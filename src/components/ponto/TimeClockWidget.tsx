import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTimeClock, type TimeClockEntryType } from "@/hooks/useTimeClock";
import { useWorkSchedules } from "@/hooks/useWorkSchedule";
import { calculateOvertimeMinutes, resolveHourlyRate, calculateEstimatedOvertimeCost, calculateOvertimeBreakdown, getOvertimeRateConfig } from "@/lib/timeClockUtils";
import { useAuth } from "@/hooks/useAuth";
import { useProfileSensitiveData } from "@/hooks/useProfileSensitiveData";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { formatTimeInTz, getTodayInTz, buildTimestamp, getDatePartInTz } from "@/lib/timezone";
import { supabase } from "@/integrations/supabase/client";
import { SelfieCapture } from "@/components/ponto/SelfieCapture";
import { PontoRecommendations } from "@/components/ponto/PontoRecommendations";
import { PontoWeeklyInsights } from "@/components/ponto/PontoWeeklyInsights";
import { PontoImpactSummary } from "@/components/ponto/PontoImpactSummary";
import { useWeeklyInsights } from "@/hooks/useWeeklyInsights";
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

interface TimeClockWidgetProps {
  /** Compact mode for embedding in other pages */
  compact?: boolean;
}

export function TimeClockWidget({ compact = false }: TimeClockWidgetProps) {
  const tz = useOrgTimezone();
  const { user, profile } = useAuth();
  const { sensitiveData } = useProfileSensitiveData();
  const {
    todayEntries,
    effectiveTodayEntries,
    effectiveMonthEntries,
    recentEntries,
    settings,
    nextAction,
    currentStatus,
    workedMinutes,
    register,
    isRegistering,
    isMonthClosed,
    entryTypeLabels,
  } = useTimeClock();

  const { getScheduleForEmployee, isWorkDay } = useWorkSchedules();
  const employeeType = profile?.employee_type || "tecnico";
  const employeeSchedule = getScheduleForEmployee(user?.id || "", employeeType);
  const orgId = profile?.organization_id;

  // Resolve effective hourly rate: profile > schedule > settings default
  const effectiveHourlyRate = resolveHourlyRate(
    sensitiveData?.hourly_rate,
    employeeSchedule.hourly_rate,
    (settings as any)?.default_hourly_rate,
  );

  const { insights: weeklyInsights, impact: weeklyImpact } = useWeeklyInsights({
    recentEntries,
    expectedClockIn: employeeSchedule.expected_clock_in,
    expectedMinutes: employeeSchedule.work_hours_per_day * 60,
    toleranceMinutes: settings?.late_tolerance_minutes ?? 10,
    tz,
    hourlyRate: effectiveHourlyRate,
  });

  // Fetch all adjustments (pending + approved) for today's entries to show indicators
  const todayEntryIds = useMemo(() => todayEntries.map(e => e.id), [todayEntries]);
  const { data: todayAdjustments = [] } = useQuery({
    queryKey: ["time-clock-today-adjustments", user?.id, todayEntryIds],
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

  // Build lookup maps for adjustment status per entry
  const adjustmentStatusMap = useMemo(() => {
    const map = new Map<string, { status: string; newTime: string | null }>();
    for (const adj of todayAdjustments) {
      const existing = map.get(adj.entry_id);
      // approved takes priority over pending
      if (!existing || adj.status === "approved") {
        map.set(adj.entry_id, { status: adj.status, newTime: adj.new_time });
      }
    }
    return map;
  }, [todayAdjustments]);

  // Build original time lookup (original todayEntries indexed by id)
  const originalTimeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of todayEntries) {
      map.set(e.id, e.recorded_at);
    }
    return map;
  }, [todayEntries]);

  // Selfie state
  const [selfieOpen, setSelfieOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<TimeClockEntryType | null>(null);
  const photoRequired = (settings as any)?.photo_required === true;

  // Confirmation dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<TimeClockEntryType | null>(null);

  const handleActionClick = (action: TimeClockEntryType) => {
    if (photoRequired) {
      // Selfie flow — confirmation happens implicitly via selfie capture
      setPendingAction(action);
      setSelfieOpen(true);
    } else {
      // Show confirmation modal
      setConfirmAction(action);
      setConfirmOpen(true);
    }
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;
    setConfirmOpen(false);
    await register({ entryType: confirmAction });
    setConfirmAction(null);
  };

  const handleCancelConfirm = () => {
    setConfirmOpen(false);
    setConfirmAction(null);
  };

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
      if (isMonthClosed) {
        throw new Error("O período está fechado. Não é possível solicitar ajustes.");
      }
      const [h, m] = adjustTime.split(":").map(Number);
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

  const rateConfig = getOvertimeRateConfig(settings);

  const { monthlyOvertime, dayOvertimes } = useMemo(() => {
    const expectedPerDay = employeeSchedule.work_hours_per_day * 60;
    const toleranceMin = settings?.late_tolerance_minutes ?? 10;
    const allEntries = [...effectiveMonthEntries];
    const byDate = new Map<string, typeof allEntries>();
    const seen = new Set<string>();
    for (const e of allEntries) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      const d = getDatePartInTz(e.recorded_at, tz);
      if (!byDate.has(d)) byDate.set(d, []);
      byDate.get(d)!.push(e);
    }
    let totalOvertime = 0;
    const dayOvertimes: Array<{ date: string; overtimeMinutes: number }> = [];
    for (const [date, entries] of byDate) {
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
        const isNonWorkDayToday = !isWorkDay(date, user?.id || "", employeeType);
        const om = calculateOvertimeMinutes(dayMinutes, expectedPerDay, toleranceMin, isNonWorkDayToday);
        totalOvertime += om;
        if (om > 0) dayOvertimes.push({ date, overtimeMinutes: om });
      }
    }
    return { monthlyOvertime: Math.floor(totalOvertime), dayOvertimes };
  }, [effectiveMonthEntries, employeeSchedule, settings, tz]);

  const overtimeH = Math.floor(monthlyOvertime / 60);
  const overtimeM = monthlyOvertime % 60;
  const expectedMinutes = employeeSchedule.work_hours_per_day * 60;
  const progress = Math.min((workedMinutes / expectedMinutes) * 100, 100);
  const workedHours = Math.floor(workedMinutes / 60);
  const workedMins = workedMinutes % 60;

  return (
    <>
      {/* Status + Action */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Ponto do Dia
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
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
              onClick={() => handleActionClick(nextAction)}
              disabled={isRegistering}
              className={`w-full text-white h-12 text-base font-semibold ${ACTION_CONFIG[nextAction].color}`}
            >
              {(() => { const Icon = ACTION_CONFIG[nextAction].icon; return <Icon className="h-5 w-5 mr-2" />; })()}
              {isRegistering ? "Registrando..." : ACTION_CONFIG[nextAction].label}
            </Button>
          ) : (
            <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-muted">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="font-medium text-foreground">Jornada concluída!</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Today's entries — show effective (adjusted) times as primary */}
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
                          <p className="text-[11px] text-muted-foreground line-through ml-0">
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

      {/* Smart Recommendations */}
      <PontoRecommendations
        entries={effectiveTodayEntries}
        expectedClockIn={employeeSchedule.expected_clock_in}
        expectedClockOut={employeeSchedule.expected_clock_out}
        expectedMinutes={employeeSchedule.work_hours_per_day * 60}
        workedMinutes={workedMinutes}
        minBreakMinutes={employeeSchedule.break_minutes}
        toleranceMinutes={settings?.late_tolerance_minutes ?? 10}
        onRequestAdjust={() => {
          const lastEntry = effectiveTodayEntries[effectiveTodayEntries.length - 1];
          if (lastEntry) openAdjustDialog(lastEntry.id, lastEntry.entry_type, lastEntry.recorded_at);
        }}
        onJustifyLateness={() => {
          const clockInEntry = effectiveTodayEntries.find(e => e.entry_type === "clock_in");
          if (clockInEntry) openAdjustDialog(clockInEntry.id, clockInEntry.entry_type, clockInEntry.recorded_at);
        }}
      />

      {/* Weekly behavioral insights + operational impact — compact, non-intrusive */}
      {!compact && <PontoWeeklyInsights insights={weeklyInsights} />}
      {!compact && <PontoImpactSummary impact={weeklyImpact} insights={weeklyInsights} />}

      {/* Monthly overtime + estimated value */}
      {!compact && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-3">
                <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Horas extras este mês</p>
                <p className="text-xl font-bold text-foreground">
                  {monthlyOvertime > 0 ? `+${overtimeH}h${overtimeM.toString().padStart(2, "0")}` : "0h00"}
                </p>
              </div>
            </div>
            {/* Estimated overtime value — only for "pay" policy and when hourly rate is set */}
            {(() => {
              const overtimePolicy = (settings as any)?.overtime_policy;
              if (overtimePolicy !== "pay") return null;
              const breakdown = calculateOvertimeBreakdown(dayOvertimes, rateConfig);
              const estimatedValue = calculateEstimatedOvertimeCost(monthlyOvertime, effectiveHourlyRate, rateConfig, breakdown);
              if (estimatedValue == null) return null;
              return (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Valor estimado</p>
                    <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                      R$ {estimatedValue.toFixed(2).replace(".", ",")}
                    </p>
                  </div>
                  <p className="text-[10px] text-muted-foreground/70 mt-1">
                    Valor estimado sujeito à conferência
                  </p>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Selfie capture */}
      <SelfieCapture
        open={selfieOpen}
        onCancel={() => { setSelfieOpen(false); setPendingAction(null); }}
        onCapture={async (blob) => {
          if (pendingAction) {
            await register({ entryType: pendingAction, photoBlob: blob });
          }
          setSelfieOpen(false);
          setPendingAction(null);
        }}
      />

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

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar registro de ponto</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction && (
                <>
                  Você confirma que deseja registrar <strong>{ACTION_CONFIG[confirmAction].label.toLowerCase()}</strong> agora?
                  <br />
                  <span className="text-xs text-muted-foreground mt-1 block">
                    Horário atual: {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelConfirm}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isRegistering}>
              {isRegistering ? "Registrando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
