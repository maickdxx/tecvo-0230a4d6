import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { calculateCostUSD } from "../_shared/aiUsageLogger.ts";
import { getTodayInTz, fetchOrgTimezone } from "../_shared/timezone.ts";
import { validateUserOrgAccess, accessDeniedResponse } from "../_shared/validateOrgAccess.ts";
import { createSanitizedStream, logOutputViolation } from "../_shared/outputValidator.ts";
import { checkAndDebitCredits, finalizeAIUsage } from "../_shared/creditGuard.ts";
import { checkAIRateLimit } from "../_shared/aiRateLimit.ts";
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

    // ── RATE LIMIT: check burst + daily cap ──
    const rateCheck = await checkAIRateLimit(supabaseAdmin, organizationId, corsHeaders);
    if (!rateCheck.allowed) {
      return rateCheck.response!;
    }

    // ── CREDIT GUARD: debit before any AI call ──
    const actionSlug = mode === "proactive_tip" ? "proactive_tip" : "tecvo_chat";
    const creditCheck = await checkAndDebitCredits(supabaseAdmin, organizationId, userId, actionSlug, corsHeaders);
    if (!creditCheck.allowed) {
      return creditCheck.response!;
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
      await finalizeAIUsage(supabaseAdmin, creditCheck.requestId, {
        model: aiModel, promptTokens: 0, completionTokens: 0, totalTokens: 0,
        durationMs, status: errorStatus,
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
    let toolErrors: string[] = [];

    while (choice?.message?.tool_calls && choice.message.tool_calls.length > 0 && toolRound < maxToolRounds) {
      toolRound++;
      console.log("[TECVO-CHAT] Tool calls round", toolRound, ":", choice.message.tool_calls.length);

      toolMessages.push({
        role: "assistant",
        content: choice.message.content || "",
        tool_calls: choice.message.tool_calls,
      });

      for (const tc of choice.message.tool_calls) {
        let toolResult: string;
        try {
          toolResult = await executeAdminTool(
            supabaseAdmin,
            organizationId,
            tc,
            orgContext,
          );
        } catch (toolErr: any) {
          const errMsg = toolErr?.message || String(toolErr);
          console.error("[TECVO-CHAT] Tool execution crash:", tc.function?.name, errMsg);
          toolResult = `❌ Erro interno ao executar "${tc.function?.name || "ação"}". O sistema registrou o problema. Tente novamente ou faça a ação manualmente no sistema.`;
          toolErrors.push(`${tc.function?.name}: ${errMsg}`);
          
          // Log the crash
          await logAIUsage(supabaseAdmin, {
            organizationId, userId, actionSlug: `tool_crash_${tc.function?.name || "unknown"}`, model: aiModel,
            promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMs: 0, status: "error",
          }).catch(() => {});
        }

        // Validate tool result is never empty
        if (!toolResult || toolResult.trim() === "") {
          toolResult = `⚠️ A ação "${tc.function?.name || "solicitada"}" não retornou resultado. Isso pode indicar um problema temporário. Tente novamente.`;
        }

        // ── Translate PENDING_CONFIRMATION into AI-friendly instruction ──
        if (toolResult.startsWith("PENDING_CONFIRMATION:")) {
          toolResult = "O envio da OS requer confirmação do usuário. Pergunte ao usuário se deseja enviar o PDF da OS para o cliente. Quando ele confirmar, chame send_service_pdf novamente com confirmed=true e target='client'.";
        }

        // ── Handle SILENT_PDF_SENT_SELF — self-send completed ──
        if (toolResult.startsWith("SILENT_PDF_SENT_SELF:")) {
          const label = toolResult.replace("SILENT_PDF_SENT_SELF:", "").trim();
          toolResult = `PDF enviado com sucesso para você: ${label}`;
        }

        console.log("[TECVO-CHAT] Tool result:", toolResult.slice(0, 200));

        toolMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: toolResult,
        });
      }

      // Next AI call
      const allowMoreTools = toolRound < maxToolRounds;
      let nextResponse: Response;
      try {
        nextResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
      } catch (fetchErr: any) {
        console.error("[TECVO-CHAT] AI fetch error on tool round:", fetchErr?.message);
        // Use last known content or generate fallback
        if (!finalContent) {
          finalContent = "Desculpe, tive um problema de conexão ao processar sua solicitação. Os dados das ações executadas foram salvos. Tente perguntar novamente.";
        }
        break;
      }

      if (!nextResponse.ok) {
        const errText = await nextResponse.text();
        console.error("[TECVO-CHAT] AI error on tool round:", nextResponse.status, errText.slice(0, 300));
        
        await logAIUsage(supabaseAdmin, {
          organizationId, userId, actionSlug: "tecvo_chat_tool_round_error", model: aiModel,
          promptTokens: 0, completionTokens: 0, totalTokens: 0,
          durationMs: Date.now() - startTime, status: "error",
        }).catch(() => {});
        
        // Fallback: use whatever content we have
        if (!finalContent) {
          finalContent = "Executei as ações solicitadas, mas tive dificuldade em formatar a resposta. Verifique os dados no sistema para confirmar.";
        }
        break;
      }

      result = await nextResponse.json();
      choice = result.choices?.[0];
      finalContent = choice?.message?.content || finalContent;
    }

    // CRITICAL: Never return empty response
    if (!finalContent || finalContent.trim() === "") {
      console.warn("[TECVO-CHAT] Empty final content, generating fallback");
      
      await logAIUsage(supabaseAdmin, {
        organizationId, userId, actionSlug: "tecvo_chat_empty_response", model: aiModel,
        promptTokens: 0, completionTokens: 0, totalTokens: 0,
        durationMs: Date.now() - startTime, status: "error",
      }).catch(() => {});

      // Retry once without tools
      try {
        const retryResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: aiModel,
            messages: toolMessages.length > chatMessages.length ? toolMessages : chatMessages,
            stream: false,
          }),
        });
        if (retryResponse.ok) {
          const retryResult = await retryResponse.json();
          finalContent = retryResult.choices?.[0]?.message?.content || "";
        }
      } catch {
        // ignore retry failure
      }

      // Ultimate fallback
      if (!finalContent || finalContent.trim() === "") {
        finalContent = "Desculpe, não consegui processar sua solicitação agora. Pode tentar novamente? Se o problema persistir, tente reformular a pergunta ou faça a ação diretamente no sistema.";
      }
    }

    const durationMs = Date.now() - startTime;

    // ── Audit numerical responses ──
    try {
      const numberPattern = /\b\d[\d.,]*\b/g;
      const numbersCited = (finalContent.match(numberPattern) || [])
        .filter((n: string) => parseFloat(n.replace(/\./g, '').replace(',', '.')) > 0)
        .slice(0, 20);

      if (numbersCited.length > 0) {
        const meta = orgContext._meta || {};
        const userQuestion = messages?.[messages.length - 1]?.content || mode || '';
        const hasTruncation = !!(meta.servicesTruncated || meta.clientsTruncated || meta.transactionsTruncated);
        const hasPartialPeriod = (meta.servicePeriodDays || 180) < 365;
        const classification = hasTruncation ? 'parcial' : hasPartialPeriod ? 'parcial' : 'completa';

        await supabaseAdmin.from('ai_response_audit').insert({
          organization_id: organizationId,
          user_id: userId,
          channel: 'app',
          user_question: userQuestion.slice(0, 2000),
          ai_response: finalContent.slice(0, 5000),
          numbers_cited: numbersCited,
          data_source: JSON.stringify({
            servicesLoaded: orgContext.services?.length || 0,
            serviceTotalAllTime: meta.serviceTotalAllTime,
            servicesTruncated: meta.servicesTruncated || false,
            clientsLoaded: orgContext.clients?.length || 0,
            clientTotalAllTime: meta.clientTotalAllTime,
            clientsTruncated: meta.clientsTruncated || false,
            transactionsLoaded: orgContext.transactions?.length || 0,
            transactionTotalAllTime: meta.transactionTotalAllTime,
            transactionsTruncated: meta.transactionsTruncated || false,
            queryLimits: { services: meta.serviceLimit, clients: meta.clientLimit, transactions: meta.transactionLimit },
          }),
          period_considered: `${meta.servicePeriodDays || 180} dias`,
          is_total_or_partial: classification === 'completa' ? 'total' : 'parcial',
          had_limit: hasTruncation,
          had_truncation: hasTruncation,
          classification,
          context_snapshot: {
            servicePeriodDays: meta.servicePeriodDays,
            servicesLoaded: orgContext.services?.length,
            serviceTotalAllTime: meta.serviceTotalAllTime,
            servicesTruncated: meta.servicesTruncated,
            clientsLoaded: orgContext.clients?.length,
            clientTotalAllTime: meta.clientTotalAllTime,
            clientsTruncated: meta.clientsTruncated,
            transactionsLoaded: orgContext.transactions?.length,
            transactionTotalAllTime: meta.transactionTotalAllTime,
            transactionsTruncated: meta.transactionsTruncated,
            queryLimits: { services: meta.serviceLimit, clients: meta.clientLimit, transactions: meta.transactionLimit },
            toolRounds: toolRound,
            toolErrors: toolErrors.length > 0 ? toolErrors : undefined,
          },
        });
      }
    } catch (auditErr) {
      console.warn('[TECVO-CHAT] Audit log failed:', auditErr);
    }

    // Log usage
    const usage = result.usage || {};
    await logAIUsage(supabaseAdmin, {
      organizationId, userId, actionSlug: "tecvo_chat", model: aiModel,
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      totalTokens: usage.total_tokens || 0,
      durationMs, status: toolErrors.length > 0 ? "error" : "success",
    });

    // Monitor recurring failure patterns - log if multiple tool errors in one request
    if (toolErrors.length >= 2) {
      console.warn(`[TECVO-CHAT] RECURRING FAILURE PATTERN: ${toolErrors.length} tool errors in single request for org=${organizationId}`, toolErrors);
      await logAIUsage(supabaseAdmin, {
        organizationId, userId, actionSlug: "recurring_failure_pattern", model: aiModel,
        promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMs: 0, status: "error",
      }).catch(() => {});
    }

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
