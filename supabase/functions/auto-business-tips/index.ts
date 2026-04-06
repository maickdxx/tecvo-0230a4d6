/**
 * ── SEND FLOW: PLATFORM_NOTIFICATION ──
 * Weekly business tips sent to org owners via their phone.
 * Runs once per week (Monday at 10:00 BRT via cron).
 *
 * PHONE SOURCE: Uses owner's phone (profiles.phone)
 * with fallback to legacy organizations.whatsapp_owner.
 *
 * CADENCE: Maximum 1 tip per week per org (7-day cooldown).
 * Tips are practical, actionable and directly applicable to HVAC technicians.
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { checkSendLimit } from "../_shared/sendGuard.ts";
import { resolveOwnerPhone, logShieldBlocked } from "../_shared/resolveOwnerPhone.ts";
import { idempotentSend } from "../_shared/idempotentSend.ts";
import { checkAndEnqueue } from "../_shared/sendWindow.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Tips are direct, professional, actionable.
 * No motivational fluff. No generic advice. No "AI-sounding" language.
 * Each tip solves a real problem or increases revenue.
 */
const BUSINESS_TIPS = [
  "💡 *Cobrança na hora certa:* envie o link de pagamento assim que o serviço for concluído. Cada dia de atraso reduz em 15% a chance de receber sem precisar cobrar de novo.",

  "💡 *Contrato preventivo = receita previsível:* ofereça pacotes semestrais de manutenção. Clientes com contrato renovam 4x mais e você elimina a sazonalidade.",

  "💡 *Checklist antes de sair:* antes de ir ao cliente, confira peças, ferramentas e dados da OS. Voltar para buscar algo custa tempo e combustível.",

  "💡 *Reagende, não cancele:* quando o cliente pede para remarcar, sugira uma nova data na mesma ligação. OS sem data vira cliente perdido.",

  "💡 *Revise seus preços a cada 6 meses:* custo de peças, gás e combustível sobe, mas muitos técnicos mantêm a tabela antiga. Calcule seu custo real por hora.",

  "💡 *Foto de antes e depois:* registre o estado do equipamento antes e depois do serviço. Isso justifica o valor cobrado e gera conteúdo para divulgação.",

  "💡 *Confirme o agendamento na véspera:* uma mensagem rápida no dia anterior reduz faltas em 40% e mostra profissionalismo.",

  "💡 *Separe conta pessoal da empresa:* misturar finanças impede você de saber se está lucrando. Use uma conta exclusiva para receber dos clientes.",

  "💡 *Cliente corporativo paga mais:* invista em prospecção de condomínios, clínicas e escritórios. O ticket médio é 3x maior que residencial.",

  "💡 *Não dê desconto, agregue valor:* ao invés de baixar o preço, inclua uma higienização ou revisão extra. Você mantém a margem e o cliente sente que ganhou.",

  "💡 *Cadastre o equipamento do cliente:* anotar modelo, BTUs e número de série agiliza futuras manutenções e facilita a compra de peças.",

  "💡 *Roteirize seus atendimentos:* agrupar serviços por região no mesmo dia economiza combustível e permite encaixar mais OS.",

  "💡 *Defina sua meta mensal:* sem meta, não tem como saber se o mês foi bom. Calcule: custos fixos + lucro desejado = meta mínima.",

  "💡 *Responda rápido no WhatsApp:* clientes que recebem resposta em até 5 minutos fecham 3x mais do que os que esperam horas.",

  "💡 *Identifique seus serviços mais lucrativos:* saiba quais tipos de OS dão mais margem e foque sua divulgação neles.",

  "💡 *Peça indicação após cada serviço bem feito:* uma simples pergunta \"conhece alguém que precisa?\" gera leads qualificados sem custo.",
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

    // Send to all organizations with active paid plans
    const { data: orgs } = await supabase
      .from("organizations")
      .select("id, timezone")
      .neq("plan", "free")
      .eq("messaging_paused", false);

    console.log(`[AUTO-TIPS] Found ${orgs?.length || 0} orgs`);
    let sent = 0;

    for (const org of orgs || []) {
      // Resolve owner's personal phone via SHIELDED logic
      const ownerPhone = await resolveOwnerPhone(supabase, org.id);
      if (!ownerPhone.phone) {
        console.log(`[AUTO-TIPS] No phone for org ${org.id} owner (userId=${ownerPhone.userId} reason=${ownerPhone.blockedReason})`);
        await logShieldBlocked(supabase, org.id, ownerPhone, "tips", "Business Tip");
        continue;
      }

      // Check if tip was sent in last 7 days (weekly cadence)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count: recentTips } = await supabase
        .from("auto_message_log")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", org.id)
        .eq("message_type", "business_tip")
        .gte("sent_at", sevenDaysAgo);

      if ((recentTips || 0) > 0) {
        console.log(`[AUTO-TIPS] Tip sent within last 7 days for org ${org.id}, skipping`);
        continue;
      }

      // Pick a tip (cycle through the list)
      const { count: totalTips } = await supabase
        .from("auto_message_log")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", org.id)
        .eq("message_type", "business_tip");

      const tipIndex = (totalTips || 0) % BUSINESS_TIPS.length;
      const tipText = BUSINESS_TIPS[tipIndex];
      const message = `${tipText}\n\n— Tecvo`;

      const guard = await checkSendLimit(supabase, org.id, null, "tips");
      if (!guard.allowed) {
        console.log(`[AUTO-TIPS] Org ${org.id} blocked by send guard: ${guard.reason}`);
        continue;
      }

      const orgTz = org.timezone || "America/Sao_Paulo";

      // CHECK SEND WINDOW — queue if outside hours
      const windowCheck = await checkAndEnqueue({
        supabase,
        organizationId: org.id,
        phone: ownerPhone.phone!,
        messageContent: message,
        messageType: "business_tip",
        sourceFunction: "auto-business-tips",
        idempotencyKey: `tip-${org.id}-${new Date().toLocaleDateString("en-CA", { timeZone: orgTz })}`,
        timezone: orgTz,
      });

      if (windowCheck.action === "queued") {
        console.log(`[AUTO-TIPS] ⏰ Org ${org.id} queued for ${windowCheck.scheduledFor} (outside send window)`);
        continue;
      }

      const result = await idempotentSend({
        supabase,
        organizationId: org.id,
        messageType: "business_tip",
        content: message,
        timezone: orgTz,
        sendFn: () => sendWhatsApp(ownerPhone.phone!, message),
      });

      if (result.sent) {
        sent++;
        console.log(`[AUTO-TIPS] ✅ Sent: org_id=${org.id} user_id=${ownerPhone.userId} role=owner function=auto-business-tips`);
      } else if (result.skipped) {
        console.log(`[AUTO-TIPS] ⏭️ Skipped org ${org.id} (already sent today)`);
      } else {
        console.log(`[AUTO-TIPS] ❌ Failed for org ${org.id}: ${result.error}`);
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
