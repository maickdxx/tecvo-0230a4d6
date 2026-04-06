/**
 * Process Message Queue — Cron-triggered function that sends queued messages.
 *
 * Runs every 5 minutes during send window hours (08:00–20:00 BRT).
 * Processes pending messages whose scheduled_for has passed.
 *
 * Features:
 * - Respects send window (double-check before sending)
 * - Distributes sends with delays to avoid bursts
 * - Integrates with sendGuard for rate limiting
 * - Retries failed messages up to max_attempts
 * - Logs all activity for monitoring
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { checkSendLimit } from "../_shared/sendGuard.ts";
import { isWithinSendWindow } from "../_shared/sendWindow.ts";
import { fetchOrgTimezone } from "../_shared/timezone.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendWhatsApp(phone: string, text: string, instanceName: string): Promise<boolean> {
  const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
  const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");
  if (!vpsUrl || !apiKey) return false;

  let cleanNumber = phone.replace(/\D/g, "");
  if (!cleanNumber.startsWith("55") && cleanNumber.length <= 11) {
    cleanNumber = "55" + cleanNumber;
  }
  const jid = cleanNumber.includes("@") ? cleanNumber : `${cleanNumber}@s.whatsapp.net`;

  try {
    const res = await fetch(`${vpsUrl}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number: jid, text }),
    });
    if (!res.ok) {
      console.error("[MSG-QUEUE] Send failed:", res.status, await res.text());
      return false;
    }
    await res.text();
    return true;
  } catch (err) {
    console.error("[MSG-QUEUE] Send error:", err);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date().toISOString();
    const BATCH_SIZE = 20;
    const DELAY_BETWEEN_SENDS_MS = 3000; // 3s between sends

    // Fetch pending messages that are due
    const { data: messages, error } = await supabase
      .from("message_send_queue")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_for", now)
      .order("scheduled_for", { ascending: true })
      .limit(BATCH_SIZE);

    if (error) {
      throw new Error(`DB error: ${error.message}`);
    }

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[MSG-QUEUE] Processing ${messages.length} queued messages`);

    let sent = 0;
    let failed = 0;
    let deferred = 0;

    // Cache org timezones to avoid repeated lookups
    const tzCache = new Map<string, string>();

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];

      // Delay between sends (skip first)
      if (i > 0) {
        await new Promise((r) => setTimeout(r, DELAY_BETWEEN_SENDS_MS));
      }

      // Get org timezone
      let orgTz = tzCache.get(msg.organization_id);
      if (!orgTz) {
        orgTz = await fetchOrgTimezone(supabase, msg.organization_id);
        tzCache.set(msg.organization_id, orgTz);
      }

      // Double-check send window (timezone may differ per org)
      if (!isWithinSendWindow(orgTz)) {
        console.log(`[MSG-QUEUE] Outside window for org ${msg.organization_id}, deferring`);
        deferred++;
        continue;
      }

      // Check send guard
      const guard = await checkSendLimit(supabase, msg.organization_id, null, msg.source_function || "queue");
      if (!guard.allowed) {
        console.log(`[MSG-QUEUE] Send guard blocked: ${guard.reason}`);
        // Don't mark as failed, just skip and retry later
        deferred++;
        continue;
      }

      // Send the message
      const ok = await sendWhatsApp(msg.phone, msg.message_content, msg.instance_name || "tecvo");

      if (ok) {
        await supabase
          .from("message_send_queue")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            attempts: msg.attempts + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", msg.id);
        sent++;
        console.log(`[MSG-QUEUE] ✅ Sent: ${msg.message_type} to ${msg.phone}`);
      } else {
        const newAttempts = msg.attempts + 1;
        const newStatus = newAttempts >= msg.max_attempts ? "failed" : "pending";

        await supabase
          .from("message_send_queue")
          .update({
            status: newStatus,
            attempts: newAttempts,
            last_error: "send_failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", msg.id);

        if (newStatus === "failed") {
          failed++;
          console.log(`[MSG-QUEUE] ❌ Failed permanently: ${msg.message_type} to ${msg.phone}`);
        } else {
          deferred++;
          console.log(`[MSG-QUEUE] ⚠️ Retry later (${newAttempts}/${msg.max_attempts}): ${msg.message_type}`);
        }
      }
    }

    console.log(`[MSG-QUEUE] Done. Sent=${sent} Failed=${failed} Deferred=${deferred}`);

    return new Response(
      JSON.stringify({ processed: messages.length, sent, failed, deferred }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[MSG-QUEUE] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
