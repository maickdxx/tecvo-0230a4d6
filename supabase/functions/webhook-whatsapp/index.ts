import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { logAIUsage, extractUsageFromResponse } from "../_shared/aiUsageLogger.ts";
import { checkSendLimit } from "../_shared/sendGuard.ts";
import { getTodayInTz, getTomorrowInTz, getFormattedDateTimeInTz, getCurrentMonthInTz } from "../_shared/timezone.ts";
import { normalizePhone, normalizeJid, normalizeDigits } from "../_shared/whatsapp-utils.ts";

import { getCorsHeaders } from "../_shared/cors.ts";

// Webhook uses static CORS since it's called by Evolution API server, not browsers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

// Removed legacy getBrasiliaDate / formatDateISO — now using _shared/timezone.ts

function formatBRL(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Fetch profile picture URL from Evolution API
 */
async function fetchProfilePicture(instance: string, remoteJid: string): Promise<string | null> {
  try {
    const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
    const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");
    if (!vpsUrl || !apiKey) return null;

    const baseUrl = vpsUrl.replace(/\/+$/, "");
    const url = `${baseUrl}/chat/fetchProfilePictureUrl/${instance}`;
    
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": apiKey,
      },
      body: JSON.stringify({ number: remoteJid }),
    });

    if (!resp.ok) return null;
    const result = await resp.json();
    const picUrl = result?.profilePictureUrl || result?.profilePicture || result?.picture || null;
    return typeof picUrl === "string" && picUrl.startsWith("http") ? picUrl : null;
  } catch (e) {
    console.warn("[WEBHOOK-WHATSAPP] fetchProfilePicture error:", e.message);
    return null;
  }
}

/**
 * Download media from Evolution API and persist to Supabase Storage.
 * Returns the permanent public URL, or null on failure.
 */
async function persistMedia(
  supabase: any,
  instance: string,
  messageKey: any,
  mimeType: string | null,
  organizationId: string,
): Promise<string | null> {
  try {
    const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
    const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");
    if (!vpsUrl || !apiKey) {
      console.warn("[WEBHOOK-WHATSAPP] persistMedia: missing VPS config");
      return null;
    }

    const baseUrl = vpsUrl.replace(/\/+$/, "");
    const url = `${baseUrl}/chat/getBase64FromMediaMessage/${instance}`;

    console.log("[WEBHOOK-WHATSAPP] persistMedia: fetching base64 for message", messageKey?.id);

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({
        message: { key: messageKey },
        convertToMp4: false,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("[WEBHOOK-WHATSAPP] persistMedia: getBase64 failed", resp.status, errText.slice(0, 200));
      return null;
    }

    const result = await resp.json();
    const base64Data = result?.base64 || result?.data || null;
    const returnedMime = result?.mimetype || result?.mimeType || mimeType || "application/octet-stream";

    if (!base64Data || typeof base64Data !== "string") {
      console.warn("[WEBHOOK-WHATSAPP] persistMedia: no base64 data returned");
      return null;
    }

    // Clean base64 — remove data URI prefix if present
    const cleanBase64 = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;

    // Convert base64 to Uint8Array in chunks to avoid stack overflow
    const binaryString = atob(cleanBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Determine file extension from mime
    const extMap: Record<string, string> = {
      "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
      "video/mp4": "mp4", "video/3gpp": "3gp",
      "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/ogg; codecs=opus": "ogg",
      "application/pdf": "pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    };
    const baseMime = returnedMime.split(";")[0].trim().toLowerCase();
    const ext = extMap[baseMime] || baseMime.split("/")[1] || "bin";
    const fileName = `${organizationId}/${crypto.randomUUID()}.${ext}`;

    console.log("[WEBHOOK-WHATSAPP] persistMedia: uploading", fileName, "size:", bytes.length, "mime:", baseMime);

    const { error: uploadError } = await supabase.storage
      .from("whatsapp-media")
      .upload(fileName, bytes, { contentType: baseMime, upsert: true });

    if (uploadError) {
      console.error("[WEBHOOK-WHATSAPP] persistMedia: upload error", uploadError);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("whatsapp-media")
      .getPublicUrl(fileName);

    console.log("[WEBHOOK-WHATSAPP] persistMedia: success →", publicUrl);
    return publicUrl;
  } catch (err: any) {
    console.error("[WEBHOOK-WHATSAPP] persistMedia: exception", err.message);
    return null;
  }
}


async function fetchOrgContext(supabase: any, organizationId: string) {
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const [servicesRes, clientsRes, transactionsRes, profilesRes, orgRes, catalogRes] = await Promise.all([
    supabase
      .from("services")
      .select("id, status, scheduled_date, completed_date, value, description, service_type, assigned_to, client_id, created_at, payment_method, document_type")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .neq("status", "cancelled")
      .gte("scheduled_date", ninetyDaysAgo)
      .order("scheduled_date", { ascending: false })
      .limit(500),
    supabase
      .from("clients")
      .select("id, name, phone, email, created_at")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .limit(500),
    supabase
      .from("transactions")
      .select("id, type, amount, date, due_date, status, category, description, payment_date, payment_method")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .gte("date", ninetyDaysAgo)
      .order("date", { ascending: false })
      .limit(500),
    supabase
      .from("profiles")
      .select("user_id, full_name, position")
      .eq("organization_id", organizationId)
      .limit(50),
    supabase
      .from("organizations")
      .select("name, monthly_goal, timezone")
      .eq("id", organizationId)
      .single(),
    supabase
      .from("catalog_services")
      .select("name, unit_price, service_type, description")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .limit(50),
  ]);

  // Debug: log query results
  console.log("[WEBHOOK-WHATSAPP] fetchOrgContext results — services:", servicesRes.data?.length ?? 0, "err:", servicesRes.error?.message,
    "| clients:", clientsRes.data?.length ?? 0, "err:", clientsRes.error?.message,
    "| transactions:", transactionsRes.data?.length ?? 0, "err:", transactionsRes.error?.message,
    "| profiles:", profilesRes.data?.length ?? 0, "err:", profilesRes.error?.message,
    "| org:", orgRes.data?.name, "err:", orgRes.error?.message,
    "| catalog:", catalogRes.data?.length ?? 0, "err:", catalogRes.error?.message);

  return {
    services: servicesRes.data || [],
    clients: clientsRes.data || [],
    transactions: transactionsRes.data || [],
    profiles: profilesRes.data || [],
    orgName: orgRes.data?.name || "Empresa",
    monthlyGoal: orgRes.data?.monthly_goal || null,
    catalog: catalogRes.data || [],
    timezone: orgRes.data?.timezone || "America/Sao_Paulo",
  };
}

/**
 * Build system prompt with org context — intent-optimized
 */
function buildSystemPrompt(ctx: any) {
  const now = new Date();
  const tz = ctx.timezone || "America/Sao_Paulo";
  const todayISO = getTodayInTz(tz);
  const tomorrowISO = getTomorrowInTz(tz);
  const { dateStr, timeStr } = getFormattedDateTimeInTz(tz);
  const currentMonth = getCurrentMonthInTz(tz);

  const { services, clients, transactions, profiles, orgName, monthlyGoal, catalog } = ctx;

  // Only count OS (not quotes)
  const osServices = services.filter((s: any) => s.document_type !== "quote");

  // Tech map
  const techMap: Record<string, string> = {};
  for (const p of profiles) {
    techMap[p.user_id] = p.full_name || "Sem nome";
  }

  // ── TODAY ──
  const todayServices = osServices.filter((s: any) => s.scheduled_date?.substring(0, 10) === todayISO);
  const todayCompleted = todayServices.filter((s: any) => s.status === "completed");
  const todayScheduled = todayServices.filter((s: any) => s.status === "scheduled");
  const todayInProgress = todayServices.filter((s: any) => s.status === "in_progress");
  const todayRevenue = todayCompleted.reduce((sum: number, s: any) => sum + (s.value || 0), 0);
  const todayTotalValue = todayServices.reduce((sum: number, s: any) => sum + (s.value || 0), 0);
  const todayClients = [...new Set(todayServices.map((s: any) => s.client_id))];

  // ── TOMORROW ──
  const tomorrowServices = osServices.filter((s: any) => s.scheduled_date?.substring(0, 10) === tomorrowISO);

  // ── THIS MONTH ──
  const monthServices = osServices.filter((s: any) => s.scheduled_date?.substring(0, 7) === currentMonth);
  const monthCompleted = monthServices.filter((s: any) => s.status === "completed");
  const monthRevenue = monthCompleted.reduce((sum: number, s: any) => sum + (s.value || 0), 0);
  const monthTotalValue = monthServices.reduce((sum: number, s: any) => sum + (s.value || 0), 0);

  // ── FINANCIAL ──
  const monthTransactions = transactions.filter((t: any) => t.date?.substring(0, 7) === currentMonth);
  const monthIncome = monthTransactions.filter((t: any) => t.type === "income");
  const monthExpenses = monthTransactions.filter((t: any) => t.type === "expense");
  const monthIncomeTotal = monthIncome.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
  const monthExpenseTotal = monthExpenses.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
  const overduePayments = transactions.filter(
    (t: any) => t.type === "income" && t.status === "pending" && t.due_date && new Date(t.due_date) < now
  );
  const todayTransIncome = monthIncome.filter((t: any) => t.date === todayISO);
  const todayIncomeTotal = todayTransIncome.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);

  // Service list formatter
  const formatServiceList = (svcs: any[], maxItems = 10) => {
    if (svcs.length === 0) return "Nenhum";
    return svcs.slice(0, maxItems).map((s: any) => {
      const client = clients.find((c: any) => c.id === s.client_id);
      const tech = s.assigned_to ? techMap[s.assigned_to] : "—";
      const time = s.scheduled_date?.substring(11, 16) || "—";
      return `  ${time} | ${client?.name || "?"} | ${s.service_type} | ${tech} | ${formatBRL(s.value || 0)} | ${s.status}`;
    }).join("\n");
  };

  // Catalog text
  const catalogText = catalog.length > 0
    ? catalog.map((c: any) => `  - ${c.name}: ${formatBRL(c.unit_price)} (${c.service_type})`).join("\n")
    : "Nenhum item no catálogo";

  return `Você é a assistente IA da empresa ${orgName}. Ajude o proprietário a consultar dados da empresa.

📅 Agora: ${dateStr} às ${timeStr} (Brasília)

══════════ DADOS EM TEMPO REAL ══════════

📊 HOJE (${dateStr}):
• Serviços: ${todayServices.length} total | ${todayCompleted.length} concluídos | ${todayScheduled.length} agendados | ${todayInProgress.length} em andamento
• Faturamento hoje (concluídos): ${formatBRL(todayRevenue)}
• Valor total agendado hoje: ${formatBRL(todayTotalValue)}
• Receitas registradas hoje (transações): ${formatBRL(todayIncomeTotal)}
• Clientes atendidos hoje: ${todayClients.length}
• Lista:
${formatServiceList(todayServices)}

📅 AMANHÃ (${new Date(tomorrowISO + "T12:00:00").toLocaleDateString("pt-BR")}):
• Serviços agendados: ${tomorrowServices.length}
• Valor previsto: ${formatBRL(tomorrowServices.reduce((s: number, sv: any) => s + (sv.value || 0), 0))}
• Lista:
${formatServiceList(tomorrowServices)}

📆 ESTE MÊS (${currentMonth}):
• Serviços: ${monthServices.length} total | ${monthCompleted.length} concluídos
• Faturamento (concluídos): ${formatBRL(monthRevenue)}
• Valor total (todos status): ${formatBRL(monthTotalValue)}
• Receitas (transações): ${formatBRL(monthIncomeTotal)} | Despesas: ${formatBRL(monthExpenseTotal)}
• Lucro operacional: ${formatBRL(monthIncomeTotal - monthExpenseTotal)}
${monthlyGoal ? `• Meta mensal: ${formatBRL(monthlyGoal)} | Atingido: ${((monthRevenue / monthlyGoal) * 100).toFixed(0)}%` : ""}

⚠️ PENDÊNCIAS:
• Pagamentos vencidos: ${overduePayments.length}${overduePayments.length > 0 ? ` (${formatBRL(overduePayments.reduce((s: number, t: any) => s + (t.amount || 0), 0))})` : ""}

👥 EQUIPE:
${profiles.map((p: any) => `  - ${p.full_name || "?"} (${p.position || "Técnico"})`).join("\n") || "  Sem membros"}

🏷️ CATÁLOGO DE PREÇOS:
${catalogText}

📇 CLIENTES: ${clients.length} cadastrados

══════════ INTENÇÕES COMUNS ══════════

Interprete a mensagem do usuário e identifique a INTENÇÃO. Exemplos:

| Mensagem do usuário | Intenção | Dados a usar |
|---|---|---|
| "quanto faturei hoje" | faturamento_do_dia | Faturamento hoje (concluídos) |
| "faturamento do mês" | faturamento_do_mes | Faturamento mês (concluídos) |
| "agenda de hoje" | agenda_de_hoje | Lista serviços hoje |
| "agenda de amanhã" | agenda_de_amanha | Lista serviços amanhã |
| "quantos serviços hoje" | quantidade_servicos_hoje | Total serviços hoje |
| "quantos serviços no mês" | quantidade_servicos_mes | Total serviços mês |
| "clientes de hoje" | clientes_do_dia | Clientes atendidos hoje |
| "meta do mês" | meta_mensal | Meta vs faturamento |
| "pagamentos atrasados" | pagamentos_vencidos | Pendências |
| "preço de instalação" | consulta_preco | Catálogo de preços |
| "agendar serviço" | agendar | Pergunte: cliente, data, horário, tipo |

══════════ DIRETRIZES ══════════

1. Respostas CURTAS (máx 500 caracteres). Use emojis com moderação.
2. Responda com DADOS REAIS. NÃO invente números.
3. Quando perguntar sobre faturamento, use APENAS serviços concluídos (status=completed).
4. Para valores monetários, use formato "R$ 1.234,56".
5. Seja direto: responda o número/dado PRIMEIRO, depois contexto se necessário.
6. Se a intenção for "agendar", pergunte: cliente, data, horário, tipo de serviço.
7. Se perguntar preço, consulte o CATÁLOGO acima.
8. NÃO use markdown complexo (sem negrito, tabelas, etc). Apenas texto e emojis.
9. Responda SEMPRE em português brasileiro.
10. Você representa a empresa "${orgName}". Fale em primeira pessoa do plural ("nós faturamos", "temos agendado").`;
}

/**
 * Fetch recent conversation history for context
 */
async function fetchConversationHistory(supabase: any, contactId: string, limit = 20) {
  const { data } = await supabase
    .from("whatsapp_messages")
    .select("content, is_from_me, created_at")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: true })
    .limit(limit);

  return (data || []).map((msg: any) => ({
    role: msg.is_from_me ? "assistant" : "user",
    content: msg.content || "[mídia]",
  }));
}

/**
 * Call Lovable AI Gateway (non-streaming)
 */
async function callAI(systemPrompt: string, conversationMessages: any[], tools?: any[]): Promise<{ content: string; usage: any; toolCalls: any[] | null }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const body: any = {
    model: "google/gemini-3-flash-preview",
    messages: [
      { role: "system", content: systemPrompt },
      ...conversationMessages,
    ],
    stream: false,
  };
  if (tools && tools.length > 0) {
    body.tools = tools;
  }

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("[WEBHOOK-WHATSAPP] AI error:", response.status, text);
    throw new Error(`AI error ${response.status}`);
  }

  const result = await response.json();
  const choice = result.choices?.[0];
  return {
    content: choice?.message?.content || "",
    usage: result.usage || {},
    toolCalls: choice?.message?.tool_calls || null,
  };
}

// Financial tools for admin_empresa mode
const FINANCIAL_TOOLS = [
  {
    type: "function",
    function: {
      name: "register_transaction",
      description: "Registra uma transação financeira (receita ou despesa) no sistema. Use quando o usuário pedir para registrar um gasto, despesa, receita ou pagamento.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["income", "expense"], description: "Tipo: income (receita) ou expense (despesa)" },
          amount: { type: "number", description: "Valor em reais (positivo)" },
          description: { type: "string", description: "Descrição da transação" },
          category: { type: "string", description: "Categoria: ex: material, combustível, alimentação, aluguel, fornecedor, serviço, outro" },
          date: { type: "string", description: "Data no formato YYYY-MM-DD. Use a data de hoje se não especificada." },
          payment_method: { type: "string", enum: ["pix", "dinheiro", "cartao_credito", "cartao_debito", "boleto", "transferencia", "outro"], description: "Forma de pagamento" },
        },
        required: ["type", "amount", "description", "category", "date"],
        additionalProperties: false,
      },
    },
  },
];

async function executeFinancialTool(supabase: any, organizationId: string, toolCall: any): Promise<string> {
  const fnName = toolCall.function?.name;
  let args: any;
  try {
    args = JSON.parse(toolCall.function?.arguments || "{}");
  } catch {
    return "Erro: argumentos inválidos.";
  }

  if (fnName === "register_transaction") {
    const { type, amount, description, category, date, payment_method } = args;
    if (!type || !amount || !description || !category || !date) {
      return "Erro: campos obrigatórios faltando (type, amount, description, category, date).";
    }
    if (amount <= 0) return "Erro: valor deve ser positivo.";

    const { error } = await supabase.from("transactions").insert({
      organization_id: organizationId,
      type,
      amount,
      description,
      category,
      date,
      status: type === "expense" ? "paid" : "pending",
      ...(payment_method ? { payment_method } : {}),
    });

    if (error) {
      console.error("[WEBHOOK-WHATSAPP] Transaction insert error:", error);
      return `Erro ao registrar: ${error.message}`;
    }

    const typeLabel = type === "income" ? "Receita" : "Despesa";
    return `${typeLabel} registrada com sucesso: R$ ${amount.toFixed(2)} — ${description} (${category}) em ${date}.`;
  }

  return "Ferramenta desconhecida.";
}

/**
 * Send message back via Evolution API
 */
async function sendWhatsAppReply(instance: string, remoteJid: string, text: string) {
  const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
  const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");

  console.log("[WEBHOOK-WHATSAPP] sendReply config — URL:", vpsUrl, "| apiKey length:", apiKey?.length, "| apiKey:", apiKey?.substring(0, 5) + "...");

  if (!vpsUrl || !apiKey) {
    console.warn("[WEBHOOK-WHATSAPP] Missing WHATSAPP_VPS_URL or WHATSAPP_BRIDGE_API_KEY, cannot send reply");
    return false;
  }

  try {
    const response = await fetch(`${vpsUrl}/message/sendText/${instance}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify({
        number: remoteJid,
        text,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[WEBHOOK-WHATSAPP] Send reply error:", response.status, errText);
      return false;
    }

    await response.text(); // consume body
    return true;
  } catch (err) {
    console.error("[WEBHOOK-WHATSAPP] Send reply exception:", err);
    return false;
  }
}

// ==================== MAIN HANDLER ====================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate webhook origin via API key
    // Evolution API may send key in different headers depending on version/config
    const webhookApiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");
    const incomingKey = req.headers.get("x-api-key") 
      || req.headers.get("apikey") 
      || req.headers.get("authorization")?.replace("Bearer ", "")
      || req.headers.get("x-apikey");
    
    if (webhookApiKey && incomingKey !== webhookApiKey) {
      // Log headers for debugging, then allow through if no key was sent at all
      // (Evolution API may not send auth headers for webhooks — URL secrecy is the auth)
      const headerNames = [...req.headers.keys()].join(", ");
      if (incomingKey) {
        // Key was sent but doesn't match — reject
        console.warn(`[WEBHOOK-WHATSAPP] Rejected: wrong api key. Headers: ${headerNames}`);
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // No key sent at all — allow through (URL is the secret)
      console.info(`[WEBHOOK-WHATSAPP] No api key in request, allowing (URL-based auth). Headers: ${headerNames}`);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    console.log("[WEBHOOK-WHATSAPP] Received:", JSON.stringify(body).slice(0, 500));

    // ========== NORMALIZE PAYLOAD ==========
    // Support both Evolution API formats:
    //
    // FORMAT A (simple - Evolution API default):
    // { "instance": "tecvo", "sender": "5519...@s.whatsapp.net", "message": { "conversation": "Oi" } }
    //
    // FORMAT B (full event - Evolution API webhook events):
    // { "event": "messages.upsert", "instance": "tecvo", "data": { "key": { "remoteJid": "...", "fromMe": false }, "message": { "conversation": "..." }, "pushName": "..." } }

    const instance = body.instance;
    const isFormatA = !body.data && !body.event; // simple format
    const data = isFormatA ? null : body.data;
    const event = body.event;

    if (!instance) {
      console.log("[WEBHOOK-WHATSAPP] Missing instance, ignoring");
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle connection.update events — update channel status in DB
    if (event === "connection.update") {
      const state = data?.state || body.data?.state;
      const statusReason = data?.statusReason || body.data?.statusReason;
      console.log("[WEBHOOK-WHATSAPP] Connection update for instance:", instance, "state:", state, "statusReason:", statusReason);

      // Look up channel by instance_name
      const { data: channel } = await supabase
        .from("whatsapp_channels")
        .select("id, is_connected, channel_status")
        .eq("instance_name", instance)
        .maybeSingle();

      if (channel) {
        // Never overwrite a deleted channel's status
        if (channel.channel_status === "deleted") {
          console.log("[WEBHOOK-WHATSAPP] Ignoring connection.update for deleted channel", channel.id);
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const isConnected = state === "open";
        if (channel.is_connected !== isConnected) {
          await supabase
            .from("whatsapp_channels")
            .update({
              is_connected: isConnected,
              ...(isConnected ? { last_connected_at: new Date().toISOString(), channel_status: "connected" } : { channel_status: "disconnected" }),
            })
            .eq("id", channel.id)
            .neq("channel_status", "deleted");
          console.log("[WEBHOOK-WHATSAPP] Updated channel", channel.id, "is_connected:", isConnected);
        }
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle reaction events
    if (event === "messages.reaction") {
      console.log("[WEBHOOK-WHATSAPP] Reaction event received:", JSON.stringify(data).slice(0, 300));
      const reactionData = data?.reaction || data;
      const reactionKey = reactionData?.key || data?.key;
      const reactionText = reactionData?.text || reactionData?.reaction?.text || "";
      const reactedMsgId = reactionKey?.id;
      const reactorJid = reactionData?.jid || reactionData?.remoteJid || reactionKey?.remoteJid || "";
      const reactorName = data?.pushName || reactorJid.split("@")[0] || "";

      if (reactedMsgId) {
        // Find message by message_id
        const { data: targetMsg } = await supabase
          .from("whatsapp_messages")
          .select("id, reactions")
          .eq("message_id", reactedMsgId)
          .maybeSingle();

        if (targetMsg) {
          const currentReactions: any[] = Array.isArray(targetMsg.reactions) ? targetMsg.reactions : [];
          
          if (reactionText) {
            // Add or update reaction
            const existingIdx = currentReactions.findIndex((r: any) => r.jid === reactorJid);
            if (existingIdx >= 0) {
              currentReactions[existingIdx] = { emoji: reactionText, jid: reactorJid, name: reactorName };
            } else {
              currentReactions.push({ emoji: reactionText, jid: reactorJid, name: reactorName });
            }
          } else {
            // Empty text = remove reaction
            const filtered = currentReactions.filter((r: any) => r.jid !== reactorJid);
            currentReactions.length = 0;
            currentReactions.push(...filtered);
          }

          await supabase
            .from("whatsapp_messages")
            .update({ reactions: currentReactions })
            .eq("id", targetMsg.id);

          console.log("[WEBHOOK-WHATSAPP] Reaction updated for message:", targetMsg.id, "reactions:", currentReactions.length);
        } else {
          console.log("[WEBHOOK-WHATSAPP] Reaction target message not found:", reactedMsgId);
        }
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle messages.update — delivery/read status updates
    if (event === "messages.update") {
      console.log("[WEBHOOK-WHATSAPP] messages.update FULL BODY:", JSON.stringify(body).slice(0, 1000));
      
      // Evolution API v2 sends data as array or single object
      // Also check body directly in case data is nested differently
      const rawUpdates = data || body.data;
      const updates = Array.isArray(rawUpdates) ? rawUpdates : [rawUpdates];
      
      const statusOrder: Record<string, number> = { pending: 0, sent: 1, delivered: 2, read: 3 };
      
      for (const update of updates) {
        if (!update) continue;
        
        const msgId = update?.key?.id || update?.id;
        // Try multiple paths where ACK/status might be
        const ack = update?.update?.status 
          ?? update?.update?.ack 
          ?? update?.status 
          ?? update?.ack
          ?? update?.update?.pollUpdates?.[0]?.vote;
        
        console.log("[WEBHOOK-WHATSAPP] messages.update item — msgId:", msgId, "ack:", ack, "raw:", JSON.stringify(update).slice(0, 300));
        
        if (!msgId) continue;
        
        // Evolution API ACK values:
        // 0 = ERROR, 1 = PENDING, 2 = SERVER_ACK (sent), 3 = DELIVERY_ACK (delivered), 4 = READ, 5 = PLAYED
        let newStatus: string | null = null;
        
        const ackNum = typeof ack === "number" ? ack : (typeof ack === "string" ? parseInt(ack, 10) : NaN);
        
        if (!isNaN(ackNum)) {
          if (ackNum === 2) newStatus = "sent";
          else if (ackNum === 3) newStatus = "delivered";
          else if (ackNum >= 4) newStatus = "read";
        } else if (typeof ack === "string") {
          const ackLower = ack.toLowerCase();
          if (ackLower === "server_ack" || ackLower === "sent") newStatus = "sent";
          else if (ackLower === "delivery_ack" || ackLower === "delivered") newStatus = "delivered";
          else if (ackLower === "read" || ackLower === "played" || ackLower === "read_ack") newStatus = "read";
        }
        
        console.log("[WEBHOOK-WHATSAPP] messages.update resolved — msgId:", msgId, "newStatus:", newStatus);
        
        if (newStatus && msgId) {
          const { data: existingMsg } = await supabase
            .from("whatsapp_messages")
            .select("id, status")
            .eq("message_id", msgId)
            .maybeSingle();
          
          if (existingMsg) {
            const currentLevel = statusOrder[existingMsg.status] ?? -1;
            const newLevel = statusOrder[newStatus] ?? -1;
            
            if (newLevel > currentLevel) {
              await supabase
                .from("whatsapp_messages")
                .update({ status: newStatus })
                .eq("id", existingMsg.id);
              console.log("[WEBHOOK-WHATSAPP] Message status UPDATED:", existingMsg.id, existingMsg.status, "->", newStatus);
            } else {
              console.log("[WEBHOOK-WHATSAPP] Message status NOT upgraded:", existingMsg.id, existingMsg.status, "vs", newStatus);
            }
          } else {
            console.log("[WEBHOOK-WHATSAPP] Message not found for status update, msgId:", msgId);
          }
        }
      }
      
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For Format B, filter non-message events
    if (event && event !== "messages.upsert") {
      console.log("[WEBHOOK-WHATSAPP] Ignoring event:", event);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For Format B, require data
    if (!isFormatA && !data) {
      console.log("[WEBHOOK-WHATSAPP] Format B but missing data, ignoring");
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract message fields from either format
    let remoteJid: string;
    let fromMe: boolean;
    let messageId: string;
    let pushName: string;
    let content = "";
    let mediaUrl: string | null = null;
    let mediaType: string | null = null;

    if (isFormatA) {
      // FORMAT A: { instance, sender, message: { conversation } }
      remoteJid = body.sender || "";
      fromMe = false; // incoming from customer
      messageId = crypto.randomUUID();
      pushName = "";
      content = body.message?.conversation || body.message?.text || "";
      console.log("[WEBHOOK-WHATSAPP] Format A — sender:", remoteJid, "text:", content.slice(0, 100));
    } else {
      // FORMAT B: { event, instance, data: { key, message, pushName } }
      remoteJid = data.key?.remoteJid || "";
      fromMe = data.key?.fromMe || false;
      messageId = data.key?.id || crypto.randomUUID();
      pushName = data.pushName || "";
      // For group messages, participant identifies the actual sender
      const participant = data.key?.participant || "";
      const profilePictureUrl = data.profilePictureUrl || null;

      // Check if this is a reaction message (comes as messages.upsert with reactionMessage)
      if (data.message?.reactionMessage) {
        const reactionMsg = data.message.reactionMessage;
        const reactedMsgId = reactionMsg.key?.id;
        const reactionEmoji = reactionMsg.text || "";
        const reactorJid = fromMe ? "me" : remoteJid;
        const reactorName = fromMe ? "Você" : (pushName || remoteJid.split("@")[0]);

        console.log("[WEBHOOK-WHATSAPP] Reaction via messages.upsert — emoji:", reactionEmoji, "targetMsg:", reactedMsgId, "from:", reactorName);

        if (reactedMsgId) {
          const { data: targetMsg } = await supabase
            .from("whatsapp_messages")
            .select("id, reactions")
            .eq("message_id", reactedMsgId)
            .maybeSingle();

          if (targetMsg) {
            const currentReactions: any[] = Array.isArray(targetMsg.reactions) ? targetMsg.reactions : [];
            
            if (reactionEmoji) {
              const existingIdx = currentReactions.findIndex((r: any) => r.jid === reactorJid);
              if (existingIdx >= 0) {
                currentReactions[existingIdx] = { emoji: reactionEmoji, jid: reactorJid, name: reactorName };
              } else {
                currentReactions.push({ emoji: reactionEmoji, jid: reactorJid, name: reactorName });
              }
            } else {
              const filtered = currentReactions.filter((r: any) => r.jid !== reactorJid);
              currentReactions.length = 0;
              currentReactions.push(...filtered);
            }

            await supabase
              .from("whatsapp_messages")
              .update({ reactions: currentReactions })
              .eq("id", targetMsg.id);

            console.log("[WEBHOOK-WHATSAPP] Reaction updated for message:", targetMsg.id);
          }
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Handle protocolMessage (REVOKE = message deleted, EDIT = message edited)
      // These come as messages.upsert but are not real messages — skip saving them
      if (data.message?.protocolMessage) {
        const protoType = data.message.protocolMessage.type;
        const revokedMsgId = data.message.protocolMessage.key?.id;
        console.log("[WEBHOOK-WHATSAPP] ProtocolMessage received — type:", protoType, "targetMsgId:", revokedMsgId);

        if (protoType === "REVOKE" && revokedMsgId) {
          // A message was deleted — update its status in the DB
          const { data: revokedMsg } = await supabase
            .from("whatsapp_messages")
            .select("id, status")
            .eq("message_id", revokedMsgId)
            .maybeSingle();

          if (revokedMsg && revokedMsg.status !== "deleted") {
            await supabase
              .from("whatsapp_messages")
              .update({ status: "deleted", content: "" })
              .eq("id", revokedMsg.id);
            console.log("[WEBHOOK-WHATSAPP] Message revoked via webhook:", revokedMsg.id);
          }
        }

        // Skip further processing — protocol messages are not chat messages
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Handle editedMessage — message was edited on WhatsApp
      if (data.message?.editedMessage) {
        const editedKey = data.message.editedMessage.message?.protocolMessage?.key?.id;
        const editedText = data.message.editedMessage.message?.protocolMessage?.editedMessage?.conversation
          || data.message.editedMessage.message?.protocolMessage?.editedMessage?.extendedTextMessage?.text
          || "";
        console.log("[WEBHOOK-WHATSAPP] EditedMessage received — targetMsgId:", editedKey, "newText:", editedText?.slice(0, 50));

        if (editedKey) {
          const { data: targetMsg } = await supabase
            .from("whatsapp_messages")
            .select("id")
            .eq("message_id", editedKey)
            .maybeSingle();

          if (targetMsg && editedText) {
            await supabase
              .from("whatsapp_messages")
              .update({ content: editedText, status: "edited" })
              .eq("id", targetMsg.id);
            console.log("[WEBHOOK-WHATSAPP] Message edited via webhook:", targetMsg.id);
          }
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── Extract content from all known message types ──
      const msg = data.message || {};
      
      if (msg.conversation) {
        content = msg.conversation;
      } else if (msg.extendedTextMessage?.text) {
        content = msg.extendedTextMessage.text;
      } else if (msg.imageMessage) {
        content = msg.imageMessage.caption || "";
        mediaType = "image";
        mediaUrl = msg.imageMessage.url || null;
      } else if (msg.videoMessage) {
        content = msg.videoMessage.caption || "";
        mediaType = "video";
        mediaUrl = msg.videoMessage.url || null;
      } else if (msg.audioMessage) {
        mediaType = "audio";
        mediaUrl = msg.audioMessage.url || null;
      } else if (msg.documentWithCaptionMessage) {
        // Document with caption (body text + attached file)
        const inner = msg.documentWithCaptionMessage.message?.documentMessage || {};
        content = msg.documentWithCaptionMessage.message?.documentMessage?.caption || inner.fileName || "";
        mediaType = "document";
        mediaUrl = inner.url || null;
      } else if (msg.documentMessage) {
        content = msg.documentMessage.caption || msg.documentMessage.fileName || "";
        mediaType = "document";
        mediaUrl = msg.documentMessage.url || null;
      } else if (msg.stickerMessage) {
        mediaType = "sticker";
        mediaUrl = msg.stickerMessage.url || null;
      } else if (msg.contactMessage) {
        const cName = msg.contactMessage.displayName || "Contato compartilhado";
        // Extract phone from vCard string
        let cPhone = "";
        const vcard = msg.contactMessage.vcard || "";
        const telMatch = vcard.match(/TEL[^:]*:([^\r\n]+)/i);
        if (telMatch) cPhone = telMatch[1].replace(/[\s\-()]/g, "");
        content = cPhone ? `${cName}||${cPhone}` : cName;
        mediaType = "contact";
      } else if (msg.contactsArrayMessage) {
        const contacts = msg.contactsArrayMessage.contacts || [];
        const parts = contacts.map((c: any) => {
          const n = c.displayName || "Contato";
          let p = "";
          const vc = c.vcard || "";
          const m = vc.match(/TEL[^:]*:([^\r\n]+)/i);
          if (m) p = m[1].replace(/[\s\-()]/g, "");
          return p ? `${n}||${p}` : n;
        });
        content = parts.join(";;");
        mediaType = "contact";
      } else if (msg.locationMessage) {
        const lat = msg.locationMessage.degreesLatitude;
        const lng = msg.locationMessage.degreesLongitude;
        content = msg.locationMessage.name || msg.locationMessage.address || `Localização: ${lat}, ${lng}`;
        mediaType = "location";
      } else if (msg.liveLocationMessage) {
        content = "Localização em tempo real";
        mediaType = "location";
      // ── Click-to-WhatsApp ad messages (templateMessage, templateButtonReplyMessage, etc.) ──
      } else if (msg.templateMessage) {
        // CTA ads send templateMessage with hydratedTemplate or hydratedFourRowTemplate
        const tmpl = msg.templateMessage.hydratedTemplate 
          || msg.templateMessage.hydratedFourRowTemplate 
          || msg.templateMessage;
        content = tmpl?.hydratedContentText 
          || tmpl?.hydratedTitleText 
          || tmpl?.text 
          || tmpl?.caption 
          || "";
        // Check for media within template
        if (tmpl?.imageMessage) {
          mediaType = "image";
          mediaUrl = tmpl.imageMessage.url || null;
          if (!content && tmpl.imageMessage.caption) content = tmpl.imageMessage.caption;
        } else if (tmpl?.videoMessage) {
          mediaType = "video";
          mediaUrl = tmpl.videoMessage.url || null;
          if (!content && tmpl.videoMessage.caption) content = tmpl.videoMessage.caption;
        } else if (tmpl?.documentMessage) {
          mediaType = "document";
          mediaUrl = tmpl.documentMessage.url || null;
        }
        if (!content) content = "[Mensagem de anúncio]";
        console.log("[WEBHOOK-WHATSAPP] templateMessage parsed — content:", content.slice(0, 100));
      } else if (msg.templateButtonReplyMessage) {
        content = msg.templateButtonReplyMessage.selectedDisplayText 
          || msg.templateButtonReplyMessage.selectedId 
          || "[Resposta de template]";
      } else if (msg.buttonsResponseMessage) {
        content = msg.buttonsResponseMessage.selectedDisplayText 
          || msg.buttonsResponseMessage.selectedButtonId 
          || "[Resposta de botão]";
      } else if (msg.listResponseMessage) {
        content = msg.listResponseMessage.title 
          || msg.listResponseMessage.singleSelectReply?.selectedRowId 
          || "[Seleção de lista]";
      } else if (msg.interactiveMessage) {
        // Interactive messages from Business API / CTA
        const body = msg.interactiveMessage.body?.text 
          || msg.interactiveMessage.header?.title 
          || "";
        const footer = msg.interactiveMessage.footer?.text || "";
        content = [body, footer].filter(Boolean).join("\n") || "[Mensagem interativa]";
        // Check for media header (image, video, document)
        if (msg.interactiveMessage.header?.imageMessage) {
          mediaType = "image";
          mediaUrl = msg.interactiveMessage.header.imageMessage.url || null;
        } else if (msg.interactiveMessage.header?.videoMessage) {
          mediaType = "video";
          mediaUrl = msg.interactiveMessage.header.videoMessage.url || null;
        } else if (msg.interactiveMessage.header?.documentMessage) {
          mediaType = "document";
          mediaUrl = msg.interactiveMessage.header.documentMessage.url || null;
        }
        console.log("[WEBHOOK-WHATSAPP] interactiveMessage parsed — content:", content.slice(0, 100), "mediaType:", mediaType);
      } else if (msg.interactiveResponseMessage) {
        content = msg.interactiveResponseMessage.body?.text 
          || msg.interactiveResponseMessage.nativeFlowResponseMessage?.paramsJson 
          || "[Resposta interativa]";
      } else if (msg.orderMessage) {
        content = msg.orderMessage.message || "[Pedido recebido]";
      } else if (msg.productMessage) {
        content = msg.productMessage.product?.title || "[Produto compartilhado]";
      } else if (msg.pollCreationMessage || msg.pollCreationMessageV3) {
        const poll = msg.pollCreationMessage || msg.pollCreationMessageV3;
        content = poll?.name || "[Enquete]";
      } else if (msg.pollUpdateMessage) {
        content = "[Voto em enquete]";
      } else if (msg.viewOnceMessage || msg.viewOnceMessageV2 || msg.viewOnceMessageV2Extension) {
        // View once messages contain nested image/video/audio
        const inner = msg.viewOnceMessage?.message 
          || msg.viewOnceMessageV2?.message 
          || msg.viewOnceMessageV2Extension?.message 
          || {};
        if (inner.imageMessage) {
          content = inner.imageMessage.caption || "";
          mediaType = "image";
          mediaUrl = inner.imageMessage.url || null;
        } else if (inner.videoMessage) {
          content = inner.videoMessage.caption || "";
          mediaType = "video";
          mediaUrl = inner.videoMessage.url || null;
        } else if (inner.audioMessage) {
          mediaType = "audio";
          mediaUrl = inner.audioMessage.url || null;
        } else {
          content = "[Visualização única]";
        }
      } else {
        // Unknown message type — log it but still save the message
        const msgKeys = Object.keys(msg).filter(k => k !== "messageContextInfo" && k !== "contextInfo");
        console.warn("[WEBHOOK-WHATSAPP] UNKNOWN message type — keys:", msgKeys.join(", "), "full:", JSON.stringify(msg).slice(0, 500));
        content = `[${msgKeys[0] || "mensagem"}]`;
      }

      // Extract contextInfo (present in Click-to-WhatsApp ads, quoted messages, etc.)
      // This helps identify ad-sourced messages
      const contextInfo = msg.extendedTextMessage?.contextInfo 
        || msg.imageMessage?.contextInfo 
        || msg.videoMessage?.contextInfo 
        || msg.templateMessage?.hydratedTemplate?.contextInfo 
        || msg.interactiveMessage?.contextInfo 
        || null;
      
      if (contextInfo) {
        const isForwarded = contextInfo.isForwarded || false;
        const adSource = contextInfo.externalAdReply || contextInfo.businessMessageForwardInfo || null;
        if (adSource) {
          console.log("[WEBHOOK-WHATSAPP] Ad-sourced message detected — adSource:", JSON.stringify(adSource).slice(0, 200));
        }
        if (isForwarded) {
          console.log("[WEBHOOK-WHATSAPP] Forwarded message detected");
        }
      }

      console.log("[WEBHOOK-WHATSAPP] Format B — remoteJid:", remoteJid, "fromMe:", fromMe, "contentLen:", content.length, "mediaType:", mediaType);
    }

    const phoneNumber = remoteJid.split("@")[0];
    const isGroup = remoteJid.includes("@g.us");

    console.log("[WEBHOOK-WHATSAPP] Instance:", instance, "From:", phoneNumber, "FromMe:", fromMe);

    // 1. Find channel by instance_name
    const { data: channel, error: channelError } = await supabase
      .from("whatsapp_channels")
      .select("id, organization_id, channel_type, owner_jid, phone_number, channel_status")
      .eq("instance_name", instance)
      .maybeSingle();

    // For group messages, double-check fromMe by comparing participant JID with channel owner
    if (isGroup && !fromMe && channel?.owner_jid) {
      const participantJid = data?.key?.participant || "";
      const ownerJidNormalized = channel.owner_jid.split("@")[0];
      const participantNormalized = participantJid.split("@")[0];
      if (participantNormalized && participantNormalized === ownerJidNormalized) {
        fromMe = true;
        console.log("[WEBHOOK-WHATSAPP] Group message from owner detected via participant JID match");
      }
    }

    // Mode detection variables
    let adminOrgId: string | null = null;

    if (channelError || !channel) {
      console.error("[WEBHOOK-WHATSAPP] Channel not found:", instance);
      return new Response(JSON.stringify({ ok: true, warning: "channel_not_found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Guard: ignore messages for deleted channels (ghost instances)
    if (channel.channel_status === "deleted") {
      console.log("[WEBHOOK-WHATSAPP] Ignoring message for deleted channel:", instance);
      return new Response(JSON.stringify({ ok: true, warning: "channel_deleted" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const channelOrganizationId = channel.organization_id;
    const isTecvoAI = channel.channel_type === "TECVO_AI";
    const isCustomerInbox = channel.channel_type === "CUSTOMER_INBOX";

    console.log("[WEBHOOK-WHATSAPP] Channel type:", channel.channel_type, "| instance:", instance);

    // ── Determine mode & target org BEFORE saving contact/message ──
    const stripCountryCode = (p: string) => (p.startsWith("55") && p.length >= 12 ? p.substring(2) : p);
    const matchesOwner = (sender: string, owner: string | null | undefined) => {
      if (!owner) return false;
      const normalizedOwner = normalizePhone(owner);
      return sender === normalizedOwner || stripCountryCode(sender) === stripCountryCode(normalizedOwner);
    };

    const normalizedSender = normalizePhone(phoneNumber);

    let mode = "lead_comercial";
    let targetOrganizationId = channelOrganizationId; // where contact/messages are stored

    if (isTecvoAI) {
      // ── TECVO_AI channel: route to the org whose whatsapp_owner matches sender ──
      const orgOwnersAll: any[] = [];
      let orgFrom = 0;
      let orgHasMore = true;
      while (orgHasMore) {
        const { data: batch } = await supabase
          .from("organizations")
          .select("id, name, whatsapp_owner")
          .not("whatsapp_owner", "is", null)
          .range(orgFrom, orgFrom + 999);
        if (batch && batch.length > 0) {
          orgOwnersAll.push(...batch);
          orgFrom += 1000;
          orgHasMore = batch.length === 1000;
        } else {
          orgHasMore = false;
        }
      }
      const orgOwners = orgOwnersAll;

      const matchedOrg = (orgOwners || []).find((org: any) => matchesOwner(normalizedSender, org.whatsapp_owner));
      if (matchedOrg) {
        mode = "admin_empresa";
        targetOrganizationId = matchedOrg.id;
      }
      // If no match, mode stays lead_comercial and stores in channel's org (Tecvo)
    } else {
      // ── CUSTOMER_INBOX channel: messages belong to the channel's org ──
      mode = "customer_message";
      targetOrganizationId = channelOrganizationId;
    }

    console.log("[WEBHOOK-WHATSAPP] Mode:", mode, "| channel_type:", channel.channel_type, "| sender:", normalizedSender, "| channel_org:", channelOrganizationId, "| target_org:", targetOrganizationId);

    // 2. Find or create contact — in the TARGET org, SCOPED TO THIS CHANNEL
    // Architecture: Each (org + phone + channel) = unique conversation thread.
    // The same client talking to two different company numbers = two separate contacts/threads.
    // We NEVER reassign a contact's channel_id — that would merge conversations.
    let existingContact: any = null;
    {
      // Step 1: Lookup by whatsapp_id (JID) + channel_id (exact match for this channel's thread)
      const { data: idMatch } = await supabase
        .from("whatsapp_contacts")
        .select("id, profile_picture_url, is_name_custom, name, linked_client_id, is_blocked, channel_id, whatsapp_id")
        .eq("organization_id", targetOrganizationId)
        .eq("whatsapp_id", remoteJid)
        .eq("channel_id", channel.id)
        .maybeSingle();
      
      if (idMatch) {
        existingContact = idMatch;
      } else if (!isGroup) {
        // Step 2: Fallback to normalized phone + channel_id for non-groups
        const phoneDigits = normalizePhone(remoteJid);
        const { data: phoneMatch } = await supabase
          .from("whatsapp_contacts")
          .select("id, profile_picture_url, is_name_custom, name, linked_client_id, is_blocked, channel_id, whatsapp_id")
          .eq("organization_id", targetOrganizationId)
          .eq("normalized_phone", phoneDigits)
          .eq("channel_id", channel.id)
          .eq("is_group", false)
          .maybeSingle();
        
        if (phoneMatch) {
          existingContact = phoneMatch;
          // Update whatsapp_id to the latest one received if they differ (e.g., @lid → @s.whatsapp.net)
          if (phoneMatch.whatsapp_id !== remoteJid) {
            console.log("[WEBHOOK-WHATSAPP] Updating contact JID due to identity variation:", phoneMatch.whatsapp_id, "→", remoteJid);
            await supabase.from("whatsapp_contacts").update({ whatsapp_id: remoteJid }).eq("id", phoneMatch.id);
          }
        }
      } else if (isGroup) {
        // Step 3: Fuzzy group match (scoped to channel)
        const groupNumericId = remoteJid.split("@")[0];
        if (groupNumericId) {
          const { data: fuzzyMatch } = await supabase
            .from("whatsapp_contacts")
            .select("id, profile_picture_url, is_name_custom, name, linked_client_id, is_blocked, whatsapp_id, channel_id")
            .eq("organization_id", targetOrganizationId)
            .eq("channel_id", channel.id)
            .eq("is_group", true)
            .like("whatsapp_id", `${groupNumericId}@%`)
            .maybeSingle();
          
          if (fuzzyMatch) {
            existingContact = fuzzyMatch;
            await supabase.from("whatsapp_contacts").update({ whatsapp_id: remoteJid }).eq("id", fuzzyMatch.id);
            console.log("[WEBHOOK-WHATSAPP] Group matched via numeric ID + synced:", fuzzyMatch.id);
          }
        }
      }
    }

    if (existingContact?.is_blocked) {
      console.log("[WEBHOOK-WHATSAPP] Contact/group is blocked, skipping:", existingContact.id, remoteJid);
      return new Response(JSON.stringify({ ok: true, skipped: "blocked" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let contactId: string;

    if (existingContact) {
      contactId = existingContact.id;
      // No channel reassignment — contact stays on its original channel
      const updateData: Record<string, any> = {};
      
      if (!existingContact.is_name_custom && !existingContact.linked_client_id && !fromMe && pushName) {
        updateData.name = pushName;
      }
      
      if (!existingContact.profile_picture_url && !fromMe && !isGroup) {
        const fetchedPic = await fetchProfilePicture(instance, remoteJid);
        if (fetchedPic) updateData.profile_picture_url = fetchedPic;
      }

      if (Object.keys(updateData).length > 0) {
        await supabase
          .from("whatsapp_contacts")
          .update(updateData)
          .eq("id", contactId);
      }
    } else {
      // Create NEW contact for this channel — even if same phone exists on another channel
      const normalizedPhone = phoneNumber.replace(/\D/g, "");
      
      let contactPicUrl = (typeof profilePictureUrl === "string" && profilePictureUrl) ? profilePictureUrl : null;
      if (!contactPicUrl && !isGroup) {
        contactPicUrl = await fetchProfilePicture(instance, remoteJid);
      }
      
      const { data: newContact, error: contactError } = await supabase
        .from("whatsapp_contacts")
        .insert({
          organization_id: targetOrganizationId,
          whatsapp_id: remoteJid,
          name: (!fromMe && pushName) ? pushName : phoneNumber,
          phone: phoneNumber,
          normalized_phone: normalizedPhone,
          is_group: isGroup,
          channel_id: channel.id,
          conversation_status: "novo",
          conversion_status: "novo_contato",
          needs_resolution: true,
          is_unread: true,
          has_conversation: true,
          ...(contactPicUrl ? { profile_picture_url: contactPicUrl } : {}),
        })
        .select("id")
        .single();

      if (contactError) {
        console.error("[WEBHOOK-WHATSAPP] Contact creation error:", contactError);
        return new Response(JSON.stringify({ ok: true, warning: "contact_creation_failed" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      contactId = newContact.id;
      console.log("[WEBHOOK-WHATSAPP] New contact/thread created:", contactId, "for channel:", channel.id, "phone:", normalizedPhone);
    }

    // 3. Deduplicate echo messages — skip saving if already exists
    const { data: existingMsg } = await supabase
      .from("whatsapp_messages")
      .select("id")
      .eq("message_id", messageId)
      .maybeSingle();

    // For fromMe echoes, also check for recent outbound messages with same content
    // (whatsapp-send saves with "out_" prefix, echo arrives with Evolution's own ID)
    let echoOfOutbound: any = null;
    if (!existingMsg && fromMe) {
      const tenSecondsAgo = new Date(Date.now() - 15000).toISOString();
      const { data: recentOutbound } = await supabase
        .from("whatsapp_messages")
        .select("id, message_id")
        .eq("contact_id", contactId)
        .eq("is_from_me", true)
        .gte("created_at", tenSecondsAgo)
        .like("message_id", "out_%")
        .order("created_at", { ascending: false })
        .limit(5);

      if (recentOutbound && recentOutbound.length > 0) {
        // Match echo to outbound by content comparison
        const normalizeContent = (s: string) => (s || "").trim().replace(/\s+/g, " ");
        const echoContent = normalizeContent(content);
        
        // Fetch content for recent outbound messages to do proper matching
        const outIds = recentOutbound.map((m: any) => m.id);
        const { data: outWithContent } = await supabase
          .from("whatsapp_messages")
          .select("id, message_id, content")
          .in("id", outIds);
        
        if (outWithContent && outWithContent.length > 0) {
          if (echoContent) {
            // Find the outbound message with matching content
            const match = outWithContent.find((m: any) => normalizeContent(m.content) === echoContent);
            echoOfOutbound = match || null;
          } else {
            // Echo with empty content (media-only) — match the most recent outbound
            echoOfOutbound = recentOutbound[0];
          }
        }
        console.log("[WEBHOOK-WHATSAPP] fromMe echo detected — matching recent out_msg:", echoOfOutbound?.message_id);
      }
    }

    let savedMsg: any = existingMsg || echoOfOutbound;
    const isEchoDuplicate = !!(existingMsg || echoOfOutbound);

    if (isEchoDuplicate) {
      console.log("[WEBHOOK-WHATSAPP] Duplicate/echo message_id:", messageId, "— skipping insert");
    } else {
      // For group messages, extract sender info from participant field
      let senderName: string | null = null;
      let senderPhone: string | null = null;
      if (isGroup) {
        const participantJid = data?.key?.participant || "";
        if (participantJid) {
          senderPhone = participantJid.split("@")[0];
        }
        if (fromMe) {
          // Use channel name or "Você" for own messages
          senderName = channel.name || "Você";
          if (!senderPhone && channel.phone_number) {
            senderPhone = channel.phone_number;
          }
        } else {
          senderName = pushName || senderPhone || null;
        }
      }

      const { data: insertedMsg, error: msgError } = await supabase
        .from("whatsapp_messages")
        .insert({
          organization_id: targetOrganizationId,
          contact_id: contactId,
          message_id: messageId,
          content,
          media_url: mediaUrl,
          media_type: mediaType,
          is_from_me: fromMe,
          status: fromMe ? "sent" : "received",
          channel_id: channel.id,
          source: "webhook",
          ...(senderName ? { sender_name: senderName } : {}),
          ...(senderPhone ? { sender_phone: senderPhone } : {}),
        })
        .select("id")
        .single();

      if (msgError) {
        console.error("[WEBHOOK-WHATSAPP] Save message error:", msgError);
        return new Response(JSON.stringify({ ok: false, error: "message_save_failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      savedMsg = insertedMsg;
    }

    // 4. Persist media to permanent storage AFTER saving the message
    //    The message is already visible in the chat; now we upgrade the URL in background.
    if (mediaType && mediaType !== "contact" && mediaType !== "location" && data?.key && savedMsg?.id) {
      const msg = data.message || {};
      // Extract mime from any message type including nested ones (viewOnce, template, interactive)
      const viewOnceInner = msg.viewOnceMessage?.message || msg.viewOnceMessageV2?.message || {};
      const templateInner = msg.templateMessage?.hydratedTemplate || msg.templateMessage?.hydratedFourRowTemplate || {};
      const interactiveHeader = msg.interactiveMessage?.header || {};
      const mimeType = msg.imageMessage?.mimetype
        || msg.videoMessage?.mimetype
        || msg.audioMessage?.mimetype
        || msg.documentMessage?.mimetype
        || msg.stickerMessage?.mimetype
        || viewOnceInner.imageMessage?.mimetype
        || viewOnceInner.videoMessage?.mimetype
        || viewOnceInner.audioMessage?.mimetype
        || templateInner.imageMessage?.mimetype
        || templateInner.videoMessage?.mimetype
        || templateInner.documentMessage?.mimetype
        || interactiveHeader.imageMessage?.mimetype
        || interactiveHeader.videoMessage?.mimetype
        || null;

      // Fire-and-forget: persist media and update the message URL asynchronously
      // We don't await this so the webhook response returns fast.
      (async () => {
        try {
          const permanentUrl = await persistMedia(supabase, instance, data.key, mimeType, targetOrganizationId);
          if (permanentUrl) {
            await supabase
              .from("whatsapp_messages")
              .update({ media_url: permanentUrl })
              .eq("id", savedMsg.id);
            console.log("[WEBHOOK-WHATSAPP] Media persisted and URL updated for message:", savedMsg.id);
          } else {
            console.warn("[WEBHOOK-WHATSAPP] Media persistence failed, keeping original URL for message:", savedMsg.id);
          }
        } catch (err: any) {
          console.error("[WEBHOOK-WHATSAPP] Background media persistence error:", err.message);
        }
      })();
    }

    // Fetch current contact state (needed for both preview update and bot triggers)
    const { data: currentContact } = await supabase
      .from("whatsapp_contacts")
      .select("unread_count, conversation_status, last_message_at")
      .eq("id", contactId)
      .single();

    // Skip contact preview update for echo duplicates (whatsapp-send already updated it)
    if (isEchoDuplicate && fromMe) {
      console.log("[WEBHOOK-WHATSAPP] Echo duplicate — skipping contact preview update");
    } else {
    // Update contact (always update normalized_phone for consistency)
    const normalizedPhoneUpdate = phoneNumber.replace(/\D/g, "");
    
    // Build proper preview content with media type labels
    const mediaLabels: Record<string, string> = {
      image: "📷 Imagem",
      video: "🎥 Vídeo",
      audio: "🎤 Áudio",
      document: "📄 Documento",
    };
    const previewContent = content
      ? content.substring(0, 200)
      : mediaType
        ? mediaLabels[mediaType] || `[${mediaType}]`
        : "";
    
    // Use Evolution API messageTimestamp if available, otherwise now()
    const evoTimestamp = data?.messageTimestamp;
    const messageTime = evoTimestamp
      ? new Date(typeof evoTimestamp === "number" ? evoTimestamp * 1000 : evoTimestamp).toISOString()
      : new Date().toISOString();

    // Only update preview if this message is actually newer than what's stored
    const currentLastMsgTime = currentContact?.last_message_at ? new Date(currentContact.last_message_at).getTime() : 0;
    const newMsgTime = new Date(messageTime).getTime();
    const isNewer = newMsgTime >= currentLastMsgTime;

    // For incoming messages, always increment unread even if not newer (for counter accuracy)
    const unreadUpdate: Record<string, any> = {
      normalized_phone: normalizedPhoneUpdate,
      has_conversation: true, // Always reactivate — ensures soft-deleted conversations reappear
      ...(typeof profilePictureUrl === "string" && profilePictureUrl ? { profile_picture_url: profilePictureUrl } : {}),
    };

    // Only update preview fields if this message is actually the newest
    if (isNewer) {
      unreadUpdate.last_message_at = messageTime;
      unreadUpdate.is_unread = !fromMe;
      unreadUpdate.last_message_content = previewContent;
      unreadUpdate.last_message_is_from_me = fromMe;
      console.log("[WEBHOOK-WHATSAPP] Updating preview — messageTime:", messageTime, "currentLastMsgTime:", currentContact?.last_message_at);
    } else {
      console.log("[WEBHOOK-WHATSAPP] Skipping preview update — message is older. messageTime:", messageTime, "currentLastMsgTime:", currentContact?.last_message_at);
    }

    // Reopen/transition conversations based on who sent the message
    {

      const currentStatus = currentContact?.conversation_status || "novo";

      if (!fromMe) {
        unreadUpdate.unread_count = ((currentContact?.unread_count as number) || 0) + 1;

        // Client sent message: reopen finalized conversations
        if (currentStatus === "resolvido") {
          unreadUpdate.conversation_status = "novo";
        } else if (currentStatus === "aguardando_cliente") {
          // Backward compat: move old aguardando_cliente to atendendo
          unreadUpdate.conversation_status = "atendendo";
        }
        // "novo" and "atendendo" stay as-is
      } else {
        // Outgoing message echo: agent sent message
        // Only transition to "atendendo" if currently "novo" — do NOT reopen finalized conversations
        if (currentStatus === "novo") {
          unreadUpdate.conversation_status = "atendendo";
        }
        // "atendendo" stays as-is, "resolvido" stays finalized (whatsapp-send already handles reopening intentionally)
      }
    }

    await supabase
      .from("whatsapp_contacts")
      .update(unreadUpdate)
      .eq("id", contactId);

    console.log("[WEBHOOK-WHATSAPP] Message saved for contact:", contactId, "in org:", targetOrganizationId);
    } // end of echo-duplicate else block

    // ── Push Notifications for CUSTOMER_INBOX incoming messages ──
    if (!fromMe && isCustomerInbox) {
      try {
        // Get all notification tokens for the org
        const { data: tokens } = await supabase
          .from("notification_tokens")
          .select("user_id")
          .eq("organization_id", targetOrganizationId);

        const uniqueUserIds = [...new Set((tokens || []).map((t: any) => t.user_id))];

        const contactName = pushName || phoneNumber;
        const previewText = content
          ? content.substring(0, 80)
          : mediaType
            ? `[${mediaType === "image" ? "Imagem" : mediaType === "video" ? "Vídeo" : mediaType === "audio" ? "Áudio" : "Documento"}]`
            : "Nova mensagem";

        const base_url = Deno.env.get("SUPABASE_URL")!;
        const anon_key = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";

        for (const userId of uniqueUserIds) {
          fetch(`${base_url}/functions/v1/send-push-notification`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${anon_key}`,
            },
            body: JSON.stringify({
              user_id: userId,
              title: `💬 ${contactName}`,
              body: previewText,
              url: "/whatsapp",
              category: "whatsapp_message",
              tag: `whatsapp_message_${contactId}_${messageId}`,
            }),
          }).catch((e: any) => console.warn("[WEBHOOK-WHATSAPP] Push notification failed:", e.message));
        }

        console.log("[WEBHOOK-WHATSAPP] Push notifications dispatched to", uniqueUserIds.length, "users");
      } catch (pushErr) {
        console.warn("[WEBHOOK-WHATSAPP] Push notification error:", pushErr);
      }
    }

    // ── Auto-trigger bots for CUSTOMER_INBOX incoming messages ──
    if (!fromMe && isCustomerInbox && contactId) {
      try {
        // 1. Check for active execution to resume or prevent duplicates
        const { data: activeExecs } = await supabase
          .from("whatsapp_bot_executions")
          .select("id, status, bot_id")
          .eq("contact_id", contactId)
          .in("status", ["running", "waiting", "waiting_input", "waiting_response"])
          .order("started_at", { ascending: false })
          .limit(1);

        const activeExec = activeExecs?.[0];
        let botExecutionHandled = false;

        if (activeExec) {
          if (["waiting_input", "waiting_response"].includes(activeExec.status)) {
            // Resume the existing execution
            const base_url2 = Deno.env.get("SUPABASE_URL")!;
            const anon_key2 = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
            
            fetch(`${base_url2}/functions/v1/bot-engine`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${anon_key2}`,
              },
              body: JSON.stringify({
                action: "resume",
                contact_id: contactId,
                message: content || "[mídia]",
              }),
            }).catch((e: any) => console.warn("[WEBHOOK-WHATSAPP] Bot resume failed:", e.message));

            console.log("[WEBHOOK-WHATSAPP] Bot execution resumed:", activeExec.id, "for contact:", contactId);
            botExecutionHandled = true;
          } else {
            // It's already running or in delay wait, don't start a new one (guarantees uniqueness)
            console.log("[WEBHOOK-WHATSAPP] Bot execution already active (skip trigger):", activeExec.id, "status:", activeExec.status);
            botExecutionHandled = true;
          }
        }

        if (!botExecutionHandled) {
          const { data: activeBots } = await supabase
            .from("whatsapp_bots")
            .select("id, trigger_type, trigger_config")
            .eq("organization_id", targetOrganizationId)
            .eq("is_active", true);

          // Determine conversation state BEFORE this message updated it
          const previousStatus = currentContact?.conversation_status || null;
          const isNewConversation = !currentContact || previousStatus === "resolvido" || !previousStatus;

          for (const bot of activeBots || []) {
            const b = bot as any;
            let triggerMatch = false;

            if (b.trigger_type === "new_message") {
              // Fires on every incoming message
              triggerMatch = true;
            } else if (b.trigger_type === "new_conversation") {
              // Fires only for truly new conversations or reopened (was finalized)
              triggerMatch = isNewConversation;
            }

            if (!triggerMatch) continue;

            // Check channel filter
            const channelIds: string[] = b.trigger_config?.channel_ids || [];
            if (channelIds.length > 0 && !channelIds.includes(channel.id)) continue;

            // Fire bot-engine start (fire-and-forget)
            const base_url2 = Deno.env.get("SUPABASE_URL")!;
            const anon_key2 = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
            fetch(`${base_url2}/functions/v1/bot-engine`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${anon_key2}`,
              },
              body: JSON.stringify({
                action: "start",
                bot_id: b.id,
                contact_id: contactId,
                organization_id: targetOrganizationId,
              }),
            }).catch((e: any) => console.warn("[WEBHOOK-WHATSAPP] Bot trigger failed:", e.message));

            console.log("[WEBHOOK-WHATSAPP] Bot triggered:", b.id, "for contact:", contactId);
            
            // Only trigger one bot per message to avoid chaos
            break;
          }
        }
      } catch (botErr) {
        console.warn("[WEBHOOK-WHATSAPP] Bot trigger error:", botErr);
      }
    }

    // 4. AI Processing — only for TECVO_AI channel, incoming messages with text
    if (!fromMe && content && !isGroup && isTecvoAI) {
      try {
        let systemPrompt: string;

        if (mode === "admin_empresa") {
          const orgContext = await fetchOrgContext(supabase, targetOrganizationId);
          systemPrompt = buildSystemPrompt(orgContext);

          // Add instruction about financial tools
          systemPrompt += `\n\n══════════ FERRAMENTAS DISPONÍVEIS ══════════
Você tem acesso à ferramenta 'register_transaction' para registrar despesas e receitas.
Quando o usuário pedir para registrar um gasto/despesa/receita:
1. Extraia os dados da mensagem (valor, descrição, categoria, data)
2. Se faltar algum dado essencial, pergunte antes de registrar
3. Use a ferramenta para registrar
4. Confirme o registro ao usuário

Categorias comuns de despesa: material, combustível, alimentação, aluguel, fornecedor, manutenção, salário, outro
Categorias comuns de receita: serviço, manutenção, instalação, venda, outro`;

          // Fetch conversation history for context
          const conversationHistory = await fetchConversationHistory(supabase, contactId);

          const startTime = Date.now();
          let aiResult = await callAI(systemPrompt, conversationHistory, FINANCIAL_TOOLS);
          let aiDuration = Date.now() - startTime;

          // Handle tool calls (one round)
          if (aiResult.toolCalls && aiResult.toolCalls.length > 0) {
            console.log("[WEBHOOK-WHATSAPP] AI requested tool calls:", aiResult.toolCalls.length);
            const toolMessages: any[] = [...conversationHistory];
            // Add assistant message with tool_calls
            toolMessages.push({ role: "assistant", content: aiResult.content || "", tool_calls: aiResult.toolCalls });

            for (const tc of aiResult.toolCalls) {
              const toolResult = await executeFinancialTool(supabase, targetOrganizationId, tc);
              console.log("[WEBHOOK-WHATSAPP] Tool result:", toolResult);
              toolMessages.push({ role: "tool", tool_call_id: tc.id, content: toolResult });
            }

            // Second AI call with tool results (no tools this time to force text response)
            const startTime2 = Date.now();
            aiResult = await callAI(systemPrompt, toolMessages);
            aiDuration += Date.now() - startTime2;
          }

          const aiResponse = aiResult.content;

          // Log AI usage
          const aiUsage = extractUsageFromResponse({ usage: aiResult.usage });
          await logAIUsage(supabase, {
            organizationId: targetOrganizationId, userId: null, actionSlug: "bot_auto_reply",
            model: "google/gemini-3-flash-preview",
            promptTokens: aiUsage.promptTokens, completionTokens: aiUsage.completionTokens,
            totalTokens: aiUsage.totalTokens, durationMs: aiDuration, status: "success",
          });

          if (aiResponse) {
            // Send guard check for AI reply
            const aiGuard = await checkSendLimit(supabase, targetOrganizationId, contactId, "ai");
            if (!aiGuard.allowed) {
              console.warn("[WEBHOOK-WHATSAPP] AI reply blocked by send guard:", aiGuard.reason);
            } else {
              console.log("[WEBHOOK-WHATSAPP] AI admin response:", aiResponse.slice(0, 200));
              const aiMessageId = `ai_${crypto.randomUUID()}`;
              await supabase.from("whatsapp_messages").insert({
                organization_id: targetOrganizationId,
                contact_id: contactId,
                message_id: aiMessageId,
                content: aiResponse,
                is_from_me: true,
                status: "sent",
                channel_id: channel.id,
              });
              const sent = await sendWhatsAppReply(instance, remoteJid, aiResponse);
              console.log("[WEBHOOK-WHATSAPP] Admin reply sent:", sent);
            }
          }
        } else {
          // lead_comercial on TECVO_AI channel
          const conversationHistory = await fetchConversationHistory(supabase, contactId);
          systemPrompt = `Você é a assistente comercial do Tecvo. Este número não está autorizado a acessar dados da empresa. Explique brevemente o que é o Tecvo e convide o usuário a conhecer a plataforma em https://tecvo.lovable.app. Responda em português brasileiro, de forma objetiva e com no máximo 500 caracteres.`;

          const startTimeLead = Date.now();
          const aiResultLead = await callAI(systemPrompt, conversationHistory);
          const aiResponse = aiResultLead.content;
          const aiDurationLead = Date.now() - startTimeLead;

          const aiUsageLead = extractUsageFromResponse({ usage: aiResultLead.usage });
          await logAIUsage(supabase, {
            organizationId: targetOrganizationId, userId: null, actionSlug: "bot_lead_reply",
            model: "google/gemini-3-flash-preview",
            promptTokens: aiUsageLead.promptTokens, completionTokens: aiUsageLead.completionTokens,
            totalTokens: aiUsageLead.totalTokens, durationMs: aiDurationLead, status: "success",
          });

          if (aiResponse) {
            // Send guard check for AI lead reply
            const leadGuard = await checkSendLimit(supabase, targetOrganizationId, contactId, "ai");
            if (!leadGuard.allowed) {
              console.warn("[WEBHOOK-WHATSAPP] AI lead reply blocked by send guard:", leadGuard.reason);
            } else {
              console.log("[WEBHOOK-WHATSAPP] AI lead response:", aiResponse.slice(0, 200));
              const aiMessageId = `ai_${crypto.randomUUID()}`;
              await supabase.from("whatsapp_messages").insert({
                organization_id: targetOrganizationId,
                contact_id: contactId,
                message_id: aiMessageId,
                content: aiResponse,
                is_from_me: true,
                status: "sent",
                channel_id: channel.id,
              });
              const sent = await sendWhatsAppReply(instance, remoteJid, aiResponse);
              console.log("[WEBHOOK-WHATSAPP] Lead reply sent:", sent);
            }
          }
        }
      } catch (aiError) {
        console.error("[WEBHOOK-WHATSAPP] AI processing error:", aiError);
      }
    }
    // CUSTOMER_INBOX: no AI auto-reply — messages just land in the inbox for manual handling

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[WEBHOOK-WHATSAPP] Error:", error);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
