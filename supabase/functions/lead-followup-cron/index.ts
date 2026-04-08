/**
 * ── LEAD FOLLOW-UP CRON ──
 * 
 * Processes pending lead follow-ups from the `lead_followups` table.
 * Generates contextual AI follow-up messages based on conversation history.
 * Sends via WhatsApp using the Tecvo institutional instance.
 * 
 * STEPS PER FOLLOW-UP:
 *   Step 0 → First follow-up (5-15 min after first contact)
 *   Step 1 → Second follow-up (4-6 hours later)
 *   Step 2 → Third follow-up (24 hours later)
 *   Step 3 → Final follow-up (48 hours later) → marks completed
 * 
 * Runs every 5 minutes via cron.
 * Respects send window (08:00-20:00).
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { TECVO_PLATFORM_INSTANCE } from "../_shared/sendFlowTypes.ts";
import { checkSendLimit } from "../_shared/sendGuard.ts";
import { checkAndDebitCredits, finalizeAIUsage } from "../_shared/creditGuard.ts";
import { extractUsageFromResponse, calculateCostUSD } from "../_shared/aiUsageLogger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Follow-up step intervals (delay until next step)
const STEP_DELAYS_MS = {
  0: 4 * 60 * 60 * 1000 + Math.random() * 2 * 60 * 60 * 1000,  // 4-6 hours
  1: 24 * 60 * 60 * 1000,                                         // 24 hours
  2: 48 * 60 * 60 * 1000,                                         // 48 hours
};

const MAX_STEPS = 3; // After step 3 → completed

// Send window check
function isWithinSendWindow(tz: string = "America/Sao_Paulo"): boolean {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", {
    timeZone: tz,
    hour12: false,
    hour: "2-digit",
  });
  const hour = parseInt(timeStr, 10);
  return hour >= 8 && hour < 20;
}

async function sendWhatsApp(phone: string, text: string): Promise<boolean> {
  const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
  const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");
  if (!vpsUrl || !apiKey) return false;

  let cleanNumber = phone.replace(/\D/g, "");
  if (!cleanNumber.startsWith("55") && cleanNumber.length <= 11) {
    cleanNumber = "55" + cleanNumber;
  }
  const jid = `${cleanNumber}@s.whatsapp.net`;

  try {
    const res = await fetch(`${vpsUrl}/message/sendText/${TECVO_PLATFORM_INSTANCE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number: jid, text }),
    });
    if (!res.ok) {
      console.error("[LEAD-FOLLOWUP] Send failed:", res.status);
      return false;
    }
    await res.text();
    return true;
  } catch (err) {
    console.error("[LEAD-FOLLOWUP] Send error:", err);
    return false;
  }
}

async function fetchConversationHistory(
  supabase: any,
  phone: string,
  channelId: string,
  orgId: string,
): Promise<Array<{ role: string; content: string }>> {
  // Find the contact
  const normalizedPhone = phone.replace(/\D/g, "");
  const { data: contact } = await supabase
    .from("whatsapp_contacts")
    .select("id")
    .eq("organization_id", orgId)
    .eq("normalized_phone", normalizedPhone)
    .eq("channel_id", channelId)
    .maybeSingle();

  if (!contact) return [];

  const { data: messages } = await supabase
    .from("whatsapp_messages")
    .select("content, is_from_me, created_at")
    .eq("contact_id", contact.id)
    .eq("channel_id", channelId)
    .not("content", "is", null)
    .order("created_at", { ascending: true })
    .limit(20);

  return (messages || []).map((m: any) => ({
    role: m.is_from_me ? "assistant" : "user",
    content: m.content,
  }));
}

async function generateFollowUpMessage(
  supabase: any,
  step: number,
  conversationHistory: Array<{ role: string; content: string }>,
  orgId: string,
): Promise<{ content: string; usage: any } | null> {
  const stepInstructions: Record<number, string> = {
    0: `Esta é a PRIMEIRA retomada após a resposta inicial. O lead parou de responder há alguns minutos.
Faça uma retomada LEVE e natural, como se estivesse continuando a conversa.
Exemplo: retome o último ponto discutido, faça uma pergunta direcionada, ou compartilhe um benefício rápido.
NÃO repita apresentação. NÃO pareça que está cobrando resposta.`,
    
    1: `Esta é a SEGUNDA retomada. O lead não respondeu há horas.
Use um ângulo DIFERENTE do anterior. Tente:
- Compartilhar um resultado/caso de sucesso
- Fazer uma pergunta sobre a rotina dele
- Oferecer algo de valor (dica prática)
Tom: natural, como se lembrasse de algo útil.`,
    
    2: `Esta é a TERCEIRA retomada. O lead está frio há 1 dia.
Seja DIRETA e breve. Tente:
- Último valor forte ("Vi que muita empresa de AC perde X por mês sem controle")
- Oferta de ação simples ("Quer que eu te mostre em 1 minuto como funciona?")
- Ou convite para testar sem compromisso
Se não converter aqui, encerre com elegância na próxima.`,
    
    3: `Esta é a ÚLTIMA mensagem de follow-up. Se o lead não respondeu até agora, provavelmente não vai.
Encerre de forma elegante e profissional:
- Não seja insistente
- Deixe a porta aberta
- Algo como: "Sem problema! Quando precisar organizar a operação, é só me chamar 😊"
MÁXIMO 2 linhas. Sem pressão.`,
  };

  const systemPrompt = `Você é a Laura, vendedora consultiva da Tecvo. Está fazendo follow-up com um lead que parou de responder.

CONTEXTO:
- Esta pessoa NÃO é cliente
- Ela já conversou antes (veja o histórico)
- Você NÃO deve repetir o que já disse

${stepInstructions[step] || stepInstructions[3]}

REGRAS:
- Mensagem CURTA (máx 300 caracteres)
- Tom natural de WhatsApp, não pareça robô
- NÃO use markdown (sem negrito, listas, etc)
- Português brasileiro
- NÃO repita apresentação
- NÃO use "— Laura" no final (já usado na primeira msg)
- Use emoji com moderação (0-2 por mensagem)`;

  try {
    const aiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
    const aiKey = Deno.env.get("LOVABLE_API_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const resp = await fetch(aiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationHistory.slice(-10), // Last 10 messages for context
          { role: "user", content: "[SISTEMA: Gere a mensagem de follow-up agora. Responda APENAS com o texto da mensagem, sem explicações.]" },
        ],
        max_tokens: 200,
        temperature: 0.8,
      }),
    });

    if (!resp.ok) {
      console.error("[LEAD-FOLLOWUP] AI call failed:", resp.status);
      return null;
    }

    const result = await resp.json();
    const content = result.choices?.[0]?.message?.content?.trim();
    return content ? { content, usage: result.usage } : null;
  } catch (err: any) {
    console.error("[LEAD-FOLLOWUP] AI error:", err.message);
    return null;
  }
}

// Static fallback messages per step (if AI fails)
const FALLBACK_MESSAGES: Record<number, string> = {
  0: "E aí, conseguiu pensar sobre o que falamos? Qualquer dúvida é só mandar! 😊",
  1: "Oi! Passando aqui rapidinho. Sabia que empresas de climatização que usam sistema organizam em média 3x mais serviços por mês? Se quiser, te mostro como funciona 👀",
  2: "Última pergunta: você prefere continuar controlando tudo pelo WhatsApp/caderno ou quer testar algo mais organizado? Sem compromisso 😉",
  3: "Sem problema! Quando precisar organizar a operação, é só me chamar aqui. Boa sorte! 😊",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date();

    // Fetch pending follow-ups whose next_followup_at has passed
    const { data: pendingFollowups, error: fetchErr } = await supabase
      .from("lead_followups")
      .select("*")
      .eq("status", "pending")
      .lte("next_followup_at", now.toISOString())
      .order("next_followup_at", { ascending: true })
      .limit(20); // Process max 20 per run

    if (fetchErr) {
      console.error("[LEAD-FOLLOWUP] Fetch error:", fetchErr.message);
      return jsonResponse({ error: fetchErr.message }, 500);
    }

    if (!pendingFollowups || pendingFollowups.length === 0) {
      return jsonResponse({ message: "No pending follow-ups", processed: 0 });
    }

    console.log(`[LEAD-FOLLOWUP] Found ${pendingFollowups.length} pending follow-ups`);

    const results: any[] = [];

    for (const fu of pendingFollowups) {
      try {
        // Check send window
        if (!isWithinSendWindow()) {
          console.log(`[LEAD-FOLLOWUP] Outside send window, skipping ${fu.phone}`);
          // Reschedule for tomorrow 08:00
          const tomorrow8am = new Date();
          tomorrow8am.setDate(tomorrow8am.getDate() + 1);
          tomorrow8am.setHours(8, 0, 0, 0);
          await supabase.from("lead_followups").update({
            next_followup_at: tomorrow8am.toISOString(),
            updated_at: now.toISOString(),
          }).eq("id", fu.id);
          results.push({ phone: fu.phone, status: "rescheduled_window" });
          continue;
        }

        // Send guard
        const guard = await checkSendLimit(supabase, fu.organization_id, null, "lead_followup");
        if (!guard.allowed) {
          console.log(`[LEAD-FOLLOWUP] Guard blocked for ${fu.phone}: ${guard.reason}`);
          results.push({ phone: fu.phone, status: "blocked_guard" });
          continue;
        }

        // Credit check
        const creditCheck = await checkAndDebitCredits(supabase, fu.organization_id, "", "bot_lead_followup");
        if (!creditCheck.allowed) {
          console.log(`[LEAD-FOLLOWUP] No credits for lead followup, org: ${fu.organization_id}`);
          results.push({ phone: fu.phone, status: "no_credits" });
          continue;
        }

        // Get conversation history for context
        const history = await fetchConversationHistory(supabase, fu.phone, fu.channel_id, fu.organization_id);

        // Generate AI message
        const startTime = Date.now();
        const aiResult = await generateFollowUpMessage(supabase, fu.step, history, fu.organization_id);
        const durationMs = Date.now() - startTime;

        let messageToSend: string;

        if (aiResult?.content) {
          messageToSend = aiResult.content;
          // Finalize AI usage
          const usage = extractUsageFromResponse({ usage: aiResult.usage });
          const estCost = calculateCostUSD("google/gemini-2.5-flash", usage.promptTokens, usage.completionTokens);
          await finalizeAIUsage(supabase, creditCheck.requestId, {
            model: "google/gemini-2.5-flash",
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
            durationMs,
            status: "success",
            estimatedCostUsd: estCost,
          });
        } else {
          // Use static fallback
          messageToSend = FALLBACK_MESSAGES[fu.step] || FALLBACK_MESSAGES[3];
          await finalizeAIUsage(supabase, creditCheck.requestId, {
            durationMs,
            status: "error",
          });
        }

        // Send the message
        const sent = await sendWhatsApp(fu.phone, messageToSend);

        if (sent) {
          // Save the message in whatsapp_messages
          const normalizedPhone = fu.phone.replace(/\D/g, "");
          const { data: contact } = await supabase
            .from("whatsapp_contacts")
            .select("id")
            .eq("organization_id", fu.organization_id)
            .eq("normalized_phone", normalizedPhone)
            .eq("channel_id", fu.channel_id)
            .maybeSingle();

          if (contact) {
            await supabase.from("whatsapp_messages").insert({
              organization_id: fu.organization_id,
              contact_id: contact.id,
              message_id: `followup_${crypto.randomUUID()}`,
              content: messageToSend,
              is_from_me: true,
              status: "sent",
              channel_id: fu.channel_id,
              ai_generated: true,
            });
          }

          // Update follow-up: advance step or complete
          const nextStep = fu.step + 1;
          if (nextStep > MAX_STEPS) {
            await supabase.from("lead_followups").update({
              status: "completed",
              step: nextStep,
              last_followup_sent_at: now.toISOString(),
              completed_at: now.toISOString(),
              updated_at: now.toISOString(),
            }).eq("id", fu.id);
            console.log(`[LEAD-FOLLOWUP] ✅ Completed follow-up for ${fu.phone} (all steps done)`);
          } else {
            const delayMs = nextStep === 1
              ? 4 * 60 * 60 * 1000 + Math.random() * 2 * 60 * 60 * 1000
              : nextStep === 2
                ? 24 * 60 * 60 * 1000
                : 48 * 60 * 60 * 1000;
            const nextFollowupAt = new Date(Date.now() + delayMs).toISOString();
            
            await supabase.from("lead_followups").update({
              step: nextStep,
              last_followup_sent_at: now.toISOString(),
              next_followup_at: nextFollowupAt,
              updated_at: now.toISOString(),
            }).eq("id", fu.id);
            console.log(`[LEAD-FOLLOWUP] ✅ Step ${fu.step} sent to ${fu.phone}, next at ${nextFollowupAt}`);
          }

          results.push({ phone: fu.phone, step: fu.step, status: "sent" });
        } else {
          console.warn(`[LEAD-FOLLOWUP] ❌ Failed to send to ${fu.phone}`);
          results.push({ phone: fu.phone, step: fu.step, status: "send_failed" });
        }

        // Small delay between sends
        await new Promise(r => setTimeout(r, 3000));
      } catch (err: any) {
        console.error(`[LEAD-FOLLOWUP] Error processing ${fu.phone}:`, err.message);
        results.push({ phone: fu.phone, status: "error", error: err.message });
      }
    }

    console.log(`[LEAD-FOLLOWUP] Done. Processed ${results.length} follow-ups.`);
    return jsonResponse({ success: true, processed: results.length, results });
  } catch (error: any) {
    console.error("[LEAD-FOLLOWUP] Fatal error:", error);
    return jsonResponse({ error: error.message }, 500);
  }
});

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
