import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  FileText, 
  UserX, 
  RefreshCw, 
  DollarSign, 
  TrendingUp, 
  ArrowRight,
  ShieldCheck,
  CalendarDays
} from "lucide-react";
import { useServices } from "@/hooks/useServices";
import { useClients } from "@/hooks/useClients";
import { format, subMonths } from "date-fns";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function RevenueOpportunitiesBlock() {
  const navigate = useNavigate();
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  
  const { services, isLoading: isLoadingServices } = useServices();
  const { clients, isLoading: isLoadingClients } = useClients();

  const opportunities = useMemo(() => {
    // 1. Open quotes total
    const openQuotes = services.filter(
      (s) => s.document_type === "quote" && (s.status === "scheduled" || s.status === "in_progress")
    );
    const quotesTotal = openQuotes.reduce((sum, s) => sum + (Number(s.value) || 0), 0);

    // 2. Inactive clients (6+ months)
    const sixMonthsAgo = format(subMonths(today, 6), "yyyy-MM-dd");
    const lastServiceByClient: Record<string, string> = {};
    services.forEach((s) => {
      if (s.status !== "completed") return;
      const date = s.completed_date || s.scheduled_date || s.created_at;
      if (!lastServiceByClient[s.client_id] || date > lastServiceByClient[s.client_id]) {
        lastServiceByClient[s.client_id] = date;
      }
    });
    const inactiveClients = clients.filter((c) => {
      const lastDate = lastServiceByClient[c.id];
      if (!lastDate) return false;
      return lastDate < sixMonthsAgo;
    });

    // 3. Pending maintenance (PMOC)
    // For now, let's assume services with "manutenção" in description or specific type
    const maintenanceQuotes = services.filter(
      (s) => 
        (s.document_type === "quote" || s.status === "scheduled") && 
        (s.description?.toLowerCase().includes("manutenção") || (s as any).type === "preventive")
    );
    const maintenanceTotal = maintenanceQuotes.reduce((sum, s) => sum + (Number(s.value) || 0), 0);

    return {
      quotes: { count: openQuotes.length, total: quotesTotal },
      inactive: { count: inactiveClients.length },
      maintenance: { count: maintenanceQuotes.length, total: maintenanceTotal }
    };
  }, [services, clients]);

  const isLoading = isLoadingServices || isLoadingClients;

  if (isLoading) return null;

  const items = [
    {
      id: "quotes",
      label: "Orçamentos em Aberto",
      value: formatCurrency(opportunities.quotes.total),
      sub: `${opportunities.quotes.count} orçamentos aguardando`,
      icon: FileText,
      color: "text-primary",
      bg: "bg-primary/10",
      action: () => navigate("/orcamentos"),
    },
    {
      id: "inactive",
      label: "Clientes Inativos",
      value: String(opportunities.inactive.count),
      sub: "Sem manutenção há +6 meses",
      icon: UserX,
      color: "text-warning",
      bg: "bg-warning/10",
      action: () => navigate("/clientes"),
    },
    {
      id: "maintenance",
      label: "Manutenções Pendentes",
      value: formatCurrency(opportunities.maintenance.total),
      sub: `${opportunities.maintenance.count} oportunidades`,
      icon: RefreshCw,
      color: "text-success",
      bg: "bg-success/10",
      action: () => navigate("/agenda"),
    },
    {
      id: "potential",
      label: "Possíveis Retornos",
      value: "Baseado em histórico",
      sub: "Análise de tendência",
      icon: TrendingUp,
      color: "text-info",
      bg: "bg-info/10",
      action: () => navigate("/ordens-servico"),
    },
  ];

  return (
    <div className="mb-8 page-enter">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/70">
          💰 Oportunidades de Receita
        </h2>
        <div className="flex-1 h-px bg-border/40" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={item.action}
            className="group flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-5 text-left transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 active:scale-[0.98]"
          >
            <div className={`rounded-xl p-3 ${item.bg} transition-transform group-hover:scale-110 shrink-0`}>
              <item.icon className={`h-6 w-6 ${item.color}`} />
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide leading-tight mb-1 truncate">
                {item.label}
              </p>
              <p className="text-2xl font-bold text-foreground number-display leading-tight truncate">
                {item.value}
              </p>
              <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 truncate">
                {item.sub}
              </p>
            </div>
            
            <ArrowRight className="h-4 w-4 text-muted-foreground/0 transition-all group-hover:text-muted-foreground/100 group-hover:translate-x-1 shrink-0" />
          </button>
        ))}
      </div>
      
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-primary/10 bg-primary/5 px-4 py-3">
        <DollarSign className="h-4 w-4 text-primary shrink-0" />
        <p className="text-sm text-muted-foreground">
          Você tem <span className="font-bold text-primary">{formatCurrency(opportunities.quotes.total)}</span> em orçamentos que podem ser convertidos em receita.
        </p>
      </div>
    </div>
  );
}
