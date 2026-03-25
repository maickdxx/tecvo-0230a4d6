import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout";
import { PageTutorialBanner } from "@/components/onboarding";
import { DemoContextTip } from "@/components/demo/DemoContextTip";
import { Button } from "@/components/ui/button";
import { Plus, ChevronLeft, ChevronRight, Eye, Settings2, Zap, ClipboardList, ChevronDown } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  format,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  isSameDay,
  isSameWeek,
  isSameMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { startOfWeek, endOfWeek } from "date-fns";
import { useServices, type Service, type ServiceFormData, type ServiceStatus } from "@/hooks/useServices";
import { useClients } from "@/hooks/useClients";
import { useSubscription } from "@/hooks/useSubscription";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { ServiceDialog } from "@/components/services";
import { ServiceDetailsDialog } from "@/components/services/ServiceDetailsDialog";
import { QuickScheduleDialog } from "@/components/agenda/QuickScheduleDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UpgradeModal } from "@/components/subscription";
import { CalendarView, type ViewMode } from "@/components/agenda/CalendarView";
import { AgendaInsightsBar } from "@/components/agenda/AgendaInsightsBar";
import { AgendaDayPanel } from "@/components/agenda/AgendaDayPanel";
import { AgendaPeriodPanel } from "@/components/agenda/AgendaPeriodPanel";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isSameDayInTz, getDatePartInTz, getHourInTz, getMinutesInTz, buildTimestamp } from "@/lib/timezone";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { useDistanceBetweenServices } from "@/hooks/useDistanceBetweenServices";
import { useOperationalCapacity, type OperationalCapacity } from "@/hooks/useOperationalCapacity";
import { useActivityTracker } from "@/hooks/useActivityTracker";
import { useOperationalCapacityConfig } from "@/hooks/useOperationalCapacityConfig";
import { OperationalCapacityModal } from "@/components/agenda/OperationalCapacityModal";
import { FullscreenLayout } from "@/components/layout/FullscreenLayout";
import { startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { Maximize2 } from "lucide-react";

type AgendaMode = "executivo" | "operacional";

export default function Agenda({ fullscreen = false }: { fullscreen?: boolean }) {
  const tz = useOrgTimezone();
  const { user } = useAuth();
  const { isEmployee, isAdmin, isOwner } = useUserRole();
  const { members } = useTeamMembers();
  const canSelectEmployee = isAdmin || isOwner;
  const { trackEvent } = useActivityTracker();
  const trackedRef = useRef(false);
  useEffect(() => { if (!trackedRef.current) { trackedRef.current = true; trackEvent("agenda_viewed"); } }, []);

  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [agendaMode, setAgendaMode] = useState<AgendaMode>("operacional");
  const [highlightedServiceId, setHighlightedServiceId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const checklistHandled = useRef(false);

  useEffect(() => {
    if (selectedFilter === null && canSelectEmployee) {
      setSelectedFilter("todos");
    }
  }, [canSelectEmployee, selectedFilter]);

  const activeFilter = isEmployee ? "fixed" : (selectedFilter ?? "todos");
  const assignedTo = activeFilter === "fixed" || activeFilter === "meus"
    ? user?.id
    : activeFilter === "todos"
    ? undefined
    : activeFilter;

  const { services, isLoading: isLoadingServices, create, update, remove, isCreating, isUpdating, isDeleting } = useServices({ assignedTo });
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const { clients } = useClients();
  const { canCreateService, servicesUsed, refetch: refetchSubscription } = useSubscription();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [monthDaySelected, setMonthDaySelected] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [quickDialogOpen, setQuickDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Scheduled services
  const scheduledServices = useMemo(() => {
    return services.filter(s => s.scheduled_date && s.status !== "cancelled");
  }, [services]);

  // Activation: highlight newest service when coming from checklist
  useEffect(() => {
    if (checklistHandled.current) return;
    if (searchParams.get("from") !== "checklist") return;
    if (isLoadingServices || scheduledServices.length === 0) return;

    checklistHandled.current = true;

    // Find the most recently created scheduled service
    const newest = [...scheduledServices].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];

    if (newest?.scheduled_date) {
      const serviceDate = new Date(newest.scheduled_date);
      setSelectedDate(serviceDate);
      setCurrentDate(serviceDate);
      setViewMode("day");
      setMonthDaySelected(true);
      setHighlightedServiceId(newest.id);

      toast.success("Perfeito! Seu atendimento já está na agenda.", {
        description: "Agora você pode acompanhar, editar ou criar novos serviços.",
        duration: 4000,
      });

      setTimeout(() => setHighlightedServiceId(null), 3000);
    }

    setSearchParams({}, { replace: true });
  }, [searchParams, isLoadingServices, scheduledServices, setSearchParams]);

  // Services for selected date (used by day panel list + day grid)
  const selectedDateServices = useMemo(() => {
    if (!selectedDate) return [];
    return scheduledServices.filter(s => isSameDayInTz(s.scheduled_date!, selectedDate, tz)).sort((a, b) => {
      if (a.status === "in_progress" && b.status !== "in_progress") return -1;
      if (b.status === "in_progress" && a.status !== "in_progress") return 1;
      const getMinutes = (s: typeof a) => {
        const ref = s.entry_date || s.scheduled_date || "";
        if (!ref) return 9999;
        return getHourInTz(ref, tz) * 60 + getMinutesInTz(ref, tz);
      };
      return getMinutes(a) - getMinutes(b);
    });
  }, [scheduledServices, selectedDate, tz]);

  // Services filtered by the active period (day/week/month)
  // IMPORTANT: week/month always use currentDate (controlled by nav buttons).
  // selectedDate is only relevant for day mode.
  const periodServices = useMemo(() => {
    if (viewMode === "day") {
      return selectedDateServices;
    }
    const refDate = currentDate; // Always use currentDate for week/month
    if (viewMode === "week") {
      const ws = startOfWeek(refDate, { weekStartsOn: 0 });
      const we = endOfWeek(refDate, { weekStartsOn: 0 });
      const startStr = `${ws.getFullYear()}-${String(ws.getMonth() + 1).padStart(2, "0")}-${String(ws.getDate()).padStart(2, "0")}`;
      const endStr = `${we.getFullYear()}-${String(we.getMonth() + 1).padStart(2, "0")}-${String(we.getDate()).padStart(2, "0")}`;
      return scheduledServices.filter(s => {
        const d = getDatePartInTz(s.scheduled_date!, tz);
        return d >= startStr && d <= endStr;
      });
    }
    // month
    const ms = startOfMonth(refDate);
    const me = endOfMonth(refDate);
    const startStr = `${ms.getFullYear()}-${String(ms.getMonth() + 1).padStart(2, "0")}-${String(ms.getDate()).padStart(2, "0")}`;
    const endStr = `${me.getFullYear()}-${String(me.getMonth() + 1).padStart(2, "0")}-${String(me.getDate()).padStart(2, "0")}`;
    return scheduledServices.filter(s => {
      const d = getDatePartInTz(s.scheduled_date!, tz);
      return d >= startStr && d <= endStr;
    });
  }, [scheduledServices, selectedDateServices, viewMode, currentDate, tz]);

  // Distance between day services
  const distanceServices = useMemo(() => {
    return selectedDateServices.map(s => ({
      id: s.id,
      service_street: s.service_street,
      service_number: s.service_number,
      service_city: s.service_city,
      service_state: s.service_state,
    }));
  }, [selectedDateServices]);

  const { distances } = useDistanceBetweenServices(distanceServices);
  const totalDistanceKm = useMemo(() => {
    let total = 0;
    distances.forEach(d => { total += d.distanceKm; });
    return total;
  }, [distances]);

  const { config: capacityConfig, isFetched: configFetched, isConfigured, save: saveConfig, isSaving: isSavingConfig } = useOperationalCapacityConfig();
  const [showCapacityModal, setShowCapacityModal] = useState(false);

  const teamSize = members.length || 1;
  const configOverride = capacityConfig ? {
    totalMinutesPerDay: capacityConfig.total_minutes_per_day,
    activeTeams: capacityConfig.active_teams,
    defaultTravelMinutes: capacityConfig.default_travel_minutes,
    worksSaturday: capacityConfig.works_saturday,
    saturdayMinutes: capacityConfig.saturday_minutes ?? 0,
  } : undefined;

  // Single-day capacity (used by day panel)
  const dayCapacity = useOperationalCapacity(selectedDateServices, teamSize, distances, configOverride, selectedDate, tz);

  // Aggregated capacity for the active period
  const capacity: OperationalCapacity = useMemo(() => {
    if (viewMode === "day") return dayCapacity;

    // For week/month: aggregate stats from periodServices
    const getServiceDurationMin = (s: Service): number => {
      // Use estimated_duration from catalog if available
      if (s.estimated_duration) {
        const [hours, minutes] = s.estimated_duration.split(":").map(Number);
        if (!isNaN(hours) && !isNaN(minutes)) {
          return hours * 60 + minutes;
        }
      }
      
      // Fallback to entry/exit dates if available
      if (s.entry_date && s.exit_date) {
        const startMin = getHourInTz(s.entry_date, tz) * 60 + getMinutesInTz(s.entry_date, tz);
        const endMin = getHourInTz(s.exit_date, tz) * 60 + getMinutesInTz(s.exit_date, tz);
        const dur = endMin - startMin;
        if (dur > 0) return dur;
      }
      return 60; // Default 1 hour
    };

    const productiveMin = periodServices.reduce((sum, s) => sum + getServiceDurationMin(s), 0);
    const predictedRevenue = periodServices.reduce((sum, s) => sum + (s.value || 0), 0);
    const serviceCount = periodServices.length;

    // Calculate total capacity across working days in the period
    const refDate = currentDate; // Always use currentDate for period calculations
    const perTeamMin = configOverride?.totalMinutesPerDay ?? 528;
    const teams = configOverride?.activeTeams ?? Math.max(teamSize, 1);
    const worksSaturday = configOverride?.worksSaturday ?? false;
    const saturdayMin = configOverride?.saturdayMinutes ?? 0;

    let totalCapacityMin = 0;
    let periodStart: Date, periodEnd: Date;
    if (viewMode === "week") {
      periodStart = startOfWeek(refDate, { weekStartsOn: 0 });
      periodEnd = endOfWeek(refDate, { weekStartsOn: 0 });
    } else {
      periodStart = startOfMonth(refDate);
      periodEnd = endOfMonth(refDate);
    }
    const cursor = new Date(periodStart);
    while (cursor <= periodEnd) {
      const dow = cursor.getDay();
      if (dow === 0) { /* Sunday = 0 capacity */ }
      else if (dow === 6) {
        if (worksSaturday && saturdayMin > 0) totalCapacityMin += saturdayMin * teams;
      } else {
        totalCapacityMin += perTeamMin * teams;
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    const capacityMin = totalCapacityMin;
    const defaultTravel = configOverride?.defaultTravelMinutes ?? 30;
    // Rough travel estimate: (services - days_with_services) * defaultTravel
    const daysWithServices = new Set(periodServices.map(s => getDatePartInTz(s.scheduled_date!, tz))).size;
    const travelMin = Math.max(0, (serviceCount - daysWithServices)) * defaultTravel;
    const usedMin = productiveMin + travelMin;
    const idleMin = Math.max(capacityMin - usedMin, 0);
    const productiveOccupancy = capacityMin > 0 ? Math.min(Math.round((productiveMin / capacityMin) * 100), 100) : 0;
    const totalOccupancy = capacityMin > 0 ? Math.min(Math.round((usedMin / capacityMin) * 100), 100) : 0;
    const productiveHours = productiveMin / 60;
    const revenuePerProductiveHour = productiveHours > 0 ? predictedRevenue / productiveHours : 0;
    const travelAlert = capacityMin > 0 && (travelMin / capacityMin) > 0.25;

    return {
      capacityMin,
      productiveMin,
      travelMin,
      idleMin,
      productiveOccupancy,
      totalOccupancy,
      predictedRevenue,
      revenuePerProductiveHour,
      serviceCount,
      travelAlert,
      isNonOperational: false,
    };
  }, [viewMode, dayCapacity, periodServices, currentDate, configOverride, teamSize, tz]);


  // Navigation
  const handlePrevious = () => {
    switch (viewMode) {
      case "month": setCurrentDate(subMonths(currentDate, 1)); setMonthDaySelected(false); break;
      case "week": setCurrentDate(subWeeks(currentDate, 1)); break;
      case "day":
        setCurrentDate(subDays(currentDate, 1));
        setSelectedDate(subDays(currentDate, 1));
        break;
    }
  };
  const handleNext = () => {
    switch (viewMode) {
      case "month": setCurrentDate(addMonths(currentDate, 1)); setMonthDaySelected(false); break;
      case "week": setCurrentDate(addWeeks(currentDate, 1)); break;
      case "day":
        setCurrentDate(addDays(currentDate, 1));
        setSelectedDate(addDays(currentDate, 1));
        break;
    }
  };
  const handleToday = () => { setCurrentDate(new Date()); setSelectedDate(new Date()); setMonthDaySelected(false); };

  const isOnCurrentPeriod = useMemo(() => {
    const now = new Date();
    switch (viewMode) {
      case "day": return isSameDay(currentDate, now);
      case "week": return isSameWeek(currentDate, now, { weekStartsOn: 0 });
      case "month": return isSameMonth(currentDate, now);
    }
  }, [viewMode, currentDate]);

  const todayLabel = viewMode === "month" ? "Mês atual" : viewMode === "week" ? "Semana atual" : "Hoje";

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    if (viewMode === "month") {
      setCurrentDate(date);
      setMonthDaySelected(true);
    }
  };

  const handleServiceClick = (service: Service) => {
    setSelectedService(service);
    setDetailsDialogOpen(true);
  };

  const handleEditFromDetails = () => {
    setDetailsDialogOpen(false);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    if (!canCreateService) { setShowUpgradeModal(true); return; }
    setSelectedService(null);
    setDialogOpen(true);
  };

  const handleQuickCreate = () => {
    if (!canCreateService) { setShowUpgradeModal(true); return; }
    setQuickDialogOpen(true);
  };

  const handleQuickSubmit = async (data: ServiceFormData) => {
    try {
      await create(data);
      refetchSubscription();
    } catch (error) {
      if ((error as Error).message === "LIMIT_REACHED") {
        setQuickDialogOpen(false);
        setShowUpgradeModal(true);
      }
    }
  };

  const handleSubmit = async (data: ServiceFormData) => {
    try {
      if (selectedService) await update({ id: selectedService.id, data });
      else { await create(data); refetchSubscription(); }
    } catch (error) {
      if ((error as Error).message === "LIMIT_REACHED") {
        setDialogOpen(false);
        setShowUpgradeModal(true);
      }
    }
  };

  const handleReschedule = async (serviceId: string, newDate: Date) => {
    const dateStr = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, "0")}-${String(newDate.getDate()).padStart(2, "0")}`;
    const timeStr = `${String(newDate.getHours()).padStart(2, "0")}:${String(newDate.getMinutes()).padStart(2, "0")}:00`;
    await update({ id: serviceId, data: { scheduled_date: buildTimestamp(dateStr, timeStr, tz) } });
  };

  const getTitle = () => {
    switch (viewMode) {
      case "month": return format(currentDate, "MMMM yyyy", { locale: ptBR });
      case "week": {
        const ws = startOfWeek(currentDate, { weekStartsOn: 0 });
        const we = endOfWeek(currentDate, { weekStartsOn: 0 });
        return `${format(ws, "d")} - ${format(we, "d 'de' MMMM", { locale: ptBR })}`;
      }
      case "day": return format(currentDate, "EEEE, d 'de' MMMM", { locale: ptBR });
    }
  };

  const Wrapper = fullscreen ? FullscreenLayout : AppLayout;
  const wrapperProps = fullscreen ? { backTo: "/agenda", title: "Agenda" } : {};

  return (
    <Wrapper {...wrapperProps as any}>
      {!fullscreen && <PageTutorialBanner pageKey="agenda" title="Agenda" message="Aqui nasce seu faturamento. Tudo que você agenda vira previsão de receita e organiza o dia da sua equipe." />}
      {!fullscreen && <DemoContextTip route="/agenda" />}
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div data-tour="agenda-header" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handlePrevious}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleToday} disabled={isOnCurrentPeriod}>{todayLabel}</Button>
              <Button variant="outline" size="icon" onClick={handleNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <h1 className="text-xl font-bold text-foreground capitalize">{getTitle()}</h1>
            {isConfigured && (
              <Button variant="ghost" size="icon" onClick={() => setShowCapacityModal(true)} title="Editar capacidade operacional">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
            {!fullscreen && (
              <Button variant="ghost" size="icon" onClick={() => window.open("/agenda/full", "_blank")} title="Abrir em tela cheia">
                <Maximize2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Agenda mode toggle */}
            <Tabs value={agendaMode} onValueChange={(v) => setAgendaMode(v as AgendaMode)}>
              <TabsList className="h-8">
                <TabsTrigger value="executivo" className="text-xs px-3 h-6">Executivo</TabsTrigger>
                <TabsTrigger value="operacional" className="text-xs px-3 h-6">Operacional</TabsTrigger>
              </TabsList>
            </Tabs>

            <Tabs value={viewMode} onValueChange={(v) => {
              const newMode = v as ViewMode;
              if (newMode === "day" && selectedDate) {
                setCurrentDate(selectedDate);
              }
              setMonthDaySelected(false);
              setViewMode(newMode);
            }}>
              <TabsList>
                <TabsTrigger value="month">Mês</TabsTrigger>
                <TabsTrigger value="week">Semana</TabsTrigger>
                <TabsTrigger value="day">Dia</TabsTrigger>
              </TabsList>
            </Tabs>

            {canSelectEmployee && (
              <Select value={activeFilter} onValueChange={setSelectedFilter}>
                <SelectTrigger className="w-[180px]">
                  <Eye className="h-4 w-4 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="Visualizar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meus">Meus Serviços</SelectItem>
                  <SelectItem value="todos">Todos</SelectItem>
                  {members.map((member) => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      {member.full_name || "Sem nome"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {!isEmployee && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="gap-2" disabled={clients.length === 0}>
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Novo Serviço</span>
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleQuickCreate}>
                    <Zap className="h-4 w-4 mr-2" />
                    Agendamento Rápido
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCreate}>
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Nova OS Completa
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Executive Insights Bar */}
        {agendaMode === "executivo" && selectedDate && (
          <AgendaInsightsBar capacity={capacity} viewMode={viewMode} />
        )}

        {/* Calendar */}
        <CalendarView
          currentDate={currentDate}
          viewMode={viewMode}
          services={scheduledServices}
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
          onServiceClick={handleServiceClick}
          onReschedule={handleReschedule}
          isLoading={isLoadingServices}
          readOnly={isEmployee}
        />

        {/* Inline config prompt — non-intrusive */}
        {configFetched && !isConfigured && !isEmployee && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Settings2 className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-foreground">
                Defina seu horário de funcionamento para melhorar sua organização
              </span>
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowCapacityModal(true)} className="flex-shrink-0">
              Configurar horários
            </Button>
          </div>
        )}

        {/* Day Panel — only in day mode */}
        {viewMode === "day" && selectedDate && (
          <AgendaDayPanel
            selectedDate={selectedDate}
            services={selectedDateServices}
            allServices={services}
            teamSize={teamSize}
            onServiceClick={handleServiceClick}
            onDelete={(id) => setDeleteTargetId(id)}
            onCreate={handleCreate}
            onQuickCreate={handleQuickCreate}
            readOnly={isEmployee}
            isExecutive={agendaMode === "executivo"}
            totalDistanceKm={totalDistanceKm > 0 ? totalDistanceKm : undefined}
            capacity={dayCapacity}
            hideServiceList={false}
            highlightedServiceId={highlightedServiceId}
          />
        )}

        {/* Period Panel — week only shows week services */}
        {viewMode === "week" && (
          <AgendaPeriodPanel
            viewMode="week"
            referenceDate={currentDate}
            services={periodServices}
            allServices={services}
            capacity={capacity}
            onServiceClick={handleServiceClick}
            onDelete={(id) => setDeleteTargetId(id)}
            readOnly={isEmployee}
          />
        )}

        {/* Month mode: if a specific day is clicked, show day panel; otherwise show summary-only period panel */}
        {viewMode === "month" && monthDaySelected && selectedDate && (
          <AgendaDayPanel
            selectedDate={selectedDate}
            services={selectedDateServices}
            allServices={services}
            teamSize={teamSize}
            onServiceClick={handleServiceClick}
            onDelete={(id) => setDeleteTargetId(id)}
            onCreate={handleCreate}
            onQuickCreate={handleQuickCreate}
            readOnly={isEmployee}
            isExecutive={agendaMode === "executivo"}
            totalDistanceKm={totalDistanceKm > 0 ? totalDistanceKm : undefined}
            capacity={dayCapacity}
            hideServiceList={false}
            highlightedServiceId={highlightedServiceId}
          />
        )}

        {viewMode === "month" && !monthDaySelected && (
          <AgendaPeriodPanel
            viewMode="month"
            referenceDate={currentDate}
            services={periodServices}
            allServices={services}
            capacity={capacity}
            onServiceClick={handleServiceClick}
            onDelete={(id) => setDeleteTargetId(id)}
            readOnly={isEmployee}
            hideServiceList
          />
        )}
      </div>

      {!isEmployee && (
        <ServiceDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          service={selectedService}
          clients={clients}
          onSubmit={handleSubmit}
          isSubmitting={isCreating || isUpdating}
          defaultDate={selectedDate}
        />
      )}

      {!isEmployee && (
        <QuickScheduleDialog
          open={quickDialogOpen}
          onOpenChange={setQuickDialogOpen}
          clients={clients}
          onSubmit={handleQuickSubmit}
          isSubmitting={isCreating}
          defaultDate={selectedDate}
        />
      )}

      {selectedService && (
        <ServiceDetailsDialog
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
          service={selectedService}
          onEdit={!isEmployee ? handleEditFromDetails : undefined}
        />
      )}

      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        servicesUsed={servicesUsed}
      />

      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agendamento?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={() => {
                if (deleteTargetId) { remove(deleteTargetId); setDeleteTargetId(null); }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Config modal — only opened manually, never auto */}
      <OperationalCapacityModal
        open={showCapacityModal}
        onOpenChange={setShowCapacityModal}
        config={capacityConfig ?? null}
        onSave={async (data) => { await saveConfig(data); setShowCapacityModal(false); }}
        isSaving={isSavingConfig}
      />
    </Wrapper>
  );
}
