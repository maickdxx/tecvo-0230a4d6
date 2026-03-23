import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { maskEmail, createLogger } from "../_shared/logging.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const log = createLogger("SEND-INVITE");

interface InviteRequest {
  email: string;
  role: string;
  organizationName: string;
  inviteToken: string;
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { email, role, organizationName, inviteToken }: InviteRequest = await req.json();

    // Validate required fields
    if (!email || !role || !organizationName || !inviteToken) {
      throw new Error("Missing required fields: email, role, organizationName, inviteToken");
    }

    // Build invite URL - use the published app domain
    const baseUrl = Deno.env.get("APP_URL") || "https://tecvo.lovable.app";
    const inviteUrl = `${baseUrl}/login?invite=${inviteToken}`;

    const roleLabels: Record<string, string> = {
      admin: "Administrador",
      member: "Membro",
      employee: "Funcionário",
    };

    const roleLabel = roleLabels[role] || role;

    // Log with masked PII
    log.step("Sending invite", { 
      to: maskEmail(email), 
      organization: organizationName,
      role: role 
    });

    const emailResponse = await resend.emails.send({
      from: "Tecvo <contato@tecvo.com.br>",
      to: [email],
      subject: `Você foi convidado para ${organizationName} — Tecvo`,
      html: `
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
                        Você foi convidado! 🎉
                      </h2>
                      <p style="margin:0 0 28px;color:#64748b;font-size:15px;text-align:center;line-height:1.6;">
                        Olá! Você foi convidado para fazer parte de<br>
                        <strong style="color:#1e293b;">${organizationName}</strong> como <strong style="color:#1e293b;">${roleLabel}</strong>.
                      </p>
                      <p style="margin:0 0 28px;color:#64748b;font-size:15px;text-align:center;line-height:1.6;">
                        Clique no botão abaixo para criar sua conta e começar a usar o sistema.
                      </p>

                      <!-- CTA Button -->
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center">
                            <a href="${inviteUrl}" style="display:inline-block;background:linear-gradient(135deg,#0D47A1,#1565C0,#1976D2);color:#ffffff;text-decoration:none;padding:16px 48px;border-radius:12px;font-size:17px;font-weight:700;letter-spacing:0.3px;box-shadow:0 4px 16px rgba(21,101,192,0.3);">
                              ✅ Aceitar Convite
                            </a>
                          </td>
                        </tr>
                      </table>

                      <p style="margin:20px 0 0;color:#94a3b8;font-size:13px;text-align:center;line-height:1.5;">
                        Se o botão não funcionar, copie e cole este link:<br>
                        <a href="${inviteUrl}" style="color:#1565C0;text-decoration:none;word-break:break-all;font-size:12px;">${inviteUrl}</a>
                      </p>
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
                              Se você não esperava este convite, ignore este e-mail com segurança.<br>
                              © 2026 Tecvo — Gestão Inteligente para Técnicos
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
        </html>
      `,
    });

    log.step("Invite email sent successfully");

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    log.error("Failed to send invite", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
