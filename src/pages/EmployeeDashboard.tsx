import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout";
import { useAuth } from "@/hooks/useAuth";
import { useServices, SERVICE_TYPE_LABELS, SERVICE_STATUS_LABELS } from "@/hooks/useServices";
import { useDistanceBetweenServices } from "@/hooks/useDistanceBetweenServices";
import { useServiceSignatures } from "@/hooks/useServiceSignatures";
import { ServiceCompleteDialog } from "@/components/services/ServiceCompleteDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, ClipboardList, Play, ArrowRight, CheckCircle2, Car, Lock, AlertCircle } from "lucide-react";
import { formatTimeInTz, formatDateInTz, getDatePartInTz, getTodayInTz, formatLongDateInTz, getHourInTz, getMinutesInTz } from "@/lib/timezone";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import type { ServicePaymentInput } from "@/hooks/useServicePayments";

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { services, updateStatus } = useServices({ assignedTo: user?.id });
  const tz = useOrgTimezone();

  const [completingService, setCompletingService] = useState<{ id: string; value: number | null } | null>(null);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);

  const { createSignature } = useServiceSignatures(completingService?.id);

  const todayStr = getTodayInTz(tz);

  const todayServices = useMemo(() => {
    if (!services) return [];
    return services.filter(s => {
      if (!s.scheduled_date || s.status === "cancelled") return false;
      return getDatePartInTz(s.scheduled_date, tz) === todayStr;
    }).sort((a, b) => {
      // In progress always on top
      if (a.status === "in_progress" && b.status !== "in_progress") return -1;
      if (b.status === "in_progress" && a.status !== "in_progress") return 1;
      // Sort by local hour/minute extracted from entry_date or scheduled_date
      const getMinutes = (s: typeof a) => {
        const ref = s.entry_date || s.scheduled_date || "";
        if (!ref) return 0;
        return getHourInTz(ref, tz) * 60 + getMinutesInTz(ref, tz);
      };
      return getMinutes(a) - getMinutes(b);
    });
  }, [services]);

  const completedToday = todayServices.filter(s => s.status === "completed").length;
  const pendingToday = todayServices.filter(s => s.status !== "completed" && s.status !== "cancelled").length;
  const { distances } = useDistanceBetweenServices(todayServices);

  const currentOpenService = useMemo(() => {
    return todayServices.find(s => s.status === "in_progress");
  }, [todayServices]);

  const nextService = useMemo(() => {
    return todayServices.find(s => s.status === "scheduled" || s.status === "in_progress");
  }, [todayServices]);

  const isNextLocked = !!currentOpenService && nextService && currentOpenService.id !== nextService.id;

  const handleStartService = (id: string) => {
    updateStatus({ id, status: "in_progress" });
  };

  const firstName = profile?.full_name?.split(" ")[0] || "Técnico";

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Olá, {firstName} 👋</h1>
          <p className="text-muted-foreground mt-1">
            {formatLongDateInTz(tz)}
          </p>
        </div>

        {/* Day Summary */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{todayServices.length}</p>
                <p className="text-xs text-muted-foreground">Serviços hoje</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{completedToday}</p>
                <p className="text-xs text-muted-foreground">Concluídos</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Next Service */}
        {nextService && (
          <Card className="border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Próximo Serviço
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="font-medium text-foreground">{nextService.client?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {SERVICE_TYPE_LABELS[nextService.service_type]}
                  </p>
                  {(() => {
                    const timeSource = nextService.entry_date || "";
                    const timeStr = formatTimeInTz(timeSource, tz);
                    const exitStr = nextService.exit_date ? formatTimeInTz(nextService.exit_date, tz) : "";
                    const showTime = timeStr && timeStr !== "—" && timeStr !== "00:00";
                    const dateDisplay = nextService.scheduled_date ? formatDateInTz(nextService.scheduled_date, tz) : "";
                    if (!showTime && !dateDisplay) return null;
                    return (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {dateDisplay && dateDisplay !== "—" && dateDisplay}
                        {showTime && ` · ${timeStr}`}
                        {showTime && exitStr && exitStr !== "—" && exitStr !== "00:00" && ` às ${exitStr}`}
                      </p>
                    );
                  })()}
                </div>
                <Badge variant={nextService.status === "in_progress" ? "default" : "secondary"}>
                  {SERVICE_STATUS_LABELS[nextService.status]}
                </Badge>
              </div>
              {nextService.status === "scheduled" && (
                <Button 
                  className="w-full" 
                  onClick={() => handleStartService(nextService.id)}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Iniciar Serviço
                </Button>
              )}
              {nextService.status === "in_progress" && (
                <Button 
                  className="w-full" 
                  onClick={() => {
                    if (!nextService.value) {
                      updateStatus({ id: nextService.id, status: "completed", payments: [] });
                    } else {
                      setCompletingService({ id: nextService.id, value: nextService.value });
                      setCompleteDialogOpen(true);
                    }
                  }}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Concluir Serviço
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Today's Services List */}
        {todayServices.length > 0 ? (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Serviços de Hoje</h2>
            {todayServices.map((service, index) => {
              const nextSvc = index < todayServices.length - 1 ? todayServices[index + 1] : null;
              const distInfo = nextSvc ? distances.get(`${service.id}->${nextSvc.id}`) : null;
              return (
                <div key={service.id}>
                  <Card className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 min-w-0 flex-1">
                          <p className="font-medium text-foreground truncate">{service.client?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {SERVICE_TYPE_LABELS[service.service_type]}
                          </p>
                          {(() => {
                            const timeSource = service.entry_date || "";
                            const timeStr = formatTimeInTz(timeSource, tz);
                            const exitStr = service.exit_date ? formatTimeInTz(service.exit_date, tz) : "";
                            const showTime = timeStr && timeStr !== "—" && timeStr !== "00:00";
                            if (!showTime) return null;
                            return (
                              <p className="text-xs text-muted-foreground">
                                {timeStr}
                                {exitStr && exitStr !== "—" && exitStr !== "00:00" && ` às ${exitStr}`}
                              </p>
                            );
                          })()}
                        </div>
                        <Badge 
                          variant={
                            service.status === "completed" ? "default" : 
                            service.status === "in_progress" ? "secondary" : "outline"
                          }
                        >
                          {SERVICE_STATUS_LABELS[service.status]}
                        </Badge>
                      </div>
                      {service.status === "in_progress" && (
                        <Button 
                          size="sm"
                          className="w-full mt-3" 
                          onClick={() => {
                            if (!service.value) {
                              updateStatus({ id: service.id, status: "completed", payments: [] });
                            } else {
                              setCompletingService({ id: service.id, value: service.value });
                              setCompleteDialogOpen(true);
                            }
                          }}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Concluir
                        </Button>
                      )}
                      {service.status === "scheduled" && (
                        <Button 
                          size="sm"
                          className="w-full mt-3" 
                          onClick={() => handleStartService(service.id)}
                        >
                          <Play className="h-3.5 w-3.5 mr-1" />
                          Iniciar
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                  {distInfo && (
                    <div className="flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground">
                      <Car className="h-3.5 w-3.5" />
                      <span>{distInfo.distanceKm} km • ~{distInfo.timeMin} min</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <CalendarDays className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhum serviço agendado para hoje</p>
            </CardContent>
          </Card>
        )}

        {/* Quick Action */}
        <Button 
          variant="outline" 
          className="w-full" 
          onClick={() => navigate("/meus-servicos")}
        >
          Ver todos meus serviços
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>

      {/* Complete Service Dialog */}
      {completingService && (
        <ServiceCompleteDialog
          open={completeDialogOpen}
          onOpenChange={setCompleteDialogOpen}
          serviceValue={completingService.value || 0}
          onConfirm={async (payments, signatureBlob, signerName) => {
            await updateStatus({ id: completingService.id, status: "completed", payments });
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
