import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { logAIUsage, extractUsageFromResponse } from "../_shared/aiUsageLogger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { contactId, organizationId, conversationMessages, userQuestion, mode, targetMessage } = await req.json();
    // mode: "suggest" (generate reply suggestions) or "chat" (free chat question)

    if (!organizationId) {
      return new Response(JSON.stringify({ error: "organizationId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check and consume AI credits
    const { data: hasCredits, error: creditError } = await supabaseAdmin.rpc("consume_ai_credits", {
      _org_id: organizationId,
      _action_slug: "copilot_response",
      _user_id: userId,
    });

    if (creditError || !hasCredits) {
      return new Response(JSON.stringify({ error: "Créditos de IA insuficientes. Recarregue seus créditos para continuar." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch context data in parallel
    const [orgRes, catalogRes, quickRepliesRes, clientRes, recentServicesRes] = await Promise.all([
      supabaseAdmin
        .from("organizations")
        .select("name, phone, email, city, state, address")
        .eq("id", organizationId)
        .single(),
      supabaseAdmin
        .from("catalog_services")
        .select("name, description, unit_price, service_type")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .is("deleted_at", null)
        .limit(100),
      supabaseAdmin
        .from("whatsapp_quick_messages")
        .select("title, content, category")
        .eq("organization_id", organizationId)
        .limit(50),
      // If we have a contactId, get linked client info
      contactId
        ? supabaseAdmin
            .from("whatsapp_contacts")
            .select("name, phone, linked_client_id, tags, notes")
            .eq("id", contactId)
            .single()
        : Promise.resolve({ data: null }),
      // Recent services for context
      contactId
        ? supabaseAdmin
            .from("whatsapp_contacts")
            .select("linked_client_id")
            .eq("id", contactId)
            .single()
            .then(async ({ data }) => {
              if (!data?.linked_client_id) return { data: [] };
              return supabaseAdmin
                .from("services")
                .select("description, service_type, status, value, scheduled_date, completed_date")
                .eq("client_id", data.linked_client_id)
                .eq("organization_id", organizationId)
                .is("deleted_at", null)
                .order("created_at", { ascending: false })
                .limit(10);
            })
        : Promise.resolve({ data: [] }),
    ]);

    const org = orgRes.data;
    const catalog = catalogRes.data || [];
    const quickReplies = quickRepliesRes.data || [];
    const contactInfo = clientRes.data;
    const recentServices = recentServicesRes.data || [];

    // Build catalog summary
    const catalogSummary = catalog.length > 0
      ? catalog.map((s: any) => `- ${s.name}: R$ ${s.unit_price?.toFixed(2) || "sob consulta"} (${s.service_type || "geral"})${s.description ? ` — ${s.description}` : ""}`).join("\n")
      : "Nenhum serviço cadastrado no catálogo.";

    // Build quick replies summary
    const quickRepliesSummary = quickReplies.length > 0
      ? quickReplies.map((r: any) => `- [${r.category || "geral"}] ${r.title}: "${r.content}"`).join("\n")
      : "Nenhuma resposta rápida cadastrada.";

    // Build services history
    const servicesSummary = recentServices.length > 0
      ? recentServices.map((s: any) => `- ${s.service_type} | ${s.status} | R$ ${s.value?.toFixed(2) || "?"} | ${s.scheduled_date || ""} | ${s.description || ""}`).join("\n")
      : "";

    const contactContext = contactInfo
      ? `Cliente: ${contactInfo.name || "Não identificado"}, Telefone: ${contactInfo.phone || "?"}, Tags: ${(contactInfo.tags || []).join(", ") || "nenhuma"}, Notas internas: ${contactInfo.notes || "nenhuma"}`
      : "";

    const systemPrompt = `Você é o Copiloto de Atendimento da empresa "${org?.name || ""}".
Sua função é ajudar o atendente humano a responder clientes via WhatsApp de forma rápida, profissional e alinhada com a empresa.

REGRAS:
- Responda SEMPRE em português brasileiro
- Mensagens curtas e diretas (WhatsApp não é email)
- Use emojis com moderação quando apropriado
- Nunca invente preços ou informações que não estejam nos dados fornecidos
- Se não souber o preço exato, sugira que o atendente consulte ou diga "sob consulta"
- Adapte o tom para ser profissional mas acessível
- Não use markdown pesado (sem #, ##, **bold** etc.) — é WhatsApp
- Máximo 300 caracteres por sugestão

DADOS DA EMPRESA:
Nome: ${org?.name || "?"}
Telefone: ${org?.phone || "?"}
Email: ${org?.email || "?"}
Cidade: ${org?.city || "?"} - ${org?.state || "?"}

CATÁLOGO DE SERVIÇOS E PREÇOS:
${catalogSummary}

RESPOSTAS RÁPIDAS CADASTRADAS (padrões da empresa):
${quickRepliesSummary}

${contactContext ? `INFORMAÇÕES DO CONTATO ATUAL:\n${contactContext}` : ""}

${servicesSummary ? `HISTÓRICO DE SERVIÇOS DESTE CLIENTE:\n${servicesSummary}` : ""}

${mode === "suggest"
  ? `TAREFA: Analise a conversa abaixo e gere EXATAMENTE 3 sugestões de resposta diferentes.
Retorne APENAS um JSON array com 3 objetos, cada um com os campos "text" (a mensagem sugerida) e "label" (rótulo curto como "Profissional", "Informal", "Objetivo").
Formato: [{"label":"...","text":"..."},{"label":"...","text":"..."},{"label":"...","text":"..."}]
NÃO inclua nenhum texto fora do JSON.`
  : `TAREFA: O atendente tem uma pergunta interna. Responda com base nos dados da empresa.
Seja direto e útil. Pode citar preços, sugerir abordagens ou dar informações do catálogo.`
}`;

    const aiMessages: any[] = [{ role: "system", content: systemPrompt }];

    // Add conversation context
    if (conversationMessages && conversationMessages.length > 0) {
      const contextMsg = conversationMessages
        .slice(-30) // last 30 messages for better context
        .map((m: any) => `${m.is_from_me ? "[Atendente]" : "[Cliente]"} (${m.created_at ? new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "?"}): ${m.content}`)
        .join("\n");
      aiMessages.push({ role: "user", content: `CONVERSA ATUAL:\n${contextMsg}` });
    }

    // Add user question for chat mode
    if (mode === "chat" && userQuestion) {
      aiMessages.push({ role: "user", content: `PERGUNTA DO ATENDENTE: ${userQuestion}` });
    } else if (mode === "suggest") {
      if (targetMessage) {
        aiMessages.push({ role: "user", content: `Gere 3 sugestões de resposta especificamente para ESTA mensagem do cliente:\n"${targetMessage.content}"\n\nIMPORTANTE: As sugestões devem ser respostas diretas a esta mensagem específica, não à última mensagem da conversa.` });
      } else {
        aiMessages.push({ role: "user", content: "Gere 3 sugestões de resposta para a ÚLTIMA mensagem relevante da conversa (considere a mensagem mais recente que precisa de resposta)." });
      }
    }

    const aiModel = "google/gemini-2.5-flash";
    const startTime = Date.now();

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: aiModel,
        messages: aiMessages,
        stream: mode === "chat",
        ...(mode === "suggest" ? { temperature: 0.7 } : {}),
      }),
    });

    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      const errorStatus = response.status === 429 ? "rate_limited" : "error";
      await logAIUsage(supabaseAdmin, {
        organizationId, userId, actionSlug: "copilot_response", model: aiModel,
        promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMs, status: errorStatus,
      });

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro na IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "chat") {
      // Log streaming call (no token data available)
      await logAIUsage(supabaseAdmin, {
        organizationId, userId, actionSlug: "copilot_chat", model: aiModel,
        promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMs, status: "success",
      });

      // Stream response
      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    } else {
      // Parse suggestions
      const result = await response.json();
      const content = result.choices?.[0]?.message?.content || "[]";

      // Log usage with tokens
      const usage = extractUsageFromResponse(result);
      await logAIUsage(supabaseAdmin, {
        organizationId, userId, actionSlug: "copilot_suggest", model: aiModel,
        promptTokens: usage.promptTokens, completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens, durationMs: Date.now() - startTime, status: "success",
      });
      
      // Extract JSON from the response
      let suggestions = [];
      try {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          suggestions = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error("Failed to parse suggestions:", e, content);
        suggestions = [{ label: "Sugestão", text: content }];
      }

      return new Response(JSON.stringify({ suggestions }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("whatsapp-ai-copilot error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
