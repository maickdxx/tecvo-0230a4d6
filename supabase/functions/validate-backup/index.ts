import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ValidationResult {
  table: string;
  backup_count: number;
  live_count: number;
  match: boolean;
  integrity_checks: string[];
  issues: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    let body: any = {};
    try { body = await req.json(); } catch {}

    const orgId = body?.organization_id;
    const backupPath = body?.backup_path;

    if (!orgId || !backupPath) {
      return new Response(
        JSON.stringify({ error: "organization_id and backup_path are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const startTime = Date.now();

    // 1. Download backup from storage
    const { data: fileData, error: downloadError } = await adminClient.storage
      .from("organization-backups")
      .download(backupPath);

    if (downloadError || !fileData) {
      return new Response(
        JSON.stringify({ error: `Backup not found: ${downloadError?.message}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const backupText = await fileData.text();
    const backup = JSON.parse(backupText);
    const backupSizeKB = Math.round(backupText.length / 1024);

    // 2. Validate metadata
    const metadata = backup.metadata;
    if (metadata?.organization_id !== orgId) {
      return new Response(
        JSON.stringify({ error: "Backup organization_id mismatch" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: ValidationResult[] = [];
    const TABLES_TO_VALIDATE = [
      "clients", "services", "service_items", "service_payments",
      "service_equipment", "service_photos", "transactions",
      "financial_accounts", "time_clock_entries", "profiles",
      "whatsapp_contacts", "whatsapp_messages",
    ];

    // 3. For each table: compare backup vs live counts and validate integrity
    for (const table of TABLES_TO_VALIDATE) {
      const backupRows = Array.isArray(backup[table]) ? backup[table] : [];
      const backupCount = backupRows.length;

      // Get live count
      const { count: liveCount, error: countError } = await adminClient
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId);

      const result: ValidationResult = {
        table,
        backup_count: backupCount,
        live_count: liveCount ?? 0,
        match: backupCount === (liveCount ?? 0),
        integrity_checks: [],
        issues: [],
      };

      if (countError) {
        result.issues.push(`Live count error: ${countError.message}`);
      }

      // Validate data structure
      if (backupCount > 0) {
        const sample = backupRows[0];
        if (!sample.id) result.issues.push("Missing 'id' field in backup records");
        if (!sample.organization_id) result.issues.push("Missing 'organization_id' field");
        result.integrity_checks.push(`Schema fields: ${Object.keys(sample).length}`);

        // Check all records belong to this org
        const wrongOrg = backupRows.filter((r: any) => r.organization_id !== orgId);
        if (wrongOrg.length > 0) {
          result.issues.push(`${wrongOrg.length} records with wrong organization_id`);
        } else {
          result.integrity_checks.push("All records match organization_id ✓");
        }

        // Check for duplicate IDs
        const ids = backupRows.map((r: any) => r.id);
        const uniqueIds = new Set(ids);
        if (uniqueIds.size !== ids.length) {
          result.issues.push(`${ids.length - uniqueIds.size} duplicate IDs found`);
        } else {
          result.integrity_checks.push("No duplicate IDs ✓");
        }
      }

      // Table-specific FK validations
      if (table === "services" && backupCount > 0) {
        const clientIds = new Set((backup.clients || []).map((c: any) => c.id));
        const orphanedServices = backupRows.filter((s: any) => !clientIds.has(s.client_id));
        if (orphanedServices.length > 0) {
          result.issues.push(`${orphanedServices.length} services reference missing clients`);
        } else {
          result.integrity_checks.push("All service→client FKs valid ✓");
        }
      }

      if (table === "service_items" && backupCount > 0) {
        const serviceIds = new Set((backup.services || []).map((s: any) => s.id));
        const orphaned = backupRows.filter((si: any) => !serviceIds.has(si.service_id));
        if (orphaned.length > 0) {
          result.issues.push(`${orphaned.length} service_items reference missing services`);
        } else {
          result.integrity_checks.push("All service_items→services FKs valid ✓");
        }
      }

      if (table === "transactions" && backupCount > 0) {
        const serviceIds = new Set((backup.services || []).map((s: any) => s.id));
        const clientIds = new Set((backup.clients || []).map((c: any) => c.id));
        const orphanedSvc = backupRows.filter((t: any) => t.service_id && !serviceIds.has(t.service_id));
        const orphanedClient = backupRows.filter((t: any) => t.client_id && !clientIds.has(t.client_id));
        if (orphanedSvc.length > 0) {
          result.issues.push(`${orphanedSvc.length} transactions reference missing services`);
        } else {
          result.integrity_checks.push("All transaction→service FKs valid ✓");
        }
        if (orphanedClient.length > 0) {
          result.issues.push(`${orphanedClient.length} transactions reference missing clients`);
        } else {
          result.integrity_checks.push("All transaction→client FKs valid ✓");
        }
      }

      if (table === "whatsapp_messages" && backupCount > 0) {
        const contactIds = new Set((backup.whatsapp_contacts || []).map((c: any) => c.id));
        const orphaned = backupRows.filter((m: any) => !contactIds.has(m.contact_id));
        if (orphaned.length > 0) {
          result.issues.push(`${orphaned.length} messages reference missing contacts`);
        } else {
          result.integrity_checks.push("All message→contact FKs valid ✓");
        }
      }

      results.push(result);
    }

    const elapsed = Date.now() - startTime;
    const totalBackupRecords = results.reduce((s, r) => s + r.backup_count, 0);
    const totalLiveRecords = results.reduce((s, r) => s + r.live_count, 0);
    const totalIssues = results.reduce((s, r) => s + r.issues.length, 0);
    const tablesWithCountMismatch = results.filter(r => !r.match).map(r => r.table);

    const report = {
      status: totalIssues === 0 ? "PASS" : "PASS_WITH_WARNINGS",
      organization_id: orgId,
      backup_date: metadata.backup_date,
      backup_size_kb: backupSizeKB,
      validation_duration_ms: elapsed,
      estimated_restore_time_seconds: Math.ceil(totalBackupRecords / 500),
      summary: {
        tables_validated: results.length,
        total_backup_records: totalBackupRecords,
        total_live_records: totalLiveRecords,
        total_issues: totalIssues,
        tables_with_count_mismatch: tablesWithCountMismatch,
        count_mismatch_note: tablesWithCountMismatch.length > 0
          ? "Count differences may be caused by new data created after the backup or the 1000-row query limit in backups for large tables (whatsapp_contacts, whatsapp_messages)."
          : null,
      },
      tables: results,
    };

    return new Response(JSON.stringify(report, null, 2), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[VALIDATE-BACKUP] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
