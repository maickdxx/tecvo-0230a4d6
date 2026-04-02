import { useMemo, useState } from "react";
import { CalendarPlus, User, Clock, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useServices, SERVICE_TYPE_LABELS } from "@/hooks/useServices";
import { getDatePartInTz, formatTimeInTz } from "@/lib/timezone";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";

interface ClosedTodayServicesProps {
  startDate: string;
  endDate: string;
}

const SERVICE_TYPE_COLORS: Record<string, string> = {
  instalacao: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  installation: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  limpeza: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
  cleaning: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
  manutencao: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  maintenance: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  contratos: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  
  outros: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  other: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  completed: { label: "Concluído", color: "text-emerald-600 dark:text-emerald-400" },
  in_progress: { label: "Em andamento", color: "text-blue-600 dark:text-blue-400" },
  scheduled: { label: "Agendado", color: "text-muted-foreground" },
};

function getImpactColor(value: number | null): string {
  if (!value || value < 100) return "bg-blue-500";
  if (value <= 500) return "bg-amber-500";
  return "bg-emerald-500";
}

function formatCurrency(value: number | null): string {
  if (!value) return "R$ 0";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTimeFallback(dateStr: string | null, tz: string): string {
  if (!dateStr) return "—";
  return formatTimeInTz(dateStr, tz);
}

export function ClosedTodayServices({ startDate: _startDate, endDate: _endDate }: ClosedTodayServicesProps) {
  const { services, isLoading } = useServices();
  const [expanded, setExpanded] = useState(false);
  const tz = useOrgTimezone();

  const todayLocal = useMemo(
    () => new Date().toLocaleDateString("en-CA", { timeZone: tz }),
    [tz]
  );

  const scheduledToday = useMemo(() => {
    return services
      .filter((s) => {
        if (s.status === "cancelled") return false;
        if (!s.scheduled_date) return false;
        return getDatePartInTz(s.scheduled_date, tz) === todayLocal;
      })
      .sort((a, b) => {
        const order: Record<string, number> = { completed: 0, in_progress: 1, scheduled: 2 };
        const diff = (order[a.status] ?? 3) - (order[b.status] ?? 3);
        if (diff !== 0) return diff;
        return (a.scheduled_date || "").localeCompare(b.scheduled_date || "");
      });
  }, [services, todayLocal]);

  const completedCount = scheduledToday.filter((s) => s.status === "completed").length;

  const totalPrevisto = useMemo(
    () => scheduledToday.reduce((sum, s) => sum + (s.value || 0), 0),
    [scheduledToday]
  );

  const byType = useMemo(() => {
    const map: Record<string, number> = {};
    scheduledToday.forEach((s) => {
      const label = SERVICE_TYPE_LABELS[s.service_type] || s.service_type;
      map[label] = (map[label] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [scheduledToday]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 px-4 sm:px-6 pt-4 sm:pt-6">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CalendarPlus className="h-4 w-4 text-primary" />
            Serviços Agendados para Hoje
          </CardTitle>
          <div className="flex items-center gap-2">
            {completedCount > 0 && (
              <Badge variant="outline" className="text-xs text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                {completedCount} concluído{completedCount > 1 ? "s" : ""}
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs">
              {scheduledToday.length}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
        {scheduledToday.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum serviço agendado hoje.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Summary by type */}
            <div className="flex flex-wrap gap-2">
              {byType.map(([type, count]) => (
                <Badge key={type} variant="outline" className="text-xs">
                  {type}: {count}
                </Badge>
              ))}
            </div>

            {/* Service list */}
            {(() => {
              const MAX_VISIBLE = 3;
              const visible = expanded ? scheduledToday : scheduledToday.slice(0, MAX_VISIBLE);
              return (
                <>
                  <div className="space-y-2">
                    {visible.map((s) => {
                const impactColor = getImpactColor(s.value);
                const typeColor = SERVICE_TYPE_COLORS[s.service_type] || SERVICE_TYPE_COLORS.other;
                const statusInfo = STATUS_LABELS[s.status] || STATUS_LABELS.scheduled;

                return (
                  <div key={s.id} className="rounded-lg border p-2.5 sm:p-3 text-sm space-y-1.5 overflow-hidden min-w-0">
                    {/* Line 1: Impact · Client · Type Badge · Value */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`h-2 w-2 rounded-full flex-shrink-0 ${impactColor}`} />
                      <span className="font-medium truncate flex-1 min-w-0">
                        {s.client?.name || "Cliente"}
                      </span>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] px-1.5 py-0 leading-4 font-medium flex-shrink-0 ${typeColor}`}
                      >
                        {SERVICE_TYPE_LABELS[s.service_type] || s.service_type}
                      </Badge>
                      <span className="font-semibold text-xs flex-shrink-0 whitespace-nowrap">
                        {formatCurrency(s.value)}
                      </span>
                    </div>

                    {/* Line 2: Operational status · Time · Responsible */}
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                      <span className={`font-medium ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-3 w-3" />
                        {formatTimeFallback(s.scheduled_date, tz)}
                      </span>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="flex items-center gap-0.5 truncate max-w-[120px]">
                        <User className="h-3 w-3" />
                        {s.assigned_profile?.full_name || "Não atribuído"}
                      </span>
                    </div>
                  </div>
                );
                    })}
                  </div>
                  {scheduledToday.length > MAX_VISIBLE && !expanded && (
                    <button
                      onClick={() => setExpanded(true)}
                      className="w-full text-center text-xs text-primary font-medium py-1.5 hover:underline flex items-center justify-center gap-1"
                    >
                      Ver todos ({scheduledToday.length})
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  )}
                </>
              );
            })()}

            {/* Footer: Total previsto */}
            <div className="pt-2 border-t flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total previsto</span>
              <span className="font-semibold">{formatCurrency(totalPrevisto)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
