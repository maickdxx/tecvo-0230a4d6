import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function buildEmailHtml(
  orgName: string,
  clientName: string,
  serviceDescription: string,
  portalUrl: string
): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">

<!-- Header -->
<tr><td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:32px 40px;text-align:center">
  <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700">${orgName}</h1>
  <p style="color:#94a3b8;margin:8px 0 0;font-size:14px">Serviço Concluído ✅</p>
</td></tr>

<!-- Body -->
<tr><td style="padding:40px">
  <p style="color:#1e293b;font-size:16px;margin:0 0 16px">Olá <strong>${clientName}</strong>,</p>
  <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px">
    Temos o prazer de informar que o seu serviço foi concluído com sucesso!
  </p>

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin:20px 0">
  <tr><td style="padding:20px">
    <p style="color:#64748b;font-size:13px;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.5px">Serviço</p>
    <p style="color:#1e293b;font-size:15px;margin:0;font-weight:600">${serviceDescription}</p>
  </td></tr>
  </table>

  <p style="color:#475569;font-size:15px;line-height:1.6;margin:16px 0 24px">
    Acesse sua <strong>Área do Cliente</strong> para ver todos os detalhes, fotos do serviço, ordens de serviço e laudos técnicos:
  </p>

  <!-- CTA Button -->
  <table width="100%" cellpadding="0" cellspacing="0">
  <tr><td align="center">
    <a href="${portalUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.3px">
      Acessar Área do Cliente →
    </a>
  </td></tr>
  </table>

  <p style="color:#94a3b8;font-size:13px;margin:24px 0 0;text-align:center">
    Ou copie e cole no navegador:<br>
    <a href="${portalUrl}" style="color:#3b82f6;word-break:break-all">${portalUrl}</a>
  </p>
</td></tr>

<!-- Footer -->
<tr><td style="background:#f8fafc;padding:24px 40px;text-align:center;border-top:1px solid #e2e8f0">
  <p style="color:#94a3b8;font-size:13px;margin:0">
    Se precisar de algo, estamos à disposição.
  </p>
  <p style="color:#cbd5e1;font-size:12px;margin:8px 0 0">
    © ${new Date().getFullYear()} ${orgName} · Enviado via Tecvo
  </p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { to, organization_id, service_id, client_name, service_description } = await req.json();

    if (!to || !organization_id) {
      throw new Error("Missing required fields: to, organization_id");
    }

    // Get org info
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", organization_id)
      .single();

    const orgName = org?.name || "Empresa";

    // Get portal config for slug
    const { data: portalConfig } = await supabase
      .from("client_portal_config")
      .select("slug")
      .eq("organization_id", organization_id)
      .maybeSingle();

    // Create a portal session for direct access (24h)
    const { data: portalSession } = await supabase
      .from("client_portal_sessions")
      .insert({
        phone: "email-access",
        organization_id,
        is_verified: true,
        token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .select("session_token")
      .single();

    const portalSlug = portalConfig?.slug || "";
    const token = portalSession?.session_token || "";
    const portalUrl = portalSlug
      ? `https://tecvo.com.br/portal/${portalSlug}/login?token=${token}`
      : `https://tecvo.com.br/portal/login?token=${token}`;

    const finalClientName = client_name || "Cliente";
    const finalServiceDesc = service_description || "Manutenção / Instalação de Ar Condicionado";

    const html = buildEmailHtml(orgName, finalClientName, finalServiceDesc, portalUrl);
    const text = `Olá ${finalClientName}, seu serviço "${finalServiceDesc}" foi concluído com sucesso! Acesse sua Área do Cliente: ${portalUrl}`;

    // Send via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${orgName} <contato@tecvo.com.br>`,
        to: Array.isArray(to) ? to : [to],
        subject: `✅ Serviço Concluído — ${orgName}`,
        html,
        text,
      }),
    });

    const resendData = await resendRes.json();
    if (!resendRes.ok) {
      throw new Error(`Resend error: ${JSON.stringify(resendData)}`);
    }

    console.log("Service completed email sent successfully:", resendData);

    return new Response(
      JSON.stringify({ success: true, resend_id: resendData.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending service completed email:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
