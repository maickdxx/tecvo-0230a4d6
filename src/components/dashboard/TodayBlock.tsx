import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, DollarSign, Clock, CheckCircle2, Loader2 } from "lucide-react";
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

interface TodayBlockProps {
  startDate: string;
  endDate: string;
  periodLabel: string;
}

export function TodayBlock({ startDate, endDate, periodLabel }: TodayBlockProps) {
  const navigate = useNavigate();
  const { organizationId } = useAuth();
  const { isDemoMode } = useDemoMode();

  const { data, isLoading } = useQuery({
    queryKey: ["today-block", organizationId, startDate, endDate, isDemoMode],
    queryFn: async () => {
      if (!organizationId) return null;

      const dayStart = `${startDate}T00:00:00`;
      const dayEnd = `${endDate}T23:59:59`;

      // Services scheduled in period
      let servicesQuery = supabase
        .from("services")
        .select("id, value, status, scheduled_date, document_type")
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .neq("document_type", "quote")
        .neq("status", "cancelled")
        .gte("scheduled_date", dayStart)
        .lte("scheduled_date", dayEnd);

      if (!isDemoMode) {
        servicesQuery = servicesQuery.eq("is_demo_data", false);
      }

      const { data: services } = await servicesQuery;

      // Payments confirmed in period
      let paymentsQuery = supabase
        .from("service_payments")
        .select("amount, is_confirmed, created_at")
        .eq("organization_id", organizationId)
        .eq("is_confirmed", true)
        .gte("confirmed_at", dayStart)
        .lte("confirmed_at", dayEnd);

      const { data: payments } = await paymentsQuery;

      return { services: services || [], payments: payments || [] };
    },
    enabled: !!organizationId,
    staleTime: 30_000,
  });

  const metrics = useMemo(() => {
    if (!data) return { count: 0, predicted: 0, realized: 0, pending: 0, inProgress: 0 };

    const { services, payments } = data;
    const count = services.length;
    const predicted = services
      .filter((s) => s.status === "scheduled" || s.status === "in_progress")
      .reduce((sum, s) => sum + (Number(s.value) || 0), 0);
    const realized = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const pending = services.filter((s) => s.status === "scheduled").length;
    const inProgress = services.filter((s) => s.status === "in_progress").length;

    return { count, predicted, realized, pending, inProgress };
  }, [data]);

  if (isLoading) {
    return (
      <div className="mb-5 rounded-xl border border-border bg-card p-5 flex items-center justify-center h-24">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const items = [
    {
      icon: CalendarDays,
      label: "Serviços",
      value: String(metrics.count),
      color: "text-primary",
      bg: "bg-primary/10",
      onClick: () => navigate("/agenda"),
    },
    {
      icon: DollarSign,
      label: "Previsto",
      value: formatCurrency(metrics.predicted),
      color: "text-info",
      bg: "bg-info/10",
      onClick: () => navigate("/agenda"),
    },
    {
      icon: CheckCircle2,
      label: "Realizado",
      value: formatCurrency(metrics.realized),
      color: "text-success",
      bg: "bg-success/10",
      onClick: () => navigate("/financeiro"),
    },
    {
      icon: Clock,
      label: "Pendentes",
      value: String(metrics.pending),
      color: "text-warning",
      bg: "bg-warning/10",
      onClick: () => navigate("/ordens-servico?status=scheduled"),
    },
    {
      icon: Loader2,
      label: "Em andamento",
      value: String(metrics.inProgress),
      color: "text-primary",
      bg: "bg-primary/10",
      onClick: () => navigate("/ordens-servico?status=in_progress"),
    },
  ];

  return (
    <div className="mb-5 animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {periodLabel}
        </h2>
        <div className="flex-1 h-px bg-border/60" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {items.map((item, i) => (
          <button
            key={i}
            onClick={item.onClick}
            className="group flex flex-col items-start gap-1 rounded-xl border border-border/60 bg-card p-4 text-left transition-all duration-200 hover:border-primary/30 hover:shadow-sm active:scale-[0.98]"
          >
            <div className="flex items-center gap-2 w-full">
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${item.bg} transition-transform group-hover:scale-110`}>
                <item.icon className={`h-4 w-4 ${item.color}`} />
              </div>
              <span className="text-[11px] text-muted-foreground leading-tight">{item.label}</span>
            </div>
            <p className="text-xl font-bold text-card-foreground mt-1 number-display">{item.value}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
