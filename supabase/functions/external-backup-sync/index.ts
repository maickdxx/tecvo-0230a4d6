import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RETENTION_DAYS = 30;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Auth validation
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
      if (token !== anonKey && token !== supabaseServiceKey) {
        const userClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: { user }, error: authError } = await userClient.auth.getUser();
        if (authError || !user) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data: isAdmin } = await adminClient.rpc("is_super_admin", { _user_id: user.id });
        if (!isAdmin) {
          return new Response(JSON.stringify({ error: "Forbidden: requires super_admin" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // S3 configuration
    const s3Endpoint = Deno.env.get("EXTERNAL_S3_ENDPOINT");
    const s3Bucket = Deno.env.get("EXTERNAL_S3_BUCKET");
    const s3AccessKey = Deno.env.get("EXTERNAL_S3_ACCESS_KEY");
    const s3SecretKey = Deno.env.get("EXTERNAL_S3_SECRET_KEY");
    const s3Region = Deno.env.get("EXTERNAL_S3_REGION") || "us-east-1";

    if (!s3Endpoint || !s3Bucket || !s3AccessKey || !s3SecretKey) {
      return new Response(
        JSON.stringify({
          error: "External S3 not configured",
          required_secrets: [
            "EXTERNAL_S3_ENDPOINT",
            "EXTERNAL_S3_BUCKET",
            "EXTERNAL_S3_ACCESS_KEY",
            "EXTERNAL_S3_SECRET_KEY",
            "EXTERNAL_S3_REGION (optional, default: us-east-1)",
          ],
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Optional: target specific org
    let targetOrgId: string | null = null;
    try {
      const body = await req.json();
      targetOrgId = body?.organization_id || null;
    } catch {
      // no body = sync all
    }

    const today = new Date().toISOString().split("T")[0];
    const results: any[] = [];
    let failedCount = 0;

    // Get today's completed backup logs
    let logsQuery = adminClient
      .from("backup_logs")
      .select("*")
      .eq("status", "completed")
      .gte("started_at", `${today}T00:00:00Z`);

    if (targetOrgId) {
      logsQuery = logsQuery.eq("organization_id", targetOrgId);
    }

    const { data: backupLogs, error: logsError } = await logsQuery;

    if (logsError || !backupLogs || backupLogs.length === 0) {
      // No backups to sync — alert about potential upstream failure
      await sendAlert(adminClient, supabaseUrl, {
        type: "external_backup_no_source",
        message: `No completed internal backups found for ${today}. External sync skipped.`,
        date: today,
      });

      return new Response(
        JSON.stringify({
          message: "No completed backups found for today to sync externally",
          date: today,
          alert_sent: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    for (const log of backupLogs) {
      const orgId = log.organization_id;
      const backupPath = log.backup_path;
      const s3Key = `tecvo-backups/${orgId}/${today}.json`;

      // Check if already synced
      const { data: existing } = await adminClient
        .from("external_backup_logs")
        .select("id")
        .eq("organization_id", orgId)
        .eq("backup_date", today)
        .eq("status", "completed")
        .maybeSingle();

      if (existing) {
        results.push({ org_id: orgId, status: "skipped", reason: "already_synced_today" });
        continue;
      }

      // Create log entry
      const { data: extLog } = await adminClient
        .from("external_backup_logs")
        .insert({
          organization_id: orgId,
          backup_date: today,
          s3_key: s3Key,
          status: "uploading",
          metadata: {
            source_path: backupPath,
            record_counts: log.record_counts,
            encryption: "AES-256 (S3 SSE)",
            retention_days: RETENTION_DAYS,
          },
        })
        .select("id")
        .single();

      try {
        // Download from internal storage
        const { data: fileData, error: downloadError } = await adminClient.storage
          .from("organization-backups")
          .download(backupPath);

        if (downloadError || !fileData) {
          throw new Error(`Download failed: ${downloadError?.message}`);
        }

        const bytes = new Uint8Array(await fileData.arrayBuffer());

        // Upload to S3 with Server-Side Encryption (SSE-S3 AES-256)
        await uploadToS3WithEncryption(
          s3Endpoint, s3Bucket, s3Key, s3AccessKey, s3SecretKey, s3Region, bytes
        );

        // Update log as completed
        await adminClient
          .from("external_backup_logs")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            size_bytes: bytes.length,
          })
          .eq("id", extLog!.id);

        results.push({
          org_id: orgId,
          status: "completed",
          s3_key: s3Key,
          size_bytes: bytes.length,
          encryption: "AES-256",
        });
      } catch (err: any) {
        console.error(`[EXT-BACKUP] Failed for ${orgId}:`, err.message);
        failedCount++;

        if (extLog?.id) {
          await adminClient
            .from("external_backup_logs")
            .update({
              status: "failed",
              error_message: err.message,
              completed_at: new Date().toISOString(),
            })
            .eq("id", extLog.id);
        }

        results.push({ org_id: orgId, status: "failed", error: err.message });
      }
    }

    // === RETENTION CLEANUP ===
    const retentionResults = await cleanupExpiredBackups(
      adminClient, s3Endpoint, s3Bucket, s3AccessKey, s3SecretKey, s3Region
    );

    // === FAILURE ALERTING ===
    if (failedCount > 0) {
      await sendAlert(adminClient, supabaseUrl, {
        type: "external_backup_failed",
        message: `${failedCount} external backup(s) failed on ${today}`,
        date: today,
        failed_orgs: results.filter(r => r.status === "failed").map(r => r.org_id),
        errors: results.filter(r => r.status === "failed").map(r => r.error),
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced: results,
        total: results.length,
        failed: failedCount,
        date: today,
        encryption: "AES-256 (SSE-S3)",
        retention: retentionResults,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[EXT-BACKUP] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: "Internal error in external backup sync" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// === S3 Upload with SSE (AES-256 server-side encryption) ===
async function uploadToS3WithEncryption(
  endpoint: string,
  bucket: string,
  key: string,
  accessKey: string,
  secretKey: string,
  region: string,
  data: Uint8Array
): Promise<void> {
  const dateStamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const shortDate = dateStamp.substring(0, 8);

  const s3Url = `${endpoint.replace(/\/$/, "")}/${bucket}/${key}`;
  const payloadHash = await sha256Hex(data);
  const parsedUrl = new URL(s3Url);
  const canonicalUri = parsedUrl.pathname;
  const host = parsedUrl.host;

  const headers: Record<string, string> = {
    host,
    "x-amz-date": dateStamp,
    "x-amz-content-sha256": payloadHash,
    "x-amz-server-side-encryption": "AES256",
    "content-type": "application/json",
    "content-length": data.length.toString(),
  };

  const signedHeaderKeys = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((k) => `${k}:${headers[k]}`)
    .join("\n") + "\n";

  const canonicalRequest = [
    "PUT",
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaderKeys,
    payloadHash,
  ].join("\n");

  const credentialScope = `${shortDate}/${region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    dateStamp,
    credentialScope,
    await sha256Hex(new TextEncoder().encode(canonicalRequest)),
  ].join("\n");

  const signingKey = await getSignatureKey(secretKey, shortDate, region, "s3");
  const signature = await hmacHex(signingKey, stringToSign);

  const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaderKeys}, Signature=${signature}`;

  const uploadResponse = await fetch(s3Url, {
    method: "PUT",
    headers: { ...headers, Authorization: authorizationHeader },
    body: data,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`S3 upload failed (${uploadResponse.status}): ${errorText}`);
  }
  await uploadResponse.text();
}

// === S3 DELETE helper ===
async function deleteFromS3(
  endpoint: string,
  bucket: string,
  key: string,
  accessKey: string,
  secretKey: string,
  region: string
): Promise<boolean> {
  const dateStamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const shortDate = dateStamp.substring(0, 8);

  const s3Url = `${endpoint.replace(/\/$/, "")}/${bucket}/${key}`;
  const payloadHash = await sha256Hex(new Uint8Array(0));
  const parsedUrl = new URL(s3Url);
  const canonicalUri = parsedUrl.pathname;
  const host = parsedUrl.host;

  const headers: Record<string, string> = {
    host,
    "x-amz-date": dateStamp,
    "x-amz-content-sha256": payloadHash,
  };

  const signedHeaderKeys = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((k) => `${k}:${headers[k]}`)
    .join("\n") + "\n";

  const canonicalRequest = ["DELETE", canonicalUri, "", canonicalHeaders, signedHeaderKeys, payloadHash].join("\n");
  const credentialScope = `${shortDate}/${region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", dateStamp, credentialScope, await sha256Hex(new TextEncoder().encode(canonicalRequest))].join("\n");

  const signingKey = await getSignatureKey(secretKey, shortDate, region, "s3");
  const signature = await hmacHex(signingKey, stringToSign);
  const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaderKeys}, Signature=${signature}`;

  const resp = await fetch(s3Url, {
    method: "DELETE",
    headers: { ...headers, Authorization: authorizationHeader },
  });
  await resp.text();
  return resp.ok || resp.status === 204;
}

// === RETENTION: Clean up backups older than RETENTION_DAYS ===
async function cleanupExpiredBackups(
  adminClient: any,
  s3Endpoint: string,
  s3Bucket: string,
  s3AccessKey: string,
  s3SecretKey: string,
  s3Region: string
): Promise<{ deleted: number; errors: number }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
  const cutoffStr = cutoffDate.toISOString().split("T")[0];

  // Find expired external backup logs
  const { data: expired } = await adminClient
    .from("external_backup_logs")
    .select("id, s3_key, organization_id, backup_date")
    .eq("status", "completed")
    .lt("backup_date", cutoffStr)
    .limit(100);

  if (!expired || expired.length === 0) {
    return { deleted: 0, errors: 0 };
  }

  let deleted = 0;
  let errors = 0;

  for (const record of expired) {
    try {
      const success = await deleteFromS3(
        s3Endpoint, s3Bucket, record.s3_key, s3AccessKey, s3SecretKey, s3Region
      );

      if (success) {
        // Mark as expired/cleaned in the log
        await adminClient
          .from("external_backup_logs")
          .update({ status: "expired", metadata: { expired_at: new Date().toISOString(), retention_days: RETENTION_DAYS } })
          .eq("id", record.id);
        deleted++;
      } else {
        errors++;
      }
    } catch (err: any) {
      console.error(`[RETENTION] Failed to delete ${record.s3_key}:`, err.message);
      errors++;
    }
  }

  console.log(`[RETENTION] Cleaned ${deleted} expired backups (cutoff: ${cutoffStr}), ${errors} errors`);
  return { deleted, errors };
}

// === ALERTING: Send failure notifications ===
async function sendAlert(
  adminClient: any,
  supabaseUrl: string,
  alertData: Record<string, any>
): Promise<void> {
  try {
    // Log to platform_admin_notifications
    await adminClient.from("platform_admin_notifications").insert({
      notification_type: "external_backup_alert",
      title: `🔴 Backup externo: ${alertData.message}`,
      metadata: alertData,
    });

    // Also try to notify via admin-notify edge function
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    try {
      await fetch(`${supabaseUrl}/functions/v1/admin-notify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          type: "external_backup_alert",
          ...alertData,
        }),
      });
    } catch {
      // Best-effort alerting
    }
  } catch (err: any) {
    console.error("[ALERT] Failed to send alert:", err.message);
  }
}

// === AWS Signature V4 helpers ===
async function hmac(key: ArrayBuffer | Uint8Array, data: string | Uint8Array): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key instanceof Uint8Array ? key : new Uint8Array(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const encoded = typeof data === "string" ? new TextEncoder().encode(data) : data;
  return crypto.subtle.sign("HMAC", cryptoKey, encoded);
}

async function hmacHex(key: ArrayBuffer, data: string): Promise<string> {
  const sig = await hmac(key, data);
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getSignatureKey(
  key: string,
  dateStamp: string,
  region: string,
  service: string
): Promise<ArrayBuffer> {
  const kDate = await hmac(new TextEncoder().encode("AWS4" + key), dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}
