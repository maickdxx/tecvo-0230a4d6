import { useMemo, useCallback } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, DollarSign, CheckCircle, CalendarCheck, AlertTriangle, Truck, Ban, Zap, ClipboardList, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Service } from "@/hooks/useServices";
import { getEffectiveStatus } from "@/components/agenda/CalendarView";
import { AgendaServiceCard } from "./AgendaServiceCard";
import { formatTimeInTz } from "@/lib/timezone";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { AgendaSmartAlerts } from "./AgendaSmartAlerts";
import type { OperationalCapacity } from "@/hooks/useOperationalCapacity";

interface AgendaDayPanelProps {
  selectedDate: Date;
  services: Service[];
  allServices: Service[];
  teamSize: number;
  onServiceClick: (service: Service) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
  onQuickCreate?: () => void;
  readOnly?: boolean;
  isExecutive?: boolean;
  totalDistanceKm?: number;
  capacity: OperationalCapacity;
  hideServiceList?: boolean;
  highlightedServiceId?: string | null;
}

const currencyFormat = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function fmtTime(min: number): string {
  if (min === 0) return "0h";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h${m > 0 ? `${m}m` : ""}` : `${m}m`;
}

function ServiceTimeline({
  services,
  allServices,
  ticketMedioMap,
  onServiceClick,
  onDelete,
  readOnly,
  highlightedServiceId,
}: {
  services: Service[];
  allServices: Service[];
  ticketMedioMap: Record<string, number>;
  onServiceClick: (s: Service) => void;
  onDelete: (id: string) => void;
  readOnly: boolean;
  highlightedServiceId?: string | null;
}) {

  // Flatten all rows into a single sorted list — no side-by-side in the card list
  const sortedServices = useMemo(() => {
    const getTimeKey = (s: Service): string => {
      const raw = s.entry_date || s.scheduled_date;
      if (!raw) return "99:99";
      const t = formatTimeInTz(raw, tz);
      return t === "—" ? "99:99" : t;
    };
    return [...services].sort((a, b) => getTimeKey(a).localeCompare(getTimeKey(b)));
  }, [services, tz]);

  return (
    <div className="space-y-2">
      {sortedServices.map((service) => (
        <AgendaServiceCard
          key={service.id}
          service={service}
          onClick={() => onServiceClick(service)}
          onDelete={() => onDelete(service.id)}
          ticketMedio={ticketMedioMap[service.client_id] ?? null}
          readOnly={readOnly}
          highlighted={service.id === highlightedServiceId}
        />
      ))}
    </div>
  );
}

export function AgendaDayPanel({
  selectedDate,
  services,
  allServices,
  teamSize,
  onServiceClick,
  onDelete,
  onCreate,
  onQuickCreate,
  readOnly = false,
  isExecutive = false,
  totalDistanceKm,
  capacity,
  hideServiceList = false,
  highlightedServiceId,
}: AgendaDayPanelProps) {
  const { totalOccupancy, productiveMin, travelMin, idleMin, capacityMin, travelAlert } = capacity;
  const occupancyColor = totalOccupancy > 85 ? "bg-destructive" : totalOccupancy > 60 ? "bg-warning" : "bg-success";

  // Stats
  const stats = useMemo(() => {
    const planned = services.reduce((s, sv) => s + (sv.value || 0), 0);
    const completed = services.filter(s => s.status === "completed").length;
    const scheduled = services.filter(s => getEffectiveStatus(s) === "scheduled").length;
    const overdue = services.filter(s => getEffectiveStatus(s) === "overdue").length;
    const realized = services.filter(s => s.status === "completed").reduce((s, sv) => s + (sv.value || 0), 0);
    return { planned, completed, scheduled, overdue, realized };
  }, [services]);

  // Ticket médio per client
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

  return (
    <div className="rounded-2xl border border-border/50 bg-card shadow-card animate-blur-in">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-border/50">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {format(selectedDate, "d 'de' MMMM", { locale: ptBR })}
          </h2>
          <p className="text-sm text-muted-foreground capitalize">
            {format(selectedDate, "EEEE", { locale: ptBR })}
          </p>
        </div>
        {!readOnly && onQuickCreate ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Novo Serviço
                <ChevronDown className="h-3 w-3 ml-1 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onQuickCreate}>
                <Zap className="h-4 w-4 mr-2" />
                Agendamento Rápido
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onCreate}>
                <ClipboardList className="h-4 w-4 mr-2" />
                Nova OS Completa
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : !readOnly ? (
          <Button size="sm" onClick={onCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Novo Serviço
          </Button>
        ) : null}
      </div>

      {/* Capacity breakdown bar */}
      {capacity.isNonOperational ? (
        <div className="px-5 pt-4">
          <div className="flex items-center gap-2 text-muted-foreground p-3 rounded-xl bg-muted/30">
            <Ban className="h-4 w-4" />
            <span className="text-sm">Dia não operacional — fora da jornada configurada</span>
          </div>
        </div>
      ) : services.length > 0 ? (
        <div className="px-5 pt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>Ocupação total do dia</span>
            <span className="number-display">{totalOccupancy}% de {fmtTime(capacityMin)}</span>
          </div>
          {/* Stacked bar */}
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
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Produtivo {fmtTime(productiveMin)}
            </span>
            <span className="flex items-center gap-1">
              <span className={cn("h-1.5 w-1.5 rounded-full", travelAlert ? "bg-destructive/80" : "bg-warning")} />
              Desloc. {fmtTime(travelMin)}
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/20" />
              Ocioso {fmtTime(idleMin)}
            </span>
          </div>
          {travelAlert && (
            <div className="mt-2 flex items-center gap-1.5 text-2xs text-destructive font-medium animate-pulse">
              <Truck className="h-3 w-3" />
              Deslocamento está consumindo mais de 25% da capacidade do dia
            </div>
          )}
        </div>
      ) : null}

      {/* Summary bar */}
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

      {/* Services list (hidden when day grid already shows them) */}
      {!hideServiceList && (
        <div className="p-5">
          {services.length === 0 ? (
            (() => {
              const hasRealServices = allServices.length > 0;
              return (
                <div className="text-center py-10">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-4">
                    <CalendarCheck className="h-7 w-7 text-primary" />
                  </div>
                  <p className="text-base font-medium text-foreground mb-1">
                    {hasRealServices
                      ? "Você ainda não tem atendimentos hoje"
                      : "Vamos começar sua agenda"}
                  </p>
                  <p className="text-sm text-muted-foreground mb-5">
                    {hasRealServices
                      ? "Que tal agendar o próximo agora?"
                      : "Crie seu primeiro atendimento e comece a organizar sua rotina"}
                  </p>
                  {!readOnly && (
                    <Button size="sm" onClick={onCreate}>
                      <Plus className="h-4 w-4 mr-1.5" />
                      {hasRealServices ? "Criar atendimento" : "Criar primeiro atendimento"}
                    </Button>
                  )}
                </div>
              );
            })()
          ) : (
            <ServiceTimeline
              services={services}
              allServices={allServices}
              ticketMedioMap={ticketMedioMap}
              onServiceClick={onServiceClick}
              onDelete={onDelete}
              readOnly={readOnly}
              highlightedServiceId={highlightedServiceId}
            />
          )}
        </div>
      )}

      {/* Smart alerts (executive mode) */}
      {isExecutive && services.length > 0 && (
        <div className="px-5 pb-5">
          <AgendaSmartAlerts services={services} totalDistanceKm={totalDistanceKm} />
        </div>
      )}

      {/* Footer summary */}
      {services.length > 0 && (
        <div className="mx-5 mb-5 p-4 rounded-xl bg-muted/40">
          <p className="text-xs text-muted-foreground mb-2">
            {services.length} serviço{services.length !== 1 ? "s" : ""} no dia
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
