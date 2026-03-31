import { formatDateInTz } from "@/lib/timezone";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { Calendar, ClipboardList, DollarSign, FileText, MapPin, MoreVertical, Pencil, Trash2, User, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ServiceStatusBadge } from "./ServiceStatusBadge";
import type { Service, ServiceStatus } from "@/hooks/useServices";
import { useServiceTypes } from "@/hooks/useServiceTypes";

interface ServiceCardProps {
  service: Service;
  onEdit: (service: Service) => void;
  onDelete: (service: Service) => void;
  onStatusChange: (service: Service, status: ServiceStatus) => void;
  onQuote: (service: Service) => void;
  onServiceOrder: (service: Service) => void;
}

export function ServiceCard({ service, onEdit, onDelete, onStatusChange, onQuote, onServiceOrder }: ServiceCardProps) {
  const { typeLabels } = useServiceTypes();
  const tz = useOrgTimezone();
  const formattedDate = service.scheduled_date
    ? formatDateInTz(service.scheduled_date, tz)
    : null;

  const formattedValue = service.value
    ? new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(service.value)
    : null;

  const hasServiceAddress = service.service_street || service.service_city;

  const formatServiceAddress = () => {
    const parts = [
      service.service_street,
      service.service_number,
      service.service_neighborhood,
      service.service_city,
      service.service_state,
    ].filter(Boolean);
    return parts.join(", ");
  };

  const openInMaps = (e: React.MouseEvent) => {
    e.stopPropagation();
    const address = formatServiceAddress();
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    window.open(url, "_blank");
  };

  const renderMenuItems = (Item: typeof DropdownMenuItem, Separator: typeof DropdownMenuSeparator) => (
    <>
      <Item onClick={() => onQuote(service)}>
        <FileText className="mr-2 h-4 w-4" />
        Gerar Orçamento
      </Item>
      <Item onClick={() => onServiceOrder(service)}>
        <ClipboardList className="mr-2 h-4 w-4" />
        Gerar Ordem de Serviço
      </Item>
      <Separator />
      <Item onClick={() => onEdit(service)}>
        <Pencil className="mr-2 h-4 w-4" />
        Editar
      </Item>
      <Separator />
      {service.status !== "scheduled" && (
        <Item onClick={() => onStatusChange(service, "scheduled")}>
          Marcar como Agendado
        </Item>
      )}
      {service.status !== "in_progress" && (
        <Item onClick={() => onStatusChange(service, "in_progress")}>
          Marcar como Em Andamento
        </Item>
      )}
      {service.status !== "completed" && (
        <Item onClick={() => onStatusChange(service, "completed")}>
          Marcar como Concluído
        </Item>
      )}
      {service.status !== "cancelled" && (
        <Item onClick={() => onStatusChange(service, "cancelled")}>
          Cancelar Serviço
        </Item>
      )}
      <Separator />
      <Item
        onClick={() => onDelete(service)}
        className="text-destructive focus:text-destructive"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Excluir
      </Item>
    </>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Card className="transition-all duration-200 hover:shadow-card-hover hover:border-primary/10">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground">
                    OS #{service.quote_number?.toString().padStart(4, "0") ?? "—"}
                  </span>
                  <ServiceStatusBadge status={service.status} />
                  {service.service_type && (
                    <Badge variant="outline" className="text-[10px] font-medium">
                      {typeLabels[service.service_type] || service.service_type}
                    </Badge>
                  )}
                </div>

                {service.client && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{service.client.name}</span>
                  </div>
                )}

                {service.assigned_profile?.full_name && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Wrench className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{service.assigned_profile.full_name}</span>
                  </div>
                )}

                {formattedDate && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    <span>{formattedDate}</span>
                  </div>
                )}

                {formattedValue && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <DollarSign className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-medium">{formattedValue}</span>
                  </div>
                )}

                {hasServiceAddress && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground min-w-0">
                    <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span className="flex-1 min-w-0 whitespace-normal break-words">
                      {formatServiceAddress()}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={openInMaps}
                      title="Abrir no mapa"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {renderMenuItems(DropdownMenuItem, DropdownMenuSeparator)}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {service.description && (
              <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                {service.description}
              </p>
            )}
          </CardContent>
        </Card>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {renderMenuItems(ContextMenuItem, ContextMenuSeparator)}
      </ContextMenuContent>
    </ContextMenu>
  );
}
