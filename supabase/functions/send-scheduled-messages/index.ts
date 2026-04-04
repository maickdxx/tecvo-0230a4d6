/**
 * ── SEND FLOW: CUSTOMER_CONVERSATION ──
 * Sends scheduled messages within existing customer conversations.
 * STRICT channel isolation: uses ONLY the channel stored on the scheduled message.
 * NO fallback to any other channel or instance. Disconnected channel → BLOCK.
 * Business hours enforcement: messages outside org business hours are skipped (wait for next cycle).
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { checkSendLimit } from "../_shared/sendGuard.ts";
import { fetchOrgTimezone } from "../_shared/timezone.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalizePhone(input: string): string {
  const beforeAt = input.split("@")[0];
  return beforeAt.replace(/\D/g, "");
}

/**
 * Get the current hour in a given IANA timezone.
 */
function getCurrentHourInTz(tz: string): number {
  const timeStr = new Date().toLocaleTimeString("en-US", {
    timeZone: tz,
    hour12: false,
    hour: "2-digit",
  });
  return parseInt(timeStr, 10);
}

/** Default business hours (used if org has no config) */
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 18;

/** Cache for org business hours config */
interface BusinessHoursConfig {
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
  worksSaturday: boolean;
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

    // Fetch due scheduled messages
    const { data: dueMessages, error: fetchError } = await supabase
      .from("whatsapp_scheduled_messages")
      .select("*, contact:contact_id(id, phone, whatsapp_id, normalized_phone, organization_id, source), channel:channel_id(id, instance_name, organization_id, is_connected, channel_status)")
      .eq("status", "scheduled")
      .lte("scheduled_at", new Date().toISOString())
      .limit(50);

    if (fetchError) {
      console.error("[SCHEDULED-SEND] Fetch error:", fetchError);
      return new Response(JSON.stringify({ error: "Fetch error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!dueMessages || dueMessages.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[SCHEDULED-SEND] Processing ${dueMessages.length} scheduled messages`);

    const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
    const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");
    let sent = 0;
    let errors = 0;
    let skippedHours = 0;

    // Cache org business hours
    const orgBhCache: Record<string, BusinessHoursConfig> = {};

    async function getBusinessHours(supabase: any, orgId: string): Promise<BusinessHoursConfig> {
      if (orgBhCache[orgId]) return orgBhCache[orgId];
      const { data: capConfig } = await supabase
        .from("operational_capacity_config")
        .select("start_time, end_time, works_saturday")
        .eq("organization_id", orgId)
        .maybeSingle();

      const config: BusinessHoursConfig = {
        startHour: DEFAULT_START_HOUR,
        startMin: 0,
        endHour: DEFAULT_END_HOUR,
        endMin: 0,
        worksSaturday: false,
      };

      if (capConfig) {
        const cap = capConfig as any;
        if (cap.start_time) {
          const [sh, sm] = cap.start_time.split(":").map(Number);
          config.startHour = sh;
          config.startMin = sm || 0;
        }
        if (cap.end_time) {
          const [eh, em] = cap.end_time.split(":").map(Number);
          config.endHour = eh;
          config.endMin = em || 0;
        }
        config.worksSaturday = cap.works_saturday ?? false;
      }

      orgBhCache[orgId] = config;
      return config;
    }

    for (const msg of dueMessages) {
      try {
        const contact = msg.contact as any;
        const channel = msg.channel as any;

        if (!contact || !channel) {
          await supabase.from("whatsapp_scheduled_messages").update({
            status: "error",
            error_message: "Contact or channel not found",
            updated_at: new Date().toISOString(),
          }).eq("id", msg.id);
          errors++;
          continue;
        }

        // Business hours check using org timezone and real config
        const orgId = contact.organization_id;
        const orgTz = await fetchOrgTimezone(supabase, orgId);
        const bh = await getBusinessHours(supabase, orgId);

        const now = new Date();
        const nowStr = now.toLocaleTimeString("en-US", { timeZone: orgTz, hour12: false, hour: "2-digit", minute: "2-digit" });
        const [currentH, currentM] = nowStr.split(":").map(Number);
        const currentMinutes = currentH * 60 + currentM;
        const startMinutes = bh.startHour * 60 + bh.startMin;
        const endMinutes = bh.endHour * 60 + bh.endMin;

        // Get day of week in org timezone
        const localDateStr = now.toLocaleDateString("en-CA", { timeZone: orgTz });
        const localDate = new Date(localDateStr + "T12:00:00Z"); // safe midday parse
        const dayOfWeek = localDate.getUTCDay(); // 0=Sun, 6=Sat
        const isSunday = dayOfWeek === 0;
        const isSaturday = dayOfWeek === 6;
        const isWorkday = !isSunday && (!isSaturday || bh.worksSaturday);
        const isWithinHours = isWorkday && currentMinutes >= startMinutes && currentMinutes < endMinutes;

        if (!isWithinHours) {
          console.log(`[SCHEDULED-SEND] Message ${msg.id} skipped: outside business hours (${currentH}:${currentM} in ${orgTz}, hours: ${bh.startHour}:${bh.startMin}-${bh.endHour}:${bh.endMin})`);
          skippedHours++;
          continue;
        }

        // STRICT: Validate channel is connected — no fallback to other channels
        if (!channel.is_connected || channel.channel_status !== "connected" || !channel.instance_name) {
          console.warn(`[SCHEDULED-SEND] Channel ${channel.id} disconnected (status: ${channel.channel_status}). Blocking scheduled message ${msg.id} — no fallback.`);
          await supabase.from("whatsapp_scheduled_messages").update({
            status: "error",
            error_message: `Canal desconectado (${channel.channel_status || "unknown"}). Reconecte para enviar.`,
            updated_at: new Date().toISOString(),
          }).eq("id", msg.id);
          errors++;
          continue;
        }

        const isWebchat = contact.source === "webchat" || (contact.whatsapp_id || "").startsWith("webchat-");
        const messageId = `out_sched_${crypto.randomUUID()}`;

        // Send guard check
        const guard = await checkSendLimit(supabase, contact.organization_id, contact.id, "scheduled");
        if (!guard.allowed) {
          console.warn(`[SCHEDULED-SEND] Message ${msg.id} blocked by send guard: ${guard.reason}`);
          await supabase.from("whatsapp_scheduled_messages").update({
            status: "error",
            error_message: `Blocked: ${guard.reason} — ${guard.detail}`,
            updated_at: new Date().toISOString(),
          }).eq("id", msg.id);
          errors++;
          continue;
        }

        if (isWebchat) {
          // Save directly for webchat
          await supabase.from("whatsapp_messages").insert({
            organization_id: contact.organization_id,
            contact_id: contact.id,
            message_id: messageId,
            content: msg.content,
            is_from_me: true,
            status: "sent",
            channel_id: channel.id,
            timestamp: new Date().toISOString(),
          });
        } else {
          // Send via Evolution API
          if (!vpsUrl || !apiKey) {
            await supabase.from("whatsapp_scheduled_messages").update({
              status: "error",
              error_message: "WhatsApp API not configured",
              updated_at: new Date().toISOString(),
            }).eq("id", msg.id);
            errors++;
            continue;
          }

          const digits = contact.normalized_phone || normalizePhone(contact.phone || contact.whatsapp_id || "");
          if (!digits) {
            await supabase.from("whatsapp_scheduled_messages").update({
              status: "error",
              error_message: "No phone number",
              updated_at: new Date().toISOString(),
            }).eq("id", msg.id);
            errors++;
            continue;
          }

          const recipientJid = `${digits}@s.whatsapp.net`;
          const evoResponse = await fetch(`${vpsUrl}/message/sendText/${channel.instance_name}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: apiKey },
            body: JSON.stringify({ number: recipientJid, text: msg.content }),
          });

          if (!evoResponse.ok) {
            const errText = await evoResponse.text();
            console.error(`[SCHEDULED-SEND] API error for ${msg.id}:`, errText);
            await supabase.from("whatsapp_scheduled_messages").update({
              status: "error",
              error_message: `API error: ${evoResponse.status}`,
              updated_at: new Date().toISOString(),
            }).eq("id", msg.id);
            errors++;
            continue;
          }
          await evoResponse.text();

          // Save message
          await supabase.from("whatsapp_messages").insert({
            organization_id: contact.organization_id,
            contact_id: contact.id,
            message_id: messageId,
            content: msg.content,
            is_from_me: true,
            status: "sent",
            channel_id: channel.id,
            timestamp: new Date().toISOString(),
          });
        }

        // Update contact last message
        const { data: currentContactData } = await supabase
          .from("whatsapp_contacts")
          .select("conversation_status")
          .eq("id", contact.id)
          .single();
        const currentStatus = currentContactData?.conversation_status || "novo";
        const contactUpdate: Record<string, any> = {
          last_message_at: new Date().toISOString(),
          last_message_content: msg.content.substring(0, 200),
          last_message_is_from_me: true,
        };
        // Only transition "novo" to "atendendo" — do NOT reopen finalized conversations with automated messages
        if (currentStatus === "novo") {
          contactUpdate.conversation_status = "atendendo";
        }
        await supabase.from("whatsapp_contacts").update(contactUpdate).eq("id", contact.id);

        // Mark as sent
        await supabase.from("whatsapp_scheduled_messages").update({
          status: "sent",
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", msg.id);

        sent++;
        console.log(`[SCHEDULED-SEND] Sent message ${msg.id} to contact ${contact.id}`);
      } catch (err) {
        console.error(`[SCHEDULED-SEND] Error processing ${msg.id}:`, err);
        await supabase.from("whatsapp_scheduled_messages").update({
          status: "error",
          error_message: String(err),
          updated_at: new Date().toISOString(),
        }).eq("id", msg.id);
        errors++;
      }
    }

    console.log(`[SCHEDULED-SEND] Done: ${sent} sent, ${errors} errors, ${skippedHours} skipped (business hours)`);
    return new Response(JSON.stringify({ processed: dueMessages.length, sent, errors, skipped_business_hours: skippedHours }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[SCHEDULED-SEND] Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
