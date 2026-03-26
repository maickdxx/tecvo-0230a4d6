import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Car,
  Play,
  CheckCircle2,
  Navigation,
  Eye,
  MapPin,
  DollarSign,
  Clock,
  UserCircle,
  Lock,
  AlertCircle,
} from "lucide-react";
import { formatTimeInTz, formatDateInTz } from "@/lib/timezone";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { SERVICE_TYPE_LABELS, type Service } from "@/hooks/useServices";
import { OperationalStatusBadge } from "./OperationalStatusBadge";
import { PriorityBadge } from "./PriorityBadge";
import { StatusActionMenu } from "./StatusActionMenu";
import type { OperationalStatus } from "@/hooks/useServiceExecution";

interface Props {
  service: Service & {
    operational_status?: string | null;
    priority?: string | null;
    travel_started_at?: string | null;
    attendance_started_at?: string | null;
  };
  showDate?: boolean;
  onStartTravel: (id: string) => void;
  onStartAttendance: (id: string) => void;
  onComplete: (service: Service) => void;
  onOpenRoute: (service: Service) => void;
  onOpenDetails: (service: Service) => void;
  onChangeStatus: (serviceId: string, status: OperationalStatus) => void;
  paidAmount?: number;
  isEmployee?: boolean;
  /** Whether this is the next actionable service */
  isNext?: boolean;
  /** Whether information should be restricted (current service is open) */
  isLocked?: boolean;
}

function buildAddress(service: Service): string {
  return [
    service.service_street,
    service.service_number,
    service.service_neighborhood,
    service.service_city,
    service.service_state,
  ]
    .filter(Boolean)
    .join(", ");
}

function calcElapsed(from: string | null | undefined): string | null {
  if (!from) return null;
  const diff = Math.floor((Date.now() - new Date(from).getTime()) / 60000);
  if (diff < 1) return "agora";
  if (diff < 60) return `${diff} min`;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return `${h}h${m > 0 ? `${m}m` : ""}`;
}

function getPaymentLabel(service: Service, paidAmount?: number): { label: string; color: string } {
  const value = service.value || 0;
  if (value <= 0) return { label: "Sem valor", color: "text-muted-foreground" };
  const paid = paidAmount ?? 0;
  if (paid >= value) return { label: "Pago", color: "text-green-600 dark:text-green-400" };
  if (paid > 0) return { label: "Parcial", color: "text-amber-600 dark:text-amber-400" };
  return { label: "Pendente", color: "text-red-600 dark:text-red-400" };
}

export function TimelineCard({
  service,
  showDate,
  onStartTravel,
  onStartAttendance,
  onComplete,
  onOpenRoute,
  onOpenDetails,
  onChangeStatus,
  paidAmount,
  isEmployee: isEmployeeUser,
  isNext,
}: Props) {
  const tz = useOrgTimezone();
  const addr = buildAddress(service);
  const opStatus = (service as any).operational_status as OperationalStatus | null;
  const priority = (service as any).priority as string | null;
  const travelStarted = (service as any).travel_started_at as string | null;
  const attendanceStarted = (service as any).attendance_started_at as string | null;

  const travelElapsed = calcElapsed(travelStarted);
  const attendanceElapsed = calcElapsed(attendanceStarted);

  const payment = getPaymentLabel(service, paidAmount);

  const isCompleted = service.status === "completed";
  const isScheduled = !isCompleted && service.status === "scheduled" && (!opStatus || opStatus === "waiting_client" || opStatus === "waiting_part" || opStatus === "problem");
  const isEnRoute = !isCompleted && opStatus === "en_route";
  const isInAttendance = !isCompleted && (opStatus === "in_attendance" || service.status === "in_progress");

  // Smart card styling based on state
  const getCardStyle = () => {
    if (isCompleted) return "border-l-4 border-l-green-500/60 opacity-60";
    if (isInAttendance) return "border-l-4 border-l-blue-500 ring-1 ring-blue-500/20";
    if (isEnRoute) return "border-l-4 border-l-amber-500 ring-1 ring-amber-500/20";
    if (opStatus === "problem") return "border-l-4 border-l-destructive";
    if (isNext) return "border-l-4 border-l-primary ring-1 ring-primary/20 shadow-md";
    return "border-l-4 border-l-muted-foreground/15";
  };

  // Timeline dot
  const dotColor = isCompleted
    ? "bg-green-500"
    : isInAttendance
    ? "bg-blue-500 animate-pulse"
    : isEnRoute
    ? "bg-amber-500 animate-pulse"
    : isNext
    ? "bg-primary animate-pulse"
    : "bg-muted-foreground/25";

  // Button size for next service
  const actionSize = isNext ? "default" : "sm";

  const entryTimeStr = formatTimeInTz(service.entry_date || service.scheduled_date || "", tz);
  const exitTimeStr = service.exit_date ? formatTimeInTz(service.exit_date, tz) : null;
  const dateStr = showDate && service.scheduled_date ? formatDateInTz(service.scheduled_date, tz) : null;

  return (
    <div className="flex gap-3">
      {/* Timeline indicator */}
      <div className="flex flex-col items-center pt-4">
        <div className={`w-3 h-3 rounded-full shrink-0 ${dotColor}`} />
        <div className="w-px flex-1 bg-border" />
      </div>

      {/* Card */}
      <Card className={`flex-1 mb-1 overflow-hidden transition-all ${getCardStyle()}`}>
        <CardContent className={`space-y-2 ${isCompleted ? "p-3" : "p-4"}`}>
          {/* Next service label */}
          {isNext && !isEnRoute && !isInAttendance && (
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                ▸ Próximo serviço
              </span>
            </div>
          )}

          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className={`font-semibold text-foreground truncate ${isCompleted ? "text-sm" : ""}`}>
                  {service.client?.name}
                </p>
                <PriorityBadge priority={priority} />
              </div>
              <p className="text-sm text-muted-foreground">
                {SERVICE_TYPE_LABELS[service.service_type] || service.service_type}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                {dateStr && dateStr !== "—" && (
                  <span className="capitalize">
                    {dateStr}
                  </span>
                )}
                {entryTimeStr && entryTimeStr !== "—" && (
                  <span className="flex items-center gap-0.5">
                    <Clock className="h-3 w-3" />
                    {entryTimeStr}
                    {exitTimeStr && exitTimeStr !== "—" && ` - ${exitTimeStr}`}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <OperationalStatusBadge status={opStatus} />
              {!isCompleted && (
                <StatusActionMenu onSelect={(s) => onChangeStatus(service.id, s)} />
              )}
            </div>
          </div>

          {/* Technician name (visible for managers) */}
          {!isEmployeeUser && service.assigned_profile?.full_name && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <UserCircle className="h-3 w-3 shrink-0" />
              <span>👷 {service.assigned_profile.full_name}</span>
            </div>
          )}

          {/* Address — always prominent for non-completed */}
          {addr && !isCompleted && (
            <button
              onClick={() => onOpenRoute(service)}
              className="text-xs text-muted-foreground flex items-start gap-1 text-left hover:text-foreground transition-colors"
            >
              <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
              <span className="line-clamp-1">{addr}</span>
            </button>
          )}

          {/* Financial + Time info */}
          <div className="flex items-center gap-3 text-xs flex-wrap">
            {service.value != null && service.value > 0 && (
              <span className="flex items-center gap-1 font-medium">
                <DollarSign className="h-3 w-3 text-muted-foreground" />
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(service.value)}
                <Badge
                  variant="secondary"
                  className={`text-[10px] px-1.5 py-0 h-4 ${
                    payment.label === "Pago"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
                      : payment.label === "Parcial"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
                      : "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
                  }`}
                >
                  {payment.label}
                  {payment.label === "Parcial" && paidAmount != null && (
                    <span className="ml-0.5">
                      ({new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(paidAmount)})
                    </span>
                  )}
                </Badge>
              </span>
            )}
            {travelElapsed && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Car className="h-3 w-3" />
                {travelElapsed}
              </span>
            )}
            {attendanceElapsed && isInAttendance && (
              <span className="flex items-center gap-1 text-muted-foreground">
                🔧 {attendanceElapsed} no local
              </span>
            )}
          </div>

          {/* Action buttons */}
          {!isCompleted && (
            <div className="flex gap-2 flex-wrap pt-1">
              {isScheduled && !isEnRoute && (
                <Button size={actionSize} className={`flex-1 ${isNext ? "h-11 text-base" : ""}`} onClick={() => onStartTravel(service.id)}>
                  <Car className={`mr-1 ${isNext ? "h-4 w-4" : "h-3.5 w-3.5"}`} />
                  Iniciar Deslocamento
                </Button>
              )}
              {isEnRoute && (
                <Button size={actionSize} className={`flex-1 ${isNext ? "h-11 text-base" : ""}`} onClick={() => onStartAttendance(service.id)}>
                  <Play className={`mr-1 ${isNext ? "h-4 w-4" : "h-3.5 w-3.5"}`} />
                  Cheguei / Iniciar
                </Button>
              )}
              {isInAttendance && (
                <Button size={actionSize} className={`flex-1 ${isNext ? "h-11 text-base" : ""}`} onClick={() => onComplete(service)}>
                  <CheckCircle2 className={`mr-1 ${isNext ? "h-4 w-4" : "h-3.5 w-3.5"}`} />
                  Finalizar
                </Button>
              )}
              {addr && (
                <Button variant="outline" size="sm" onClick={() => onOpenRoute(service)}>
                  <Navigation className="h-3.5 w-3.5 mr-1" />
                  Rota
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => onOpenDetails(service)}>
                <Eye className="h-3.5 w-3.5 mr-1" />
                Detalhes
              </Button>
            </div>
          )}

          {/* Completed: minimal actions */}
          {isCompleted && (
            <div className="flex gap-2 pt-1">
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => onOpenDetails(service)}>
                <Eye className="h-3 w-3 mr-1" />
                Ver detalhes
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
