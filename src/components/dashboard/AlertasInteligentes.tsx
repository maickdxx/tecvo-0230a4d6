import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, FileText, UserX, CheckCircle2, ChevronRight } from "lucide-react";
import { useServices } from "@/hooks/useServices";
import { useClients } from "@/hooks/useClients";
import { useTransactions } from "@/hooks/useTransactions";
import { getTodayInTz, getDatePartInTz } from "@/lib/timezone";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";

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
  const tz = useOrgTimezone();

  const alerts = useMemo((): Alert[] => {
    const result: Alert[] = [];
    const todayStr = getTodayInTz(tz);

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
      <div className="mb-5 rounded-xl border border-border/60 bg-card shadow-card p-4 animate-fade-in">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <div className="rounded-full bg-success/10 p-1.5">
            <CheckCircle2 className="h-4 w-4 text-success" />
          </div>
          <span className="font-medium">Tudo sob controle — nenhum alerta.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-5 rounded-xl border border-border/60 bg-card shadow-card overflow-hidden animate-fade-in">
      <div className="px-5 pt-4 pb-2">
        <h3 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          Atenção
        </h3>
      </div>
      <div className="divide-y divide-border/50">
        {alerts.map((alert) => {
          const bgClass = alert.severity === "destructive" ? "hover:bg-destructive/5" : "hover:bg-warning/5";
          const iconBg = alert.severity === "destructive" ? "bg-destructive/10" : "bg-warning/10";
          const iconColor = alert.severity === "destructive" ? "text-destructive" : "text-warning";
          return (
            <button
              key={alert.id}
              onClick={alert.action}
              className={`flex items-center gap-3 px-5 py-3 w-full text-left transition-colors ${bgClass}`}
            >
              <div className={`rounded-full p-1.5 shrink-0 ${iconBg}`}>
                <alert.icon className={`h-4 w-4 ${iconColor}`} />
              </div>
              <span className="text-sm font-medium text-card-foreground flex-1">{alert.message}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
