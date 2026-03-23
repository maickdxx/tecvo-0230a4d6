import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Clock, User, Wrench, HardHat } from "lucide-react";
import { formatTimeInTz } from "@/lib/timezone";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Service, SERVICE_STATUS_LABELS } from "@/hooks/useServices";
import { ServiceStatusBadge } from "@/components/services/ServiceStatusBadge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface AgendaSidebarProps {
  selectedDate: Date | null;
  services: Service[];
  onServiceClick: (service: Service) => void;
  onCreateClick: () => void;
  readOnly?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AgendaSidebar({
  selectedDate,
  services,
  onServiceClick,
  onCreateClick,
  readOnly = false,
  open,
  onOpenChange,
}: AgendaSidebarProps) {
  if (!selectedDate) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-lg font-semibold">
                {format(selectedDate, "d 'de' MMMM", { locale: ptBR })}
              </SheetTitle>
              <p className="text-sm text-muted-foreground capitalize">
                {format(selectedDate, "EEEE", { locale: ptBR })}
              </p>
            </div>
            {!readOnly && (
              <Button size="sm" onClick={onCreateClick}>
                <Plus className="h-4 w-4 mr-1" />
                Novo Serviço
              </Button>
            )}
          </div>
        </SheetHeader>

        {/* Services list */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {services.length === 0 ? (
              <div className="text-center py-8">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                  <Wrench className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Nenhum serviço agendado
                </p>
                {!readOnly && (
                  <Button
                    size="sm"
                    variant="link"
                    onClick={onCreateClick}
                    className="mt-2"
                  >
                    Agendar serviço
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {services.map((service) => (
                  <SidebarServiceCard
                    key={service.id}
                    service={service}
                    onClick={() => onServiceClick(service)}
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Summary */}
        {services.length > 0 && (
          <div className="p-4 border-t border-border">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total de serviços</span>
              <span className="font-medium text-foreground">{services.length}</span>
            </div>
            {services.some((s) => s.value) && (
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-muted-foreground">Valor estimado</span>
                <span className="font-medium text-foreground">
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(
                    services.reduce((sum, s) => sum + (s.value || 0), 0)
                  )}
                </span>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SidebarServiceCard({
  service,
  onClick,
}: {
  service: Service;
  onClick: () => void;
}) {
  const tz = useOrgTimezone();
  const scheduledTime = (service.entry_date || service.scheduled_date)
    ? formatTimeInTz(service.entry_date || service.scheduled_date || "", tz)
    : null;

  return (
    <div
      onClick={onClick}
      className="p-2.5 rounded-lg border border-border bg-background hover:bg-muted/50 cursor-pointer transition-colors"
    >
      {/* Row 1: Client + time | badge + value */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <span className="text-sm font-semibold truncate">
            {service.client?.name}
          </span>
          {scheduledTime && (
            <span className="text-xs text-muted-foreground flex items-center gap-1 flex-shrink-0">
              <Clock className="h-3 w-3" />
              {scheduledTime}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {service.value && (
            <span className="text-sm font-medium text-primary">
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(service.value)}
            </span>
          )}
          <ServiceStatusBadge status={service.status} className="text-[10px] px-1.5 py-0 h-5" />
        </div>
      </div>

      {/* Row 2: Technician */}
      {service.assigned_profile?.full_name && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
          <HardHat className="h-3 w-3" />
          <span className="truncate">{service.assigned_profile.full_name}</span>
        </div>
      )}
    </div>
  );
}
