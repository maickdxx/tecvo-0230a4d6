import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { logAIUsage } from "../_shared/aiUsageLogger.ts";
import { getTodayInTz, getFormattedDateTimeInTz, fetchOrgTimezone } from "../_shared/timezone.ts";
import { validateUserOrgAccess, accessDeniedResponse } from "../_shared/validateOrgAccess.ts";
import { createSanitizedStream, logOutputViolation } from "../_shared/outputValidator.ts";

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
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

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
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user) {
      console.error("Auth error:", userError);
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

    // CRITICAL: Validate user belongs to the requested organization
    const hasAccess = await validateUserOrgAccess(supabaseAdmin, userId, organizationId, "tecvo-chat");
    if (!hasAccess) {
      return accessDeniedResponse(corsHeaders);
    }

    // Fetch org timezone and real data in parallel
    const now = new Date();
    const orgTz = await fetchOrgTimezone(supabaseAdmin, organizationId);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const [servicesRes, clientsRes, transactionsRes, profilesRes] = await Promise.all([
      supabaseAdmin
        .from("services")
        .select("id, status, scheduled_date, completed_date, value, description, service_type, assigned_to, client_id, created_at, payment_method, document_type")
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .neq("status", "cancelled")
        .gte("scheduled_date", ninetyDaysAgo)
        .order("scheduled_date", { ascending: false })
        .limit(500),
      supabaseAdmin
        .from("clients")
        .select("id, name, phone, email, created_at")
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .limit(500),
      supabaseAdmin
        .from("transactions")
        .select("id, type, amount, date, due_date, status, category, description, payment_date, payment_method")
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .gte("date", ninetyDaysAgo)
        .order("date", { ascending: false })
        .limit(500),
      supabaseAdmin
        .from("profiles")
        .select("user_id, full_name, position")
        .eq("organization_id", organizationId)
        .limit(50),
    ]);

    const services = servicesRes.data || [];
    const clients = clientsRes.data || [];
    const transactions = transactionsRes.data || [];
    const profiles = profilesRes.data || [];

    // Calculate insights
    const scheduled = services.filter((s) => s.status === "scheduled");
    const completed = services.filter((s) => s.status === "completed");
    const inProgress = services.filter((s) => s.status === "in_progress");
    const billableCompleted = completed.filter((s) => (s.value || 0) > 0);
    const operationalCompleted = completed.filter((s) => !s.value || s.value === 0);

    const income = transactions.filter((t) => t.type === "income");
    const expenses = transactions.filter((t) => t.type === "expense");
    const overduePayments = transactions.filter(
      (t) => t.type === "income" && t.status === "pending" && t.due_date && new Date(t.due_date) < now
    );
    const totalRevenue = income.reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalExpenses = expenses.reduce((sum, t) => sum + (t.amount || 0), 0);

    // Find clients with last service > 6 months ago
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const clientLastService: Record<string, string> = {};
    for (const s of services) {
      if (s.status !== "completed") continue;
      const date = s.completed_date || s.scheduled_date || s.created_at;
      if (!clientLastService[s.client_id] || date > clientLastService[s.client_id]) {
        clientLastService[s.client_id] = date;
      }
    }
    const inactiveClients = clients.filter((c) => {
      const lastDate = clientLastService[c.id];
      return lastDate && new Date(lastDate) < sixMonthsAgo;
    });

    console.log("TECVO-CHAT - DATA LIMITE 6 MESES:", sixMonthsAgo.toISOString());
    console.log("TECVO-CHAT - CLIENTES COM ÚLTIMO SERVIÇO CONCLUÍDO:", JSON.stringify(clientLastService));
    console.log("TECVO-CHAT - CLIENTES INATIVOS:", inactiveClients.length);

    // Technician map
    const techMap: Record<string, string> = {};
    for (const p of profiles) {
      techMap[p.user_id] = p.full_name || "Sem nome";
    }

    // Build org-timezone-aware date/time
    const { dateStr, timeStr } = getFormattedDateTimeInTz(orgTz);
    const todayDate = getTodayInTz(orgTz);

    // Filter today's services by scheduled_date (date-only comparison)
    const todayServices = services.filter((s) => {
      if (!s.scheduled_date) return false;
      return s.scheduled_date.substring(0, 10) === todayDate;
    });
    const todayValue = todayServices.reduce((sum, s) => sum + (s.value || 0), 0);

    const todayServicesText = todayServices.length > 0
      ? todayServices
          .map((s) => {
            const client = clients.find((c) => c.id === s.client_id);
            const tech = s.assigned_to ? techMap[s.assigned_to] : "Não atribuído";
            const time = s.scheduled_date ? (s.scheduled_date.substring(11, 16) || "Sem horário") : "Sem horário";
            const statusMap: Record<string, string> = { scheduled: "Agendado", in_progress: "Em andamento", completed: "Concluído" };
            return `- ${time}: ${client?.name || "Cliente"} | ${s.service_type} | Técnico: ${tech} | R$ ${s.value || 0} | Status: ${statusMap[s.status] || s.status}`;
          })
          .join("\n")
      : "Nenhum serviço para hoje";

    const systemPrompt = `Você é a IA da Tecvo — uma assistente operacional da empresa de climatização.

📅 Data e hora atual: ${dateStr} às ${timeStr}

🔧 DADOS REAIS DO SISTEMA (últimos 90 dias):

SERVIÇOS:
- Total: ${services.length}
- Agendados: ${scheduled.length}
- Em andamento: ${inProgress.length}
- Concluídos (cobráveis, valor > 0): ${billableCompleted.length} (R$ ${billableCompleted.reduce((s, sv) => s + (sv.value || 0), 0).toFixed(2)})
- Concluídos (operacionais, valor = 0): ${operationalCompleted.length}

FINANCEIRO:
- Faturamento do período: R$ ${totalRevenue.toFixed(2)}
- Despesas do período: R$ ${totalExpenses.toFixed(2)}
- Saldo: R$ ${(totalRevenue - totalExpenses).toFixed(2)}
- Pagamentos vencidos: ${overduePayments.length} (total: R$ ${overduePayments.reduce((s, t) => s + t.amount, 0).toFixed(2)})

CLIENTES:
- Total cadastrados: ${clients.length}
- Inativos (6+ meses): ${inactiveClients.length}

TÉCNICOS:
${profiles.map((p) => `- ${p.full_name || "Sem nome"} (${p.position || "Técnico"})`).join("\n")}

📋 SERVIÇOS DE HOJE (${dateStr}):
${todayServicesText}
Total do dia: ${todayServices.length} serviços | R$ ${todayValue.toFixed(2)} estimado

SERVIÇOS AGENDADOS PRÓXIMOS:
${scheduled
  .filter((s) => s.scheduled_date && new Date(s.scheduled_date) >= now)
  .slice(0, 15)
  .map((s) => {
    const client = clients.find((c) => c.id === s.client_id);
    const tech = s.assigned_to ? techMap[s.assigned_to] : "Não atribuído";
    return `- ${s.scheduled_date}: ${client?.name || "Cliente"} | ${s.service_type} | Técnico: ${tech} | R$ ${s.value || 0}`;
  })
  .join("\n") || "Nenhum serviço agendado"}

PAGAMENTOS VENCIDOS:
${overduePayments
  .slice(0, 10)
  .map((t) => `- ${t.description}: R$ ${t.amount} (venceu em ${t.due_date})`)
  .join("\n") || "Nenhum pagamento vencido"}

CLIENTES INATIVOS (últimos 6+ meses):
${inactiveClients
  .slice(0, 10)
  .map((c) => {
    const lastDate = clientLastService[c.id];
    return `- ${c.name} (${c.phone}) - Último serviço: ${lastDate ? new Date(lastDate).toLocaleDateString("pt-BR", { timeZone: orgTz }) : "Nunca"}`;
  })
  .join("\n") || "Nenhum cliente inativo"}

===== DIRETRIZES OFICIAIS =====

COMPORTAMENTO:
1. Responda de forma OBJETIVA — exatamente o que foi perguntado.
2. NÃO mude de assunto. NÃO invente contexto. NÃO dê respostas genéricas.
3. Se faltar dado, pergunte SOMENTE o necessário de forma direta.
4. NUNCA responda duas coisas diferentes na mesma mensagem.
5. NUNCA adicione análises extras ou explicações que não foram pedidas.
6. Se quiser dar uma dica adicional, envie como mensagem separada, NUNCA misture com a resposta principal.

AÇÕES QUE VOCÊ PODE EXECUTAR:
✔ Criar/editar/remarcar/cancelar agendamento
✔ Criar Ordem de Serviço e atualizar status
✔ Buscar e criar clientes
✔ Vincular cliente ao agendamento
✔ Consultar agenda e serviços pendentes

AÇÕES QUE EXIGEM CONFIRMAÇÃO (pergunte antes de executar):
⚠️ Excluir cliente, excluir agendamento, cancelar OS, alterações críticas
Exemplo: "Confirma cancelar o agendamento do cliente João para amanhã às 14h?"

REGRAS OPERACIONAIS:
- Respeitar EXATAMENTE data e horário informados pelo usuário.
- NUNCA alterar horário automaticamente.
- Sempre usar fuso horário local do Brasil.
- Se houver conflito de horário, avisar ANTES de criar.

CRIAÇÃO DE AGENDAMENTO — validar: cliente, data, horário entrada, horário saída, tipo de serviço. Se faltar, perguntar apenas o que falta.

CRIAÇÃO DE OS — vincular ao cliente correto, usar tipo de serviço existente no sistema, NUNCA inventar tipo.

PADRÃO DE RESPOSTA:
- Prioridade: Objetivo → Claro → Executável
- Resposta curta primeiro, depois pergunta necessária (se houver)
- Exemplos:
  "Qual meu dia mais vazio?" → "Quinta-feira — 1 agendamento."
  "Quanto faturei esse mês?" → "R$ 12.350,00 em 23 serviços."

PROIBIÇÕES:
- NÃO seja consultor genérico ou chatbot conversacional.
- NÃO invente dados. Use APENAS os dados acima.
- NÃO altere valores financeiros nem modifique OS sem solicitação.
- Serviços com valor R$ 0 são NORMAIS (visita técnica, orçamento, garantia). NUNCA alerte sobre eles.
- Métricas financeiras consideram APENAS serviços com valor > 0.
- Formate com markdown apenas quando necessário para clareza.`;

    // Proactive tip mode: add extra instruction to system prompt
    let finalSystemPrompt = systemPrompt;
    if (mode === "proactive_tip") {
      finalSystemPrompt += `\n\nMODO PROATIVO: Você está abrindo o chat espontaneamente para ajudar o usuário.
Envie UMA dica curta e útil baseada nos dados reais acima.
Foco em: recorrência de clientes, ticket médio, pagamentos vencidos, oportunidades de faturamento, limpeza periódica, manutenção preventiva.
Tom: direto, prático, como uma consultora de empresas de ar-condicionado.
Máximo 2-3 frases. Comece com uma observação concreta sobre os dados. Use emoji se apropriado.
NÃO cumprimente. NÃO diga "olá". Vá direto ao ponto.`;
    }

    const chatMessages = mode === "proactive_tip"
      ? [{ role: "system", content: finalSystemPrompt }, { role: "user", content: "Me dê uma dica proativa baseada nos dados da minha empresa." }]
      : [{ role: "system", content: finalSystemPrompt }, ...messages];

    const aiModel = "gemini-2.5-flash";
    const startTime = Date.now();

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: aiModel,
        messages: chatMessages,
        stream: true,
      }),
    });

    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      const errorStatus = response.status === 429 ? "rate_limited" : "error";
      await logAIUsage(supabaseAdmin, {
        organizationId, userId, actionSlug: "tecvo_chat", model: aiModel,
        promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMs, status: errorStatus,
      });

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Entre em contato com o suporte." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log streaming call (no token info for streams)
    await logAIUsage(supabaseAdmin, {
      organizationId, userId, actionSlug: "tecvo_chat", model: aiModel,
      promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMs, status: "success",
    });

    // Apply output sanitization filter on the stream
    const sanitizedStream = createSanitizedStream(response.body!, async (fullText, hadIssues) => {
      if (hadIssues) {
        await logOutputViolation(supabaseAdmin, organizationId, userId, "tecvo-chat", ["stream_sanitized"], fullText);
      }
    });

    return new Response(sanitizedStream, {
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
