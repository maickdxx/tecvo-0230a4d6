import { createClient } from "npm:@supabase/supabase-js@2.57.2";

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
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = "Tecvo <contato@tecvo.com.br>";

function buildPurchaseEmailHtml(params: {
  userName: string;
  planName: string;
  orgName: string;
}): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
  <tr><td style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:32px 40px;text-align:center;">
    <h1 style="color:#ffffff;font-size:24px;margin:0;font-weight:700;">Tecvo</h1>
    <p style="color:rgba(255,255,255,0.85);font-size:14px;margin:8px 0 0;">Gestão inteligente para empresas de serviço</p>
  </td></tr>
  <tr><td style="padding:40px;">
    <h2 style="color:#18181b;font-size:20px;margin:0 0 16px;font-weight:600;">🎉 Bem-vindo(a) à Tecvo, ${params.userName}!</h2>
    <p style="color:#3f3f46;font-size:15px;line-height:1.6;margin:0 0 16px;">
      Sua assinatura do plano <strong style="color:#2563eb;">${params.planName}</strong> foi confirmada com sucesso para <strong>${params.orgName}</strong>.
    </p>
    <p style="color:#3f3f46;font-size:15px;line-height:1.6;margin:0 0 16px;">
      A partir de agora, você tem acesso completo a todas as ferramentas que vão ajudar você a organizar seus serviços, gerenciar sua equipe e fazer sua empresa crescer.
    </p>
    <p style="color:#3f3f46;font-size:15px;line-height:1.6;margin:0 0 24px;">
      Estamos juntos nessa jornada de crescimento. Se precisar de qualquer ajuda, nossa equipe está pronta para te apoiar.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
    <tr><td style="background:#2563eb;border-radius:8px;padding:14px 32px;">
      <a href="https://tecvo.com.br/dashboard" style="color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;display:inline-block;">
        Acessar minha plataforma →
      </a>
    </td></tr></table>
    <div style="background:#f0f4ff;border-radius:8px;padding:20px;margin-bottom:24px;">
      <p style="color:#3f3f46;font-size:14px;margin:0 0 8px;"><strong>Resumo da assinatura:</strong></p>
      <p style="color:#3f3f46;font-size:14px;margin:0;">✅ Plano: <strong>${params.planName}</strong></p>
      <p style="color:#3f3f46;font-size:14px;margin:4px 0 0;">✅ Empresa: <strong>${params.orgName}</strong></p>
    </div>
    <p style="color:#71717a;font-size:13px;line-height:1.5;margin:0;">
      Se você tiver alguma dúvida ou precisar de ajuda, entre em contato pelo suporte dentro da plataforma ou responda este e-mail.
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

async function sendViaResend(to: string, subject: string, html: string, text: string): Promise<{ success: boolean; error?: string; id?: string }> {
  if (!RESEND_API_KEY) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html,
      text,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return { success: false, error: `Resend error ${res.status}: ${errText}` };
  }

  const data = await res.json();
  console.log(`[BILLING-EMAIL] Sent via Resend to ${to}, id: ${data.id}`);
  return { success: true, id: data.id };
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
    const { organization_id, plan } = await req.json();
    if (!organization_id || !plan) {
      return new Response(JSON.stringify({ error: "Missing organization_id or plan" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const planName = PLAN_NAMES[plan] || plan;
    console.log(`[BILLING-EMAIL] Purchase confirmed — org: ${organization_id}, plan: ${plan}`);

    // Get org + owner info
    const { data: org } = await supabase
      .from("organizations")
      .select("name, email")
      .eq("id", organization_id)
      .single();

    // Get org + owner info via user_roles
    const { data: org } = await supabase
      .from("organizations")
      .select("name, email")
      .eq("id", organization_id)
      .single();

    const { data: ownerRole } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("organization_id", organization_id)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();

    if (!ownerRole) {
      console.warn("[BILLING-EMAIL] No owner role found for org:", organization_id);
      return new Response(JSON.stringify({ sent: false, reason: "no_owner_role" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("full_name, user_id")
      .eq("user_id", ownerRole.user_id)
      .maybeSingle();

    if (!ownerProfile) {
      console.warn("[BILLING-EMAIL] No profile found for owner:", ownerRole.user_id);
      return new Response(JSON.stringify({ sent: false, reason: "no_profile" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: authData } = await supabase.auth.admin.getUserById(ownerProfile.user_id);
    const ownerEmail = authData?.user?.email;

    if (!ownerEmail) {
      console.warn("[BILLING-EMAIL] No email found for user:", ownerProfile.user_id);
      return new Response(JSON.stringify({ sent: false, reason: "no_email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[BILLING-EMAIL] Target: org_id=${organization_id} user_id=${ownerProfile.user_id} role=owner function=billing-send-purchase-email`);

    const userName = ownerProfile.full_name || org?.name || "Cliente";
    const orgName = org?.name || "Sua empresa";
    const html = buildPurchaseEmailHtml({ userName, planName, orgName });
    const subject = `✅ Assinatura confirmada — Plano ${planName} ativado na Tecvo`;
    const text = `Olá ${userName}, sua assinatura do plano ${planName} foi confirmada para ${orgName}. Acesse a plataforma em https://tecvo.com.br/dashboard.`;

    const recipients = [ownerEmail];
    if (ADMIN_EMAIL && ADMIN_EMAIL !== ownerEmail) {
      recipients.push(ADMIN_EMAIL);
    }

    const results = [];
    for (const email of recipients) {
      const result = await sendViaResend(email, subject, html, text);

      await supabase.from("billing_email_log").insert({
        organization_id,
        email_type: "purchase_confirmed",
        recipient_email: email,
        plan,
        status: result.success ? "sent" : "failed",
        error_message: result.success ? null : result.error,
        metadata: { method: "resend_direct", resend_id: result.id },
      });

      results.push({ email, status: result.success ? "sent" : "failed", error: result.error });
    }

    console.log(`[BILLING-EMAIL] Results:`, JSON.stringify(results));
    return new Response(JSON.stringify({ sent: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[BILLING-EMAIL] Error:", (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
