import { useMemo } from "react";
import { Activity, AlertTriangle, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useServices } from "@/hooks/useServices";
import { useClients } from "@/hooks/useClients";
import { useTransactions } from "@/hooks/useTransactions";

export function SecretariaAutoSummary() {
  const { services } = useServices();
  const { clients } = useClients();
  const { transactions } = useTransactions();

  const summary = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

    // Today's services
    const todayServices = (services || []).filter(
      (s) =>
        s.status !== "cancelled" &&
        s.scheduled_date?.startsWith(todayStr)
    );

    const scheduled = todayServices.filter((s) => s.status === "scheduled").length;
    const inProgress = todayServices.filter((s) => s.status === "in_progress").length;
    const completed = todayServices.filter((s) => s.status === "completed").length;

    // Overdue payments
    const overduePayments = (transactions || []).filter(
      (t) =>
        t.type === "income" &&
        t.status === "pending" &&
        t.due_date &&
        new Date(t.due_date) < now
    ).length;

    // Inactive clients
    const clientLastService: Record<string, Date> = {};
    (services || []).forEach((s) => {
      if (s.status !== "completed") return;
      const d = s.completed_date || s.scheduled_date || s.created_at;
      if (d) {
        const date = new Date(d);
        if (!clientLastService[s.client_id] || date > clientLastService[s.client_id]) {
          clientLastService[s.client_id] = date;
        }
      }
    });
    const inactiveClients = (clients || []).filter((c) => {
      const last = clientLastService[c.id];
      return last && last < sixMonthsAgo;
    }).length;

    const hasAlerts = overduePayments > 0 || inactiveClients > 0;

    return {
      total: todayServices.length,
      scheduled,
      inProgress,
      completed,
      overduePayments,
      inactiveClients,
      hasAlerts,
    };
  }, [services, clients, transactions]);

  const alertParts: string[] = [];
  if (summary.overduePayments > 0) alertParts.push(`${summary.overduePayments} pagamento(s) vencido(s)`);
  if (summary.inactiveClients > 0) alertParts.push(`${summary.inactiveClients} cliente(s) inativo(s)`);

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-3 space-y-1">
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-primary" />
          <span className="font-medium text-foreground">
            Hoje: {summary.total} serviço(s)
          </span>
          <span className="text-muted-foreground">
            — Agendados: {summary.scheduled} | Em andamento: {summary.inProgress} | Concluídos: {summary.completed}
          </span>
        </div>
        {summary.hasAlerts ? (
          <div className="flex items-center gap-2 text-xs">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
            <span className="text-destructive font-medium">
              Alertas: {alertParts.join(" · ")}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs">
            <Activity className="h-3.5 w-3.5 text-primary" />
            <span className="text-muted-foreground">Tudo sob controle — sem alertas pendentes.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
