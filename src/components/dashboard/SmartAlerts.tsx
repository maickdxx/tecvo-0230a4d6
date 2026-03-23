import { useMemo } from "react";
import { AlertTriangle, Clock, FileText, CheckCircle2, UserX } from "lucide-react";
import { useServices } from "@/hooks/useServices";
import { useClients } from "@/hooks/useClients";
import { useTransactions } from "@/hooks/useTransactions";

interface Alert {
  id: string;
  type: "inactive_client" | "overdue_payment" | "pending_quote";
  icon: typeof AlertTriangle;
  message: string;
  className: string;
}

export function SmartAlerts() {
  const { services, isLoading: isLoadingServices } = useServices();
  const { clients, isLoading: isLoadingClients } = useClients();
  const { transactions, isLoading: isLoadingTransactions } = useTransactions();

  const alerts = useMemo((): Alert[] => {
    const result: Alert[] = [];
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // 1. Inactive clients (no service in 6+ months)
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
      return new Date(lastDate) < sixMonthsAgo;
    });



    if (inactiveClients.length > 0) {
      // Calculate potential: inactive clients * general average ticket
      const completedServicesWithValue = services.filter(s => s.status === "completed" && s.value && s.value > 0);
      const generalAvgTicket = completedServicesWithValue.length > 0
        ? completedServicesWithValue.reduce((sum, s) => sum + (s.value || 0), 0) / completedServicesWithValue.length
        : 0;
      const potential = inactiveClients.length * generalAvgTicket;
      const formattedPotential = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(potential);
      
      result.push({
        id: "inactive_clients",
        type: "inactive_client",
        icon: UserX,
        message: `${inactiveClients.length} cliente${inactiveClients.length > 1 ? "s" : ""} para reativar${potential > 0 ? ` – potencial ${formattedPotential}` : ""}`,
        className: "text-warning",
      });
    }

    // 2. Overdue payments
    const overduePayments = transactions.filter(
      (t) => t.status === "pending" && t.due_date && t.due_date < todayStr
    );

    if (overduePayments.length > 0) {
      const overdueTotal = overduePayments.reduce((sum, t) => sum + Number(t.amount), 0);
      const formattedTotal = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(overdueTotal);
      result.push({
        id: "overdue_payments",
        type: "overdue_payment",
        icon: AlertTriangle,
        message: `${overduePayments.length} pagamento${overduePayments.length > 1 ? "s" : ""} vencido${overduePayments.length > 1 ? "s" : ""} – ${formattedTotal}`,
        className: "text-destructive",
      });
    }

    // 3. Pending quotes older than 5 days
    const fiveDaysAgo = new Date(today);
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    const pendingQuotes = services.filter(
      (s) =>
        s.document_type === "quote" &&
        s.status === "scheduled" &&
        new Date(s.created_at) < fiveDaysAgo
    );

    if (pendingQuotes.length > 0) {
      result.push({
        id: "pending_quotes",
        type: "pending_quote",
        icon: FileText,
        message: `${pendingQuotes.length} orçamento${pendingQuotes.length > 1 ? "s" : ""} pendente${pendingQuotes.length > 1 ? "s" : ""} há mais de 5 dias`,
        className: "text-warning",
      });
    }

    return result.slice(0, 2);
  }, [services, clients, transactions]);

  const isLoading = isLoadingServices || isLoadingClients || isLoadingTransactions;

  if (isLoading) return null;

  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-card p-5">
      <h3 className="text-sm font-semibold text-card-foreground mb-4">Alertas Inteligentes</h3>
      {alerts.length === 0 ? (
        <div className="flex items-center gap-3 text-sm text-muted-foreground rounded-lg bg-success/5 p-3">
          <div className="rounded-full bg-success/10 p-1.5">
            <CheckCircle2 className="h-4 w-4 text-success" />
          </div>
          <span>Tudo sob controle.</span>
        </div>
      ) : (
        <div className="space-y-2.5">
          {alerts.map((alert) => {
            const bgMap: Record<string, string> = {
              "text-warning": "bg-warning/5",
              "text-destructive": "bg-destructive/5",
            };
            const iconBgMap: Record<string, string> = {
              "text-warning": "bg-warning/10",
              "text-destructive": "bg-destructive/10",
            };
            return (
              <div key={alert.id} className={`flex items-center gap-3 text-sm rounded-lg p-3 ${bgMap[alert.className] || "bg-muted/50"}`}>
                <div className={`rounded-full p-1.5 ${iconBgMap[alert.className] || "bg-muted"}`}>
                  <alert.icon className={`h-4 w-4 shrink-0 ${alert.className}`} />
                </div>
                <span className="text-card-foreground">{alert.message}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
