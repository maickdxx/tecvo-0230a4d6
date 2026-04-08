import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { logAIUsage, extractUsageFromResponse } from "../_shared/aiUsageLogger.ts";
import { validateUserOrgAccess, accessDeniedResponse } from "../_shared/validateOrgAccess.ts";
import { validateAIOutput, logOutputViolation } from "../_shared/outputValidator.ts";
import { checkAIRateLimit } from "../_shared/aiRateLimit.ts";

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

    // Verify user
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

    const { contactId, organizationId, conversationMessages } = await req.json();
    if (!organizationId || !contactId) {
      return new Response(JSON.stringify({ error: "organizationId and contactId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CRITICAL: Validate user belongs to the requested organization
    const hasAccess = await validateUserOrgAccess(supabaseAdmin, userId, organizationId, "analyze-conversation");
    if (!hasAccess) {
      return accessDeniedResponse(corsHeaders);
    }

    // ── RATE LIMIT ──
    const rateCheck = await checkAIRateLimit(supabaseAdmin, organizationId, corsHeaders);
    if (!rateCheck.allowed) return rateCheck.response!;

    // Check and consume AI credits
    const { data: hasCredits, error: creditError } = await supabaseAdmin.rpc("consume_ai_credits", {
      _org_id: organizationId,
      _action_slug: "analyze_conversation",
      _user_id: userId,
    });

    if (creditError || !hasCredits) {
      return new Response(JSON.stringify({ error: "A capacidade de processamento da Laura está pausada. Amplie para continuar." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch context data in parallel
    const [orgRes, catalogRes, contactRes, serviceTypesRes, paymentMethodsRes] = await Promise.all([
      supabaseAdmin
        .from("organizations")
        .select("name, phone, email, city, state, address, zip_code")
        .eq("id", organizationId)
        .single(),
      supabaseAdmin
        .from("catalog_services")
        .select("id, name, description, unit_price, service_type")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .is("deleted_at", null)
        .limit(100),
      supabaseAdmin
        .from("whatsapp_contacts")
        .select("name, phone, linked_client_id")
        .eq("id", contactId)
        .single(),
      supabaseAdmin
        .from("service_types")
        .select("name, slug")
        .eq("organization_id", organizationId)
        .limit(50),
      supabaseAdmin
        .from("payment_methods")
        .select("slug, name, installments")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("installments", { ascending: true, nullsFirst: true })
        .limit(100),
    ]);

    const org = orgRes.data;
    const catalog = catalogRes.data || [];
    const contactInfo = contactRes.data;
    const serviceTypes = serviceTypesRes.data || [];
    const paymentMethods = paymentMethodsRes.data || [];

    // If contact has a linked client, get their info
    let clientInfo = null;
    if (contactInfo?.linked_client_id) {
      const { data } = await supabaseAdmin
        .from("clients")
        .select("id, name, phone, email, street, number, complement, neighborhood, city, state, zip_code")
        .eq("id", contactInfo.linked_client_id)
        .single();
      clientInfo = data;
    }

    // Build catalog summary with IDs for matching
    const catalogSummary = catalog.length > 0
      ? catalog.map((s: any) => `- [ID:${s.id}] ${s.name}: R$ ${s.unit_price?.toFixed(2)} (${s.service_type || "geral"})${s.description ? ` — ${s.description}` : ""}`).join("\n")
      : "Nenhum serviço no catálogo.";

    const serviceTypesList = serviceTypes.map((t: any) => t.name).join(", ");
    const paymentMethodsList = paymentMethods.length > 0
      ? paymentMethods.map((pm: any) => {
          if (pm.installments) return `${pm.name} [slug:${pm.slug}]`;
          return `${pm.name} [slug:${pm.slug}]`;
        }).join(", ")
      : "Nenhuma forma de pagamento cadastrada.";

    // Build conversation text with timestamps
    const conversationText = (conversationMessages || [])
      .map((m: any) => {
        const time = m.created_at ? new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
        const date = m.created_at ? new Date(m.created_at).toLocaleDateString("pt-BR") : "";
        return `[${date} ${time}] ${m.is_from_me ? "ATENDENTE" : "CLIENTE"}: ${m.content}`;
      })
      .join("\n");

    const systemPrompt = `Você é um assistente especializado em extrair informações de conversas de WhatsApp para gerar Ordens de Serviço (OS).

DADOS DA EMPRESA:
Nome: ${org?.name || "?"}
Cidade: ${org?.city || "?"} - ${org?.state || "?"}
Endereço: ${org?.address || "?"}
CEP: ${org?.zip_code || "?"}

${clientInfo ? `DADOS DO CLIENTE VINCULADO:
Nome: ${clientInfo.name}
Telefone: ${clientInfo.phone}
Endereço: ${[clientInfo.street, clientInfo.number, clientInfo.complement, clientInfo.neighborhood].filter(Boolean).join(", ")}
Cidade: ${clientInfo.city || "?"} - ${clientInfo.state || "?"}
CEP: ${clientInfo.zip_code || "?"}` : `CONTATO:
Nome: ${contactInfo?.name || "Não identificado"}
Telefone: ${contactInfo?.phone || "?"}`}

CATÁLOGO DE SERVIÇOS (preços de referência com IDs para correspondência exata):
${catalogSummary}

TIPOS DE SERVIÇO DISPONÍVEIS: ${serviceTypesList}
FORMAS DE PAGAMENTO DISPONÍVEIS (usar slug exato): ${paymentMethodsList}

TAREFA:
Analise a conversa de WhatsApp abaixo e extraia TODAS as informações relevantes para criar uma Ordem de Serviço.

Retorne APENAS um JSON com a seguinte estrutura (todos os campos são opcionais, preencha apenas os que conseguir identificar na conversa):

{
  "client_name": "nome do cliente",
  "client_phone": "telefone do cliente",
  "service_street": "rua/logradouro",
  "service_number": "número",
  "service_complement": "complemento (apto, bloco etc)",
  "service_neighborhood": "bairro",
  "service_city": "cidade",
  "service_state": "UF (2 letras)",
  "service_zip_code": "CEP (formato 00000-000)",
  "service_type": "tipo do serviço (usar slug: instalacao, manutencao, limpeza, contratos, outros)",
  "catalog_service_id": "ID do serviço do catálogo que melhor corresponde (extrair do [ID:uuid])",
  "equipment_type": "tipo do equipamento SOMENTE se o cliente mencionar detalhes específicos do equipamento que precisa ser registrado. NÃO preencher com termos genéricos como 'Split' ou 'Ar-condicionado' que já fazem parte do nome do serviço",
  "equipment_capacity": "capacidade em BTUs SOMENTE se mencionado explicitamente pelo cliente",
  "equipment_brand": "marca do equipamento SOMENTE se mencionada explicitamente",
  "equipment_model": "modelo do equipamento SOMENTE se mencionado explicitamente",
  "description": "descrição do serviço a ser realizado",
  "value": 0.00,
  "discount": 0.00,
  "discount_type": "percentage ou fixed",
  "final_value": 0.00,
  "payment_method": "slug da forma de pagamento (ex: pix, cash, debit_card, credit_card_1x)",
  "payment_due_date": "data de vencimento no formato YYYY-MM-DD",
  "notes": "observações importantes mencionadas pelo cliente",
  "scheduled_date": "data agendada (formato YYYY-MM-DD)",
  "scheduled_time": "horário de entrada/visita (formato HH:mm)",
  "exit_time": "horário de saída previsto/confirmado (formato HH:mm)",
  "sources": {
    "service_street": "mensagem do CLIENTE em DD/MM/YYYY HH:mm",
    "value": "mensagem do ATENDENTE em DD/MM/YYYY HH:mm",
    ...
  },
  "confidence": {
    "address": "alta|media|baixa",
    "value": "alta|media|baixa",
    "service": "alta|media|baixa",
    "cep": "alta|media|baixa"
  }
}

REGRAS:
1. Extraia VALORES mencionados pelo atendente (quem informa preço é o atendente)
2. DESCONTO - REGRA CRÍTICA:
   - Se a conversa mencionar desconto em percentual (ex: "20% de desconto"), preencha: "discount_type": "percentage", "discount": 20
   - Se a conversa mencionar desconto em valor (ex: "50 reais de desconto"), preencha: "discount_type": "fixed", "discount": 50
   - "value" deve ser SEMPRE o valor ORIGINAL/CHEIO do serviço (antes do desconto)
   - "final_value" deve ser o valor APÓS aplicar o desconto
   - Exemplo: "250 com 20% de desconto" → value: 250, discount: 20, discount_type: "percentage", final_value: 200
   - Exemplo: "250 com 50 de desconto" → value: 250, discount: 50, discount_type: "fixed", final_value: 200
3. Se o endereço estiver incompleto, tente completar com base na cidade da empresa (${org?.city || "?"}-${org?.state || "?"})
4. IMPORTANTE: Associe ao serviço do catálogo mais próximo usando o [ID:uuid]. Exemplo: se "limpeza 9000 BTUs" foi mencionado e existe "[ID:abc-123] Limpeza de ar-condicionado 9000 BTU", retorne "catalog_service_id": "abc-123"
5. BUSCA DE CEP: Se identificar endereço completo (rua + número + cidade + estado), tente inferir o CEP baseado na localização. Se não tiver certeza, deixe vazio ou marque confidence.cep como "baixa"
6. Em "sources", indique de qual mensagem cada informação foi extraída (data e hora)
7. Em "confidence", indique o nível de confiança para endereço, valor, serviço e CEP
8. NÃO invente informações que não estejam na conversa
9. Se o cliente já estiver cadastrado, use os dados do cadastro como base e complemente com a conversa
10. NÃO inclua texto fora do JSON
11. EQUIPAMENTO: Somente preencha equipment_type, equipment_brand, equipment_model se o cliente fornecer dados ESPECÍFICOS do equipamento (marca, modelo, número de série). Termos genéricos como "Split", "Ar-condicionado" NÃO devem preencher esses campos pois já fazem parte da descrição do serviço.
12. FORMA DE PAGAMENTO: preencha payment_method apenas com um slug válido da lista fornecida. Se não houver evidência clara na conversa, deixe vazio.
13. HORÁRIO DE SAÍDA: preencha exit_time apenas se houver menção explícita (ex: "termina às 18:30"). Se não houver, deixe vazio.
14. DATA DE VENCIMENTO: preencha payment_due_date apenas se houver menção explícita de vencimento/prazo de pagamento. Use formato YYYY-MM-DD; se não houver evidência clara, deixe vazio.`;

    const aiMessages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `CONVERSA:\n${conversationText}\n\nExtraia as informações e retorne o JSON.` },
    ];

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
        temperature: 0.3,
      }),
    });

    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      const errorStatus = response.status === 429 ? "rate_limited" : "error";
      await logAIUsage(supabaseAdmin, {
        organizationId, userId, actionSlug: "analyze_conversation", model: aiModel,
        promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMs, status: errorStatus,
      });

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro na IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "{}";

    // Log AI usage
    const usage = extractUsageFromResponse(result);
    await logAIUsage(supabaseAdmin, {
      organizationId, userId, actionSlug: "analyze_conversation", model: aiModel,
      promptTokens: usage.promptTokens, completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens, durationMs, status: "success",
    });

    let extraction: any = {};
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extraction = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("Failed to parse extraction:", e, content);
      extraction = { error: "Não foi possível analisar a conversa" };
    }

    // Normalize extracted required fields
    if (extraction.payment_method) {
      const rawPayment = String(extraction.payment_method).toLowerCase().trim();
      const paymentAliases: Record<string, string> = {
        pix: "pix",
        dinheiro: "cash",
        cash: "cash",
        boleto: "boleto",
        transferencia: "bank_transfer",
        "transferência": "bank_transfer",
        debit_card: "debit_card",
        debito: "debit_card",
        "débito": "debit_card",
      };

      const ccInstallmentsMatch = rawPayment.match(/(?:credito|crédito|credit_card)[^\d]*(\d{1,2})x?/i);
      if (ccInstallmentsMatch) {
        extraction.payment_method = `credit_card_${ccInstallmentsMatch[1]}x`;
      } else if (rawPayment.includes("cart") && (rawPayment.includes("credito") || rawPayment.includes("crédito"))) {
        extraction.payment_method = "credit_card_1x";
      } else {
        extraction.payment_method = paymentAliases[rawPayment] || rawPayment;
      }

      const validSlugs = new Set(paymentMethods.map((pm: any) => pm.slug));
      if (!validSlugs.has(extraction.payment_method)) {
        extraction.payment_method = "";
      }
    }

    if (extraction.exit_time) {
      const exitMatch = String(extraction.exit_time).match(/(\d{2}:\d{2})/);
      extraction.exit_time = exitMatch ? exitMatch[1] : "";
    }

    if (extraction.payment_due_date) {
      const rawDueDate = String(extraction.payment_due_date).trim();
      const brDateMatch = rawDueDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      const isoDateMatch = rawDueDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);

      if (isoDateMatch) {
        extraction.payment_due_date = `${isoDateMatch[1]}-${isoDateMatch[2]}-${isoDateMatch[3]}`;
      } else if (brDateMatch) {
        extraction.payment_due_date = `${brDateMatch[3]}-${brDateMatch[2]}-${brDateMatch[1]}`;
      } else {
        extraction.payment_due_date = "";
      }
    }

    // Auto-fetch CEP via ViaCEP if address is present but CEP is missing or needs validation
    if (extraction.service_state && extraction.service_city && extraction.service_street) {
      try {
        const uf = extraction.service_state.trim();
        const city = extraction.service_city.trim();
        // Clean street name: remove numbers, commas, extra info
        let street = extraction.service_street.split(",")[0].trim();
        // Remove common prefixes for better search
        street = street.replace(/^(rua|r\.|av\.|avenida|travessa|trav\.)\s*/i, "").trim();

        const viaCepUrl = `https://viacep.com.br/ws/${encodeURIComponent(uf)}/${encodeURIComponent(city)}/${encodeURIComponent(street)}/json/`;
        const cepResp = await fetch(viaCepUrl);
        if (cepResp.ok) {
          const cepData = await cepResp.json();
          if (Array.isArray(cepData) && cepData.length > 0) {
            // Validate: check if returned data matches the city and state
            const validResults = cepData.filter((r: any) =>
              r.localidade?.toLowerCase() === city.toLowerCase() &&
              r.uf?.toLowerCase() === uf.toLowerCase()
            );

            if (validResults.length > 0) {
              const bestMatch = validResults[0];
              // Only override CEP if it's missing or if we have high confidence
              if (!extraction.service_zip_code || validResults.length === 1) {
                extraction.service_zip_code = bestMatch.cep;
              }
              if (!extraction.service_neighborhood && bestMatch.bairro) {
                extraction.service_neighborhood = bestMatch.bairro;
              }
              extraction.confidence = {
                ...extraction.confidence,
                cep: validResults.length === 1 ? "alta" : "media",
              };
            } else if (!extraction.service_zip_code) {
              // Results didn't match city/state - low confidence
              extraction.confidence = { ...extraction.confidence, cep: "baixa" };
            }
          }
        }
      } catch (cepErr) {
        console.warn("ViaCEP lookup failed:", cepErr);
      }
    }

    // If CEP was provided by AI, validate it against the address
    if (extraction.service_zip_code && extraction.service_city) {
      try {
        const cleanCep = extraction.service_zip_code.replace(/\D/g, "");
        if (cleanCep.length === 8) {
          const validateResp = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
          if (validateResp.ok) {
            const validateData = await validateResp.json();
            if (!validateData.erro) {
              // Check if CEP matches the city
              if (validateData.localidade?.toLowerCase() !== extraction.service_city.toLowerCase()) {
                console.warn("CEP doesn't match city, searching for correct CEP");
                // CEP doesn't match - clear it and let the search above find the right one
                extraction.service_zip_code = "";
                extraction.confidence = { ...extraction.confidence, cep: "baixa" };
              } else {
                // CEP is valid and matches - fill in missing address info
                if (!extraction.service_neighborhood && validateData.bairro) {
                  extraction.service_neighborhood = validateData.bairro;
                }
                if (!extraction.service_state && validateData.uf) {
                  extraction.service_state = validateData.uf;
                }
              }
            } else {
              // CEP doesn't exist
              extraction.service_zip_code = "";
              extraction.confidence = { ...extraction.confidence, cep: "baixa" };
            }
          }
        }
      } catch (valErr) {
        console.warn("CEP validation failed:", valErr);
      }
    }

    // Include matched catalog service data
    let matchedCatalogService = null;
    if (extraction.catalog_service_id) {
      matchedCatalogService = catalog.find((s: any) => s.id === extraction.catalog_service_id) || null;
    }

    return new Response(JSON.stringify({ extraction, clientInfo, matchedCatalogService }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-conversation error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
