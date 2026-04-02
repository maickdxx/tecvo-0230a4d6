import { useMemo } from "react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DollarSign, CheckCircle, CalendarCheck, AlertTriangle, TrendingUp, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Service } from "@/hooks/useServices";
import { getEffectiveStatus } from "@/components/agenda/CalendarView";
import { AgendaServiceCard } from "./AgendaServiceCard";
import { isSameDayInTz, getDatePartInTz, formatTimeInTz } from "@/lib/timezone";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import type { OperationalCapacity } from "@/hooks/useOperationalCapacity";

interface AgendaPeriodPanelProps {
  viewMode: "week" | "month";
  referenceDate: Date;
  services: Service[];
  allServices: Service[];
  capacity: OperationalCapacity;
  onServiceClick: (service: Service) => void;
  onDelete: (id: string) => void;
  readOnly?: boolean;
  hideServiceList?: boolean;
}

const currencyFormat = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function fmtTime(min: number): string {
  if (min === 0) return "0h";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h${m > 0 ? `${m}m` : ""}` : `${m}m`;
}

export function AgendaPeriodPanel({
  viewMode,
  referenceDate,
  services,
  allServices,
  capacity,
  onServiceClick,
  onDelete,
  readOnly = false,
  hideServiceList = false,
}: AgendaPeriodPanelProps) {
  const tz = useOrgTimezone();
  const periodLabel = viewMode === "month" ? "do Mês" : "da Semana";

  const periodRange = useMemo(() => {
    if (viewMode === "week") {
      const ws = startOfWeek(referenceDate, { weekStartsOn: 0 });
      const we = endOfWeek(referenceDate, { weekStartsOn: 0 });
      return { start: ws, end: we };
    }
    return { start: startOfMonth(referenceDate), end: endOfMonth(referenceDate) };
  }, [viewMode, referenceDate]);

  const periodTitle = useMemo(() => {
    if (viewMode === "week") {
      return `${format(periodRange.start, "d", { locale: ptBR })} – ${format(periodRange.end, "d 'de' MMMM", { locale: ptBR })}`;
    }
    return format(referenceDate, "MMMM 'de' yyyy", { locale: ptBR });
  }, [viewMode, referenceDate, periodRange]);

  // Stats
  const stats = useMemo(() => {
    const planned = services.reduce((s, sv) => s + (sv.value || 0), 0);
    const completed = services.filter(s => s.status === "completed").length;
    const scheduled = services.filter(s => getEffectiveStatus(s) === "scheduled").length;
    const overdue = services.filter(s => getEffectiveStatus(s) === "overdue").length;
    const realized = services.filter(s => s.status === "completed").reduce((s, sv) => s + (sv.value || 0), 0);
    return { planned, completed, scheduled, overdue, realized };
  }, [services]);

  // Group services by day
  const groupedByDay = useMemo(() => {
    const days = eachDayOfInterval({ start: periodRange.start, end: periodRange.end });
    const getTimeKey = (s: Service): string => {
      const raw = s.entry_date || s.scheduled_date;
      if (!raw) return "99:99";
      const t = formatTimeInTz(raw, tz);
      return t === "—" ? "99:99" : t;
    };
    const groups: { date: Date; services: Service[] }[] = [];
    for (const day of days) {
      const dayServices = services
        .filter(s => isSameDayInTz(s.scheduled_date!, day, tz))
        .sort((a, b) => getTimeKey(a).localeCompare(getTimeKey(b)));
      if (dayServices.length > 0) {
        groups.push({ date: day, services: dayServices });
      }
    }
    return groups;
  }, [services, periodRange]);

  // Ticket médio map
  const ticketMedioMap = useMemo(() => {
    const map: Record<string, number> = {};
    const completedByClient: Record<string, number[]> = {};
    allServices.forEach(s => {
      if (s.status === "completed" && s.value && s.value > 0) {
        if (!completedByClient[s.client_id]) completedByClient[s.client_id] = [];
        completedByClient[s.client_id].push(s.value);
      }
    });
    Object.entries(completedByClient).forEach(([cid, vals]) => {
      map[cid] = vals.reduce((a, b) => a + b, 0) / vals.length;
    });
    return map;
  }, [allServices]);

  const { totalOccupancy, productiveMin, travelMin, idleMin, capacityMin, travelAlert } = capacity;

  return (
    <div className="rounded-2xl border border-border/50 bg-card shadow-card animate-blur-in">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-border/50">
        <div>
          <h2 className="text-lg font-semibold text-foreground capitalize">
            Resumo {periodLabel}
          </h2>
          <p className="text-sm text-muted-foreground capitalize">{periodTitle}</p>
        </div>
      </div>

      {/* Capacity breakdown */}
      {services.length > 0 && capacityMin > 0 && (
        <div className="px-5 pt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>Ocupação {periodLabel.toLowerCase()}</span>
            <span className="number-display">{totalOccupancy}% de {fmtTime(capacityMin)}</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden flex bg-muted/50">
            {productiveMin > 0 && (
              <div
                className="bg-success transition-all duration-700 ease-out"
                style={{ width: `${Math.min((productiveMin / capacityMin) * 100, 100)}%` }}
              />
            )}
            {travelMin > 0 && (
              <div
                className={cn("transition-all duration-700 ease-out", travelAlert ? "bg-destructive/80" : "bg-warning")}
                style={{ width: `${Math.min((travelMin / capacityMin) * 100, 100 - (productiveMin / capacityMin) * 100)}%` }}
              />
            )}
          </div>
          <div className="flex items-center gap-4 mt-1.5 text-2xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> Produtivo {fmtTime(productiveMin)}
            </span>
            <span className="flex items-center gap-1">
              <span className={cn("h-1.5 w-1.5 rounded-full", travelAlert ? "bg-destructive/80" : "bg-warning")} /> Desloc. {fmtTime(travelMin)}
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/20" /> Ocioso {fmtTime(idleMin)}
            </span>
          </div>
        </div>
      )}

      {/* Summary stats */}
      {services.length > 0 && (
        <div className="mx-5 mt-3 p-3 rounded-xl bg-muted/30 flex flex-wrap gap-x-5 gap-y-1.5 items-center text-xs">
          <span className="font-semibold text-foreground">
            {services.length} serviço{services.length !== 1 ? "s" : ""}
          </span>
          <span className="text-muted-foreground">
            <DollarSign className="h-3 w-3 inline -mt-0.5 mr-0.5" />
            {currencyFormat(stats.planned)} previsto
          </span>
          {stats.completed > 0 && (
            <span className="text-success">
              <CheckCircle className="h-3 w-3 inline -mt-0.5 mr-0.5" />
              {stats.completed} concluído{stats.completed !== 1 ? "s" : ""}
            </span>
          )}
          {stats.scheduled > 0 && (
            <span className="text-info">
              <CalendarCheck className="h-3 w-3 inline -mt-0.5 mr-0.5" />
              {stats.scheduled} agendado{stats.scheduled !== 1 ? "s" : ""}
            </span>
          )}
          {stats.overdue > 0 && (
            <span className="text-destructive">
              <AlertTriangle className="h-3 w-3 inline -mt-0.5 mr-0.5" />
              {stats.overdue} atrasado{stats.overdue !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {/* Grouped service list */}
      {!hideServiceList && (
        <div className="p-5">
          {services.length === 0 ? (
            <div className="text-center py-8">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Nenhum serviço {periodLabel.toLowerCase()}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedByDay.map(({ date, services: dayServices }) => (
                <div key={date.toISOString()}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-foreground capitalize">
                      {format(date, "EEEE, d", { locale: ptBR })}
                    </span>
                    <span className="text-2xs text-muted-foreground">
                      {dayServices.length} serviço{dayServices.length !== 1 ? "s" : ""}
                    </span>
                    <div className="flex-1 h-px bg-border/50" />
                  </div>
                  <div className="space-y-2">
                    {dayServices.map(service => (
                      <AgendaServiceCard
                        key={service.id}
                        service={service}
                        onClick={() => onServiceClick(service)}
                        onDelete={() => onDelete(service.id)}
                        ticketMedio={ticketMedioMap[service.client_id] ?? null}
                        readOnly={readOnly}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer summary */}
      {services.length > 0 && (
        <div className="mx-5 mb-5 p-4 rounded-xl bg-muted/40">
          <p className="text-xs text-muted-foreground mb-2">
            {services.length} serviço{services.length !== 1 ? "s" : ""} {periodLabel.toLowerCase()}
          </p>
          {stats.planned > 0 && (
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-muted-foreground">Valor estimado</span>
              <span className="font-medium text-foreground">{currencyFormat(stats.planned)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5 text-success" />
              Valor realizado
            </span>
            <span className="text-base font-bold text-success number-display">
              {currencyFormat(stats.realized)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
