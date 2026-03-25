import { Clock, User, HardHat, Trash2, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTimeInTz } from "@/lib/timezone";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { Service } from "@/hooks/useServices";
import { ServiceStatusBadge } from "@/components/services/ServiceStatusBadge";
import { getEffectiveStatus } from "@/components/agenda/CalendarView";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const SERVICE_TYPE_BORDER_COLORS: Record<string, string> = {
  limpeza: "border-l-green-500",
  instalacao: "border-l-blue-500",
  manutencao: "border-l-amber-500",
  reparo: "border-l-red-500",
  pmoc: "border-l-indigo-500",
  visita: "border-l-sky-500",
  orcamento: "border-l-emerald-500",
  desinstalacao: "border-l-orange-500",
  contratos: "border-l-purple-500",
  outros: "border-l-gray-400",
  // Legacy
  installation: "border-l-blue-500",
  cleaning: "border-l-green-500",
  maintenance: "border-l-amber-500",
  repair: "border-l-red-500",
  maintenance_contract: "border-l-purple-500",
  other: "border-l-gray-400",
};

function getBorderColor(type: string): string {
  return SERVICE_TYPE_BORDER_COLORS[type] || SERVICE_TYPE_BORDER_COLORS.outros;
}

interface AgendaServiceCardProps {
  service: Service;
  onClick: () => void;
  onDelete?: () => void;
  ticketMedio?: number | null;
  readOnly?: boolean;
  highlighted?: boolean;
}

const currencyFormat = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export function AgendaServiceCard({ service, onClick, onDelete, ticketMedio, readOnly, highlighted }: AgendaServiceCardProps) {
  const tz = useOrgTimezone();

  const rawTime = service.entry_date || service.scheduled_date || "";
  const scheduledTime = rawTime ? formatTimeInTz(rawTime, tz) : null;
  const displayTime = scheduledTime && scheduledTime !== "—" ? scheduledTime : null;

  return (
    <div
      onClick={onClick}
      className={cn(
        "p-3 rounded-xl border-l-4 bg-card hover:shadow-card-hover cursor-pointer transition-all duration-300 hover:-translate-y-0.5 animate-blur-in border border-border/50",
        getBorderColor(service.service_type),
        highlighted && "ring-2 ring-primary/50 shadow-[0_0_12px_hsl(var(--primary)/0.2)] animate-fade-in"
      )}
    >
      {/* Row 1 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <span className="text-sm font-semibold truncate">{service.client?.name}</span>
          {displayTime && (
            <span className="text-xs text-muted-foreground flex items-center gap-1 flex-shrink-0">
              <Clock className="h-3 w-3" />
              {displayTime}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {service.value != null && service.value > 0 && (
            <span className="text-sm font-medium text-primary number-display">
              {currencyFormat(service.value)}
            </span>
          )}
          <ServiceStatusBadge status={getEffectiveStatus(service, tz)} className="text-[10px] px-1.5 py-0 h-5" />
          {!readOnly && onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Row 2: Tech + ticket medio */}
      <div className="flex items-center justify-between mt-1">
        {service.assigned_profile?.full_name && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <HardHat className="h-3 w-3" />
            <span className="truncate">{service.assigned_profile.full_name}</span>
          </div>
        )}
        {ticketMedio != null && ticketMedio > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">
                  <TrendingUp className="h-2.5 w-2.5" />
                  {currencyFormat(ticketMedio)}
                </span>
              </TooltipTrigger>
              <TooltipContent>Ticket médio deste cliente</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}
