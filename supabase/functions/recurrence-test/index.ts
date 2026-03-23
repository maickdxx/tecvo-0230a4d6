import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// HARDCODED: Only this number can receive test messages
const ALLOWED_TEST_NUMBER = "19989307608";

const STAGE_DELAY_MS = 5000; // 5 seconds between stages

type MessageStage = "2_months" | "4_months" | "6_months" | "8_months" | "10_months" | "12_months";

interface StageConfig {
  type: MessageStage;
  label: string;
  delayMs: number;
}

const TEST_STAGES: StageConfig[] = [
  { type: "2_months",  label: "2 meses — filtro",          delayMs: 0 },
  { type: "4_months",  label: "4 meses — reforço",         delayMs: STAGE_DELAY_MS },
  { type: "6_months",  label: "6 meses — limpeza ideal",   delayMs: STAGE_DELAY_MS * 2 },
  { type: "8_months",  label: "8 meses — reengajamento 1", delayMs: STAGE_DELAY_MS * 3 },
  { type: "10_months", label: "10 meses — reengajamento 2", delayMs: STAGE_DELAY_MS * 4 },
  { type: "12_months", label: "12 meses — última tentativa", delayMs: STAGE_DELAY_MS * 5 },
];

const DEFAULT_MESSAGES: Record<MessageStage, string> = {
  "2_months": "⚠️ [TESTE] Olá {nome}! Já faz 2 meses desde a última limpeza do seu ar-condicionado 😊\nRecomendamos a limpeza do filtro para manter o bom funcionamento.\nDaqui a alguns meses será o momento ideal para a limpeza completa. Se precisar, estamos à disposição!",
  "4_months": "⚠️ [TESTE] Olá {nome}! Já faz 4 meses desde a última limpeza do seu ar-condicionado 😊\nManter o filtro limpo ajuda muito no desempenho do equipamento.\nEm breve será o momento ideal para uma nova limpeza completa. Se quiser já se programar, estamos à disposição!",
  "6_months": "⚠️ [TESTE] Olá {nome}! Já faz cerca de 6 meses desde a última limpeza do seu ar-condicionado 😊\nEsse é o momento ideal para realizar uma nova higienização e evitar problemas.\nQuer agendar?",
  "8_months": "⚠️ [TESTE] Olá {nome}! Já faz cerca de 8 meses desde a última limpeza do seu ar-condicionado.\nA limpeza já passou do prazo ideal e isso pode afetar o desempenho do equipamento.\nQuer agendar com a gente?",
  "10_months": "⚠️ [TESTE] Olá {nome}! Já faz cerca de 10 meses desde a última limpeza do seu ar-condicionado.\nManter a higienização em dia ajuda a evitar perda de eficiência, mau cheiro e outros problemas.\nSe quiser, podemos te ajudar a agendar.",
  "12_months": "⚠️ [TESTE] Olá {nome}! Já faz cerca de 12 meses desde a última limpeza do seu ar-condicionado.\nEsse tempo já está bem acima do ideal para manutenção preventiva.\nCaso queira agendar sua limpeza, estamos à disposição.",
};

async function sendWhatsApp(phone: string, text: string, instanceName: string): Promise<boolean> {
  const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
  const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");
  if (!vpsUrl || !apiKey) return false;

  let cleanNumber = phone.replace(/\D/g, "");
  if (!cleanNumber.startsWith("55") && cleanNumber.length <= 11) {
    cleanNumber = "55" + cleanNumber;
  }
  const jid = `${cleanNumber}@s.whatsapp.net`;

  try {
    const res = await fetch(`${vpsUrl}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number: jid, text }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[TEST] Send failed:", res.status, body);
      return false;
    }
    await res.text();
    return true;
  } catch (err) {
    console.error("[TEST] Send error:", err);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth: verify_jwt=false in config.toml handles gateway auth.
  // Additional check: require service_role or anon key for safety.
  // With verify_jwt=false, Supabase gateway lets the request through,
  // so we just validate the request has proper structure.

  try {
    const body = await req.json().catch(() => ({}));
    const { organization_id, client_name } = body as { organization_id?: string; client_name?: string };

    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve org's connected WhatsApp instance
    const { data: channel } = await supabase
      .from("whatsapp_channels")
      .select("instance_name, is_connected")
      .eq("organization_id", organization_id)
      .eq("is_connected", true)
      .eq("channel_type", "CUSTOMER_INBOX")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!channel?.instance_name) {
      return new Response(JSON.stringify({ error: "No connected WhatsApp instance for this organization" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const instanceName = channel.instance_name;
    const firstName = client_name?.split(" ")[0] || "Cliente";
    const testPhone = ALLOWED_TEST_NUMBER;

    console.log(`[TEST] Starting recurrence test for org=${organization_id} instance=${instanceName} phone=${testPhone}`);

    const log: { stage: string; sentAt: string; status: string; content: string }[] = [];

    for (let i = 0; i < TEST_STAGES.length; i++) {
      const stage = TEST_STAGES[i];

      // Wait the delay (0 for first stage)
      if (i > 0) {
        await new Promise(r => setTimeout(r, STAGE_DELAY_MS));
      }

      const message = DEFAULT_MESSAGES[stage.type].replace(/\{nome\}/g, firstName);
      const sentAt = new Date().toISOString();

      console.log(`[TEST] Stage ${stage.label} — sending via ${instanceName}...`);

      const sent = await sendWhatsApp(testPhone, message, instanceName);

      const entry = {
        stage: stage.label,
        sentAt,
        status: sent ? "sent" : "failed",
        content: message.substring(0, 100) + "...",
      };
      log.push(entry);

      console.log(`[TEST] Stage ${stage.label} — ${sent ? "✅ sent" : "❌ failed"}`);
    }

    console.log(`[TEST] Complete. ${log.filter(l => l.status === "sent").length}/${log.length} messages sent.`);

    return new Response(JSON.stringify({
      test: true,
      organization_id,
      instance_used: instanceName,
      target_phone: testPhone,
      stages_completed: log.length,
      stages_sent: log.filter(l => l.status === "sent").length,
      log,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[TEST] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
