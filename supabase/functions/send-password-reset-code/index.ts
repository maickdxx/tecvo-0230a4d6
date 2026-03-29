import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger, maskEmail } from "../_shared/logging.ts";

const logger = createLogger("send-password-reset-code");

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Always return success to avoid user enumeration
  const successResponse = new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );

  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return successResponse;
    }

    const normalizedEmail = email.toLowerCase().trim();
    logger.step("Password reset requested", { email: maskEmail(normalizedEmail) });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if this email belongs to a real user (silently ignore if not)
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = users?.users?.some(
      (u) => u.email?.toLowerCase() === normalizedEmail
    );

    if (!userExists) {
      logger.step("Email not found, returning silent success", { email: maskEmail(normalizedEmail) });
      return successResponse;
    }

    // Rate-limit: block if a code was created less than 60s ago
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const { data: recentCode } = await supabaseAdmin
      .from("password_reset_codes")
      .select("created_at")
      .eq("email", normalizedEmail)
      .gte("created_at", oneMinuteAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentCode) {
      logger.step("Rate limit hit, returning silent success", { email: maskEmail(normalizedEmail) });
      return successResponse;
    }

    // Invalidate previous codes for this email
    await supabaseAdmin
      .from("password_reset_codes")
      .update({ verified: true })
      .eq("email", normalizedEmail)
      .eq("verified", false);

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));

    // Save new code
    const { error: insertError } = await supabaseAdmin
      .from("password_reset_codes")
      .insert({
        email: normalizedEmail,
        code,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        verified: false,
        attempts: 0,
      });

    if (insertError) {
      logger.error("Failed to save reset code", insertError);
      return successResponse;
    }

    // --- Send email via Resend ---
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      const htmlContent = buildEmailHtml(code);
      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Tecvo <contato@tecvo.com.br>",
          to: [normalizedEmail],
          subject: "Tecvo — Código de redefinição de senha",
          html: htmlContent,
        }),
      });
      const resendData = await resendResponse.json();
      if (!resendResponse.ok) {
        logger.error("Resend API error", resendData);
      } else {
        logger.step("Reset email sent", { email: maskEmail(normalizedEmail) });
      }
    }

    // --- Optionally send via WhatsApp ---
    try {
      // Find user profile to get phone number
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("phone, organization_id")
        .eq("user_id", users.users.find((u) => u.email?.toLowerCase() === normalizedEmail)?.id ?? "")
        .maybeSingle();

      const phone = profile?.phone;

      if (phone && profile?.organization_id) {
        // Check if org has an active WhatsApp channel
        const { data: channel } = await supabaseAdmin
          .from("whatsapp_channels")
          .select("id, is_connected, instance_name")
          .eq("organization_id", profile.organization_id)
          .eq("is_connected", true)
          .limit(1)
          .maybeSingle();

        if (channel) {
          const cleanPhone = phone.replace(/\D/g, "");
          const waMessage = `🔐 *Tecvo — Redefinição de Senha*\n\nRecebemos uma solicitação de redefinição de senha para sua conta Tecvo.\n\nSeu código é: *${code}*\n\n⏱ Válido por 10 minutos.\n\nSe você não solicitou, ignore esta mensagem. Sua senha permanece a mesma.`;

          // ── SEND FLOW: PLATFORM_AUTH ──
          // Password reset codes are fire-and-forget security messages.
          // They are NOT conversation replies and do NOT participate in thread history.
          // We send via the org's connected channel for delivery convenience.
          const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
          const waApiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");
          if (vpsUrl && waApiKey && channel.instance_name) {
            let normalizedPhone = cleanPhone;
            if (!normalizedPhone.startsWith("55") && normalizedPhone.length <= 11) {
              normalizedPhone = "55" + normalizedPhone;
            }
            const jid = `${normalizedPhone}@s.whatsapp.net`;
            await fetch(`${vpsUrl}/message/sendText/${channel.instance_name}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: waApiKey },
              body: JSON.stringify({ number: jid, text: waMessage }),
            });
          }
          logger.step("WhatsApp reset code sent", { phone: cleanPhone.slice(0, 4) + "****" });
        }
      }
    } catch (waError) {
      // WhatsApp is optional — silently ignore failures
      logger.error("WhatsApp send failed (non-critical)", waError);
    }

    return successResponse;
  } catch (error) {
    logger.error("Unexpected error", error);
    // Always return success to avoid user enumeration
    return successResponse;
  }
});

function buildEmailHtml(code: string): string {
  return `<!DOCTYPE html>
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
                      <span style="font-size:28px;">🔐</span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <h1 style="margin:0;color:#ffffff;font-size:32px;font-weight:800;letter-spacing:-0.5px;">Tecvo</h1>
                    <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px;font-weight:500;letter-spacing:1px;text-transform:uppercase;">Redefinição de Senha</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 36px 32px;">
              <h2 style="margin:0 0 6px;color:#0D47A1;font-size:22px;font-weight:800;text-align:center;">
                Redefinição de Senha
              </h2>
              <p style="margin:0 0 28px;color:#64748b;font-size:15px;text-align:center;line-height:1.6;">
                Recebemos uma solicitação de redefinição de senha para sua conta Tecvo.<br>
                Use o código abaixo para continuar.
              </p>

              <!-- OTP Code -->
              <div style="background:linear-gradient(135deg,#E8EAF6,#E3F2FD);border:2px solid #1565C0;border-radius:16px;padding:28px 20px;text-align:center;margin-bottom:28px;">
                <p style="margin:0 0 10px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:2px;font-weight:700;">
                  Código de redefinição
                </p>
                <p style="margin:0;font-size:40px;font-weight:900;letter-spacing:10px;color:#0D47A1;font-family:'Courier New',monospace;">
                  ${code}
                </p>
                <p style="margin:10px 0 0;color:#94a3b8;font-size:12px;">
                  ⏱ Válido por 10 minutos
                </p>
              </div>

              <p style="margin:0;color:#94a3b8;font-size:13px;text-align:center;line-height:1.5;">
                Digite o código acima na tela de redefinição de senha.
              </p>
            </td>
          </tr>

          <!-- Security notice -->
          <tr>
            <td style="padding:0 36px 36px;">
              <div style="background:#FFF8E1;border:1px solid #FFE082;border-radius:12px;padding:16px 20px;">
                <p style="margin:0;color:#795548;font-size:13px;text-align:center;line-height:1.6;">
                  ⚠️ <strong>Aviso de segurança:</strong> Se você não solicitou a redefinição de senha, ignore este e-mail. Sua senha permanece a mesma e sua conta está segura.
                </p>
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
}
