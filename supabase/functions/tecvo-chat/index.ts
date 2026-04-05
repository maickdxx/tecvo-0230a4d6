import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { logAIUsage } from "../_shared/aiUsageLogger.ts";
import { getTodayInTz, fetchOrgTimezone } from "../_shared/timezone.ts";
import { validateUserOrgAccess, accessDeniedResponse } from "../_shared/validateOrgAccess.ts";
import { createSanitizedStream, logOutputViolation } from "../_shared/outputValidator.ts";
import {
  fetchOrgContext,
  buildSystemPrompt,
  buildToolsInstruction,
  ADMIN_TOOLS,
  executeAdminTool,
} from "../_shared/lauraPrompt.ts";

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

    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const { messages, organizationId, mode } = await req.json();
    if (!organizationId) {
      return new Response(JSON.stringify({ error: "organizationId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hasAccess = await validateUserOrgAccess(supabaseAdmin, userId, organizationId, "tecvo-chat");
    if (!hasAccess) {
      return accessDeniedResponse(corsHeaders);
    }

    // Fetch org context using shared module
    const orgContext = await fetchOrgContext(supabaseAdmin, organizationId);
    const orgTz = orgContext.timezone;
    const todayISO = getTodayInTz(orgTz);

    // Build unified system prompt (same as WhatsApp)
    let systemPrompt = buildSystemPrompt(orgContext);

    // Add tools instruction
    systemPrompt += buildToolsInstruction(todayISO);

    // App-specific: no WhatsApp formatting needed, use markdown
    systemPrompt += `\n\nCANAL: App Web. Use markdown para formatação (negrito, listas, etc). NÃO use prefixo "Laura:" nas mensagens.`;

    // Proactive tip mode
    if (mode === "proactive_tip") {
      systemPrompt += `\n\nMODO PROATIVO: Envie UMA dica curta e útil baseada nos dados reais.
Foco em: recorrência de clientes, ticket médio, pagamentos vencidos, oportunidades de faturamento.
Tom: direto, prático. Máximo 2-3 frases. Comece com uma observação concreta. Use emoji se apropriado.
NÃO cumprimente. NÃO diga "olá". Vá direto ao ponto.`;
    }

    const chatMessages = mode === "proactive_tip"
      ? [{ role: "system", content: systemPrompt }, { role: "user", content: "Me dê uma dica proativa baseada nos dados da minha empresa." }]
      : [{ role: "system", content: systemPrompt }, ...messages];

    const aiModel = "google/gemini-2.5-flash";
    const startTime = Date.now();

    // Non-streaming call with tools support
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: aiModel,
        messages: chatMessages,
        tools: ADMIN_TOOLS,
        stream: false,
      }),
    });

    if (!response.ok) {
      const durationMs = Date.now() - startTime;
      const errorStatus = response.status === 429 ? "rate_limited" : "error";
      await logAIUsage(supabaseAdmin, {
        organizationId, userId, actionSlug: "tecvo_chat", model: aiModel,
        promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMs, status: errorStatus,
      });

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Entre em contato com o suporte." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result = await response.json();
    let choice = result.choices?.[0];
    let finalContent = choice?.message?.content || "";

    // Handle tool calls (up to 3 rounds)
    let toolMessages: any[] = [...chatMessages];
    let toolRound = 0;
    const maxToolRounds = 3;

    while (choice?.message?.tool_calls && choice.message.tool_calls.length > 0 && toolRound < maxToolRounds) {
      toolRound++;
      console.log("[TECVO-CHAT] Tool calls round", toolRound, ":", choice.message.tool_calls.length);

      toolMessages.push({
        role: "assistant",
        content: choice.message.content || "",
        tool_calls: choice.message.tool_calls,
      });

      for (const tc of choice.message.tool_calls) {
        const toolResult = await executeAdminTool(
          supabaseAdmin,
          organizationId,
          tc,
          orgContext,
        );
        console.log("[TECVO-CHAT] Tool result:", toolResult.slice(0, 200));

        toolMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: toolResult,
        });
      }

      // Next AI call
      const allowMoreTools = toolRound < maxToolRounds;
      const nextResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: aiModel,
          messages: toolMessages,
          ...(allowMoreTools ? { tools: ADMIN_TOOLS } : {}),
          stream: false,
        }),
      });

      if (!nextResponse.ok) {
        const errText = await nextResponse.text();
        console.error("[TECVO-CHAT] AI error on tool round:", nextResponse.status, errText.slice(0, 300));
        break;
      }

      result = await nextResponse.json();
      choice = result.choices?.[0];
      finalContent = choice?.message?.content || finalContent;
    }

    const durationMs = Date.now() - startTime;

    // Log usage
    const usage = result.usage || {};
    await logAIUsage(supabaseAdmin, {
      organizationId, userId, actionSlug: "tecvo_chat", model: aiModel,
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      totalTokens: usage.total_tokens || 0,
      durationMs, status: "success",
    });

    // Return as SSE stream format for frontend compatibility
    const encoder = new TextEncoder();
    const sseData = `data: ${JSON.stringify({ choices: [{ delta: { content: finalContent } }] })}\n\ndata: [DONE]\n\n`;

    return new Response(encoder.encode(sseData), {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("tecvo-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
