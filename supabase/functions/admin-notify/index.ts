import { getCorsHeaders } from "../_shared/cors.ts";
import { TECVO_PLATFORM_INSTANCE } from "../_shared/sendFlowTypes.ts";

const SUPER_ADMIN_EMAIL = "micheldouglas7991@gmail.com";
const SUPER_ADMIN_PHONE = "5519989307608";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = "contato@tecvo.com.br";

interface NotificationPayload {
  type: string;
  org_id?: string;
  org_name?: string;
  org_email?: string;
  org_phone?: string;
  plan?: string;
  old_plan?: string;
  created_at?: string;
  count?: number;
  days_inactive?: number;
  error_details?: string;
  responsible_name?: string;
  responsible_email?: string;
  responsible_phone?: string;
}

function buildEmail(payload: NotificationPayload): { subject: string; html: string } {
  const { type } = payload;
  // Admin notifications use a fixed timezone (platform admin is in Brazil)
  const ADMIN_TZ = "America/Sao_Paulo";
  const timestamp = new Date().toLocaleString("pt-BR", { timeZone: ADMIN_TZ });

  const header = (title: string, emoji: string) => `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; border-radius: 12px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 24px 32px;">
        <h1 style="color: #fff; margin: 0; font-size: 20px;">${emoji} ${title}</h1>
        <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0; font-size: 13px;">TecVo Admin • ${timestamp}</p>
      </div>
      <div style="padding: 24px 32px; color: #e2e8f0;">
  `;

  const footer = `
      </div>
      <div style="padding: 16px 32px; background: #1e293b; text-align: center;">
        <p style="color: #64748b; font-size: 12px; margin: 0;">TecVo Platform Admin • Notificação automática</p>
      </div>
    </div>
  `;

  const row = (label: string, value: string | undefined | null) =>
    value ? `<p style="margin: 8px 0;"><strong style="color: #94a3b8;">${label}:</strong> <span style="color: #f1f5f9;">${value}</span></p>` : "";

  switch (type) {
    case "new_account":
      return {
        subject: "🚀 Nova empresa cadastrada na plataforma",
        html: `${header("Nova Empresa Cadastrada", "🚀")}
          ${row("Empresa", payload.org_name)}
          ${row("Responsável", payload.responsible_name)}
          ${row("E-mail", payload.org_email || payload.responsible_email)}
          ${row("Telefone", payload.org_phone || payload.responsible_phone)}
          ${row("Plano", payload.plan)}
          ${row("Data/Hora", payload.created_at ? new Date(payload.created_at).toLocaleString("pt-BR", { timeZone: ADMIN_TZ }) : timestamp)}
        ${footer}`,
      };

    case "first_service":
      return {
        subject: `🎯 Primeiro serviço criado: ${payload.org_name}`,
        html: `${header("Primeiro Serviço Criado", "🎯")}
          ${row("Empresa", payload.org_name)}
          <p style="color: #22c55e; margin-top: 16px;">✅ A empresa começou a usar a plataforma!</p>
        ${footer}`,
      };

    case "milestone_100":
      return {
        subject: `🏆 100 serviços: ${payload.org_name}`,
        html: `${header("Marco de 100 Serviços", "🏆")}
          ${row("Empresa", payload.org_name)}
          <p style="color: #eab308; margin-top: 16px;">⭐ Cliente ativo forte — considere oferecer upgrade ou benefícios!</p>
        ${footer}`,
      };

    case "cancellation_attempt":
      return {
        subject: `⚠️ Tentativa de cancelamento: ${payload.org_name}`,
        html: `${header("Tentativa de Cancelamento", "⚠️")}
          ${row("Empresa", payload.org_name)}
          ${row("Plano atual", payload.plan)}
          <p style="color: #ef4444; margin-top: 16px;">🚨 Ação rápida de retenção necessária!</p>
        ${footer}`,
      };

    case "plan_expired":
      return {
        subject: `💳 Plano expirado: ${payload.org_name}`,
        html: `${header("Plano Expirado", "💳")}
          ${row("Empresa", payload.org_name)}
          ${row("Plano anterior", payload.old_plan)}
          <p style="color: #f97316; margin-top: 16px;">A empresa voltou para o plano gratuito.</p>
        ${footer}`,
      };

    case "inactive_7_days":
      return {
        subject: `😴 7 dias sem atividade: ${payload.org_name}`,
        html: `${header("Empresa Inativa (7 dias)", "😴")}
          ${row("Empresa", payload.org_name)}
          <p style="color: #f97316; margin-top: 16px;">⚠️ Risco de abandono — considere entrar em contato.</p>
        ${footer}`,
      };

    case "inactive_30_days":
      return {
        subject: `🚨 30 dias sem atividade: ${payload.org_name}`,
        html: `${header("Empresa Inativa (30 dias)", "🚨")}
          ${row("Empresa", payload.org_name)}
          <p style="color: #ef4444; margin-top: 16px;">🔴 Alto risco de churn — ação urgente necessária!</p>
        ${footer}`,
      };

    case "system_error":
      return {
        subject: `🔴 Erro crítico no sistema`,
        html: `${header("Erro Crítico do Sistema", "🔴")}
          ${row("Detalhes", payload.error_details)}
          <p style="color: #ef4444; margin-top: 16px;">Verificação imediata necessária.</p>
        ${footer}`,
      };

    default:
      return {
        subject: `📢 Notificação Admin: ${type}`,
        html: `${header("Notificação", "📢")}
          <pre style="color: #e2e8f0; background: #1e293b; padding: 16px; border-radius: 8px; overflow: auto;">${JSON.stringify(payload, null, 2)}</pre>
        ${footer}`,
      };
  }
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: NotificationPayload = await req.json();

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { subject, html } = buildEmail(payload);

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `TecVo Admin <${FROM_EMAIL}>`,
        to: [SUPER_ADMIN_EMAIL],
        subject,
        html,
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error("Resend error:", errText);
      return new Response(JSON.stringify({ error: "Failed to send email", details: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await emailRes.json();
    console.log("Admin notification sent:", payload.type, result.id);

    return new Response(JSON.stringify({ success: true, email_id: result.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("admin-notify error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
