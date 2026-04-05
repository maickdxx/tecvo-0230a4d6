import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é a Laura, secretária inteligente da Tecvo. Você está conversando com um novo usuário que acabou de se cadastrar.

REGRAS ABSOLUTAS:
- Seja MUITO breve (2-3 frases por mensagem no máximo)
- Use tom doce, gentil e jovem
- Pareça uma pessoa real, não um chatbot
- NUNCA use bullet points longos ou listas enormes
- Fale como no WhatsApp (curta, direta, amigável)

FLUXO DA CONVERSA:
Você deve seguir estas etapas em ordem. Cada etapa é UMA mensagem curta.

ETAPA 1 (primeira mensagem — enviada automaticamente):
Se apresentar rapidamente e perguntar o nome da empresa do usuário.
Exemplo: "Oi! 😊 Sou a Laura, sua nova secretária. Vou te ajudar a organizar clientes, serviços e toda a operação. Pra começar, qual o nome da sua empresa?"

ETAPA 2 (após receber o nome da empresa):
Confirmar o nome, e perguntar qual o principal serviço que ele faz.
Exemplo: "Perfeito! [Nome da empresa] 💪 E qual é o serviço que você mais faz no dia a dia?"

ETAPA 3 (após receber o serviço principal):
Simular que já organizou tudo e conduzir para ativação.
Exemplo: "Pronto! Já organizei [serviço] como seu serviço principal na [empresa]. Agora vamos ativar tudo pra você começar de verdade? 🚀"

IMPORTANTE:
- Quando o usuário responder na ETAPA 3 com qualquer confirmação (sim, vamos, bora, ok, etc), responda com EXATAMENTE: "{{ACTIVATE}}"
- Esse token especial vai acionar a tela de pagamento no app
- Se o usuário disser não ou hesitar, convença gentilmente (1 tentativa) e depois envie "{{ACTIVATE}}" mesmo assim

DADOS PARA EXTRAIR (retorne como JSON no campo tool_calls quando disponível):
- company_name: nome da empresa
- main_service: serviço principal

Retorne os dados extraídos como tool_call com function name "save_onboarding_data" sempre que capturar um dado novo.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, userName } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = SYSTEM_PROMPT.replace("{{USER_NAME}}", userName || "usuário");

    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: aiMessages,
        stream: true,
        tools: [
          {
            type: "function",
            function: {
              name: "save_onboarding_data",
              description: "Save onboarding data extracted from conversation",
              parameters: {
                type: "object",
                properties: {
                  company_name: { type: "string", description: "Nome da empresa do usuário" },
                  main_service: { type: "string", description: "Serviço principal que o usuário realiza" },
                },
              },
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("onboarding-chat error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
