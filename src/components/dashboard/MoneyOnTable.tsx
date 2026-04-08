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

      // Source of truth: open receivable transactions linked to completed services.
      // If the receivable is already paid (or no longer exists), the widget must not appear.
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

      const { data: openReceivables, error: openReceivablesError } = await supabase
        .from("transactions")
        .select("service_id, amount, status, approval_status")
        .eq("organization_id", organizationId)
        .eq("type", "income")
        .in("service_id", serviceIds)
        .in("status", ["pending", "overdue"])
        .is("deleted_at", null)
        .or("approval_status.is.null,approval_status.eq.approved");

      if (openReceivablesError) throw openReceivablesError;

      const openReceivableMap = new Map<string, number>();
      (openReceivables || []).forEach((transaction) => {
        if (!transaction.service_id) return;
        openReceivableMap.set(
          transaction.service_id,
          (openReceivableMap.get(transaction.service_id) || 0) + Number(transaction.amount)
        );
      });

      const unpaid = completedServices
        .filter((service) => (openReceivableMap.get(service.id) || 0) > 0)
        .map((service) => ({
          ...service,
          remaining: openReceivableMap.get(service.id) || 0,
        }));

      const totalRemaining = unpaid.reduce((sum, s) => sum + s.remaining, 0);

      return { count: unpaid.length, totalRemaining };
    },
    enabled: !!organizationId,
    staleTime: 120_000,
    refetchOnMount: "always",
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
