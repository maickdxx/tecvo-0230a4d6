import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useDemoMode } from "./useDemoMode";
import { useRecurrence } from "./useRecurrence";

export type HealthLevel = "inicio" | "evoluindo" | "saudavel";

export interface PillarScore {
  name: string;
  score: number;
  maxScore: number;
  color: string;
}

export interface ChecklistItem {
  label: string;
  completed: boolean;
}

export interface ChecklistPhase {
  phase: string;
  items: ChecklistItem[];
}

export interface CompanyHealthData {
  score: number;
  level: HealthLevel;
  pillarScores: PillarScore[];
  suggestions: string[];
  checklist: ChecklistPhase[];
  checklistProgress: number;
  allChecklistDone: boolean;
  isLoading: boolean;
}

/**
 * useCompanyHealth — Uses a single database RPC to get all health indicators
 * instead of loading all services, clients, and transactions into the frontend.
 */
export function useCompanyHealth(): CompanyHealthData {
  const { organizationId } = useAuth();
  const { isDemoMode } = useDemoMode();
  const { data: recurrenceClients, isLoading: loadingRecurrence } = useRecurrence();

  const { data: indicators, isLoading: loadingIndicators } = useQuery({
    queryKey: ["company-health-indicators", organizationId, isDemoMode],
    queryFn: async () => {
      if (!organizationId) return null;

      const { data, error } = await supabase.rpc("get_company_health_indicators", {
        _org_id: organizationId,
        _is_demo: isDemoMode,
      });

      if (error) throw error;
      return data as Record<string, unknown>;
    },
    enabled: !!organizationId,
    staleTime: 60_000,
  });

  const isLoading = loadingIndicators || loadingRecurrence;

  return useMemo(() => {
    if (isLoading || !indicators) {
      return {
        score: 0,
        level: "inicio" as HealthLevel,
        pillarScores: [],
        suggestions: [],
        checklist: [],
        checklistProgress: 0,
        allChecklistDone: false,
        isLoading: true,
      };
    }

    const hasScheduled = Boolean(indicators.has_scheduled);
    const recentlyCompleted = Boolean(indicators.has_recently_completed);
    const hasConfirmedIncome = Boolean(indicators.has_confirmed_income);
    const hasOverdue = Boolean(indicators.has_overdue);
    const clientCount = Number(indicators.client_count) || 0;
    const serviceCount = Number(indicators.service_count) || 0;
    const completedCount = Number(indicators.completed_count) || 0;
    const teamCount = Number(indicators.team_count) || 0;
    const hasRecentServices = Boolean(indicators.has_recent_services);
    const hasRecentTransactions = Boolean(indicators.has_recent_transactions);
    const totalAccountBalance = Number(indicators.total_account_balance) || 0;
    const pendingExpenses = Number(indicators.pending_expenses) || 0;
    const scheduledWithoutValue = Boolean(indicators.has_scheduled_without_value);
    const hasEligible = Boolean(indicators.has_eligible_recurrence);
    const hasActiveAccounts = Boolean(indicators.has_active_accounts);

    const recData = recurrenceClients;
    const hasActiveRecurrence = recData && 'clients' in recData ? recData.clients.length > 0 : Array.isArray(recData) ? recData.length > 0 : false;

    // ---- PILLAR: Operação (30%) ----
    const operationScore = (hasScheduled ? 15 : 0) + (recentlyCompleted ? 15 : 0);

    // ---- PILLAR: Financeiro (25%) ----
    const financeScore = (hasConfirmedIncome ? 15 : 0) + (!hasOverdue ? 10 : 0);

    // ---- PILLAR: Estrutura (15%) ----
    const enoughClients = clientCount >= 3;
    const enoughServices = serviceCount >= 3;
    const teamConfigured = teamCount >= 2;
    const structureScore =
      (enoughClients ? 5 : 0) + (enoughServices ? 5 : 0) + (teamConfigured ? 5 : 0);

    // ---- PILLAR: Recorrência (15%) ----
    const recurrenceScore = (hasActiveRecurrence ? 10 : 0) + (hasEligible ? 5 : 0);

    // ---- PILLAR: Uso da plataforma (15%) ----
    const usageScore = (hasRecentServices ? 8 : 0) + (hasRecentTransactions ? 7 : 0);

    const score = operationScore + financeScore + structureScore + recurrenceScore + usageScore;

    const level: HealthLevel =
      score <= 40 ? "inicio" : score <= 70 ? "evoluindo" : "saudavel";

    const pillarScores: PillarScore[] = [
      { name: "Operação", score: operationScore, maxScore: 30, color: "hsl(var(--success))" },
      { name: "Financeiro", score: financeScore, maxScore: 25, color: "hsl(var(--warning, 45 93% 47%))" },
      { name: "Estrutura", score: structureScore, maxScore: 15, color: "hsl(var(--primary))" },
      { name: "Recorrência", score: recurrenceScore, maxScore: 15, color: "hsl(280 60% 55%)" },
      { name: "Uso", score: usageScore, maxScore: 15, color: "hsl(var(--accent-foreground))" },
    ];

    // Suggestions
    const suggestions: string[] = [];
    if (hasOverdue) suggestions.push("Regularize pagamentos vencidos");
    if (pendingExpenses > 0 && totalAccountBalance < pendingExpenses)
      suggestions.push("Você possui pouco caixa disponível para os próximos dias");
    if (!hasConfirmedIncome) suggestions.push("Confirme recebimentos pendentes");
    if (scheduledWithoutValue) suggestions.push("Confirme serviços agendados para aumentar o faturamento");
    if (!hasActiveRecurrence) suggestions.push("Ative recorrência para gerar receita previsível");
    if (operationScore < 15) suggestions.push("Conclua serviços para melhorar sua operação");
    if (!hasScheduled) suggestions.push("Crie agendamentos para organizar sua rotina");
    if (!enoughClients) suggestions.push("Cadastre mais clientes");
    if (!teamConfigured) suggestions.push("Configure sua equipe");
    if (!hasRecentServices) suggestions.push("Crie serviços para manter a plataforma ativa");

    // ---- CHECKLIST ----
    const checklist: ChecklistPhase[] = [
      {
        phase: "Início",
        items: [
          { label: "Primeiro cliente cadastrado", completed: clientCount >= 1 },
          { label: "Primeiro serviço criado", completed: serviceCount >= 1 },
          { label: "Primeiro agendamento criado", completed: hasScheduled },
        ],
      },
      {
        phase: "Operação",
        items: [
          { label: "Primeiro serviço concluído", completed: completedCount >= 1 },
          { label: "Primeiro recebimento confirmado", completed: hasConfirmedIncome },
          { label: "Conta financeira ativa", completed: hasActiveAccounts },
        ],
      },
      {
        phase: "Crescimento",
        items: [
          { label: "Primeira recorrência criada", completed: hasActiveRecurrence },
          { label: "5 serviços concluídos", completed: completedCount >= 5 },
          { label: "Uso contínuo da plataforma", completed: hasRecentServices },
        ],
      },
    ];

    const checklistProgress = checklist.reduce(
      (acc, phase) => acc + phase.items.filter((i) => i.completed).length,
      0
    );

    return {
      score,
      level,
      pillarScores,
      suggestions: suggestions.slice(0, 3),
      checklist,
      checklistProgress,
      allChecklistDone: checklistProgress === 9,
      isLoading: false,
    };
  }, [isLoading, indicators, recurrenceClients]);
}
