import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, FileText, UserX, CheckCircle2, ChevronRight } from "lucide-react";
import { useServices } from "@/hooks/useServices";
import { useClients } from "@/hooks/useClients";
import { useTransactions } from "@/hooks/useTransactions";

interface Alert {
  id: string;
  icon: typeof AlertTriangle;
  message: string;
  severity: "warning" | "destructive";
  action?: () => void;
}

export function AlertasInteligentes() {
  const navigate = useNavigate();
  const { services, isLoading: isLoadingServices } = useServices();
  const { clients, isLoading: isLoadingClients } = useClients();
  const { transactions, isLoading: isLoadingTransactions } = useTransactions();

  const alerts = useMemo((): Alert[] => {
    const result: Alert[] = [];
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // 1. Overdue services
    const overdueServices = services.filter((s) => {
      if (!s.scheduled_date || s.status === "completed" || s.status === "cancelled") return false;
      return s.scheduled_date.substring(0, 10) < todayStr;
    });

    if (overdueServices.length > 0) {
      result.push({
        id: "overdue_services",
        icon: AlertTriangle,
        message: `${overdueServices.length} serviço${overdueServices.length > 1 ? "s" : ""} atrasado${overdueServices.length > 1 ? "s" : ""}`,
        severity: "destructive",
        action: () => navigate("/ordens-servico?status=overdue"),
      });
    }

    // 2. Overdue payments
    const overduePayments = transactions.filter(
      (t) => t.status === "pending" && t.due_date && t.due_date < todayStr
    );

    if (overduePayments.length > 0) {
      const total = overduePayments.reduce((sum, t) => sum + Number(t.amount), 0);
      const formatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(total);
      result.push({
        id: "overdue_payments",
        icon: AlertTriangle,
        message: `${overduePayments.length} pagamento${overduePayments.length > 1 ? "s" : ""} vencido${overduePayments.length > 1 ? "s" : ""} – ${formatted}`,
        severity: "destructive",
        action: () => navigate("/financeiro?tab=receivable&status=overdue"),
      });
    }

    // 3. Pending quotes > 5 days
    const fiveDaysAgo = new Date(today);
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    const pendingQuotes = services.filter(
      (s) => s.document_type === "quote" && s.status === "scheduled" && new Date(s.created_at) < fiveDaysAgo
    );

    if (pendingQuotes.length > 0) {
      result.push({
        id: "pending_quotes",
        icon: FileText,
        message: `${pendingQuotes.length} orçamento${pendingQuotes.length > 1 ? "s" : ""} sem retorno há +5 dias`,
        severity: "warning",
        action: () => navigate("/orcamentos"),
      });
    }


    // 5. Started but not finished services (Today or older)
    const unfinishedServices = services.filter((s) => {
      return (s.status === "in_progress" || (s as any).operational_status === "en_route");
    });

    if (unfinishedServices.length > 0) {
      result.push({
        id: "unfinished_services",
        icon: AlertTriangle,
        message: `${unfinishedServices.length} serviço${unfinishedServices.length > 1 ? "s" : ""} em execução no momento`,
        severity: "warning",
        action: () => navigate("/ordens-servico?status=in_progress"),
      });
    }

    return result;
  }, [services, clients, transactions, navigate]);

  const isLoading = isLoadingServices || isLoadingClients || isLoadingTransactions;
  if (isLoading) return null;

  // Don't render if no alerts
  if (alerts.length === 0) {
    return (
      <div className="mb-10 rounded-[2rem] border border-border/40 bg-card p-8 shadow-[0_8px_30px_rgb(0,0,0,0.03)] animate-fade-in transition-all duration-500 hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] group">
        <div className="flex items-center gap-5 text-sm text-muted-foreground/60">
          <div className="rounded-xl bg-success/5 p-3 shadow-sm ring-4 ring-success/[0.01]">
            <CheckCircle2 className="h-5 w-5 text-success/60" />
          </div>
          <span className="font-bold tracking-tight">Tudo em ordem — nenhum alerta crítico detectado.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-10 rounded-[2rem] border border-border/40 bg-card shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden animate-fade-in transition-all duration-500 hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] group">
      <div className="px-8 pt-8 pb-5 bg-muted/[0.05] border-b border-border/10">
        <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-muted-foreground/50 flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-warning/10">
            <AlertTriangle className="h-4 w-4 text-warning/70" />
          </div>
          Inteligência Operacional
        </h3>
      </div>
      <div className="divide-y divide-border/5">
        {alerts.map((alert) => {
          const bgClass = alert.severity === "destructive" ? "hover:bg-destructive/[0.01]" : "hover:bg-warning/[0.01]";
          const iconBg = alert.severity === "destructive" ? "bg-destructive/10" : "bg-warning/10";
          const iconColor = alert.severity === "destructive" ? "text-destructive/80" : "text-warning/80";
          return (
            <button
              key={alert.id}
              onClick={alert.action}
              className={`flex items-center gap-5 px-8 py-6 w-full text-left transition-all duration-300 group/item ${bgClass}`}
            >
              <div className={`rounded-2xl p-3.5 shrink-0 transition-all duration-500 group-hover/item:scale-110 group-hover/item:rotate-3 shadow-sm ${iconBg}`}>
                <alert.icon className={`h-5 w-5 ${iconColor}`} />
              </div>
              <span className="text-sm font-bold text-card-foreground/70 flex-1 tracking-tight">{alert.message}</span>
              <ChevronRight className="h-5 w-5 text-muted-foreground/20 shrink-0 transition-all duration-500 group-hover/item:translate-x-1.5" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
}
