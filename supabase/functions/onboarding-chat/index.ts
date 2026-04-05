import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "google/gemini-2.5-flash";

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

const BodySchema = z.object({
  userName: z.string().optional().nullable(),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    }),
  ).max(20),
});

type ChatMessage = {
  role: "user" | "assistant" | "tool";
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
};

type ExtractedData = {
  company_name?: string;
  main_service?: string;
};

const tools = [
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
];

async function callAI(messages: ChatMessage[], systemPrompt: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      stream: false,
      tools,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      throw new Response(JSON.stringify({ error: "Credits exhausted" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const text = await response.text();
    console.error("AI gateway error:", response.status, text);
    throw new Error("AI error");
  }

  const result = await response.json();
  const choice = result.choices?.[0];

  return {
    content: choice?.message?.content || "",
    toolCalls: choice?.message?.tool_calls || [],
  };
}

function mergeExtractedData(current: ExtractedData, incoming: Record<string, unknown>): ExtractedData {
  const next = { ...current };
  if (typeof incoming.company_name === "string" && incoming.company_name.trim()) {
    next.company_name = incoming.company_name.trim();
  }
  if (typeof incoming.main_service === "string" && incoming.main_service.trim()) {
    next.main_service = incoming.main_service.trim();
  }
  return next;
}

function fallbackContent(messages: ChatMessage[], extractedData: ExtractedData): string {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content?.trim() || "";
  const normalizedLastUser = lastUserMessage.toLowerCase();

  if (/(^|\b)(sim|vamos|bora|ok|beleza|claro|pode|perfeito|quero)(\b|$)/i.test(normalizedLastUser)) {
    return "Perfeito! Vamos lá 🚀 {{ACTIVATE}}";
  }

  if (extractedData.main_service) {
    const companyPart = extractedData.company_name ? ` na ${extractedData.company_name}` : "";
    return `Pronto! Já organizei ${extractedData.main_service} como seu serviço principal${companyPart}. Agora vamos ativar tudo pra você começar de verdade? 🚀`;
  }

  if (extractedData.company_name) {
    return `${extractedData.company_name}, adorei! 💪 E qual serviço você mais faz no dia a dia?`;
  }

  return "Perfeito! Me diz qual o nome da sua empresa?";
}

function chunkText(content: string, size = 120): string[] {
  if (!content) return [];
  const chunks: string[] = [];
  for (let index = 0; index < content.length; index += size) {
    chunks.push(content.slice(index, index + size));
  }
  return chunks;
}

function buildSSEPayload(content: string, extractedData: ExtractedData): string {
  const payloadParts: string[] = [];

  if (Object.keys(extractedData).length > 0) {
    payloadParts.push(
      `data: ${JSON.stringify({
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  index: 0,
                  function: {
                    arguments: JSON.stringify(extractedData),
                  },
                },
              ],
            },
          },
        ],
      })}\n\n`,
    );
  }

  const textChunks = chunkText(content);
  if (textChunks.length === 0) {
    textChunks.push("");
  }

  textChunks.forEach((chunk, index) => {
    payloadParts.push(
      `data: ${JSON.stringify({
        choices: [
          {
            index: 0,
            delta: {
              role: index === 0 ? "assistant" : undefined,
              content: chunk,
            },
          },
        ],
      })}\n\n`,
    );
  });

  payloadParts.push("data: [DONE]\n\n");
  return payloadParts.join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const parsedBody = BodySchema.safeParse(await req.json());
    if (!parsedBody.success) {
      return new Response(JSON.stringify({ error: parsedBody.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, userName } = parsedBody.data;
    const systemPrompt = SYSTEM_PROMPT.replaceAll("{{USER_NAME}}", userName || "");

    const conversationMessages: ChatMessage[] = [...messages];
    let extractedData: ExtractedData = {};
    let finalContent = "";
    let lastNonEmptyContent = "";

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = await callAI(conversationMessages, systemPrompt);

      if (result.content?.trim()) {
        lastNonEmptyContent = result.content.trim();
      }

      if (!result.toolCalls.length) {
        finalContent = result.content?.trim() || lastNonEmptyContent;
        break;
      }

      conversationMessages.push({
        role: "assistant",
        content: result.content || "",
        tool_calls: result.toolCalls,
      });

      for (const toolCall of result.toolCalls) {
        let toolArgs: Record<string, unknown> = {};

        try {
          toolArgs = JSON.parse(toolCall?.function?.arguments || "{}");
        } catch {
          toolArgs = {};
        }

        extractedData = mergeExtractedData(extractedData, toolArgs);

        conversationMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify({ ok: true, saved: toolArgs }),
        });
      }
    }

    const contentToSend = finalContent || fallbackContent(conversationMessages, extractedData);
    const ssePayload = buildSSEPayload(contentToSend, extractedData);

    return new Response(ssePayload, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error("onboarding-chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
