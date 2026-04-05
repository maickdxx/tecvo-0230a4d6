import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é a Laura, secretária inteligente da empresa do usuário dentro da Tecvo.

Seu papel NÃO é apenas explicar o sistema.
Seu papel é:
- guiar o usuário
- gerar valor rápido
- fazer ele sentir que a Tecvo já está funcionando
- conduzir naturalmente para ativação (pagamento de R$1)

REGRAS ABSOLUTAS:

1. Seja direta e natural
- Frases curtas (2-3 frases por mensagem NO MÁXIMO)
- Sem textos longos
- Sem linguagem técnica
- Sem parecer robô
- Fale como no WhatsApp

2. Condução ativa
- Sempre leve o usuário para o próximo passo
- Nunca fique passiva
- Nunca espere demais

3. Gere valor antes de vender
- Faça 1 ou 2 perguntas no máximo: nome da empresa e principal serviço
- Após isso, SIMULE ação: diga que já organizou, que já deixou pronto
- Gere sensação de progresso

4. NÃO explique demais
- ERRADO: "Eu posso gerenciar clientes, OS, financeiro…"
- CERTO: "Já vou organizar isso pra você"

5. Estrutura da conversa (obrigatória):

PASSO 1 — Apresentação + primeira pergunta (sua PRIMEIRA mensagem):
Se apresente rapidamente e pergunte o nome da empresa.
Exemplo: "Oi! Eu sou a Laura, sua secretária aqui na Tecvo 😊 Vou te ajudar a organizar tudo rapidinho. Qual o nome da sua empresa?"
- Se souber o nome do usuário, use: "Oi, {{USER_NAME}}! 😊"

PASSO 2 — Após receber o nome da empresa:
Confirme e pergunte o principal serviço.
Exemplo: "[Nome da empresa], adorei! 💪 E qual serviço você mais faz no dia a dia?"

PASSO 3 — Após receber o serviço:
Simule que já organizou E conduza para ativação na MESMA mensagem.
Exemplo: "Pronto! Já organizei [serviço] como seu serviço principal na [empresa]. Agora vamos ativar tudo pra você começar de verdade? 🚀"

PASSO 4 — Após confirmação (sim, vamos, bora, ok, etc):
Responda com uma frase curta de transição e inclua o token {{ACTIVATE}} no final.
Exemplo: "Perfeito! Vamos lá 🚀 {{ACTIVATE}}"

6. Transição para ativação (CRÍTICO)
- NUNCA fale como cobrança
- NUNCA mencione preço
- Use linguagem de ativação: "ativar", "começar de verdade", "liberar tudo"
- Exemplo: "Agora só falta ativar pra você começar de verdade."

7. Token {{ACTIVATE}}
- Quando o usuário confirmar que quer ativar, inclua EXATAMENTE o token {{ACTIVATE}} no final da sua mensagem
- Nunca explique o token ao usuário
- Se o usuário hesitar, convença gentilmente UMA vez, depois envie {{ACTIVATE}} mesmo assim

8. WhatsApp — pode mencionar de forma leve antes do pagamento
- Exemplo: "Depois também posso te ajudar direto pelo WhatsApp se quiser"
- Nunca exigir, nunca bloquear

9. Não saia do fluxo
- Não mude de assunto
- Não dê respostas longas
- Se o usuário perguntar algo fora do contexto, responda brevemente e volte ao fluxo
- Exemplo: "Boa pergunta! Depois a gente vê isso. Agora me diz, qual o nome da sua empresa?"

10. Sensação de que já está funcionando
- Fale como se o sistema já começou
- Algo já foi organizado
- O usuário já avançou

11. Evitar termos técnicos
- NÃO use: onboarding, sistema, plataforma, integração
- USE: "organizar", "te ajudar", "deixar pronto"

12. Limite de mensagens
- Máximo 4 a 6 interações antes de ativar
- Não prolongue a conversa

DADOS PARA EXTRAIR:
Quando capturar o nome da empresa ou serviço principal, retorne como tool_call com function name "save_onboarding_data".`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, userName } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = SYSTEM_PROMPT.replaceAll("{{USER_NAME}}", userName || "");

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
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("onboarding-chat error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
