/**
 * ── DISPATCH-WELCOME ──
 * Unified welcome dispatcher for new Tecvo users.
 * Called automatically via DB trigger on profiles INSERT (owner only).
 *
 * Strategy:
 *   - If WhatsApp available → send WhatsApp welcome
 *   - If email available → send email via send-transactional-email (Lovable Email)
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

function buildWhatsAppText(name: string): string {
  return `👋 Olá, ${name}! Bem-vindo(a) à *Tecvo*!\n\nSua conta foi configurada com sucesso. Estamos aqui para facilitar a gestão do seu negócio.\n\nSe precisar de ajuda, é só mandar uma mensagem! 🚀`;
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

    // Fetch and verify owner role
    const { data: ownerRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user_id)
      .eq("organization_id", organization_id)
      .eq("role", "owner")
      .maybeSingle();

    if (!ownerRole) {
      console.log(`[DISPATCH-WELCOME] User ${user_id} is not the owner for org ${organization_id}, skipping.`);
      return new Response(JSON.stringify({ success: false, reason: "not_owner" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all necessary data
    const [profileRes, orgRes, authRes] = await Promise.all([
      adminClient.from("profiles").select("full_name, phone, whatsapp_ai_enabled").eq("user_id", user_id).maybeSingle(),
      adminClient.from("organizations").select("name").eq("id", organization_id).maybeSingle(),
      adminClient.auth.admin.getUserById(user_id),
    ]);

    const profile = profileRes.data;
    const org = orgRes.data;
    const userEmail = authRes.data?.user?.email;
    const userName = profile?.full_name || org?.name || "empreendedor";

    // Resolve WhatsApp — send welcome to any user with a phone, regardless of AI toggle
    const waNumber = normalizeToDigits(profile?.phone) || null;

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

          const text = buildWhatsAppText(userName);

          // Try with the original number first, then without the 9th digit (BR mobile compat)
          const numbersToTry = [waNumber];
          // If BR number with 13 digits (55 + 2-digit area + 9-digit mobile), try without the 9th digit
          if (waNumber.startsWith("55") && waNumber.length === 13) {
            const withoutNinth = waNumber.slice(0, 4) + waNumber.slice(5); // remove the 5th char (the leading 9 of mobile)
            numbersToTry.push(withoutNinth);
          }

          let lastError = "";
          for (const num of numbersToTry) {
            const jid = `${num}@s.whatsapp.net`;
            console.log(`[DISPATCH-WELCOME] Trying WhatsApp send to ${jid}`);

            const res = await fetch(`${vpsUrl}/message/sendText/${TECVO_PLATFORM_INSTANCE}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: apiKey },
              body: JSON.stringify({ number: jid, text }),
            });

            if (res.ok) {
              const resBody = await res.json().catch(() => ({}));
              return { success: true, messageId: resBody?.key?.id || null };
            }

            lastError = await res.text();
            console.log(`[DISPATCH-WELCOME] Failed for ${num}: ${lastError}`);
            
            // If it's a "not exists" error and we have another number to try, continue
            if (lastError.includes('"exists":false') && numbersToTry.indexOf(num) < numbersToTry.length - 1) {
              continue;
            }
          }

          return { success: false, error: `HTTP 400: ${lastError}` };
        },
      });
    } else {
      results.whatsapp = "skipped_no_phone";
    }

    // ── Email channel (via Lovable Email / send-transactional-email) ──
    if (userEmail) {
      results.email = await dispatchChannel(adminClient, {
        userId: user_id,
        orgId: organization_id,
        triggerType: "welcome",
        channel: "email",
        userName,
        payload: { email: userEmail },
        sendFn: async () => {
          try {
            // Call send-transactional-email via direct HTTP
            const fnUrl = `${supabaseUrl}/functions/v1/send-transactional-email`;
            const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
            const res = await fetch(fnUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${anonKey}`,
                "apikey": anonKey,
              },
              body: JSON.stringify({
                templateName: "welcome",
                recipientEmail: userEmail,
                idempotencyKey: `welcome-email-${user_id}`,
                templateData: { name: userName },
              }),
            });

            if (!res.ok) {
              const errText = await res.text();
              return { success: false, error: `HTTP ${res.status}: ${errText}` };
            }

            const data = await res.json().catch(() => ({}));
            if (data?.success || data?.queued) {
              return { success: true, messageId: data?.message_id || null };
            }

            return { success: false, error: data?.error || data?.reason || "Unknown response" };
          } catch (err) {
            return { success: false, error: String(err) };
          }
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
