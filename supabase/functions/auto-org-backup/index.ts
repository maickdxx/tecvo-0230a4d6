import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BACKUP_TABLES = [
  "clients",
  "services",
  "service_items",
  "service_payments",
  "service_equipment",
  "service_photos",
  "transactions",
  "financial_accounts",
  "time_clock_entries",
  "profiles",
  "whatsapp_contacts",
  "whatsapp_messages",
] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Optional: backup a single org (from request body or cron runs all)
    let targetOrgId: string | null = null;
    try {
      const body = await req.json();
      targetOrgId = body?.organization_id || null;
    } catch {
      // No body = backup all orgs
    }

    // Get organizations to backup
    let orgsQuery = adminClient.from("organizations").select("id, name");
    if (targetOrgId) {
      orgsQuery = orgsQuery.eq("id", targetOrgId);
    }
    const { data: orgs, error: orgsError } = await orgsQuery;

    if (orgsError || !orgs) {
      console.error("[BACKUP] Failed to fetch orgs:", orgsError);
      return new Response(JSON.stringify({ error: "Failed to fetch organizations" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];
    const today = new Date().toISOString().split("T")[0];

    for (const org of orgs) {
      const orgId = org.id;
      const backupPath = `${orgId}/${today}.json`;

      // Check if backup already exists today
      const { data: existing } = await adminClient
        .from("backup_logs")
        .select("id")
        .eq("organization_id", orgId)
        .eq("status", "completed")
        .gte("started_at", `${today}T00:00:00Z`)
        .maybeSingle();

      if (existing) {
        results.push({ org_id: orgId, status: "skipped", reason: "already_backed_up_today" });
        continue;
      }

      // Create log entry
      const { data: logEntry } = await adminClient
        .from("backup_logs")
        .insert({
          organization_id: orgId,
          backup_path: backupPath,
          status: "running",
          tables_included: [...BACKUP_TABLES],
        })
        .select("id")
        .single();

      try {
        const backupData: Record<string, any> = {
          metadata: {
            organization_id: orgId,
            organization_name: org.name,
            backup_date: new Date().toISOString(),
            tables: BACKUP_TABLES,
          },
        };
        const recordCounts: Record<string, number> = {};

        // Fetch data from each table with pagination
        for (const table of BACKUP_TABLES) {
          try {
            const allRows: any[] = [];
            let from = 0;
            const pageSize = 1000;
            let hasMore = true;

            while (hasMore) {
              const { data, error } = await adminClient
                .from(table)
                .select("*")
                .eq("organization_id", orgId)
                .range(from, from + pageSize - 1);

              if (error) {
                console.error(`[BACKUP] Error fetching ${table} for ${orgId}:`, error.message);
                backupData[table] = { error: error.message };
                recordCounts[table] = 0;
                break;
              }

              if (data && data.length > 0) {
                allRows.push(...data);
                from += pageSize;
                hasMore = data.length === pageSize;
              } else {
                hasMore = false;
              }
            }

            if (!backupData[table]?.error) {
              backupData[table] = allRows;
              recordCounts[table] = allRows.length;
            }
          } catch (tableErr: any) {
            console.error(`[BACKUP] Exception on ${table}:`, tableErr.message);
            backupData[table] = { error: tableErr.message };
            recordCounts[table] = 0;
          }
        }

        // Upload to storage
        const jsonContent = JSON.stringify(backupData);
        const encoder = new TextEncoder();
        const bytes = encoder.encode(jsonContent);

        const { error: uploadError } = await adminClient.storage
          .from("organization-backups")
          .upload(backupPath, bytes, {
            contentType: "application/json",
            upsert: true,
          });

        if (uploadError) {
          throw new Error(`Upload failed: ${uploadError.message}`);
        }

        // Update log
        await adminClient
          .from("backup_logs")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            record_counts: recordCounts,
            size_bytes: bytes.length,
          })
          .eq("id", logEntry!.id);

        results.push({
          org_id: orgId,
          status: "completed",
          records: recordCounts,
          size_bytes: bytes.length,
        });
      } catch (err: any) {
        console.error(`[BACKUP] Failed for org ${orgId}:`, err.message);

        if (logEntry?.id) {
          await adminClient
            .from("backup_logs")
            .update({
              status: "failed",
              error_message: err.message,
              completed_at: new Date().toISOString(),
            })
            .eq("id", logEntry.id);
        }

        results.push({ org_id: orgId, status: "failed", error: err.message });
      }
    }

    return new Response(
      JSON.stringify({ success: true, backups: results, total: results.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[BACKUP] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno no backup" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
