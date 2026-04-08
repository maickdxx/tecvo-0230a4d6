/**
 * Laura Tools — tool definitions (ADMIN_TOOLS array).
 * Extracted from lauraPrompt.ts for maintainability.
 * 
 * Adding a new tool:
 * 1. Add definition here
 * 2. Add executor in lauraToolExecutor.ts
 * 3. Add risk level in actionShield.ts ACTION_RISK_REGISTRY
 * 4. Add prompt instructions in lauraPrompt.ts buildToolsInstruction()
 */

export const ADMIN_TOOLS = [
  {
    type: "function",
    function: {
      name: "register_transaction",
      description: "Registra uma transação financeira (receita ou despesa) no sistema.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["income", "expense"], description: "Tipo: income (receita) ou expense (despesa)" },
          amount: { type: "number", description: "Valor em reais (positivo)" },
          description: { type: "string", description: "Descrição da transação" },
          category: { type: "string", description: "Categoria: material, combustível, alimentação, aluguel, fornecedor, serviço, outro" },
          date: { type: "string", description: "Data no formato YYYY-MM-DD." },
          payment_method: { type: "string", enum: ["pix", "dinheiro", "cartao_credito", "cartao_debito", "boleto", "transferencia", "outro"], description: "Forma de pagamento" },
          account_id: { type: "string", description: "UUID da conta financeira a ser usada. Obrigatório quando há múltiplas contas. Se a organização tem apenas 1 conta, pode omitir." },
        },
        required: ["type", "amount", "description", "category", "date"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_service",
      description: "Cria uma Ordem de Serviço (OS) no sistema. Tenta vincular automaticamente ao catálogo de serviços para usar preço e descrição padronizados.",
      parameters: {
        type: "object",
        properties: {
          client_name: { type: "string", description: "Nome do cliente (busca parcial no cadastro)" },
          scheduled_date: { type: "string", description: "Data e hora no formato YYYY-MM-DDTHH:MM:SS." },
          service_type: { type: "string", description: "Tipo de serviço: instalacao, manutencao, limpeza, reparo, visita_tecnica, outro" },
          description: { type: "string", description: "Descrição do serviço a ser realizado" },
          value: { type: "number", description: "Valor do serviço em reais. Se não informado, será preenchido pelo catálogo automaticamente." },
          assigned_to_name: { type: "string", description: "Nome do técnico responsável (busca parcial). Opcional." },
          catalog_service_name: { type: "string", description: "Nome do item do catálogo a vincular (ex: 'Limpeza de Ar Condicionado 12.000 BTUs'). Busca parcial. Se informado, usa preço e descrição do catálogo." },
        },
        required: ["client_name", "scheduled_date", "service_type", "description"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_financial_account",
      description: "Cria uma nova conta financeira e define como conta padrão da IA.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nome da conta (ex: Itaú, Nubank, Bradesco)" },
          account_type: { type: "string", enum: ["checking", "savings", "cash", "digital"], description: "Tipo de conta" },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_default_account",
      description: "Define uma conta financeira existente como conta padrão da IA para registros financeiros.",
      parameters: {
        type: "object",
        properties: {
          account_id: { type: "string", description: "ID da conta financeira a ser definida como padrão" },
          account_name: { type: "string", description: "Nome da conta escolhida (para confirmação)" },
        },
        required: ["account_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_quote",
      description: "Cria um Orçamento no sistema.",
      parameters: {
        type: "object",
        properties: {
          client_name: { type: "string", description: "Nome do cliente (busca parcial no cadastro)" },
          service_type: { type: "string", description: "Tipo de serviço" },
          description: { type: "string", description: "Descrição detalhada do serviço/orçamento" },
          value: { type: "number", description: "Valor estimado do orçamento em reais" },
          scheduled_date: { type: "string", description: "Data prevista no formato YYYY-MM-DDTHH:MM:SS. Opcional." },
        },
        required: ["client_name", "service_type", "description", "value"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_client",
      description: "Cadastra um novo cliente no sistema.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nome completo do cliente" },
          phone: { type: "string", description: "Telefone do cliente (com DDD)" },
          email: { type: "string", description: "Email do cliente. Opcional." },
          address: { type: "string", description: "Endereço do cliente. Opcional." },
        },
        required: ["name", "phone"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_service_pdf",
      description:
        "Envia o PDF oficial de uma OS ou Orçamento via WhatsApp. Use target='self' para enviar ao próprio usuário (sem confirmação). Use target='client' para enviar ao cliente (exige confirmed=true).",
      parameters: {
        type: "object",
        properties: {
          service_id: {
            type: "string",
            description:
              "UUID COMPLETO do serviço. Use SEMPRE que tiver o ID (ex: após create_service). Tem prioridade absoluta sobre service_identifier.",
          },
          service_identifier: {
            type: "string",
            description:
              "Fallback: número da OS (ex: '0042') ou nome do cliente. Só use quando NÃO tiver o service_id UUID.",
          },
          target: {
            type: "string",
            enum: ["self", "client"],
            description:
              "Destino do envio. 'self'=envia para o próprio usuário que pediu (sem confirmação). 'client'=envia para o cliente da OS (exige confirmação). Default: 'client'.",
          },
          confirmed: {
            type: "boolean",
            description:
              "Só obrigatório quando target='client'. Indica que o usuário CONFIRMOU explicitamente o envio para o cliente.",
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "approve_pending_transactions",
      description: "Aprova transações financeiras pendentes, consolidando no saldo real. Apenas gestores podem usar. PRIMEIRA chamada (sem confirmed): retorna resumo e pede confirmação. SEGUNDA chamada (com confirmed=true): executa a aprovação.",
      parameters: {
        type: "object",
        properties: {
          scope: { type: "string", enum: ["all_today", "all_pending", "by_type"], description: "Escopo: all_today (tudo de hoje), all_pending (todas pendentes), by_type (por tipo)" },
          type_filter: { type: "string", enum: ["income", "expense"], description: "Filtro por tipo, usado quando scope=by_type" },
          confirmed: { type: "boolean", description: "true SOMENTE após o usuário responder CONFIRMAR. Não use na primeira chamada." },
        },
        required: ["scope"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reject_pending_transactions",
      description: "Reprova transações financeiras pendentes. Não impacta o saldo. PRIMEIRA chamada (sem confirmed): retorna resumo e pede confirmação. SEGUNDA chamada (com confirmed=true): executa a reprovação.",
      parameters: {
        type: "object",
        properties: {
          transaction_ids: { type: "array", items: { type: "string" }, description: "IDs das transações para reprovar" },
          reason: { type: "string", description: "Motivo da reprovação" },
          confirmed: { type: "boolean", description: "true SOMENTE após o usuário responder CONFIRMAR. Não use na primeira chamada." },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_pending_summary",
      description: "Retorna resumo das transações pendentes de aprovação financeira.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Data no formato YYYY-MM-DD. Se não informada, mostra todas as pendentes." },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_pending_transactions",
      description: "Lista detalhadamente as transações pendentes de aprovação financeira, item por item. Use quando o gestor pedir para ver, listar ou detalhar as pendências.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Data no formato YYYY-MM-DD para filtrar pendências de um dia específico." },
          type_filter: { type: "string", enum: ["income", "expense"], description: "Filtrar apenas receitas ou despesas." },
          limit: { type: "number", description: "Quantidade máxima de itens a retornar. Padrão: 20." },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  // ─── NEW TOOLS: CRUD expansion ───
  {
    type: "function",
    function: {
      name: "edit_service",
      description: "Edita uma Ordem de Serviço existente. Pode alterar data, horário, valor, tipo, técnico ou descrição.",
      parameters: {
        type: "object",
        properties: {
          service_id: { type: "string", description: "UUID do serviço a editar." },
          scheduled_date: { type: "string", description: "Nova data/hora no formato YYYY-MM-DDTHH:MM:SS. Opcional." },
          value: { type: "number", description: "Novo valor em reais. Opcional." },
          service_type: { type: "string", description: "Novo tipo de serviço. Opcional." },
          description: { type: "string", description: "Nova descrição. Opcional." },
          assigned_to_name: { type: "string", description: "Nome do novo técnico responsável. Opcional." },
          status: { type: "string", enum: ["scheduled", "in_progress", "completed"], description: "Novo status. Opcional." },
        },
        required: ["service_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_service",
      description: "Cancela uma Ordem de Serviço existente. Pede confirmação antes de executar.",
      parameters: {
        type: "object",
        properties: {
          service_id: { type: "string", description: "UUID do serviço a cancelar." },
          reason: { type: "string", description: "Motivo do cancelamento. Opcional." },
          confirmed: { type: "boolean", description: "true SOMENTE após o usuário confirmar. Não use na primeira chamada." },
        },
        required: ["service_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_client",
      description: "Atualiza dados de um cliente existente (telefone, email, endereço, nome).",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string", description: "UUID do cliente a atualizar." },
          client_name: { type: "string", description: "Nome do cliente para busca, se não tiver o UUID." },
          name: { type: "string", description: "Novo nome do cliente. Opcional." },
          phone: { type: "string", description: "Novo telefone. Opcional." },
          email: { type: "string", description: "Novo email. Opcional." },
          address: { type: "string", description: "Novo endereço. Opcional." },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_services",
      description: "Busca serviços por cliente, data, status ou tipo. Use para consultas específicas sem depender do contexto pré-carregado.",
      parameters: {
        type: "object",
        properties: {
          client_name: { type: "string", description: "Nome do cliente para filtrar. Opcional." },
          date_from: { type: "string", description: "Data início no formato YYYY-MM-DD. Opcional." },
          date_to: { type: "string", description: "Data fim no formato YYYY-MM-DD. Opcional." },
          status: { type: "string", enum: ["scheduled", "in_progress", "completed", "cancelled"], description: "Filtrar por status. Opcional." },
          service_type: { type: "string", description: "Filtrar por tipo de serviço. Opcional." },
          limit: { type: "number", description: "Quantidade máxima. Padrão: 20." },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_clients",
      description: "Busca clientes por nome, telefone ou email. Retorna dados completos do cliente incluindo endereço.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Termo de busca: nome, telefone ou email do cliente." },
          limit: { type: "number", description: "Quantidade máxima. Padrão: 10." },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_service_equipment",
      description: "Retorna os equipamentos vinculados a um serviço específico, incluindo dados técnicos e checklist de cada equipamento.",
      parameters: {
        type: "object",
        properties: {
          service_id: { type: "string", description: "UUID do serviço." },
        },
        required: ["service_id"],
        additionalProperties: false,
      },
    },
  },
];
