import { useState, useEffect, useMemo } from "react";
import { formatDateInTz, formatTimeInTz } from "@/lib/timezone";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { AppLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, MapPin, Clock, Wrench, User, CalendarDays, Loader2, Eye } from "lucide-react";
import { useServices, SERVICE_STATUS_LABELS, type Service, type ServiceStatus } from "@/hooks/useServices";
import { ServiceDetailsDialog } from "@/components/services/ServiceDetailsDialog";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { isSameDayInTz } from "@/lib/timezone";

export default function MeusServicos() {
  const { user, organizationId } = useAuth();
  const tz = useOrgTimezone();
  const { isAdmin, isOwner, isEmployee } = useUserRole();
  const { members } = useTeamMembers();
  const canSelectEmployee = isAdmin || isOwner;

  // Check if admin has services assigned to them
  const { data: hasOwnServices, isLoading: isCheckingOwn } = useQuery({
    queryKey: ["has-own-services", user?.id, organizationId],
    queryFn: async () => {
      if (!user?.id || !organizationId) return false;
      const { count, error } = await supabase
        .from("services")
        .select("id", { count: "exact", head: true })
        .eq("assigned_to", user.id)
        .is("deleted_at", null)
        .limit(1);
      if (error) return false;
      return (count || 0) > 0;
    },
    enabled: !!user?.id && !!organizationId && canSelectEmployee,
    staleTime: 1000 * 60 * 2,
  });

  // Filter is only ready once the ownership check completes (or isn't needed)
  const filterReady = isEmployee || !canSelectEmployee || !isCheckingOwn;

  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);

  // Set smart default exactly once after the check resolves
  useEffect(() => {
    if (selectedFilter === null && filterReady && canSelectEmployee) {
      setSelectedFilter(hasOwnServices ? "meus" : "todos");
    }
  }, [filterReady, canSelectEmployee, hasOwnServices, selectedFilter]);

  // Derive final filter value
  const activeFilter = isEmployee
    ? "fixed"
    : (selectedFilter ?? (hasOwnServices ? "meus" : "todos"));

  const assignedTo = activeFilter === "fixed"
    ? user?.id
    : activeFilter === "meus"
    ? user?.id
    : activeFilter === "todos"
    ? undefined
    : activeFilter;

  const { services, isLoading: isLoadingServices, updateStatus } = useServices({
    assignedTo,
  });

  // Show loading until filter is resolved to prevent wrong initial query
  const isLoading = !filterReady || isLoadingServices;

  const handleStatusChange = async (serviceId: string, status: ServiceStatus, paymentMethod?: string, payments?: Array<{ payment_method: string; amount: number; financial_account_id: string }>) => {
    await updateStatus({ id: serviceId, status, paymentMethod, payments });
  };

  const [selectedDate, setSelectedDate] = useState<"today" | "tomorrow" | "all">("today");
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const currentOpenService = useMemo(() => {
    return services.find(s => s.status === "in_progress");
  }, [services]);

  const filteredServices = services
    .filter((service) => {
      if (!service.scheduled_date) return selectedDate === "all";
      if (selectedDate === "today") return isSameDayInTz(service.scheduled_date, today, tz);
      if (selectedDate === "tomorrow") return isSameDayInTz(service.scheduled_date, tomorrow, tz);
      return true;
    })
    .sort((a, b) => {
      const timeA = a.entry_date || a.scheduled_date || "";
      const timeB = b.entry_date || b.scheduled_date || "";
      return timeA.localeCompare(timeB);
    });

  const handleServiceClick = (service: Service) => {
    setSelectedService(service);
    setDetailsOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled": return "bg-info/10 text-info border-info/30";
      case "in_progress": return "bg-warning/10 text-warning border-warning/30";
      case "completed": return "bg-success/10 text-success border-success/30";
      case "cancelled": return "bg-destructive/10 text-destructive border-destructive/30";
      default: return "bg-muted text-muted-foreground";
    }
  };

  // Build subtitle
  const getSubtitle = () => {
    if (isEmployee) return "Serviços atribuídos a você";
    if (activeFilter === "meus") return "Serviços atribuídos a você";
    if (activeFilter === "todos") return `${filteredServices.length} serviço${filteredServices.length !== 1 ? "s" : ""}`;
    const member = members.find(m => m.user_id === activeFilter);
    return member ? `Serviços de ${member.full_name || "membro"}` : "Serviços";
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Serviços</h1>
        <p className="text-muted-foreground">{getSubtitle()}</p>
      </div>

      {/* Employee selector for admins */}
      {canSelectEmployee && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Visualizar:</span>
          </div>
          <Select value={activeFilter} onValueChange={setSelectedFilter}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="meus">Meus Serviços</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
              {members.map((member) => (
                <SelectItem key={member.user_id} value={member.user_id}>
                  {member.full_name || "Sem nome"} ({member.role === "employee" ? "Funcionário" : member.role === "admin" ? "Administrador" : member.role === "owner" ? "Proprietário" : "Membro"})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={selectedDate === "today" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedDate("today")}
        >
          <CalendarDays className="h-4 w-4 mr-2" />
          Hoje
        </Button>
        <Button
          variant={selectedDate === "tomorrow" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedDate("tomorrow")}
        >
          Amanhã
        </Button>
        <Button
          variant={selectedDate === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedDate("all")}
        >
          Todos
        </Button>
      </div>

      {filteredServices.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Wrench className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">
              {selectedDate === "today"
                ? "Nenhum serviço para hoje"
                : selectedDate === "tomorrow"
                ? "Nenhum serviço para amanhã"
                : "Nenhum serviço encontrado"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredServices.map((service) => {
            const isLocked = !!currentOpenService && currentOpenService.id !== service.id && service.status !== "completed" && isEmployee;

            return (
              <Card 
                key={service.id} 
                className={`overflow-hidden transition-colors ${isLocked ? "opacity-75 bg-muted/20 grayscale-[0.2]" : "cursor-pointer hover:bg-muted/50"}`}
                onClick={() => !isLocked && handleServiceClick(service)}
              >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-foreground">
                        {isLocked ? (service.client?.name?.split(" ")[0] || "Cliente") : service.client?.name || "Cliente não encontrado"}
                        {isLocked && (
                          <Badge variant="outline" className="ml-2 text-[10px] text-amber-600 border-amber-500/30 gap-1 bg-amber-50 dark:bg-amber-950/20">
                            <Lock className="h-2.5 w-2.5" />
                            Reservado
                          </Badge>
                        )}
                      </span>
                    </div>
                    {service.scheduled_date && (() => {
                      const entryTime = service.entry_date ? formatTimeInTz(service.entry_date, tz) : "";
                      const exitTime = service.exit_date ? formatTimeInTz(service.exit_date, tz) : "";
                      const showEntry = entryTime && entryTime !== "—" && entryTime !== "00:00";
                      const showExit = exitTime && exitTime !== "—" && exitTime !== "00:00";
                      const dateStr = formatDateInTz(service.scheduled_date, tz);
                      return (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          <span>
                            {showEntry ? entryTime : ""}
                            {showEntry && showExit ? ` às ${exitTime}` : ""}
                            {showEntry ? " - " : ""}
                            {dateStr}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                  <Badge className={getStatusColor(service.status)}>
                    {SERVICE_STATUS_LABELS[service.status]}
                  </Badge>
                </div>

                {service.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {service.description}
                  </p>
                )}

                {service.client?.address && (
                  <div className="flex items-start gap-2 mb-4 p-3 bg-muted/50 rounded-lg">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <span className="text-sm">{service.client.address}</span>
                  </div>
                )}

                {service.client?.phone && (
                  <Button
                    asChild
                    variant="outline"
                    className="w-full"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <a href={`tel:${service.client.phone}`}>
                      <Phone className="h-4 w-4 mr-2" />
                      Ligar para {service.client.phone}
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      <ServiceDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        service={selectedService}
        onStatusChange={handleStatusChange}
      />
    </AppLayout>
  );
}
