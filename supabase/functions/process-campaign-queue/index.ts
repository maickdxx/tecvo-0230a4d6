/**
 * process-campaign-queue — Controlled campaign sender.
 * Processes campaign_sends queue one-by-one with rate limiting,
 * progressive scaling, error blacklisting, and randomized delays.
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { TECVO_PLATFORM_INSTANCE } from "../_shared/sendFlowTypes.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Progressive Volume Scaling ──
// Returns max sends/hour based on campaign age in days
function getProgressiveLimit(baseSendsPerHour: number, campaignStartDate: string | null): number {
  if (!campaignStartDate) return Math.min(baseSendsPerHour, 10);
  const daysSinceStart = Math.floor((Date.now() - new Date(campaignStartDate).getTime()) / 86400000);
  // Day 0-1: 25% of limit (max 5)
  // Day 2-3: 50% of limit (max 10)  
  // Day 4-6: 75% of limit (max 15)
  // Day 7+: full limit
  if (daysSinceStart <= 1) return Math.max(3, Math.min(Math.floor(baseSendsPerHour * 0.25), 5));
  if (daysSinceStart <= 3) return Math.min(Math.floor(baseSendsPerHour * 0.5), 10);
  if (daysSinceStart <= 6) return Math.min(Math.floor(baseSendsPerHour * 0.75), 15);
  return baseSendsPerHour;
}

// ── Randomized Delay ──
function getRandomInterval(minSec: number, maxSec: number): number {
  return minSec + Math.floor(Math.random() * (maxSec - minSec));
}

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

// ── Check if phone was already blacklisted (previously failed) ──
async function isPhoneBlacklisted(supabase: any, phone: string, campaignName: string): Promise<boolean> {
  const cleanPhone = phone.replace(/\D/g, "");
  // Check if this phone already failed in ANY campaign send
  const { data } = await supabase
    .from("campaign_sends")
    .select("id")
    .eq("whatsapp_status", "error")
    .limit(1);
  
  // Check specifically for this phone number across all sends
  const { data: failedSends } = await supabase
    .from("campaign_sends")
    .select("id, whatsapp_error")
    .eq("phone", phone)
    .eq("whatsapp_status", "error")
    .limit(1);
  
  if (failedSends && failedSends.length > 0) {
    const err = failedSends[0].whatsapp_error || "";
    // If the error indicates number doesn't exist on WhatsApp, blacklist it
    if (err.includes("exists\":false") || err.includes("not registered") || err.includes("Bad Request")) {
      return true;
    }
  }
  return false;
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

    // 2. Progressive volume: calculate effective limit based on campaign age
    const effectiveLimit = getProgressiveLimit(config.sends_per_hour, config.current_campaign_started_at || null);
    
    // 3. Check hourly rate limit with progressive cap
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count: sentLastHour } = await supabase
      .from("campaign_sends")
      .select("*", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("processed_at", oneHourAgo);

    if ((sentLastHour || 0) >= effectiveLimit) {
      return jsonResponse({ 
        skipped: true, reason: "rate_limit", 
        sent_last_hour: sentLastHour, 
        effective_limit: effectiveLimit,
        base_limit: config.sends_per_hour,
        scaling: effectiveLimit < config.sends_per_hour ? "progressive" : "full"
      });
    }

    // 4. Check minimum interval with RANDOMIZED delay
    const randomInterval = getRandomInterval(config.min_interval_seconds, config.max_interval_seconds);
    
    const { data: lastSent } = await supabase
      .from("campaign_sends")
      .select("processed_at")
      .eq("status", "sent")
      .order("processed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastSent?.processed_at) {
      const elapsed = (Date.now() - new Date(lastSent.processed_at).getTime()) / 1000;
      if (elapsed < randomInterval) {
        return jsonResponse({ 
          skipped: true, reason: "interval_cooldown", 
          elapsed_seconds: Math.round(elapsed),
          required_interval: randomInterval,
          next_send_in: Math.round(randomInterval - elapsed)
        });
      }
    }

    // 5. Get next pending item (order by priority DESC, then created_at ASC)
    const { data: nextItem } = await supabase
      .from("campaign_sends")
      .select("*")
      .eq("status", "pending")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!nextItem) return jsonResponse({ skipped: true, reason: "queue_empty" });

    // 6. Check if phone is blacklisted (previously failed on WA)
    let skipWhatsapp = false;
    if (nextItem.phone) {
      skipWhatsapp = await isPhoneBlacklisted(supabase, nextItem.phone, nextItem.campaign_name);
      if (skipWhatsapp) {
        console.log(`[CAMPAIGN] Phone ${nextItem.phone} blacklisted (previous WA failure), skipping WA`);
      }
    }

    // 7. Decide channels with blacklist awareness
    const channelDecision = decideChannels(
      !skipWhatsapp && nextItem.phone && vpsUrl && apiKey ? nextItem.phone : null,
      nextItem.email
    );

    // If no channel available at all, mark as failed
    if (channelDecision.primaryChannel === "none") {
      await supabase
        .from("campaign_sends")
        .update({
          status: "failed",
          whatsapp_status: skipWhatsapp ? "blacklisted" : "skipped",
          email_status: "skipped",
          whatsapp_error: skipWhatsapp ? "Number previously failed - blacklisted" : null,
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", nextItem.id);
      
      return jsonResponse({ 
        processed: { id: nextItem.id, user: nextItem.user_name, status: "failed", reason: "no_channel_available" }
      });
    }

    const now = new Date().toISOString();

    // 8. Mark as processing
    await supabase
      .from("campaign_sends")
      .update({
        status: "processing",
        primary_channel: channelDecision.primaryChannel,
        channel_decided_at: now,
        updated_at: now,
      })
      .eq("id", nextItem.id);

    console.log(`[CAMPAIGN] Processing: user=${nextItem.user_name}, phone=${nextItem.phone}, email=${nextItem.email}, primary=${channelDecision.primaryChannel}, wa_blacklisted=${skipWhatsapp}, interval=${randomInterval}s`);

    // 9. Send WhatsApp (priority channel)
    let waStatus = skipWhatsapp ? "blacklisted" : "skipped";
    let waError: string | null = skipWhatsapp ? "Number previously failed - blacklisted" : null;
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

    // 10. Send Email (always as fallback or complement)
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

    // 11. Determine final status
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
        wa_blacklisted: skipWhatsapp,
      },
      rate: { 
        sent_last_hour: (sentLastHour || 0) + (finalStatus === "sent" ? 1 : 0), 
        effective_limit: effectiveLimit,
        base_limit: config.sends_per_hour,
        interval_used: randomInterval,
      },
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
