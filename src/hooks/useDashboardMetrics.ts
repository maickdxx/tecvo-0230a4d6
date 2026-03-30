import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useDemoMode } from "./useDemoMode";
import { calcularVariacao } from "@/lib/metricsEngine";

export interface DashboardMetrics {
  // Core financials
  income: number;
  expense: number;
  balance: number;
  margin: number;
  pendingIncome: number;
  forecastedRevenue: number;
  averageTicket: number;

  // Variation vs previous period
  incomeChange: number | null;
  expenseChange: number | null;
  balanceChange: number | null;
  marginChange: number | null;

  // Service counts
  totalServices: number;
  completedServices: number;
  pendingServices: number;

  // Revenue Engine data
  revenueByType: Record<string, number>;
  countByType: Record<string, number>;

  // Efficiency data
  cancelledCount: number;
  avgExecDays: number;

  isLoading: boolean;
}

/**
 * useDashboardMetrics — Fetches ALL dashboard metrics via a single database RPC.
 * Replaces the old pattern of loading all services + transactions into the frontend.
 * Only aggregated values are returned — no raw rows transferred.
 */
export function useDashboardMetrics(
  startDate: string,
  endDate: string,
  prevStartDate: string,
  prevEndDate: string
): DashboardMetrics {
  const { organizationId } = useAuth();
  const { isDemoMode } = useDemoMode();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-metrics", organizationId, startDate, endDate, prevStartDate, prevEndDate, isDemoMode],
    queryFn: async () => {
      if (!organizationId) return null;

      const { data: result, error } = await supabase.rpc("get_dashboard_stats", {
        _org_id: organizationId,
        _start_date: startDate,
        _end_date: endDate,
        _prev_start_date: prevStartDate,
        _prev_end_date: prevEndDate,
        _is_demo: isDemoMode,
      });

      if (error) throw error;
      return result as Record<string, unknown>;
    },
    enabled: !!organizationId,
    staleTime: 30_000, // 30s — dashboard doesn't need real-time updates
  });

  if (!data || isLoading) {
    return {
      income: 0, expense: 0, balance: 0, margin: 0,
      pendingIncome: 0, forecastedRevenue: 0, averageTicket: 0,
      incomeChange: null, expenseChange: null, balanceChange: null, marginChange: null,
      totalServices: 0, completedServices: 0, pendingServices: 0,
      revenueByType: {}, countByType: {},
      cancelledCount: 0, avgExecDays: 0,
      isLoading,
    };
  }

  const income = Number(data.income) || 0;
  const pendingIncome = Number(data.pending_income) || 0;
  const expense = Number(data.expense) || 0;
  const balance = income - expense;
  const margin = income > 0 ? (balance / income) * 100 : 0;

  const prevIncome = Number(data.prev_income) || 0;
  const prevExpense = Number(data.prev_expense) || 0;
  const prevBalance = prevIncome - prevExpense;
  const prevMargin = prevIncome > 0 ? (prevBalance / prevIncome) * 100 : 0;

  const incomeServicePaidCount = Number(data.income_service_paid_count) || 0;
  const averageTicket = incomeServicePaidCount > 0 ? income / incomeServicePaidCount : 0;

  return {
    income,
    expense,
    balance,
    margin,
    pendingIncome,
    forecastedRevenue: Number(data.forecasted_revenue) || 0,
    averageTicket,

    incomeChange: calcularVariacao(income, prevIncome),
    expenseChange: calcularVariacao(expense, prevExpense),
    balanceChange: calcularVariacao(balance, prevBalance),
    marginChange: calcularVariacao(margin, prevMargin),

    totalServices: Number(data.total_services) || 0,
    completedServices: Number(data.completed_services) || 0,
    pendingServices: Number(data.pending_services) || 0,

    revenueByType: (data.revenue_by_type as Record<string, number>) || {},
    countByType: (data.count_by_type as Record<string, number>) || {},

    cancelledCount: Number(data.cancelled_count) || 0,
    avgExecDays: Number(data.avg_exec_days) || 0,

    isLoading: false,
  };
}
