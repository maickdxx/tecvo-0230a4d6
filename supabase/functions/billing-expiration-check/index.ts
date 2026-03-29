import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { resolveOwnerContact, logShieldBlocked } from "../_shared/resolveOwnerPhone.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLAN_NAMES: Record<string, string> = {
  starter: "Essencial",
  essential: "Profissional",
  pro: "Empresa",
  teste: "Teste Interno",
};

const ADMIN_EMAIL = "michaeldouglas7991@gmail.com";

const EMAIL_CONFIGS: Record<string, { type: string; subject: (planName: string) => string; heading: string; message: string; urgency: "info" | "warning" | "danger" }> = {
  "7": {
    type: "expiration_7d",
    subject: (p) => `⏳ Seu plano ${p} expira em 7 dias — Tecvo`,
    heading: "Seu plano expira em 7 dias",
    message: "Faltam 7 dias para o vencimento da sua assinatura. Garanta que você não perca acesso às ferramentas que ajudam sua empresa a crescer.",
    urgency: "info",
  },
  "3": {
    type: "expiration_3d",
    subject: (p) => `⚠️ Seu plano ${p} expira em 3 dias — Tecvo`,
    heading: "Atenção: seu plano expira em 3 dias",
    message: "Restam apenas 3 dias para a expiração do seu plano. Não deixe sua gestão parar — renove agora e continue no controle.",
    urgency: "warning",
  },
  "0": {
    type: "expiration_today",
    subject: (p) => `🚨 Seu plano ${p} expira hoje — Tecvo`,
    heading: "Seu plano expira hoje!",
    message: "Hoje é o último dia do seu plano ativo. Após o vencimento, você perderá acesso a funcionalidades essenciais. Renove agora para manter tudo funcionando.",
    urgency: "danger",
  },
  "-1": {
    type: "expiration_1d_after",
    subject: (p) => `❌ Seu plano ${p} expirou — Regularize agora | Tecvo`,
    heading: "Seu plano expirou",
    message: "Sua assinatura expirou ontem e algumas funcionalidades já estão restritas. Regularize seu pagamento agora para recuperar o acesso completo.",
    urgency: "danger",
  },
};

function buildExpirationEmailHtml(params: {
  userName: string;
  planName: string;
  orgName: string;
  heading: string;
  message: string;
  urgency: "info" | "warning" | "danger";
}): string {
  const headerBg = params.urgency === "danger"
    ? "linear-gradient(135deg,#dc2626,#b91c1c)"
    : params.urgency === "warning"
    ? "linear-gradient(135deg,#f59e0b,#d97706)"
    : "linear-gradient(135deg,#2563eb,#1d4ed8)";

  const ctaText = params.urgency === "danger" ? "Reativar meu plano agora" : "Renovar meu plano";
  const ctaBg = params.urgency === "danger" ? "#dc2626" : "#2563eb";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
  <tr><td style="background:${headerBg};padding:32px 40px;text-align:center;">
    <h1 style="color:#ffffff;font-size:24px;margin:0;font-weight:700;">Tecvo</h1>
  </td></tr>
  <tr><td style="padding:40px;">
    <h2 style="color:#18181b;font-size:20px;margin:0 0 16px;font-weight:600;">${params.heading}</h2>
    <p style="color:#3f3f46;font-size:15px;line-height:1.6;margin:0 0 8px;">
      Olá, <strong>${params.userName}</strong>,
    </p>
    <p style="color:#3f3f46;font-size:15px;line-height:1.6;margin:0 0 16px;">
      ${params.message}
    </p>
    <div style="background:#fafafa;border-radius:8px;padding:16px;margin:0 0 24px;border-left:4px solid ${ctaBg};">
      <p style="color:#3f3f46;font-size:14px;margin:0;">
        <strong>Plano:</strong> ${params.planName}<br>
        <strong>Empresa:</strong> ${params.orgName}
      </p>
    </div>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
    <tr><td style="background:${ctaBg};border-radius:8px;padding:14px 32px;">
      <a href="https://tecvo.com.br/planos" style="color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;display:inline-block;">
        ${ctaText} →
      </a>
    </td></tr></table>
    <p style="color:#71717a;font-size:13px;line-height:1.5;margin:0;">
      Se tiver qualquer dúvida, estamos aqui para ajudar. Basta acessar o suporte na plataforma ou responder este e-mail.
    </p>
  </td></tr>
  <tr><td style="background:#fafafa;padding:24px 40px;border-top:1px solid #e4e4e7;text-align:center;">
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    console.log("[BILLING-EXPIRATION] Starting expiration check...");

    // Get all orgs with active paid plans or recently expired
    const { data: orgs, error: orgsError } = await supabase
      .from("organizations")
      .select("id, name, plan, plan_expires_at, subscription_status, cancel_at_period_end")
      .not("plan", "eq", "free")
      .not("plan_expires_at", "is", null);

    if (orgsError) throw orgsError;

    // Also get recently expired orgs (plan=free but had plan_expires_at in last 2 days)
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const { data: expiredOrgs } = await supabase
      .from("organizations")
      .select("id, name, plan, plan_expires_at, subscription_status, cancel_at_period_end")
      .eq("plan", "free")
      .not("plan_expires_at", "is", null)
      .gte("plan_expires_at", twoDaysAgo.toISOString());

    const allOrgs = [...(orgs || []), ...(expiredOrgs || [])];
    const now = new Date();
    let emailsSent = 0;
    let emailsSkipped = 0;

    for (const org of allOrgs) {
      if (!org.plan_expires_at) continue;

      const expiresAt = new Date(org.plan_expires_at);
      const daysUntilExpiry = Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Check which email config matches
      let emailConfig: typeof EMAIL_CONFIGS[string] | null = null;
      if (daysUntilExpiry === 7) emailConfig = EMAIL_CONFIGS["7"];
      else if (daysUntilExpiry === 3) emailConfig = EMAIL_CONFIGS["3"];
      else if (daysUntilExpiry === 0) emailConfig = EMAIL_CONFIGS["0"];
      else if (daysUntilExpiry === -1) emailConfig = EMAIL_CONFIGS["-1"];

      if (!emailConfig) continue;

      // Check if already sent today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data: existing } = await supabase
        .from("billing_email_log")
        .select("id")
        .eq("organization_id", org.id)
        .eq("email_type", emailConfig.type)
        .gte("created_at", todayStart.toISOString())
        .limit(1);

      if (existing?.length) {
        emailsSkipped++;
        continue;
      }

      // ── Resolve SHIELDED owner contact (STRICT: only owner role, no fallback) ──
      const ownerContact = await resolveOwnerContact(supabase, org.id);

      if (!ownerContact.userId || !ownerContact.email) {
        console.log(`[BILLING-EXPIRATION] Shielded block for org ${org.id}: ${ownerContact.blockedReason}`);
        await logShieldBlocked(supabase, org.id, ownerContact, "billing_expiration", `Billing expiration notification: ${emailConfig.type}`);
        continue;
      }

      const ownerEmail = ownerContact.email;
      console.log(`[BILLING-EXPIRATION] Target: org_id=${org.id} user_id=${ownerContact.userId} role=owner function=billing-expiration-check`);

      const planName = PLAN_NAMES[org.plan] || org.plan || "Seu plano";
      const userName = ownerProfile.full_name || org.name || "Cliente";
      const subject = emailConfig.subject(planName);
      const html = buildExpirationEmailHtml({
        userName,
        planName,
        orgName: org.name,
        heading: emailConfig.heading,
        message: emailConfig.message,
        urgency: emailConfig.urgency,
      });

      const recipients = [ownerEmail];
      if (ADMIN_EMAIL && ADMIN_EMAIL !== ownerEmail) recipients.push(ADMIN_EMAIL);

      for (const email of recipients) {
        try {
          const messageId = `${emailConfig.type}-${org.id}-${email}-${new Date().toISOString().slice(0, 10)}`;
          const queuedAt = new Date().toISOString();

          const { error: enqueueError } = await supabase.rpc("enqueue_email", {
            queue_name: "transactional_emails",
            payload: {
              to: email,
              from: "Tecvo <contato@notify.tecvo.com.br>",
              sender_domain: "notify.tecvo.com.br",
              subject,
              html,
              text: `Olá ${userName}, ${emailConfig.message} Plano: ${planName}. Empresa: ${org.name}. Acesse https://tecvo.com.br/planos para regularizar sua assinatura com a Tecvo.`,
              purpose: "transactional",
              label: emailConfig.type,
              run_id: messageId,
              message_id: messageId,
              queued_at: queuedAt,
              template_name: emailConfig.type,
            },
          });

          const status = enqueueError ? "failed" : "sent";
          await supabase.from("billing_email_log").insert({
            organization_id: org.id,
            email_type: emailConfig.type,
            recipient_email: email,
            plan: org.plan,
            status,
            error_message: enqueueError?.message || null,
            metadata: { days_until_expiry: daysUntilExpiry },
          });

          if (!enqueueError) emailsSent++;
        } catch (err) {
          await supabase.from("billing_email_log").insert({
            organization_id: org.id,
            email_type: emailConfig.type,
            recipient_email: email,
            plan: org.plan,
            status: "failed",
            error_message: (err as Error).message,
          });
        }
      }
    }

    console.log(`[BILLING-EXPIRATION] Done. Sent: ${emailsSent}, Skipped: ${emailsSkipped}`);
    return new Response(JSON.stringify({ sent: emailsSent, skipped: emailsSkipped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[BILLING-EXPIRATION] Error:", (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
