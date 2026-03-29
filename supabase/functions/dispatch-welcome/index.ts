/**
 * ── DISPATCH-WELCOME ──
 * Unified welcome dispatcher for new Tecvo users.
 * Called automatically via DB trigger on profiles INSERT (owner only).
 *
 * Strategy:
 *   - If WhatsApp available → send WhatsApp welcome
 *   - If email available → send email welcome
 *   - Both channels fire independently (not fallback)
 *   - Idempotent via onboarding_delivery_logs unique constraint
 *
 * SEND FLOW: PLATFORM_NOTIFICATION (uses tecvo instance)
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { TECVO_PLATFORM_INSTANCE } from "../_shared/sendFlowTypes.ts";
import { normalizeToDigits } from "../_shared/resolveOwnerPhone.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = "Tecvo <contato@tecvo.com.br>";

function buildWhatsAppText(name: string): string {
  return `👋 Olá, ${name}! Bem-vindo(a) à *Tecvo*!\n\nSua conta foi configurada com sucesso. Estamos aqui para facilitar a gestão do seu negócio.\n\nSe precisar de ajuda, é só mandar uma mensagem! 🚀`;
}

function buildWelcomeEmailHtml(name: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
  <tr><td style="background:linear-gradient(135deg,#2563eb,#7c3aed);padding:32px 40px;text-align:center;">
    <h1 style="color:#ffffff;margin:0;font-size:24px;">🚀 Bem-vindo à Tecvo!</h1>
  </td></tr>
  <tr><td style="padding:32px 40px;">
    <p style="color:#3f3f46;font-size:15px;line-height:1.6;margin:0 0 16px;">
      Olá, <strong>${name}</strong>! Sua conta foi criada com sucesso.
    </p>
    <p style="color:#3f3f46;font-size:15px;line-height:1.6;margin:0 0 16px;">
      A Tecvo vai te ajudar a organizar seus serviços, clientes e financeiro em um só lugar. 
      Comece agora mesmo!
    </p>
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, organization_id } = await req.json();
    if (!user_id || !organization_id) {
      return new Response(JSON.stringify({ error: "user_id and organization_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[DISPATCH-WELCOME] Processing user=${user_id} org=${organization_id}`);

    // Fetch all necessary data
    const [profileRes, orgRes, authRes] = await Promise.all([
      adminClient.from("profiles").select("full_name, whatsapp_personal, phone").eq("user_id", user_id).maybeSingle(),
      adminClient.from("organizations").select("name").eq("id", organization_id).maybeSingle(),
      adminClient.auth.admin.getUserById(user_id),
    ]);

    const profile = profileRes.data;
    const org = orgRes.data;
    const userEmail = authRes.data?.user?.email;
    const userName = profile?.full_name || org?.name || "empreendedor";

    // Resolve WhatsApp
    const waPersonal = normalizeToDigits(profile?.whatsapp_personal);
    const waFallback = normalizeToDigits(profile?.phone);
    const waNumber = waPersonal || waFallback || null;

    const results: Record<string, string> = {};

    // ── WhatsApp channel ──
    if (waNumber) {
      results.whatsapp = await dispatchChannel(adminClient, {
        userId: user_id,
        orgId: organization_id,
        triggerType: "welcome",
        channel: "whatsapp",
        userName,
        payload: { phone: waNumber },
        sendFn: async () => {
          const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
          const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");
          if (!vpsUrl || !apiKey) return { success: false, error: "WA not configured" };

          const jid = `${waNumber}@s.whatsapp.net`;
          const text = buildWhatsAppText(userName);

          const res = await fetch(`${vpsUrl}/message/sendText/${TECVO_PLATFORM_INSTANCE}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: apiKey },
            body: JSON.stringify({ number: jid, text }),
          });

          if (!res.ok) {
            const errText = await res.text();
            return { success: false, error: `HTTP ${res.status}: ${errText}` };
          }
          const resBody = await res.json().catch(() => ({}));
          return { success: true, messageId: resBody?.key?.id || null };
        },
      });
    } else {
      results.whatsapp = "skipped_no_phone";
    }

    // ── Email channel ──
    if (userEmail) {
      results.email = await dispatchChannel(adminClient, {
        userId: user_id,
        orgId: organization_id,
        triggerType: "welcome",
        channel: "email",
        userName,
        payload: { email: userEmail },
        sendFn: async () => {
          if (!RESEND_API_KEY) return { success: false, error: "RESEND_API_KEY not configured" };

          const html = buildWelcomeEmailHtml(userName);
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: FROM_EMAIL,
              to: [userEmail],
              subject: "🚀 Bem-vindo à Tecvo!",
              html,
            }),
          });

          if (!res.ok) {
            const errText = await res.text();
            return { success: false, error: `Resend ${res.status}: ${errText}` };
          }
          const resBody = await res.json();
          return { success: true, messageId: resBody?.id || null };
        },
      });
    } else {
      results.email = "skipped_no_email";
    }

    // Also mark welcome_whatsapp_sent on organizations for legacy compat
    await adminClient
      .from("organizations")
      .update({ welcome_whatsapp_sent: true })
      .eq("id", organization_id);

    console.log(`[DISPATCH-WELCOME] Done: ${JSON.stringify(results)}`);
    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[DISPATCH-WELCOME] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── Idempotent channel dispatcher ──
interface DispatchOpts {
  userId: string;
  orgId: string;
  triggerType: string;
  channel: string;
  userName: string;
  payload: Record<string, unknown>;
  sendFn: () => Promise<{ success: boolean; error?: string; messageId?: string | null }>;
}

async function dispatchChannel(
  adminClient: any,
  opts: DispatchOpts
): Promise<string> {
  const { userId, orgId, triggerType, channel, userName, payload, sendFn } = opts;

  // Attempt atomic insert (idempotency via unique constraint)
  const { error: insertError } = await adminClient
    .from("onboarding_delivery_logs")
    .insert({
      user_id: userId,
      organization_id: orgId,
      trigger_type: triggerType,
      channel,
      status: "pending",
      payload_snapshot: { ...payload, name: userName },
    });

  if (insertError) {
    // Unique constraint violation = already dispatched
    if (insertError.code === "23505") {
      console.log(`[DISPATCH-WELCOME] Already dispatched ${channel} for user=${userId}`);
      return "already_sent";
    }
    console.error(`[DISPATCH-WELCOME] Insert error:`, insertError);
    return "insert_error";
  }

  // Send
  try {
    const result = await sendFn();

    if (result.success) {
      await adminClient
        .from("onboarding_delivery_logs")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          provider_message_id: result.messageId || null,
        })
        .eq("user_id", userId)
        .eq("trigger_type", triggerType)
        .eq("channel", channel);

      return "sent";
    } else {
      await adminClient
        .from("onboarding_delivery_logs")
        .update({
          status: "failed",
          error_message: result.error || "Unknown error",
        })
        .eq("user_id", userId)
        .eq("trigger_type", triggerType)
        .eq("channel", channel);

      return "failed";
    }
  } catch (err) {
    await adminClient
      .from("onboarding_delivery_logs")
      .update({
        status: "failed",
        error_message: String(err),
      })
      .eq("user_id", userId)
      .eq("trigger_type", triggerType)
      .eq("channel", channel);

    return "error";
  }
}
