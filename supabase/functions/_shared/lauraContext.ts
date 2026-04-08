/**
 * Laura Context — data fetching and org context builder.
 * Extracted from lauraPrompt.ts for maintainability.
 */

import {
  getCurrentMonthInTz,
  getFormattedDateTimeInTz,
  getTodayInTz,
  getTomorrowInTz,
  formatTimeInTz,
  getDatePartInTz,
} from "./timezone.ts";

// ─────────────────── helpers ───────────────────

export function formatBRL(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─────────────────── OAL: contact decisions summary ───────────────────

export function buildContactDecisionsSummary(decisions: any[]): string {
  if (!decisions || decisions.length === 0) {
    return "Nenhum dado de contato disponível — todos os clientes estão elegíveis por padrão.";
  }

  const blocked = decisions.filter((d: any) => d.contact_status !== "eligible_for_contact");
  const eligible = decisions.filter((d: any) => d.contact_status === "eligible_for_contact");

  const lines: string[] = [];

  if (blocked.length > 0) {
    lines.push(`⛔ BLOQUEADOS (${blocked.length}):`);
    for (const d of blocked.slice(0, 20)) {
      const reason = d.block_reason === "recurrence_active" ? "recorrência ativa"
        : d.block_reason === "recent_contact" ? "contato recente"
        : d.block_reason === "cooldown_period" ? `cooldown até ${d.next_allowed_date}`
        : d.block_reason || "bloqueado";
      lines.push(`  • ${d.client_name}: ${d.contact_status} (${reason})`);
    }
    if (blocked.length > 20) lines.push(`  ... e mais ${blocked.length - 20} clientes bloqueados`);
  }

  lines.push(`✅ ELEGÍVEIS para contato: ${eligible.length} clientes`);

  return lines.join("\n");
}

// ─────────────────── context fetcher ───────────────────

export async function fetchOrgContext(supabase: any, organizationId: string) {
  const now = new Date();
  const oneEightyDaysAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString();

  const SERVICE_LIMIT = 2000;
  const CLIENT_LIMIT = 1000;
  const TRANSACTION_LIMIT = 2000;

  const [servicesRes, clientsRes, transactionsRes, profilesRes, orgRes, catalogRes,
         servicesTotalRes, clientsTotalRes, transactionsTotalRes,
         financialAccountsRes, contactDecisionsRes] = await Promise.all([
    supabase
      .from("services")
      .select("id, status, scheduled_date, completed_date, value, description, service_type, assigned_to, client_id, created_at, payment_method, document_type, operational_status")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .neq("status", "cancelled")
      .gte("scheduled_date", oneEightyDaysAgo)
      .order("scheduled_date", { ascending: false })
      .limit(SERVICE_LIMIT),
    supabase
      .from("clients")
      .select("id, name, phone, email, created_at")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .limit(CLIENT_LIMIT),
    supabase
      .from("transactions")
      .select("id, type, amount, date, due_date, status, category, description, payment_date, payment_method")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .gte("date", oneEightyDaysAgo)
      .order("date", { ascending: false })
      .limit(TRANSACTION_LIMIT),
    supabase
      .from("profiles")
      .select("user_id, full_name, position")
      .eq("organization_id", organizationId)
      .limit(50),
    supabase
      .from("organizations")
      .select("name, monthly_goal, timezone, default_ai_account_id")
      .eq("id", organizationId)
      .single(),
    supabase
      .from("catalog_services")
      .select("name, unit_price, service_type, description")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .limit(50),
    supabase
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .neq("status", "cancelled"),
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("deleted_at", null),
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("deleted_at", null),
    supabase
      .from("financial_accounts")
      .select("id, name, account_type, balance, is_active")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("name"),
    supabase.rpc("get_client_contact_decisions", { _org_id: organizationId }),
  ]);

  const services = servicesRes.data || [];
  const clients = clientsRes.data || [];
  const transactions = transactionsRes.data || [];

  const totalServicesAllTime = servicesTotalRes.count ?? services.length;
  const totalClientsAllTime = clientsTotalRes.count ?? clients.length;
  const totalTransactionsAllTime = transactionsTotalRes.count ?? transactions.length;

  const financialAccounts = financialAccountsRes.data || [];
  const contactDecisions = contactDecisionsRes.data || [];
  const defaultAiAccountId = orgRes.data?.default_ai_account_id || null;
  const defaultAccount = defaultAiAccountId
    ? financialAccounts.find((a: any) => a.id === defaultAiAccountId) || null
    : null;

  return {
    services,
    clients,
    transactions,
    profiles: profilesRes.data || [],
    orgName: orgRes.data?.name || "Empresa",
    monthlyGoal: orgRes.data?.monthly_goal || null,
    catalog: catalogRes.data || [],
    timezone: orgRes.data?.timezone || "America/Sao_Paulo",
    financialAccounts,
    defaultAiAccountId,
    defaultAccount,
    contactDecisions,
    _meta: {
      servicePeriodDays: 180,
      serviceLimit: SERVICE_LIMIT,
      serviceLoadedCount: services.length,
      serviceTotalAllTime: totalServicesAllTime,
      servicesTruncated: services.length >= SERVICE_LIMIT,
      clientLimit: CLIENT_LIMIT,
      clientLoadedCount: clients.length,
      clientTotalAllTime: totalClientsAllTime,
      clientsTruncated: clients.length >= CLIENT_LIMIT,
      transactionPeriodDays: 180,
      transactionLimit: TRANSACTION_LIMIT,
      transactionLoadedCount: transactions.length,
      transactionTotalAllTime: totalTransactionsAllTime,
      transactionsTruncated: transactions.length >= TRANSACTION_LIMIT,
      financialAccountsCount: financialAccounts.length,
      hasDefaultAccount: !!defaultAccount,
    },
  };
}
