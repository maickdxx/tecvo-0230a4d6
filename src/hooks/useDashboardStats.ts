import { useMemo } from "react";
import { format, isSameDay, isSameMonth, isSameWeek, subDays, eachDayOfInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTransactions } from "./useTransactions";
import { useServices, SERVICE_TYPE_LABELS, SERVICE_STATUS_LABELS } from "./useServices";
import { useDashboardServices } from "./useDashboardServices";
import { usePaymentMethods } from "./usePaymentMethods";
import { calcularMetricasCompletas } from "@/lib/metricsEngine";

// Re-export Granularity from PeriodoGlobal for backwards compatibility
import type { Granularity } from "@/lib/periodoGlobal";
export type { Granularity } from "@/lib/periodoGlobal";

export interface DashboardStats {
  income: number;
  expense: number;
  balance: number;
  incomeChange: number | null;
  expenseChange: number | null;
  balanceChange: number | null;
  totalServices: number;
  pendingServices: number;
  forecastedRevenue: number;
  averageTicket: number;
  completedServices: number;
  margin: number;
  marginChange: number | null;
  isLoading: boolean;
}

export interface MonthlyChartData {
  name: string;
  receitas: number;
  despesas: number;
}

export interface RecentServiceData {
  id: string;
  client: string;
  type: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  statusLabel: string;
  value: number;
  date: string;
}

/**
 * useDashboardStats — Hook central da Visão Geral.
 *
 * Delega TODOS os cálculos ao MetricsEngine.
 * Serviços são filtrados pelo CoreServiceEngine (via scheduled_date).
 * Períodos vêm do PeriodoGlobal (via Dashboard).
 *
 * O Dashboard apenas exibe o retorno — nenhum cálculo direto nos cards.
 */
export function useDashboardStats(startDate: string, endDate: string, prevStartDate: string, prevEndDate: string) {
  // Lightweight service query for dashboard metrics (no client join)
  const { data: services = [], isLoading: isLoadingServices } = useDashboardServices();

  // Despesas do período atual (por payment_date — data do pagamento efetivo)
  const { 
    transactions: currentExpenseTransactions, 
    isLoading: isLoadingCurrentExpenses,
  } = useTransactions({
    startDate,
    endDate,
    type: "expense",
    dateField: "payment_date",
  });

  // Despesas do período anterior (por payment_date)
  const { 
    transactions: previousExpenseTransactions, 
    isLoading: isLoadingPrevExpenses,
  } = useTransactions({
    startDate: prevStartDate,
    endDate: prevEndDate,
    type: "expense",
    dateField: "payment_date",
  });

  // Income transactions do período atual (por payment_date — data do pagamento efetivo)
  const { 
    transactions: currentIncomeTransactions, 
    isLoading: isLoadingCurrentIncome,
  } = useTransactions({
    startDate,
    endDate,
    type: "income",
    dateField: "payment_date",
  });

  // Income transactions do período anterior (por payment_date)
  const { 
    transactions: previousIncomeTransactions, 
    isLoading: isLoadingPrevIncome,
  } = useTransactions({
    startDate: prevStartDate,
    endDate: prevEndDate,
    type: "income",
    dateField: "payment_date",
  });

  const stats = useMemo((): DashboardStats => {
    // MetricsEngine: cálculo centralizado de todas as métricas
    const metricas = calcularMetricasCompletas(
      services,
      currentExpenseTransactions,
      previousExpenseTransactions,
      currentIncomeTransactions,
      previousIncomeTransactions,
      startDate,
      endDate,
      prevStartDate,
      prevEndDate,
    );

    // Mapear para a interface DashboardStats (compatibilidade com cards existentes)
    return {
      income: metricas.receita,
      expense: metricas.despesa,
      balance: metricas.lucroReal,
      incomeChange: metricas.receitaChange,
      expenseChange: metricas.despesaChange,
      balanceChange: metricas.lucroChange,
      totalServices: metricas.totalServicos,
      pendingServices: metricas.servicosPendentes,
      forecastedRevenue: metricas.receitaPrevista,
      averageTicket: metricas.ticketMedio,
      completedServices: metricas.servicosConcluidos,
      margin: metricas.margem,
      marginChange: metricas.margemChange,
      isLoading: isLoadingServices || isLoadingCurrentExpenses || isLoadingPrevExpenses || isLoadingCurrentIncome || isLoadingPrevIncome,
    };
  }, [services, currentExpenseTransactions, previousExpenseTransactions, currentIncomeTransactions, previousIncomeTransactions, startDate, endDate, prevStartDate, prevEndDate, isLoadingServices, isLoadingCurrentExpenses, isLoadingPrevExpenses, isLoadingCurrentIncome, isLoadingPrevIncome]);

  return { ...stats, currentIncomeTransactions };
}

export function useCashFlowChartData(granularity: Granularity, startDate: string, endDate: string) {
  const { transactions, isLoading } = useTransactions({
    startDate,
    endDate,
    dateField: "payment_date",
  });

  const data = useMemo((): MonthlyChartData[] => {
    if (granularity === "month") {
      // For month view: group by month across the range (6 months)
      const start = new Date(startDate);
      const end = new Date(endDate);
      const months: Date[] = [];
      const current = new Date(start.getFullYear(), start.getMonth(), 1);
      while (current <= end) {
        months.push(new Date(current));
        current.setMonth(current.getMonth() + 1);
      }

      return months.map((month) => {
        const monthTransactions = transactions.filter((t) =>
          isSameMonth(new Date(t.payment_date || t.date), month)
        );

        const receitas = monthTransactions
          .filter((t) => t.type === "income" && t.status === "paid")
          .reduce((sum, t) => sum + Number(t.amount), 0);

        const despesas = monthTransactions
          .filter((t) => t.type === "expense" && t.status === "paid")
          .reduce((sum, t) => sum + Number(t.amount), 0);

        return {
          name: format(month, "MMM", { locale: ptBR }).replace(".", ""),
          receitas,
          despesas,
        };
      });
    }

    // For day and week: group by individual days
    const days = eachDayOfInterval({
      start: new Date(startDate),
      end: new Date(endDate),
    });

    return days.map((day) => {
      const dayTransactions = transactions.filter((t) =>
        isSameDay(new Date(t.payment_date || t.date), day)
      );

      const receitas = dayTransactions
        .filter((t) => t.type === "income" && t.status === "paid")
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const despesas = dayTransactions
        .filter((t) => t.type === "expense" && t.status === "paid")
        .reduce((sum, t) => sum + Number(t.amount), 0);

      return {
        name: granularity === "day"
          ? format(day, "dd/MM", { locale: ptBR })
          : format(day, "EEE", { locale: ptBR }),
        receitas,
        despesas,
      };
    });
  }, [transactions, granularity, startDate, endDate]);

  return { data, isLoading };
}

export function useRecentServices(limit: number = 5) {
  // Recent services need client name, so use the full query but limit to 5 rows
  const { organizationId } = useAuth();
  const { isDemoMode } = useDemoMode();

  const query = useQuery({
    queryKey: ["recent-services", organizationId, isDemoMode, limit],
    queryFn: async () => {
      if (!organizationId) return [];
      let qb = supabase
        .from("services")
        .select("id, status, value, scheduled_date, created_at, service_type, client:clients(name)")
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (!isDemoMode) qb = qb.eq("is_demo_data", false);
      const { data, error } = await qb;
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
    staleTime: 30_000,
  });

  const isLoading = query.isLoading;
  const services = query.data || [];

  const recentServices = useMemo((): RecentServiceData[] => {
    return services
      .slice(0, limit)
      .map((service) => {
        const scheduledDate = service.scheduled_date
          ? new Date(service.scheduled_date)
          : new Date(service.created_at);
        
        const now = new Date();
        const isToday = scheduledDate.toDateString() === now.toDateString();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const isTomorrow = scheduledDate.toDateString() === tomorrow.toDateString();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const isYesterday = scheduledDate.toDateString() === yesterday.toDateString();

        let dateStr: string;
        if (isToday) {
          dateStr = `Hoje, ${format(scheduledDate, "HH:mm")}`;
        } else if (isTomorrow) {
          dateStr = `Amanhã, ${format(scheduledDate, "HH:mm")}`;
        } else if (isYesterday) {
          dateStr = `Ontem, ${format(scheduledDate, "HH:mm")}`;
        } else {
          dateStr = format(scheduledDate, "dd/MM/yyyy");
        }

        return {
          id: service.id,
          client: service.client?.name || "Cliente não encontrado",
          type: SERVICE_TYPE_LABELS[service.service_type],
          status: service.status,
          statusLabel: SERVICE_STATUS_LABELS[service.status],
          value: service.value || 0,
          date: dateStr,
        };
      });
  }, [services, limit]);

  return { recentServices, isLoading };
}

// Payment method stats for dashboard chart
export interface PaymentMethodChartData {
  name: string;
  value: number;
  count: number;
}

export function usePaymentMethodStats(startDate: string, endDate: string) {
  const { transactions, isLoading: isLoadingTransactions } = useTransactions({
    startDate,
    endDate,
    type: "income",
    dateField: "payment_date",
  });

  const { paymentMethodLabels, isLoading: isLoadingMethods } = usePaymentMethods();

  const data = useMemo((): PaymentMethodChartData[] => {
    const paidTransactions = transactions.filter((t) => t.status === "paid");
    
    const grouped = paidTransactions.reduce((acc, t) => {
      const method = t.payment_method || "unknown";
      if (!acc[method]) {
        acc[method] = { value: 0, count: 0 };
      }
      acc[method].value += Number(t.amount);
      acc[method].count += 1;
      return acc;
    }, {} as Record<string, { value: number; count: number }>);

    return Object.entries(grouped)
      .map(([method, stats]) => ({
        name: method === "unknown" ? "Não definido" : (paymentMethodLabels[method] || method || "Não informado"),
        value: stats.value,
        count: stats.count,
      }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, paymentMethodLabels]);

  const total = data.reduce((sum, item) => sum + item.value, 0);

  return { data, total, isLoading: isLoadingTransactions || isLoadingMethods };
}
