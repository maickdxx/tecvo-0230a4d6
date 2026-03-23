import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { checkSendLimit } from "../_shared/sendGuard.ts";
import { getTodayInTz } from "../_shared/timezone.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUSINESS_TIPS = [
  "💡 Clientes que fazem limpeza preventiva a cada 6 meses reduzem muito a chance de quebra do equipamento. Oferecer esse serviço aumenta o faturamento recorrente.",
  "💡 Enviar uma mensagem de acompanhamento 30 dias após o serviço gera recompra e fidelização. Simples e eficaz!",
  "💡 Equipamentos mal dimensionados são a principal causa de reclamação. Ofereça consultoria de capacidade como diferencial.",
  "💡 Contratos de manutenção preventiva garantem receita previsível todo mês. Considere oferecer pacotes trimestrais ou semestrais.",
  "💡 Fotos de antes e depois do serviço são poderosas para marketing no WhatsApp e Instagram. Peça autorização e publique!",
  "💡 Clientes corporativos costumam ter ticket médio 3x maior que residenciais. Vale investir em prospecção B2B.",
  "💡 Oferecer garantia estendida nos seus serviços aumenta a confiança do cliente e reduz a taxa de desistência.",
  "💡 Um técnico bem treinado resolve chamados mais rápido e gera menos retorno. Invista em capacitação.",
  "💡 A maioria dos chamados de emergência acontece no verão. Prepare seu estoque e equipe com antecedência.",
  "💡 Uniforme e identificação profissional aumentam a percepção de valor do serviço e justificam preços maiores.",
  "💡 Agendar retornos de manutenção preventiva automaticamente evita perder clientes para a concorrência.",
  "💡 Oferecer múltiplas formas de pagamento (PIX, cartão, boleto) elimina objeções na hora de fechar o serviço.",
  "💡 Categorize seus serviços por tipo: limpeza, instalação, reparo e preventiva. Isso ajuda a identificar onde está seu maior faturamento.",
  "💡 Um bom atendimento no WhatsApp gera 5x mais indicações do que propaganda paga. Seja rápido e educado!",
  "💡 Fotografe sempre o modelo e número de série do equipamento. Isso agiliza futuras manutenções e compra de peças.",
  "💡 Cadastre todos os clientes com endereço completo. Isso economiza tempo de deslocamento e permite roteirizar melhor.",
  "💡 Revise seus preços a cada 6 meses. Custos de peças e combustível sobem, e seu lucro pode estar diminuindo sem perceber.",
  "💡 Crie pacotes de serviço (ex: limpeza + higienização) com desconto. Isso aumenta o ticket médio por visita.",
];

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
    const res = await fetch(`${vpsUrl}/message/sendText/tecvo`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number: jid, text }),
    });
    if (!res.ok) {
      console.error("[AUTO-TIPS] Send failed:", res.status, await res.text());
      return false;
    }
    await res.text();
    return true;
  } catch (err) {
    console.error("[AUTO-TIPS] Send error:", err);
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

    // TEMP: Only send to Space Ar Condicionado
    const ALLOWED_ORG_ID = "f46f0514-fecf-4939-b1fa-6a0247f96540";

    const { data: orgs } = await supabase
      .from("organizations")
      .select("id, whatsapp_owner, timezone")
      .eq("id", ALLOWED_ORG_ID)
      .not("whatsapp_owner", "is", null)
      .neq("whatsapp_owner", "");

    console.log(`[AUTO-TIPS] Found ${orgs?.length || 0} orgs`);
    let sent = 0;

    for (const org of orgs || []) {
      if (!org.whatsapp_owner) continue;

      // Check if tip was sent in last 3 days
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const { count: recentTips } = await supabase
        .from("auto_message_log")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", org.id)
        .eq("message_type", "business_tip")
        .gte("sent_at", threeDaysAgo);

      if ((recentTips || 0) > 0) {
        console.log(`[AUTO-TIPS] Tip sent recently for org ${org.id}, skipping`);
        continue;
      }

      // Check daily rate limit (max 2 non-operational) — use org timezone for "today"
      const orgTz = (org as any).timezone || "America/Sao_Paulo";
      const todayStr = getTodayInTz(orgTz);
      const { count: todayNonOp } = await supabase
        .from("auto_message_log")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", org.id)
        .in("message_type", ["weather", "business_tip"])
        .gte("sent_at", `${todayStr}T00:00:00`);

      if ((todayNonOp || 0) >= 2) {
        console.log(`[AUTO-TIPS] Rate limit for org ${org.id}`);
        continue;
      }

      // Pick a tip — use count of previous tips to rotate
      const { count: totalTips } = await supabase
        .from("auto_message_log")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", org.id)
        .eq("message_type", "business_tip");

      const tipIndex = (totalTips || 0) % BUSINESS_TIPS.length;
      const tipText = BUSINESS_TIPS[tipIndex];
      const message = `${tipText}\n\n— Tecvo`;

      // Send guard check
      const guard = await checkSendLimit(supabase, org.id, null, "tips");
      if (!guard.allowed) {
        console.log(`[AUTO-TIPS] Org ${org.id} blocked by send guard: ${guard.reason}`);
        continue;
      }

      const ok = await sendWhatsApp(org.whatsapp_owner, message);
      if (ok) {
        await supabase.from("auto_message_log").insert({
          organization_id: org.id,
          message_type: "business_tip",
          content: message,
        });
        sent++;
      }
    }

    console.log(`[AUTO-TIPS] Done. Sent ${sent} tips.`);
    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[AUTO-TIPS] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
