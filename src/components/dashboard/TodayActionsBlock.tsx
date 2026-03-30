import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  CalendarDays, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  FileText, 
  UserX, 
  TrendingUp,
  ArrowRight,
  ShieldCheck
} from "lucide-react";
import { useServices } from "@/hooks/useServices";
import { useClients } from "@/hooks/useClients";
import { useTransactions } from "@/hooks/useTransactions";
import { format, subDays, subMonths } from "date-fns";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function TodayActionsBlock() {
  const navigate = useNavigate();
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  
  const { services, isLoading: isLoadingServices } = useServices();
  const { clients, isLoading: isLoadingClients } = useClients();
  const { transactions, isLoading: isLoadingTransactions } = useTransactions();

  const actions = useMemo(() => {
    const result: {
      id: string;
      label: string;
      impact?: string;
      icon: any;
      color: string;
      bg: string;
      action: () => void;
      priority: number;
    }[] = [];

    // 1. Overdue services (High priority)
    const overdueServices = services.filter((s) => {
      if (!s.scheduled_date || s.status === "completed" || s.status === "cancelled" || s.document_type === "quote") return false;
      return s.scheduled_date.substring(0, 10) < todayStr;
    });

    if (overdueServices.length > 0) {
      const impactValue = overdueServices.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
      result.push({
        id: "overdue_services",
        label: `${overdueServices.length} serviço${overdueServices.length > 1 ? "s" : ""} atrasado${overdueServices.length > 1 ? "s" : ""}`,
        impact: impactValue > 0 ? `${formatCurrency(impactValue)} em risco` : undefined,
        icon: Clock,
        color: "text-destructive",
        bg: "bg-destructive/10",
        action: () => navigate("/ordens-servico?status=overdue"),
        priority: 1,
      });
    }

    // 2. Overdue payments (High priority)
    const overduePayments = transactions.filter(
      (t) => t.status === "pending" && t.due_date && t.due_date < todayStr && t.type === "income"
    );

    if (overduePayments.length > 0) {
      const total = overduePayments.reduce((sum, t) => sum + Number(t.amount), 0);
      result.push({
        id: "overdue_payments",
        label: `${overduePayments.length} pagamento${overduePayments.length > 1 ? "s" : ""} vencido${overduePayments.length > 1 ? "s" : ""}`,
        impact: `${formatCurrency(total)} pendente`,
        icon: AlertTriangle,
        color: "text-destructive",
        bg: "bg-destructive/10",
        action: () => navigate("/financeiro?tab=receivable&status=overdue"),
        priority: 2,
      });
    }

    // 3. Quotes without response (Potential revenue)
    const fiveDaysAgo = format(subDays(today, 5), "yyyy-MM-dd");
    const pendingQuotes = services.filter(
      (s) => s.document_type === "quote" && s.status === "scheduled" && s.created_at.substring(0, 10) <= fiveDaysAgo
    );

    if (pendingQuotes.length > 0) {
      const totalValue = pendingQuotes.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
      result.push({
        id: "pending_quotes",
        label: `${pendingQuotes.length} orçamento${pendingQuotes.length > 1 ? "s" : ""} sem resposta`,
        impact: totalValue > 0 ? `${formatCurrency(totalValue)} aguardando` : undefined,
        icon: FileText,
        color: "text-warning",
        bg: "bg-warning/10",
        action: () => navigate("/orcamentos"),
        priority: 3,
      });
    }

    // 4. Inactive clients (6+ months)
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

    if (inactiveClients.length > 0) {
      result.push({
        id: "inactive_clients",
        label: `${inactiveClients.length} cliente${inactiveClients.length > 1 ? "s" : ""} sem manutenção`,
        impact: "Potencial de reativação",
        icon: UserX,
        color: "text-primary",
        bg: "bg-primary/10",
        action: () => navigate("/clientes"),
        priority: 4,
      });
    }

    // 5. Services for today
    const todayServices = services.filter(
      (s) => s.scheduled_date?.startsWith(todayStr) && s.status !== "cancelled" && s.document_type !== "quote"
    );

    if (todayServices.length > 0) {
      result.push({
        id: "today_services",
        label: `${todayServices.length} serviço${todayServices.length > 1 ? "s" : ""} para hoje`,
        icon: CalendarDays,
        color: "text-info",
        bg: "bg-info/10",
        action: () => navigate("/agenda"),
        priority: 5,
      });
    }

    return result.sort((a, b) => a.priority - b.priority).slice(0, 5);
  }, [services, clients, transactions, todayStr, navigate]);

  const isLoading = isLoadingServices || isLoadingClients || isLoadingTransactions;

  if (isLoading) {
    return (
      <div className="mb-6 h-32 w-full animate-pulse rounded-xl bg-muted/50" />
    );
  }

  if (actions.length === 0) {
    return (
      <div className="mb-8 rounded-2xl border border-success/20 bg-success/5 p-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <div className="rounded-full bg-success/10 p-3">
            <ShieldCheck className="h-6 w-6 text-success" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Tudo sob controle hoje</h2>
            <p className="text-sm text-muted-foreground">Não há ações críticas pendentes no momento. Bom trabalho!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 page-enter">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/70">
          🎯 Ações de Hoje
        </h2>
        <div className="flex-1 h-px bg-border/40" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {actions.map((item) => (
          <button
            key={item.id}
            onClick={item.action}
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/60 bg-card p-4 text-left transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 active:scale-[0.98]"
          >
            <div className="flex items-start justify-between">
              <div className={`rounded-xl p-2.5 ${item.bg} transition-transform group-hover:scale-110`}>
                <item.icon className={`h-5 w-5 ${item.color}`} />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/0 transition-all group-hover:text-muted-foreground/100 group-hover:translate-x-1" />
            </div>

            <div className="mt-4">
              <h3 className="text-[15px] font-bold text-foreground leading-tight group-hover:text-primary transition-colors">
                {item.label}
              </h3>
              {item.impact && (
                <p className="mt-1 text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-success" />
                  {item.impact}
                </p>
              )}
            </div>
            
            {/* Visual indicator of priority */}
            <div className={`absolute top-0 right-0 h-1 w-12 ${item.id === "overdue_services" || item.id === "overdue_payments" ? "bg-destructive/40" : "bg-primary/20"}`} />
          </button>
        ))}
      </div>
    </div>
  );
}
