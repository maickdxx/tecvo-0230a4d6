import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useDemoMode } from "./useDemoMode";

export interface FeeByMethod {
  payment_method: string;
  count: number;
  gross_total: number;
  net_total: number;
  fee_total: number;
  fee_percentage: number;
}

export interface FeeAnalyticsSummary {
  total_gross: number;
  total_net: number;
  total_fees: number;
  avg_fee_pct: number;
  by_method: FeeByMethod[];
}

export function usePaymentFeeAnalytics(startDate: string, endDate: string) {
  const { organizationId } = useAuth();
  const { isDemoMode } = useDemoMode();

  return useQuery({
    queryKey: ["payment-fee-analytics", organizationId, startDate, endDate, isDemoMode],
    queryFn: async (): Promise<FeeAnalyticsSummary> => {
      if (!organizationId) {
        return { total_gross: 0, total_net: 0, total_fees: 0, avg_fee_pct: 0, by_method: [] };
      }

      // Fetch completed services with value in the period
      const { data: services, error: sErr } = await supabase
        .from("services")
        .select("id, value, is_demo_data")
        .eq("organization_id", organizationId)
        .eq("status", "completed" as any)
        .is("deleted_at", null)
        .gte("completed_date", startDate)
        .lte("completed_date", endDate + "T23:59:59");

      if (sErr) throw sErr;

      const filtered = isDemoMode
        ? (services ?? [])
        : (services ?? []).filter((s) => !s.is_demo_data);

      const withValue = filtered.filter((s) => s.value && s.value > 0);
      if (withValue.length === 0) {
        return { total_gross: 0, total_net: 0, total_fees: 0, avg_fee_pct: 0, by_method: [] };
      }

      const serviceIds = withValue.map((s) => s.id);
      const serviceValueMap = new Map(withValue.map((s) => [s.id, s.value ?? 0]));

      // Fetch service_payments for these services
      const { data: payments, error: pErr } = await supabase
        .from("service_payments")
        .select("service_id, payment_method, amount")
        .in("service_id", serviceIds);

      if (pErr) throw pErr;

      // Group payments by service
      const paymentsByService = new Map<string, Array<{ payment_method: string; amount: number }>>();
      for (const p of payments ?? []) {
        const arr = paymentsByService.get(p.service_id) || [];
        arr.push({ payment_method: p.payment_method, amount: p.amount });
        paymentsByService.set(p.service_id, arr);
      }

      // For each service, calculate fee as gross - net per payment method
      // When there's a single payment, fee = service.value - payment.amount
      // When split, distribute gross proportionally
      const methodStats = new Map<string, { count: number; gross: number; net: number }>();

      for (const svc of withValue) {
        const svcPayments = paymentsByService.get(svc.id);
        if (!svcPayments || svcPayments.length === 0) continue;

        const grossValue = svc.value ?? 0;
        const netSum = svcPayments.reduce((s, p) => s + p.amount, 0);

        if (svcPayments.length === 1) {
          // Simple case: one payment
          const pm = svcPayments[0].payment_method || "sem_forma";
          const existing = methodStats.get(pm) || { count: 0, gross: 0, net: 0 };
          existing.count += 1;
          existing.gross += grossValue;
          existing.net += netSum;
          methodStats.set(pm, existing);
        } else {
          // Split payment: distribute gross proportionally to each payment's net share
          for (const p of svcPayments) {
            const pm = p.payment_method || "sem_forma";
            const share = netSum > 0 ? p.amount / netSum : 1 / svcPayments.length;
            const grossPortion = grossValue * share;

            const existing = methodStats.get(pm) || { count: 0, gross: 0, net: 0 };
            existing.count += 1;
            existing.gross += grossPortion;
            existing.net += p.amount;
            methodStats.set(pm, existing);
          }
        }
      }

      let totalGross = 0;
      let totalNet = 0;
      const byMethod: FeeByMethod[] = [];

      for (const [method, stats] of methodStats.entries()) {
        const feeTot = stats.gross - stats.net;
        const feePct = stats.gross > 0 ? (feeTot / stats.gross) * 100 : 0;
        totalGross += stats.gross;
        totalNet += stats.net;

        byMethod.push({
          payment_method: method,
          count: stats.count,
          gross_total: stats.gross,
          net_total: stats.net,
          fee_total: feeTot,
          fee_percentage: feePct,
        });
      }

      byMethod.sort((a, b) => b.fee_total - a.fee_total);

      const totalFees = totalGross - totalNet;
      const avgFeePct = totalGross > 0 ? (totalFees / totalGross) * 100 : 0;

      return {
        total_gross: totalGross,
        total_net: totalNet,
        total_fees: totalFees,
        avg_fee_pct: avgFeePct,
        by_method: byMethod,
      };
    },
    enabled: !!organizationId,
    staleTime: 1000 * 60 * 5,
  });
}
