import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDemoMode } from "@/hooks/useDemoMode";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function MoneyOnTable() {
  const navigate = useNavigate();
  const { organizationId } = useAuth();
  const { isDemoMode } = useDemoMode();

  const { data } = useQuery({
    queryKey: ["money-on-table", organizationId, isDemoMode],
    queryFn: async () => {
      if (!organizationId) return null;

      // Services completed but not fully paid
      // A service is "unpaid" if completed but has no confirmed payments >= value
      let q = supabase
        .from("services")
        .select("id, value, completed_date, client:clients(name)")
        .eq("organization_id", organizationId)
        .eq("status", "completed")
        .is("deleted_at", null)
        .neq("document_type", "quote")
        .gt("value", 0)
        .order("completed_date", { ascending: false })
        .limit(500);

      if (!isDemoMode) q = q.eq("is_demo_data", false);

      const { data: completedServices } = await q;
      if (!completedServices || completedServices.length === 0) return null;

      const serviceIds = completedServices.map((s) => s.id);

      // Get confirmed payments for these services
      const { data: payments } = await supabase
        .from("service_payments")
        .select("service_id, amount, is_confirmed")
        .in("service_id", serviceIds)
        .eq("is_confirmed", true);

      // Get fee expenses (taxa_pagamento) for these services — they cover the gap between gross and net
      const { data: feeTransactions } = await supabase
        .from("transactions")
        .select("service_id, amount")
        .in("service_id", serviceIds)
        .eq("type", "expense" as any)
        .eq("category", "taxa_pagamento")
        .eq("status", "paid");

      // Sum payments + fees per service (both represent covered value)
      const paidMap = new Map<string, number>();
      (payments || []).forEach((p) => {
        paidMap.set(p.service_id, (paidMap.get(p.service_id) || 0) + Number(p.amount));
      });
      (feeTransactions || []).forEach((f) => {
        if (f.service_id) {
          paidMap.set(f.service_id, (paidMap.get(f.service_id) || 0) + Number(f.amount));
        }
      });

      // Find unpaid/partially paid services
      const unpaid = completedServices
        .filter((s) => {
          const paid = paidMap.get(s.id) || 0;
          return paid < (Number(s.value) || 0) * 0.99; // 1% tolerance for rounding
        })
        .map((s) => ({
          ...s,
          paid: paidMap.get(s.id) || 0,
          remaining: (Number(s.value) || 0) - (paidMap.get(s.id) || 0),
        }));

      const totalRemaining = unpaid.reduce((sum, s) => sum + s.remaining, 0);

      return { count: unpaid.length, totalRemaining };
    },
    enabled: !!organizationId,
    staleTime: 120_000,
  });

  if (!data || data.count === 0 || data.totalRemaining <= 0) return null;

  return (
    <button
      onClick={() => navigate("/contas-receber")}
      className="w-full rounded-xl border border-warning/30 bg-warning/5 p-4 flex items-center gap-4 text-left transition-all hover:bg-warning/10 hover:border-warning/50 active:scale-[0.99] group animate-fade-in"
    >
      <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
        <AlertTriangle className="h-5 w-5 text-warning" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground">
          💰 {formatCurrency(data.totalRemaining)} para cobrar
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {data.count} serviço{data.count !== 1 ? "s" : ""} concluído{data.count !== 1 ? "s" : ""} aguardando pagamento
        </p>
      </div>
      <ArrowRight className="h-4 w-4 text-warning group-hover:translate-x-1 transition-transform shrink-0" />
    </button>
  );
}
