import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger, maskEmail } from "../_shared/logging.ts";

const logger = createLogger("send-verification-email");

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, fullName } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logger.step("Generating OTP", { email: maskEmail(email) });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Clean old verification records for this email
    await supabaseAdmin
      .from("email_verifications")
      .delete()
      .eq("email", email.toLowerCase());

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));

    // Save to database
    const { error: insertError } = await supabaseAdmin
      .from("email_verifications")
      .insert({
        email: email.toLowerCase(),
        code,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        verified: false,
      });

    if (insertError) {
      logger.error("Failed to save OTP", insertError);
      throw insertError;
    }

    // Build confirmation URL (magic link via Supabase)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const siteUrl = req.headers.get("origin") || "https://tecnico-pro.lovable.app";

    // Send email via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const displayName = fullName || email.split("@")[0];

    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#F0F4F8;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F0F4F8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(21,101,192,0.12);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0D47A1,#1565C0,#1976D2,#1E88E5);padding:40px 40px 32px;text-align:center;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:16px;">
                    <div style="width:56px;height:56px;background:rgba(255,255,255,0.15);border-radius:16px;display:inline-block;line-height:56px;">
                      <span style="font-size:28px;">❄️</span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <h1 style="margin:0;color:#ffffff;font-size:32px;font-weight:800;letter-spacing:-0.5px;">Tecvo</h1>
                    <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px;font-weight:500;letter-spacing:1px;text-transform:uppercase;">Gestão Inteligente para Técnicos</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 36px 32px;">
              <h2 style="margin:0 0 6px;color:#0D47A1;font-size:24px;font-weight:800;text-align:center;">
                Bem-vindo à Tecvo! 🎉
              </h2>
              <p style="margin:0 0 28px;color:#64748b;font-size:15px;text-align:center;line-height:1.6;">
                Olá, <strong style="color:#1e293b;">${displayName}</strong>!<br>
                Confirme seu e-mail para começar a usar a plataforma.
              </p>

              <!-- OTP Code -->
              <div style="background:linear-gradient(135deg,#E8EAF6,#E3F2FD);border:2px solid #1565C0;border-radius:16px;padding:28px 20px;text-align:center;margin-bottom:28px;">
                <p style="margin:0 0 10px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:2px;font-weight:700;">
                  Código de verificação
                </p>
                <p style="margin:0;font-size:40px;font-weight:900;letter-spacing:10px;color:#0D47A1;font-family:'Courier New',monospace;">
                  ${code}
                </p>
                <p style="margin:10px 0 0;color:#94a3b8;font-size:12px;">
                  ⏱ Válido por 10 minutos
                </p>
              </div>

              <p style="margin:0;color:#94a3b8;font-size:13px;text-align:center;line-height:1.5;">
                Digite o código acima no aplicativo para confirmar seu cadastro.
              </p>
            </td>
          </tr>

          <!-- Benefits -->
          <tr>
            <td style="padding:0 36px 36px;">
              <div style="background:#F8FAFC;border-radius:14px;padding:24px 20px;">
                <p style="margin:0 0 16px;color:#1e293b;font-size:14px;font-weight:700;text-align:center;">
                  O que você vai encontrar:
                </p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:8px 0;">
                      <table cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="width:36px;vertical-align:top;">
                            <span style="font-size:18px;">📅</span>
                          </td>
                          <td style="vertical-align:top;">
                            <p style="margin:0;color:#334155;font-size:14px;font-weight:600;">Organize sua agenda de serviços</p>
                            <p style="margin:2px 0 0;color:#94a3b8;font-size:12px;">Nunca mais perca um atendimento</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;">
                      <table cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="width:36px;vertical-align:top;">
                            <span style="font-size:18px;">💰</span>
                          </td>
                          <td style="vertical-align:top;">
                            <p style="margin:0;color:#334155;font-size:14px;font-weight:600;">Controle financeiro real do seu negócio</p>
                            <p style="margin:2px 0 0;color:#94a3b8;font-size:12px;">Saiba exatamente quanto entra e sai</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;">
                      <table cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="width:36px;vertical-align:top;">
                            <span style="font-size:18px;">🔄</span>
                          </td>
                          <td style="vertical-align:top;">
                            <p style="margin:0;color:#334155;font-size:14px;font-weight:600;">Aumente o faturamento com recorrência</p>
                            <p style="margin:2px 0 0;color:#94a3b8;font-size:12px;">Contratos e manutenções programadas</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 36px;background:#f1f5f9;border-top:1px solid #e2e8f0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <p style="margin:0 0 4px;color:#475569;font-size:13px;font-weight:700;">Tecvo</p>
                    <p style="margin:0 0 12px;color:#94a3b8;font-size:12px;">
                      <a href="https://tecvo.com.br" style="color:#1565C0;text-decoration:none;">tecvo.com.br</a> · contato@tecvo.com.br
                    </p>
                    <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.5;">
                      Se você não solicitou este acesso, ignore este e-mail com segurança.<br>
                      © ${new Date().getFullYear()} Tecvo — Gestão Inteligente para Técnicos
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Tecvo <contato@tecvo.com.br>",
        to: [email],
        subject: "Bem-vindo à Tecvo — Confirme seu e-mail",
        html: htmlContent,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      logger.error("Resend API error", resendData);
      throw new Error(resendData?.message || "Failed to send email");
    }

    logger.step("Email sent successfully", { email: maskEmail(email) });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    logger.error("Unexpected error", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
