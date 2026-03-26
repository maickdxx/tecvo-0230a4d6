import { useState, useMemo } from "react";
import { addDays, format } from "date-fns";
import { AppLayout } from "@/components/layout";
import { DemoContextTip } from "@/components/demo/DemoContextTip";
import { useAuth } from "@/hooks/useAuth";
import { useServices } from "@/hooks/useServices";
import { useDistanceBetweenServices } from "@/hooks/useDistanceBetweenServices";
import { useServiceSignatures } from "@/hooks/useServiceSignatures";
import { useOrganization } from "@/hooks/useOrganization";
import { useServiceExecution } from "@/hooks/useServiceExecution";
import { ServiceDetailsDialog } from "@/components/services/ServiceDetailsDialog";
import { ServiceCompleteDialog } from "@/components/services/ServiceCompleteDialog";
import { TimeClockWidget } from "@/components/ponto/TimeClockWidget";
import { JourneyBalanceCard } from "@/components/ponto/JourneyBalanceCard";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDatePartInTz, getTodayInTz, formatLongDateInTz, getHourInTz, getMinutesInTz } from "@/lib/timezone";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { CalendarDays, AlertCircle } from "lucide-react";
import {
  TimelineCard,
  TimelineConnector,
  TechnicianMetrics,
} from "@/components/meu-dia";
import type { Service, ServiceStatus } from "@/hooks/useServices";
import type { OperationalStatus } from "@/hooks/useServiceExecution";

type MeuDiaTab = "today" | "tomorrow" | "week";

const EMPTY_MESSAGES: Record<MeuDiaTab, string> = {
  today: "Nenhum serviço agendado para hoje",
  tomorrow: "Nenhum serviço agendado para amanhã",
  week: "Nenhum serviço agendado para esta semana",
};

function openRoute(service: Service) {
  const addr = [
    service.service_street, service.service_number,
    service.service_neighborhood, service.service_city, service.service_state,
  ].filter(Boolean).join(", ");
  if (addr) window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`, "_blank");
}

export default function MeuDia() {
  const { user, profile } = useAuth();
  const { services, updateStatus } = useServices(
    user?.id ? { assignedTo: user.id } : undefined
  );
  const { startTravel, startAttendance, updateOperationalStatus } = useServiceExecution();
  const tz = useOrgTimezone();

  const [tab, setTab] = useState<MeuDiaTab>("today");
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [completingService, setCompletingService] = useState<Service | null>(null);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);

  const { createSignature } = useServiceSignatures(completingService?.id);
  const { organization } = useOrganization();
  const requireClientSignature = organization?.require_client_signature ?? false;
  const timeClockEnabled = (organization as any)?.time_clock_enabled === true;

  const todayStr = getTodayInTz(tz);
  const tomorrowStr = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const weekEndStr = format(addDays(new Date(), 6), "yyyy-MM-dd");

  const baseFiltered = useMemo(() => {
    if (!services) return [];
    return services.filter((s) => {
      if (!s.scheduled_date || s.status === "cancelled") return false;
      return s.assigned_to === user?.id;
    });
  }, [services, user?.id]);

  const todayServices = useMemo(() => {
    return baseFiltered.filter((s) => s.scheduled_date && getDatePartInTz(s.scheduled_date, tz) === todayStr);
  }, [baseFiltered, todayStr, tz]);

  const countToday = useMemo(() => baseFiltered.filter(s => getDatePartInTz(s.scheduled_date!, tz) === todayStr).length, [baseFiltered, todayStr, tz]);
  const countTomorrow = useMemo(() => baseFiltered.filter(s => getDatePartInTz(s.scheduled_date!, tz) === tomorrowStr).length, [baseFiltered, tomorrowStr, tz]);
  const countWeek = useMemo(() => baseFiltered.filter(s => {
    const d = getDatePartInTz(s.scheduled_date!, tz);
    return d >= todayStr && d <= weekEndStr;
  }).length, [baseFiltered, todayStr, weekEndStr, tz]);

  const filteredServices = useMemo(() => {
    return baseFiltered
      .filter((s) => {
        const d = getDatePartInTz(s.scheduled_date!, tz);
        if (tab === "today") return d === todayStr;
        if (tab === "tomorrow") return d === tomorrowStr;
        return d >= todayStr && d <= weekEndStr;
      })
      .sort((a, b) => {
        if (a.status === "completed" && b.status !== "completed") return 1;
        if (b.status === "completed" && a.status !== "completed") return -1;
        if (a.status === "in_progress" && b.status !== "in_progress") return -1;
        if (b.status === "in_progress" && a.status !== "in_progress") return 1;
        const aOp = (a as any).operational_status;
        const bOp = (b as any).operational_status;
        if (aOp === "en_route" && bOp !== "en_route") return -1;
        if (bOp === "en_route" && aOp !== "en_route") return 1;
        const getMinutes = (s: typeof a) => {
          const ref = s.entry_date || s.scheduled_date || "";
          if (!ref) return 0;
          return getHourInTz(ref, tz) * 60 + getMinutesInTz(ref, tz);
        };
        return getMinutes(a) - getMinutes(b);
      });
  }, [baseFiltered, tab, todayStr, tomorrowStr, weekEndStr, tz]);

  const currentOpenService = useMemo(() => {
    return filteredServices.find(s => s.status === "in_progress" || (s as any).operational_status === "en_route");
  }, [filteredServices]);

  // Find next actionable service (first non-completed)
  const nextServiceId = useMemo(() => {
    if (tab !== "today") return null;
    const next = filteredServices.find((s) => s.status !== "completed");
    return next?.id ?? null;
  }, [filteredServices, tab]);

  const techMetrics = useMemo(() => {
    const svcs = todayServices;
    const completed = svcs.filter((s) => s.status === "completed");

    let avgServiceTime = 0;
    const withTime = completed.filter((s) => (s as any).attendance_started_at && s.completed_date);
    if (withTime.length > 0) {
      const total = withTime.reduce((sum, s) => {
        const start = new Date((s as any).attendance_started_at).getTime();
        const end = new Date(s.completed_date!).getTime();
        return sum + (end - start) / 60000;
      }, 0);
      avgServiceTime = total / withTime.length;
    }

    let totalTravelTime = 0;
    svcs.filter((s) => (s as any).travel_started_at).forEach((s) => {
      const travelStart = new Date((s as any).travel_started_at).getTime();
      const travelEnd = (s as any).attendance_started_at
        ? new Date((s as any).attendance_started_at).getTime()
        : Date.now();
      totalTravelTime += (travelEnd - travelStart) / 60000;
    });

    const revenue = svcs.reduce((sum, s) => sum + (s.value || 0), 0);

    return {
      totalServices: svcs.length,
      completedCount: completed.length,
      avgServiceTime,
      totalTravelTime,
      revenue,
    };
  }, [todayServices]);

  const servicesForDistance = tab === "today" ? filteredServices : [];
  const { distances } = useDistanceBetweenServices(servicesForDistance);

  const handleStatusChange = async (
    serviceId: string,
    status: ServiceStatus,
    paymentMethod?: string,
    payments?: Array<{ payment_method: string; amount: number; financial_account_id: string }>
  ) => {
    await updateStatus({ id: serviceId, status, paymentMethod, payments });
  };

  const handleComplete = (service: Service) => {
    if (!service.value && !requireClientSignature) {
      handleStatusChange(service.id, "completed", undefined, []);
    } else {
      setCompletingService(service);
      setCompleteDialogOpen(true);
    }
  };

  const handleOperationalStatusChange = async (serviceId: string, status: OperationalStatus) => {
    await updateOperationalStatus({ serviceId, status });
  };

  const firstName = profile?.full_name?.split(" ")[0] || "Técnico";

  return (
    <AppLayout>
      <DemoContextTip route="/meu-dia" />
      <div className="space-y-4">
        {/* Header */}
        <div data-tour="meu-dia-header">
          <h1 className="text-xl font-bold text-foreground">
            Meu Dia — {firstName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {formatLongDateInTz(tz)}
          </p>
        </div>

        {/* Time Clock Widget */}
        {timeClockEnabled && (
          <div className="space-y-3">
            <TimeClockWidget compact />
            <JourneyBalanceCard />
          </div>
        )}

        {/* Operational Alert for pending completion */}
        {currentOpenService && (
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                  Atendimento em aberto (OS #{currentOpenService.quote_number})
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Finalize este serviço para liberar integralmente as informações do próximo.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Progress + Metrics */}
        <TechnicianMetrics {...techMetrics} />

        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as MeuDiaTab)}>
          <TabsList className="w-full">
            <TabsTrigger value="today" className="flex-1">
              Hoje ({countToday})
            </TabsTrigger>
            <TabsTrigger value="tomorrow" className="flex-1">
              Amanhã ({countTomorrow})
            </TabsTrigger>
            <TabsTrigger value="week" className="flex-1">
              Semana ({countWeek})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Timeline */}
        {filteredServices.length > 0 ? (
          <div className="space-y-0">
            {filteredServices.map((service, index) => {
              const nextSvc = tab === "today" && index < filteredServices.length - 1
                ? filteredServices[index + 1]
                : null;
              const distInfo = nextSvc
                ? distances.get(`${service.id}->${nextSvc.id}`)
                : null;

              return (
                <div key={service.id}>
                  <TimelineCard
                    service={service as any}
                    showDate={tab === "week"}
                    isEmployee={true}
                    isNext={service.id === nextServiceId}
                    isLocked={!!currentOpenService && currentOpenService.id !== service.id && service.status !== "completed"}
                    onStartTravel={startTravel}
                    onStartAttendance={startAttendance}
                    onComplete={handleComplete}
                    onOpenRoute={openRoute}
                    onOpenDetails={(s) => {
                      setSelectedService(s);
                      setDetailsOpen(true);
                    }}
                    onChangeStatus={handleOperationalStatusChange}
                  />
                  {nextSvc && tab === "today" && (
                    <TimelineConnector
                      distanceKm={distInfo?.distanceKm}
                      timeMin={distInfo?.timeMin}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <CalendarDays className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground">{EMPTY_MESSAGES[tab]}</p>
            </CardContent>
          </Card>
        )}
      </div>

      <ServiceDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        service={selectedService}
      />

      {completingService && (
        <ServiceCompleteDialog
          open={completeDialogOpen}
          onOpenChange={setCompleteDialogOpen}
          serviceValue={completingService.value || 0}
          onConfirm={async (payments, signatureBlob, signerName) => {
            await handleStatusChange(completingService.id, "completed", undefined, payments);
            if (signatureBlob) {
              await createSignature({ serviceId: completingService.id, blob: signatureBlob, signerName });
            }
            setCompletingService(null);
          }}
        />
      )}
    </AppLayout>
  );
}
