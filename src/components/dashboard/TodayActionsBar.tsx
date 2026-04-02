import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useServices } from "@/hooks/useServices";
import { getTodayInTz, getDatePartInTz } from "@/lib/timezone";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";

export function TodayActionsBar() {
  const navigate = useNavigate();
  const { services } = useServices({ documentType: "service_order" });
  const tz = useOrgTimezone();

  const today = getTodayInTz(tz);

  const insights = useMemo(() => {
    const todayServices = services.filter(
      (s) => s.scheduled_date && getDatePartInTz(s.scheduled_date, tz) === today && s.status !== "cancelled"
    );
    const inProgress = services.filter((s) => s.status === "in_progress");
    const overdue = services.filter((s) => {
      if (!s.scheduled_date || s.status === "completed" || s.status === "cancelled") return false;
      return getDatePartInTz(s.scheduled_date, tz) < today;
    });
    const completedUnpaid = services.filter(
      (s) => s.status === "completed" && (s as any).total_paid < (s as any).value
    );

    return { todayServices, inProgress, overdue, completedUnpaid };
  }, [services, today]);

  const { todayServices, inProgress, overdue, completedUnpaid } = insights;

  // Don't show if no actionable data
  if (todayServices.length === 0 && inProgress.length === 0 && overdue.length === 0 && completedUnpaid.length === 0) {
    return null;
  }

  const items = [
    {
      show: todayServices.length > 0,
      icon: CalendarDays,
      label: `${todayServices.length} serviço${todayServices.length > 1 ? "s" : ""} hoje`,
      color: "text-info" as const,
      bg: "bg-info/10" as const,
      action: () => navigate("/agenda"),
    },
    {
      show: inProgress.length > 0,
      icon: Clock,
      label: `${inProgress.length} em andamento`,
      color: "text-warning" as const,
      bg: "bg-warning/10" as const,
      action: () => navigate("/ordens-servico?status=in_progress"),
    },
    {
      show: overdue.length > 0,
      icon: AlertTriangle,
      label: `${overdue.length} atrasado${overdue.length > 1 ? "s" : ""}`,
      color: "text-destructive" as const,
      bg: "bg-destructive/10" as const,
      action: () => navigate("/ordens-servico?status=overdue"),
    },
    {
      show: completedUnpaid.length > 0,
      icon: CheckCircle2,
      label: `${completedUnpaid.length} pagamento${completedUnpaid.length > 1 ? "s" : ""} pendente${completedUnpaid.length > 1 ? "s" : ""}`,
      color: "text-success" as const,
      bg: "bg-success/10" as const,
      action: () => navigate("/ordens-servico?status=completed"),
    },
  ].filter((item) => item.show);

  if (items.length === 0) return null;

  return (
    <div className="mb-6 page-enter">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/60">
          Ações do dia
        </h2>
        <div className="flex-1 h-px bg-border/60" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 entrance-stagger">
        {items.map((item, i) => (
          <button
            key={i}
            onClick={item.action}
            className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3.5 text-left transition-all duration-200 hover:border-primary/30 hover:shadow-sm active:scale-[0.98]"
          >
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${item.bg} transition-transform group-hover:scale-110`}>
              <item.icon className={`h-4.5 w-4.5 ${item.color}`} />
            </div>
            <span className="text-sm font-medium text-foreground leading-tight">
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
