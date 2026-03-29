/**
 * process-campaign-queue — Controlled campaign sender.
 * Processes campaign_sends queue one-by-one with rate limiting.
 * Channel priority: WhatsApp first, then email. Both if available.
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { TECVO_PLATFORM_INSTANCE } from "../_shared/sendFlowTypes.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Channel Decision ──
function decideChannels(phone: string | null, email: string | null): {
  primaryChannel: "whatsapp" | "email" | "none";
  sendWhatsapp: boolean;
  sendEmail: boolean;
} {
  const hasWhatsapp = !!phone;
  const hasEmail = !!email;

  if (hasWhatsapp && hasEmail) {
    return { primaryChannel: "whatsapp", sendWhatsapp: true, sendEmail: true };
  }
  if (hasWhatsapp) {
    return { primaryChannel: "whatsapp", sendWhatsapp: true, sendEmail: false };
  }
  if (hasEmail) {
    return { primaryChannel: "email", sendWhatsapp: false, sendEmail: true };
  }
  return { primaryChannel: "none", sendWhatsapp: false, sendEmail: false };
}

// ── Email via Lovable Transactional Email System ──
async function sendCampaignEmail(
  supabase: any,
  to: string,
  subject: string,
  userName: string,
  bodyText: string,
  campaignSendId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "campaign_recovery",
        recipientEmail: to,
        idempotencyKey: `campaign-recovery-${campaignSendId}`,
        templateData: {
          userName,
          bodyText: bodyText.replace(/\n/g, "<br>"),
          emailSubject: subject,
        },
      },
    });

    if (error) {
      return { success: false, error: error.message || String(error) };
    }
    if (data?.error) {
      return { success: false, error: data.error };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
  const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");

  try {
    // 1. Read campaign config
    const { data: config } = await supabase
      .from("campaign_config")
      .select("*")
      .eq("id", 1)
      .single();

    if (!config) return jsonResponse({ error: "No campaign config found" }, 500);
    if (config.is_paused) return jsonResponse({ skipped: true, reason: "campaign_paused" });

    // 2. Check hourly rate limit
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count: sentLastHour } = await supabase
      .from("campaign_sends")
      .select("*", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("processed_at", oneHourAgo);

    if ((sentLastHour || 0) >= config.sends_per_hour) {
      return jsonResponse({ skipped: true, reason: "rate_limit", sent_last_hour: sentLastHour });
    }

    // 3. Check minimum interval
    const { data: lastSent } = await supabase
      .from("campaign_sends")
      .select("processed_at")
      .eq("status", "sent")
      .order("processed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastSent?.processed_at) {
      const elapsed = (Date.now() - new Date(lastSent.processed_at).getTime()) / 1000;
      if (elapsed < config.min_interval_seconds) {
        return jsonResponse({ skipped: true, reason: "interval_cooldown", elapsed_seconds: Math.round(elapsed) });
      }
    }

    // 4. Get next pending item
    const { data: nextItem } = await supabase
      .from("campaign_sends")
      .select("*")
      .eq("status", "pending")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!nextItem) return jsonResponse({ skipped: true, reason: "queue_empty" });

    // 5. Decide channels BEFORE processing
    const channelDecision = decideChannels(
      nextItem.phone && vpsUrl && apiKey ? nextItem.phone : null,
      nextItem.email,
      nextItem.email_template
    );

    const now = new Date().toISOString();

    // 6. Mark as processing with channel decision
    await supabase
      .from("campaign_sends")
      .update({
        status: "processing",
        primary_channel: channelDecision.primaryChannel,
        channel_decided_at: now,
        updated_at: now,
      })
      .eq("id", nextItem.id);

    console.log(`[CAMPAIGN] Processing: user=${nextItem.user_name}, phone=${nextItem.phone}, email=${nextItem.email}, primary=${channelDecision.primaryChannel}`);

    // 7. Send WhatsApp (priority channel)
    let waStatus = "skipped";
    let waError: string | null = null;
    let waSentAt: string | null = null;

    if (channelDecision.sendWhatsapp && nextItem.phone && vpsUrl && apiKey) {
      try {
        let cleanNumber = nextItem.phone.replace(/\D/g, "");
        if (!cleanNumber.startsWith("55") && cleanNumber.length <= 11) {
          cleanNumber = "55" + cleanNumber;
        }
        const jid = `${cleanNumber}@s.whatsapp.net`;
        const message = nextItem.message_template.replace("{{name}}", nextItem.user_name || "");

        const res = await fetch(`${vpsUrl}/message/sendText/${TECVO_PLATFORM_INSTANCE}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: apiKey },
          body: JSON.stringify({ number: jid, text: message }),
        });

        waSentAt = new Date().toISOString();
        if (res.ok) {
          waStatus = "sent";
          console.log(`[CAMPAIGN] WhatsApp sent to ${nextItem.phone}`);
        } else {
          waStatus = "error";
          waError = await res.text();
          console.error(`[CAMPAIGN] WhatsApp failed: ${res.status} ${waError}`);
        }
      } catch (err: any) {
        waStatus = "error";
        waError = err.message;
        waSentAt = new Date().toISOString();
      }
    }

    // 8. Send Email
    let emailStatus = "skipped";
    let emailError: string | null = null;
    let emailSentAt: string | null = null;

    if (channelDecision.sendEmail && nextItem.email) {
      const subject = nextItem.email_subject || "Novidades da Tecvo";
      const bodyText = (nextItem.email_template || nextItem.message_template)
        .replace("{{name}}", nextItem.user_name || "");

      const result = await sendCampaignEmail(
        supabase,
        nextItem.email,
        subject,
        nextItem.user_name || "",
        bodyText,
        nextItem.id
      );
      emailSentAt = new Date().toISOString();
      emailStatus = result.success ? "sent" : "error";
      emailError = result.error || null;

      if (result.success) {
        console.log(`[CAMPAIGN] Email enqueued for ${nextItem.email}`);
      } else {
        console.error(`[CAMPAIGN] Email failed: ${result.error}`);
      }
    }

    // 9. Determine final status
    const finalStatus = waStatus === "sent" || emailStatus === "sent" ? "sent" : "failed";

    await supabase
      .from("campaign_sends")
      .update({
        status: finalStatus,
        whatsapp_status: waStatus,
        email_status: emailStatus,
        whatsapp_error: waError,
        email_error: emailError,
        whatsapp_sent_at: waSentAt,
        email_sent_at: emailSentAt,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", nextItem.id);

    return jsonResponse({
      success: true,
      processed: {
        id: nextItem.id,
        user: nextItem.user_name,
        phone: nextItem.phone,
        email: nextItem.email,
        primary_channel: channelDecision.primaryChannel,
        whatsapp: waStatus,
        email: emailStatus,
        final: finalStatus,
      },
      rate: { sent_last_hour: (sentLastHour || 0) + (finalStatus === "sent" ? 1 : 0), limit: config.sends_per_hour },
    });
  } catch (error: any) {
    console.error("[CAMPAIGN] Critical error:", error);
    return jsonResponse({ error: error.message }, 500);
  }
});

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
