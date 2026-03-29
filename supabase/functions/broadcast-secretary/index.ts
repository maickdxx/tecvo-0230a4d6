/**
 * ── SEND FLOW: PLATFORM_NOTIFICATION ──
 * Broadcasts messages from the Tecvo platform to organization owners.
 * Always uses TECVO_PLATFORM_INSTANCE ("tecvo") — never an org channel.
 * These messages are NOT part of any customer conversation.
 *
 * PHONE SOURCE: Uses owner's personal phone (profiles.whatsapp_personal)
 * with fallback to profiles.phone, then legacy organizations.whatsapp_owner.
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { checkSendLimit } from "../_shared/sendGuard.ts";
import { TECVO_PLATFORM_INSTANCE } from "../_shared/sendFlowTypes.ts";
import { resolveOwnerPhone } from "../_shared/resolveOwnerPhone.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendWhatsApp(phone: string, text: string) {
  const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
  const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");
  if (!vpsUrl || !apiKey) return false;

  let cleanNumber = phone.replace(/\D/g, "");
  if (!cleanNumber.startsWith("55") && cleanNumber.length <= 11) {
    cleanNumber = "55" + cleanNumber;
  }
  const jid = cleanNumber.includes("@") ? cleanNumber : `${cleanNumber}@s.whatsapp.net`;

  try {
    const res = await fetch(`${vpsUrl}/message/sendText/${TECVO_PLATFORM_INSTANCE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number: jid, text }),
    });
    if (!res.ok) {
      console.error("[BROADCAST] Send failed:", res.status, await res.text());
      return false;
    }
    await res.text();
    return true;
  } catch (err) {
    console.error("[BROADCAST] Send error:", err);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let customMessage = "";
    let singleOrgId = "";
    try {
      const body = await req.json();
      customMessage = body.message || "";
      singleOrgId = body.single_org_id || "";
    } catch {
      // no body is fine
    }

    const defaultMessage = `Olá! 👋

Eu sou a *IA da TecVo* — sua assistente virtual para gestão da empresa.

Você pode me perguntar sobre:

📊 *Faturamento* — "Quanto faturei esse mês?"
📅 *Agenda* — "Quais serviços tenho hoje?"
👥 *Clientes* — "Quantos clientes tenho?"
💰 *Financeiro* — "Quanto tenho a receber?"
📈 *Desempenho* — "Como está meu mês?"

Também envio *automaticamente*:
☀️ Previsão do tempo diária às 06h
🔧 Atualizações em tempo real dos seus serviços
💡 Dicas de negócio ocasionais

É só me mandar uma mensagem aqui quando precisar! 😊

— Tecvo`;

    const message = customMessage || defaultMessage;

    // TEMP: Only send to Space Ar Condicionado
    const ALLOWED_ORG_ID = "f46f0514-fecf-4939-b1fa-6a0247f96540";

    let query = supabase
      .from("organizations")
      .select("id, name");

    if (singleOrgId) {
      query = query.eq("id", singleOrgId);
    } else {
      query = query.eq("id", ALLOWED_ORG_ID);
    }

    const { data: orgs, error } = await query;

    if (error) {
      throw new Error(`DB error: ${error.message}`);
    }

    console.log(`[BROADCAST] Found ${orgs?.length || 0} organizations`);

    const results: { org: string; phone: string; sent: boolean; source: string }[] = [];

    for (const org of orgs || []) {
      if (results.length > 0) {
        await new Promise((r) => setTimeout(r, 2000));
      }

      // Resolve owner's personal phone
      const ownerPhone = await resolveOwnerPhone(supabase, org.id);
      if (!ownerPhone.phone) {
        console.log(`[BROADCAST] ${org.name}: No phone found for owner`);
        results.push({ org: org.name, phone: "none", sent: false, source: "none" });
        continue;
      }

      const guard = await checkSendLimit(supabase, org.id, null, "broadcast");
      if (!guard.allowed) {
        console.log(`[BROADCAST] ${org.name}: BLOCKED by send guard — ${guard.reason}`);
        results.push({ org: org.name, phone: ownerPhone.phone, sent: false, source: ownerPhone.source! });
        continue;
      }

      const sent = await sendWhatsApp(ownerPhone.phone, message);
      results.push({ org: org.name, phone: ownerPhone.phone, sent, source: ownerPhone.source! });
      console.log(`[BROADCAST] ${org.name} (${ownerPhone.phone} via ${ownerPhone.source}): ${sent ? "✅" : "❌"}`);

      if (sent) {
        await supabase.from("auto_message_log").insert({
          organization_id: org.id,
          message_type: "broadcast",
          content: message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        total: results.length,
        sent: results.filter((r) => r.sent).length,
        failed: results.filter((r) => !r.sent).length,
        details: results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[BROADCAST] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
