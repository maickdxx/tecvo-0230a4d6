import { AlertTriangle, Clock, UserX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Service } from "@/hooks/useServices";

interface Props {
  services: Service[];
}

interface Alert {
  icon: React.ElementType;
  message: string;
  severity: "critical" | "warning" | "info";
}

export function OperationalAlerts({ services }: Props) {
  const alerts: Alert[] = [];
  const now = new Date();

  // 1. Overdue: scheduled time passed, not started
  const overdueServices = services.filter((s) => {
    if (s.status === "completed" || s.status === "in_progress" || s.status === "cancelled") return false;
    const opStatus = (s as any).operational_status;
    if (opStatus === "en_route" || opStatus === "in_attendance") return false;
    if (!s.entry_date) return false;
    return now > new Date(s.entry_date);
  });

  if (overdueServices.length > 0) {
    const names = overdueServices.slice(0, 2).map((s) => s.client?.name).filter(Boolean).join(", ");
    alerts.push({
      icon: AlertTriangle,
      message: `${overdueServices.length} serviço${overdueServices.length > 1 ? "s" : ""} com horário ultrapassado${names ? `: ${names}` : ""}`,
      severity: "critical",
    });
  }

  // 2. Long attendance (>2h)
  const longAttendance = services.filter((s) => {
    const started = (s as any).attendance_started_at;
    if (!started || s.status === "completed") return false;
    return (Date.now() - new Date(started).getTime()) / 60000 > 120;
  });

  if (longAttendance.length > 0) {
    alerts.push({
      icon: Clock,
      message: `${longAttendance.length} atendimento${longAttendance.length > 1 ? "s" : ""} acima de 2h no local`,
      severity: "warning",
    });
  }

  // 3. Idle technicians
  const techMap = new Map<string, { total: number; active: number }>();
  services.forEach((s) => {
    if (!s.assigned_to || s.status === "cancelled") return;
    const entry = techMap.get(s.assigned_to) || { total: 0, active: 0 };
    entry.total++;
    const op = (s as any).operational_status;
    if (op === "en_route" || op === "in_attendance" || s.status === "completed" || s.status === "in_progress") {
      entry.active++;
    }
    techMap.set(s.assigned_to, entry);
  });

  const idleCount = [...techMap.values()].filter((i) => i.total > 0 && i.active === 0).length;
  if (idleCount > 0) {
    alerts.push({
      icon: UserX,
      message: `${idleCount} técnico${idleCount > 1 ? "s" : ""} com serviços agendados mas sem atividade`,
      severity: "info",
    });
  }

  if (alerts.length === 0) return null;

  const colors = {
    critical: "border-l-red-500 bg-red-500/5 dark:bg-red-500/10",
    warning: "border-l-amber-500 bg-amber-500/5 dark:bg-amber-500/10",
    info: "border-l-blue-500 bg-blue-500/5 dark:bg-blue-500/10",
  };
  const iconColors = {
    critical: "text-red-600 dark:text-red-400",
    warning: "text-amber-600 dark:text-amber-400",
    info: "text-blue-600 dark:text-blue-400",
  };

  return (
    <div className="space-y-2">
      {alerts.slice(0, 3).map((a, i) => {
        const Icon = a.icon;
        return (
          <Card key={i} className={`border-l-4 ${colors[a.severity]}`}>
            <CardContent className="p-3 flex items-center gap-3">
              <Icon className={`h-4 w-4 shrink-0 ${iconColors[a.severity]}`} />
              <p className="text-sm text-foreground">{a.message}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
