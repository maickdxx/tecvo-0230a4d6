/**
 * process-campaign-queue — Controlled campaign sender.
 * Processes campaign_sends queue one-by-one with rate limiting.
 * Designed for re-engagement: slow, safe, no mass blast.
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { TECVO_PLATFORM_INSTANCE } from "../_shared/sendFlowTypes.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Email via Resend ──
async function sendEmail(
  to: string,
  subject: string,
  html: string,
  resendKey: string,
  fromEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({ from: fromEmail, to: [to], subject, html }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `Resend ${res.status}: ${errText}` };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

function buildEmailHtml(userName: string, bodyText: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
  <tr><td style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:24px 40px;text-align:center;">
    <h1 style="color:#ffffff;font-size:22px;margin:0;font-weight:700;">Tecvo</h1>
  </td></tr>
  <tr><td style="padding:32px 40px;">
    <p style="color:#3f3f46;font-size:15px;line-height:1.6;margin:0 0 16px;">${bodyText}</p>
    <table cellpadding="0" cellspacing="0" style="margin:24px auto;">
    <tr><td style="background:#2563eb;border-radius:8px;padding:14px 32px;">
      <a href="https://tecvo.com.br/dashboard" style="color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;">
        Acessar a Tecvo →
      </a>
    </td></tr></table>
  </td></tr>
  <tr><td style="background:#fafafa;padding:20px 40px;border-top:1px solid #e4e4e7;text-align:center;">
    <p style="color:#a1a1aa;font-size:12px;margin:0;">
      Tecvo — Gestão inteligente para empresas de serviço<br>
      <a href="https://tecvo.com.br" style="color:#2563eb;text-decoration:none;">tecvo.com.br</a>
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
  const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = "Tecvo <noreply@notify.tecvo.com.br>";

  try {
    // 1. Read campaign config
    const { data: config } = await supabase
      .from("campaign_config")
      .select("*")
      .eq("id", 1)
      .single();

    if (!config) {
      return jsonResponse({ error: "No campaign config found" }, 500);
    }

    // Check pause
    if (config.is_paused) {
      return jsonResponse({ skipped: true, reason: "campaign_paused", message: config.paused_reason });
    }

    // 2. Check hourly rate limit
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count: sentLastHour } = await supabase
      .from("campaign_sends")
      .select("*", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("processed_at", oneHourAgo);

    if ((sentLastHour || 0) >= config.sends_per_hour) {
      console.log(`[CAMPAIGN] Rate limit reached: ${sentLastHour}/${config.sends_per_hour} per hour`);
      return jsonResponse({ skipped: true, reason: "rate_limit", sent_last_hour: sentLastHour });
    }

    // 3. Check minimum interval since last send
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
        console.log(`[CAMPAIGN] Too soon: ${Math.round(elapsed)}s < ${config.min_interval_seconds}s min`);
        return jsonResponse({ skipped: true, reason: "interval_cooldown", elapsed_seconds: Math.round(elapsed) });
      }
    }

    // 4. Get next pending item (ordered by priority DESC, created_at ASC)
    const { data: nextItem } = await supabase
      .from("campaign_sends")
      .select("*")
      .eq("status", "pending")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!nextItem) {
      return jsonResponse({ skipped: true, reason: "queue_empty" });
    }

    // 5. Mark as processing
    await supabase
      .from("campaign_sends")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", nextItem.id);

    console.log(`[CAMPAIGN] Processing: user=${nextItem.user_id}, phone=${nextItem.phone}, email=${nextItem.email}`);

    // 6. Send WhatsApp
    let waStatus = "skipped";
    let waError: string | null = null;

    if (nextItem.phone && vpsUrl && apiKey) {
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
      }
    }

    // 7. Send Email
    let emailStatus = "skipped";
    let emailError: string | null = null;

    if (nextItem.email && nextItem.email_template && resendKey) {
      const subject = nextItem.email_subject || "Novidades da Tecvo";
      const bodyText = nextItem.email_template
        .replace("{{name}}", nextItem.user_name || "")
        .replace(/\n/g, "<br>");
      const html = buildEmailHtml(nextItem.user_name || "", bodyText);

      const result = await sendEmail(nextItem.email, subject, html, resendKey, fromEmail);
      emailStatus = result.success ? "sent" : "error";
      emailError = result.error || null;

      if (result.success) {
        console.log(`[CAMPAIGN] Email sent to ${nextItem.email}`);
      } else {
        console.error(`[CAMPAIGN] Email failed: ${result.error}`);
      }
    }

    // 8. Determine final status
    const finalStatus = waStatus === "sent" || emailStatus === "sent" ? "sent" : "failed";

    await supabase
      .from("campaign_sends")
      .update({
        status: finalStatus,
        whatsapp_status: waStatus,
        email_status: emailStatus,
        whatsapp_error: waError,
        email_error: emailError,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", nextItem.id);

    // 9. Random delay for next call (between min and max interval)
    const delayInfo = {
      min: config.min_interval_seconds,
      max: config.max_interval_seconds,
      next_eligible: new Date(Date.now() + config.min_interval_seconds * 1000).toISOString(),
    };

    return jsonResponse({
      success: true,
      processed: {
        id: nextItem.id,
        user: nextItem.user_name,
        whatsapp: waStatus,
        email: emailStatus,
        final: finalStatus,
      },
      rate: { sent_last_hour: (sentLastHour || 0) + (finalStatus === "sent" ? 1 : 0), limit: config.sends_per_hour },
      delay: delayInfo,
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
