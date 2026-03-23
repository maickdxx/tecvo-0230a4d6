import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { useTimeClock, type TimeClockEntryType } from "@/hooks/useTimeClock";
import { useWorkSchedules } from "@/hooks/useWorkSchedule";
import { calculateOvertimeMinutes } from "@/lib/timeClockUtils";
import { useAuth } from "@/hooks/useAuth";
import { useServices } from "@/hooks/useServices";
import { supabase } from "@/integrations/supabase/client";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { formatTimeInTz, getTodayInTz, getDatePartInTz, formatLongDateInTz, buildTimestamp } from "@/lib/timezone";
import { SelfieCapture } from "@/components/ponto/SelfieCapture";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Clock,
  LogIn,
  Coffee,
  RotateCcw,
  LogOut,
  MapPin,
  CheckCircle2,
  Timer,
  TrendingUp,
  Edit3,
  Briefcase,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";


const ACTION_CONFIG: Record<TimeClockEntryType, { label: string; icon: typeof LogIn; color: string }> = {
  clock_in: { label: "Registrar Entrada", icon: LogIn, color: "bg-green-500 hover:bg-green-600" },
  break_start: { label: "Iniciar Pausa", icon: Coffee, color: "bg-amber-500 hover:bg-amber-600" },
  break_end: { label: "Registrar Retorno", icon: RotateCcw, color: "bg-blue-500 hover:bg-blue-600" },
  clock_out: { label: "Registrar Saída", icon: LogOut, color: "bg-red-500 hover:bg-red-600" },
};

const STATUS_COLORS: Record<string, string> = {
  "Aguardando entrada": "bg-muted text-muted-foreground",
  "Trabalhando": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  "Em pausa": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  "Jornada encerrada": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

export default function Ponto() {
  const tz = useOrgTimezone();
  const { user, profile } = useAuth();
  const {
    todayEntries,
    effectiveTodayEntries,
    effectiveMonthEntries,
    settings,
    nextAction,
    currentStatus,
    workedMinutes,
    register,
    isRegistering,
    isMonthClosed,
    entryTypeLabels,
  } = useTimeClock();

  const { getScheduleForEmployee } = useWorkSchedules();
  const employeeType = (profile as any)?.employee_type || "tecnico";
  const employeeSchedule = getScheduleForEmployee(user?.id || "", employeeType);

  const isFieldWorker = (profile as any)?.field_worker === true;
  const orgId = (profile as any)?.organization_id;

  // Fetch adjustments for today's entries (pending + approved)
  const todayEntryIds = useMemo(() => todayEntries.map(e => e.id), [todayEntries]);
  const { data: todayAdjustments = [] } = useQuery({
    queryKey: ["time-clock-today-adjustments-ponto", user?.id, todayEntryIds],
    queryFn: async () => {
      if (todayEntryIds.length === 0) return [];
      const { data, error } = await supabase
        .from("time_clock_adjustments")
        .select("entry_id, new_time, status")
        .in("entry_id", todayEntryIds)
        .in("status", ["approved", "pending"]);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && todayEntryIds.length > 0,
  });

  const adjustmentStatusMap = useMemo(() => {
    const map = new Map<string, { status: string; newTime: string | null }>();
    for (const adj of todayAdjustments) {
      const existing = map.get(adj.entry_id);
      if (!existing || adj.status === "approved") {
        map.set(adj.entry_id, { status: adj.status, newTime: adj.new_time });
      }
    }
    return map;
  }, [todayAdjustments]);

  const originalTimeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of todayEntries) map.set(e.id, e.recorded_at);
    return map;
  }, [todayEntries]);

  // Today's services for field workers
  const { services } = useServices(
    user?.id && isFieldWorker ? { assignedTo: user.id } : undefined
  );

  const todayStr = getTodayInTz(tz);

  const todayServices = useMemo(() => {
    if (!services || !isFieldWorker) return [];
    return services
      .filter((s) => s.scheduled_date && getDatePartInTz(s.scheduled_date, tz) === todayStr && s.status !== "cancelled")
      .sort((a, b) => {
        const aTime = a.entry_date || a.scheduled_date || "";
        const bTime = b.entry_date || b.scheduled_date || "";
        return aTime.localeCompare(bTime);
      });
  }, [services, isFieldWorker, todayStr]);

  // Selfie state
  const [selfieOpen, setSelfieOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<TimeClockEntryType | null>(null);
  const photoRequired = (settings as any)?.photo_required === true;

  // Adjustment request dialog
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [adjustEntryId, setAdjustEntryId] = useState<string | null>(null);
  const [adjustTime, setAdjustTime] = useState("");
  const [adjustType, setAdjustType] = useState<string>("clock_in");
  const [adjustReason, setAdjustReason] = useState("");
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);

  const openAdjustDialog = (entryId: string, entryType: string, recordedAt: string) => {
    setAdjustEntryId(entryId);
    setAdjustType(entryType);
    setAdjustTime(formatTimeInTz(recordedAt, tz));
    setAdjustReason("");
    setAdjustDialogOpen(true);
  };

  const submitAdjustment = async () => {
    if (!adjustEntryId || !adjustReason.trim() || !adjustTime || !user || !orgId) return;
    setIsSubmittingAdjust(true);
    try {
      const entry = todayEntries.find((e) => e.id === adjustEntryId);
      const originalTime = entry?.recorded_at || null;
      // Build new_time as ISO from today + adjustTime
      // Block if month is closed
      if (isMonthClosed) {
        throw new Error("O período está fechado. Não é possível solicitar ajustes.");
      }
      const [h, m] = adjustTime.split(":").map(Number);
      // Build date in org timezone and attach proper offset
      const todayDate = getTodayInTz(tz);
      const newTimeISO = buildTimestamp(todayDate, `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`, tz);

      const { error } = await supabase.from("time_clock_adjustments").insert({
        entry_id: adjustEntryId,
        organization_id: orgId,
        adjusted_by: user.id,
        requested_by: user.id,
        adjustment_type: "employee_request",
        original_time: originalTime,
        new_time: newTimeISO,
        reason: `Tipo: ${entryTypeLabels[adjustType as TimeClockEntryType] || adjustType}`,
        request_reason: adjustReason.trim(),
        status: "pending",
      });
      if (error) throw error;
      toast({ title: "Solicitação enviada", description: "Seu ajuste foi enviado para aprovação do gestor." });
      setAdjustDialogOpen(false);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro", description: err.message });
    } finally {
      setIsSubmittingAdjust(false);
    }
  };

  const monthlyOvertime = useMemo(() => {
    const expectedPerDay = employeeSchedule.work_hours_per_day * 60;
    const toleranceMin = settings?.late_tolerance_minutes ?? 10;

    // Use effective month entries (with approved adjustments applied)
    const allEntries = [...effectiveMonthEntries];
    const byDate = new Map<string, typeof allEntries>();
    const seen = new Set<string>();
    for (const e of allEntries) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      const d = e.recorded_at.split("T")[0];
      if (!byDate.has(d)) byDate.set(d, []);
      byDate.get(d)!.push(e);
    }

    let totalOvertime = 0;
    for (const [, entries] of byDate) {
      const sorted = entries.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
      let dayMinutes = 0;
      let clockIn: Date | null = null;
      for (const e of sorted) {
        const t = new Date(e.recorded_at);
        if (e.entry_type === "clock_in" || e.entry_type === "break_end") clockIn = t;
        if ((e.entry_type === "break_start" || e.entry_type === "clock_out") && clockIn) {
          dayMinutes += (t.getTime() - clockIn.getTime()) / 60000;
          clockIn = null;
        }
      }
      const hasClockOut = sorted.some((e) => e.entry_type === "clock_out");
      if (hasClockOut) {
        totalOvertime += calculateOvertimeMinutes(dayMinutes, expectedPerDay, toleranceMin, false);
      }
    }
    return Math.floor(totalOvertime);
  }, [effectiveMonthEntries, employeeSchedule, settings]);

  const overtimeH = Math.floor(monthlyOvertime / 60);
  const overtimeM = monthlyOvertime % 60;

  const firstName = profile?.full_name?.split(" ")[0] || "Funcionário";
  const expectedMinutes = employeeSchedule.work_hours_per_day * 60;
  const progress = Math.min((workedMinutes / expectedMinutes) * 100, 100);
  const workedHours = Math.floor(workedMinutes / 60);
  const workedMins = workedMinutes % 60;

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-foreground">Ponto — {firstName}</h1>
          <p className="text-sm text-muted-foreground">
            {formatLongDateInTz(tz)}
          </p>
        </div>

        {/* Status + Action */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-3">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge className={STATUS_COLORS[currentStatus] || "bg-muted"}>{currentStatus}</Badge>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Trabalhado</p>
                <p className="text-2xl font-bold text-foreground">
                  {workedHours}h{workedMins.toString().padStart(2, "0")}
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progresso da jornada</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {nextAction ? (
              <Button
                onClick={() => {
                  if (photoRequired) {
                    setPendingAction(nextAction);
                    setSelfieOpen(true);
                  } else {
                    register({ entryType: nextAction });
                  }
                }}
                disabled={isRegistering}
                className={`w-full text-white h-14 text-lg font-semibold ${ACTION_CONFIG[nextAction].color}`}
              >
                {(() => { const Icon = ACTION_CONFIG[nextAction].icon; return <Icon className="h-5 w-5 mr-2" />; })()}
                {isRegistering ? "Registrando..." : ACTION_CONFIG[nextAction].label}
              </Button>
            ) : (
              <div className="flex items-center justify-center gap-2 p-4 rounded-lg bg-muted">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="font-medium text-foreground">Jornada concluída!</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Today's entries — show effective (adjusted) times */}
        {effectiveTodayEntries.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Timer className="h-4 w-4 text-primary" />
                Registros de Hoje
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {effectiveTodayEntries.map((entry) => {
                  const adjInfo = adjustmentStatusMap.get(entry.id);
                  const isApproved = adjInfo?.status === "approved";
                  const isPending = adjInfo?.status === "pending";
                  const originalTime = originalTimeMap.get(entry.id);
                  const wasAdjusted = isApproved && originalTime && originalTime !== entry.recorded_at;

                  return (
                    <div key={entry.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isApproved ? "bg-green-500" : isPending ? "bg-amber-500" : "bg-primary"}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{entryTypeLabels[entry.entry_type]}</span>
                            <span className="text-sm text-foreground font-mono">
                              {formatTimeInTz(entry.recorded_at, tz)}
                            </span>
                            {isApproved && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-500/50 text-green-600 dark:text-green-400">
                                Ajustado
                              </Badge>
                            )}
                            {isPending && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/50 text-amber-600 dark:text-amber-400">
                                Pendente
                              </Badge>
                            )}
                          </div>
                          {wasAdjusted && originalTime && (
                            <p className="text-[11px] text-muted-foreground line-through">
                              Original: {formatTimeInTz(originalTime, tz)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {entry.latitude && <MapPin className="h-3 w-3 text-muted-foreground" />}
                        {!isPending && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs text-muted-foreground hover:text-primary"
                            onClick={() => openAdjustDialog(entry.id, entry.entry_type, originalTime || entry.recorded_at)}
                          >
                            <Edit3 className="h-3.5 w-3.5 mr-1" />
                            {isApproved ? "Novo Ajuste" : "Ajuste"}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Monthly overtime card */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-3">
                <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Horas extras este mês</p>
                <p className="text-xl font-bold text-foreground">
                  {monthlyOvertime > 0 ? `+${overtimeH}h${overtimeM.toString().padStart(2, "0")}` : "0h00"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Today's services for field workers */}
        {isFieldWorker && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" />
                Serviços de Hoje
              </CardTitle>
            </CardHeader>
            <CardContent>
              {todayServices.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">Nenhum serviço agendado para hoje</p>
              ) : (
                <div className="space-y-3">
                  {todayServices.map((svc) => {
                    const ref = svc.entry_date || svc.scheduled_date || "";
                    const timeStr = ref ? formatTimeInTz(ref, tz) : null;
                    const showTime = timeStr && timeStr !== "00:00" ? timeStr : null;

                    return (
                      <div key={svc.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                        <div className="text-sm font-mono font-medium text-primary min-w-[3rem]">
                          {showTime || "—"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {svc.description || svc.service_type}
                          </p>
                          {svc.client && (
                            <p className="text-xs text-muted-foreground truncate">
                              Cliente: {(svc.client as any).name || "—"}
                            </p>
                          )}
                          <Badge variant="secondary" className="mt-1 text-xs">
                            {svc.status === "completed" ? "Concluído" : svc.status === "in_progress" ? "Em andamento" : "Agendado"}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Adjustment Request Dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Solicitar Ajuste de Ponto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Tipo de registro</label>
              <Select value={adjustType} onValueChange={setAdjustType}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clock_in">Entrada</SelectItem>
                  <SelectItem value="break_start">Início de Pausa</SelectItem>
                  <SelectItem value="break_end">Retorno de Pausa</SelectItem>
                  <SelectItem value="clock_out">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Horário correto</label>
              <Input type="time" value={adjustTime} onChange={(e) => setAdjustTime(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Justificativa</label>
              <Textarea
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Descreva o motivo do ajuste..."
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAdjustDialogOpen(false)}>Cancelar</Button>
            <Button onClick={submitAdjustment} disabled={isSubmittingAdjust || !adjustReason.trim()}>
              {isSubmittingAdjust ? "Enviando..." : "Enviar Solicitação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Selfie Capture */}
      <SelfieCapture
        open={selfieOpen}
        onCapture={(blob) => {
          setSelfieOpen(false);
          if (pendingAction) {
            register({ entryType: pendingAction, photoBlob: blob });
            setPendingAction(null);
          }
        }}
        onCancel={() => {
          setSelfieOpen(false);
          setPendingAction(null);
        }}
      />
    </AppLayout>
  );
}
