import { useState, useMemo } from "react";
import { calculateOvertimeMinutes, calculateDeficitMinutes, getEffectiveMaxDay, computePolicySummary, resolveHourlyRate, calculateEstimatedOvertimeCost, calculateOvertimeBreakdown, getOvertimeRateConfig, type OvertimePolicy } from "@/lib/timeClockUtils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppLayout } from "@/components/layout";
import { useTimeClockAdmin } from "@/hooks/useTimeClock";
import { useWorkSchedules } from "@/hooks/useWorkSchedule";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { getDatePartInTz } from "@/lib/timezone";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Lock, Unlock, Clock, TrendingUp, AlertTriangle, CheckCircle2, UserX, Loader2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function PontoFechamento() {
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [filterUser, setFilterUser] = useState("all");

  const [year, month] = filterMonth.split("-").map(Number);
  
  // Dynamic date range based on selected month
  const dateRange = useMemo(() => {
    const lastDay = new Date(year, month, 0).getDate();
    return {
      start: `${year}-${String(month).padStart(2, "0")}-01`,
      end: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
    };
  }, [year, month]);

  const { effectiveEntries, teamProfiles, settings } = useTimeClockAdmin(dateRange);
  const { getScheduleForEmployee, isWorkDay } = useWorkSchedules();
  const { user, profile } = useAuth();
  const { isAdmin, isOwner } = useUserRole();
  const tz = useOrgTimezone();
  const queryClient = useQueryClient();
  const orgId = (profile as any)?.organization_id;
  const canManageClosures = isAdmin || isOwner;

  const [confirmDialog, setConfirmDialog] = useState<{ action: "close" | "reopen"; userId: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch closures for the selected month
  const { data: closures = [], isLoading: loadingClosures } = useQuery({
    queryKey: ["time-clock-closures", orgId, year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_clock_month_closures")
        .select("*")
        .eq("organization_id", orgId)
        .eq("month", month)
        .eq("year", year);
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  // Fetch bank hours for the selected month
  const { data: bankHours = [] } = useQuery({
    queryKey: ["time-clock-bank-hours", orgId, year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_clock_bank_hours")
        .select("*")
        .eq("organization_id", orgId)
        .eq("month", month)
        .eq("year", year);
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  const closureMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const c of closures) map.set(c.user_id, c);
    return map;
  }, [closures]);

  const bankHoursMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const b of bankHours) map.set(b.user_id, b);
    return map;
  }, [bankHours]);

  const toleranceMin = settings?.late_tolerance_minutes ?? 10;
  const overtimePolicy: OvertimePolicy = (settings as any)?.overtime_policy === "pay" ? "pay" : "bank";

  // Calculate summaries per employee
  const employeeSummaries = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const targetProfiles = filterUser === "all" ? teamProfiles : teamProfiles.filter(p => p.user_id === filterUser);

    return targetProfiles.map(p => {
      const userId = p.user_id;
      const empType = (p as any).employee_type || "tecnico";
      const schedule = getScheduleForEmployee(userId, empType);
      const closure = closureMap.get(userId);
      const bank = bankHoursMap.get(userId);
      const isClosed = !!closure?.closed_at && !closure?.reopened_at;

      // ===== SNAPSHOT: when period is closed, use saved values (immutable) =====
      if (isClosed && closure) {
        return {
          userId,
          name: p.full_name || "Sem nome",
          isClosed: true,
          closure,
          bankEntry: bank,
          totalWorked: closure.total_worked_minutes ?? 0,
          expectedMinutes: closure.total_expected_minutes ?? 0,
          totalOvertime: closure.total_overtime_minutes ?? 0,
          bankBalance: closure.bank_balance_minutes ?? 0,
          totalLates: closure.total_lates ?? 0,
          totalIncompletes: 0, // closed periods have no incompletes by definition
          totalAbsences: closure.total_absences ?? 0,
          expectedDays: Math.round((closure.total_expected_minutes ?? 0) / (schedule.work_hours_per_day * 60)),
          daysWorked: Math.round((closure.total_expected_minutes ?? 0) / (schedule.work_hours_per_day * 60)) - (closure.total_absences ?? 0),
          dayOvertimes: [] as Array<{ date: string; overtimeMinutes: number }>, // no per-day data for snapshots
        };
      }

      // ===== LIVE CALCULATION: open or reopened period =====
      // Use centralized maxDay logic (accounts for current month, reopened)
      const maxDay = getEffectiveMaxDay(year, month, null, null); // open period → no closure constraint

      // Calculate from entries
      let totalWorked = 0, totalLates = 0, totalIncompletes = 0, totalOvertime = 0;
      let expectedDays = 0;
      const daysWorkedSet = new Set<string>();
      const dayOvertimes: Array<{ date: string; overtimeMinutes: number }> = [];

      for (let d = 1; d <= maxDay; d++) {
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        if (isWorkDay(dateStr, userId, empType)) expectedDays++;
      }

      const expectedMinutes = expectedDays * schedule.work_hours_per_day * 60;

      // Process entries for this user in this month
      const userEntries = effectiveEntries.filter(e => e.user_id === userId && getDatePartInTz(e.recorded_at, tz).startsWith(filterMonth));
      const byDate = new Map<string, typeof userEntries>();
      for (const e of userEntries) {
        const date = getDatePartInTz(e.recorded_at, tz);
        if (!byDate.has(date)) byDate.set(date, []);
        byDate.get(date)!.push(e);
      }

      for (const [date, entries] of byDate) {
        // Skip entries from future dates (beyond maxDay)
        const dayNum = parseInt(date.split("-")[2], 10);
        if (dayNum > maxDay) continue;

        const sorted = [...entries].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
        let dayWorked = 0;
        let clockIn: Date | null = null;

        for (const e of sorted) {
          const t = new Date(e.recorded_at);
          if (e.entry_type === "clock_in" || e.entry_type === "break_end") clockIn = t;
          if ((e.entry_type === "break_start" || e.entry_type === "clock_out") && clockIn) {
            dayWorked += (t.getTime() - clockIn.getTime()) / 60000;
            clockIn = null;
          }
        }

        totalWorked += dayWorked;
        daysWorkedSet.add(date);

        // Late check
        const isNonWork = !isWorkDay(date, userId, empType);
        if (!isNonWork && sorted[0]?.entry_type === "clock_in" && schedule.expected_clock_in) {
          const entryTime = new Date(sorted[0].recorded_at);
          const [h, m] = schedule.expected_clock_in.split(":").map(Number);
          const expected = new Date(entryTime);
          expected.setHours(h, m + toleranceMin, 0, 0);
          if (entryTime > expected) totalLates++;
        }

        // Incomplete
        const last = sorted[sorted.length - 1];
        if (last.entry_type !== "clock_out") totalIncompletes++;

        // Per-day overtime calculation
        const hasClockOut = sorted.some(e => e.entry_type === "clock_out");
        if (hasClockOut) {
          const expectedPerDay = schedule.work_hours_per_day * 60;
          const om = calculateOvertimeMinutes(dayWorked, expectedPerDay, toleranceMin, isNonWork);
          const dm = calculateDeficitMinutes(dayWorked, expectedPerDay, toleranceMin, isNonWork);
          totalOvertime += om;
          totalDeficit += dm;
          if (om > 0) dayOvertimes.push({ date, overtimeMinutes: Math.floor(om) });
        }
      }

      const workDaysWorked = [...daysWorkedSet].filter(d => isWorkDay(d, userId, empType)).length;
      const totalAbsences = Math.max(0, expectedDays - workDaysWorked);
      const bankBalance = Math.round(totalOvertime - totalDeficit);

      return {
        userId,
        name: p.full_name || "Sem nome",
        isClosed,
        closure,
        bankEntry: bank,
        totalWorked: Math.floor(totalWorked),
        expectedMinutes,
        totalOvertime: Math.floor(totalOvertime),
        bankBalance,
        totalLates,
        totalIncompletes,
        totalAbsences,
        expectedDays,
        daysWorked: workDaysWorked,
        dayOvertimes,
      };
    });
  }, [teamProfiles, effectiveEntries, filterMonth, filterUser, closureMap, bankHoursMap, getScheduleForEmployee, isWorkDay, toleranceMin, year, month, tz]);

  const formatHours = (min: number) => {
    const rounded = Math.round(min);
    const h = Math.floor(Math.abs(rounded) / 60);
    const m = Math.abs(rounded) % 60;
    return `${min < 0 ? "-" : ""}${h}h${m.toString().padStart(2, "0")}`;
  };

  const handleClosePeriod = async (userId: string) => {
    if (!orgId || !user) return;
    setIsProcessing(true);
    try {
      const summary = employeeSummaries.find(s => s.userId === userId);
      if (!summary) throw new Error("Funcionário não encontrado");

      // Fetch previous month bank carry
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const { data: prevBank } = await supabase
        .from("time_clock_bank_hours")
        .select("balance_minutes")
        .eq("user_id", userId)
        .eq("organization_id", orgId)
        .eq("month", prevMonth)
        .eq("year", prevYear)
        .eq("closed", true)
        .maybeSingle();

      const carriedFromPrev = prevBank?.balance_minutes ?? 0;

      // Upsert month closure
      const { error: closureError } = await supabase
        .from("time_clock_month_closures")
        .upsert({
          organization_id: orgId,
          user_id: userId,
          month,
          year,
          closed_by: user.id,
          closed_at: new Date().toISOString(),
          reopened_by: null,
          reopened_at: null,
          total_worked_minutes: summary.totalWorked,
          total_expected_minutes: summary.expectedMinutes,
          total_overtime_minutes: summary.totalOvertime,
          total_absences: summary.totalAbsences,
          total_lates: summary.totalLates,
          bank_balance_minutes: summary.bankBalance,
          estimated_cost: (() => {
            if (overtimePolicy !== "pay" || summary.totalOvertime <= 0) return null;
            const empProfile = teamProfiles.find(tp => tp.user_id === userId);
            const empType = (empProfile as any)?.employee_type || "tecnico";
            const schedule = getScheduleForEmployee(userId, empType);
            const rate = resolveHourlyRate((empProfile as any)?.hourly_rate, schedule.hourly_rate, (settings as any)?.default_hourly_rate);
            const rateConfig = getOvertimeRateConfig(settings);
            const breakdown = summary.dayOvertimes ? calculateOvertimeBreakdown(summary.dayOvertimes, rateConfig) : null;
            return calculateEstimatedOvertimeCost(summary.totalOvertime, rate, rateConfig, breakdown);
          })(),
        } as any, { onConflict: "organization_id,user_id,month,year" });
      if (closureError) throw closureError;

      // Upsert bank hours
      const newBalance = carriedFromPrev + summary.bankBalance;
      const { error: bankError } = await supabase
        .from("time_clock_bank_hours")
        .upsert({
          user_id: userId,
          organization_id: orgId,
          month,
          year,
          balance_minutes: newBalance,
          carried_from_previous: carriedFromPrev,
          added_minutes: Math.max(0, summary.bankBalance),
          deducted_minutes: Math.abs(Math.min(0, summary.bankBalance)),
          closed: true,
        }, { onConflict: "user_id,organization_id,month,year" });
      if (bankError) throw bankError;

      queryClient.invalidateQueries({ queryKey: ["time-clock-closures"] });
      queryClient.invalidateQueries({ queryKey: ["time-clock-bank-hours"] });
      toast({ title: "Período fechado com sucesso!" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro", description: err.message });
    } finally {
      setIsProcessing(false);
      setConfirmDialog(null);
    }
  };

  const handleReopenPeriod = async (userId: string) => {
    if (!orgId || !user) return;
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from("time_clock_month_closures")
        .update({
          reopened_by: user.id,
          reopened_at: new Date().toISOString(),
        })
        .eq("organization_id", orgId)
        .eq("user_id", userId)
        .eq("month", month)
        .eq("year", year);
      if (error) throw error;

      // Mark bank hours as not closed
      await supabase
        .from("time_clock_bank_hours")
        .update({ closed: false })
        .eq("user_id", userId)
        .eq("organization_id", orgId)
        .eq("month", month)
        .eq("year", year);

      queryClient.invalidateQueries({ queryKey: ["time-clock-closures"] });
      queryClient.invalidateQueries({ queryKey: ["time-clock-bank-hours"] });
      toast({ title: "Período reaberto!" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro", description: err.message });
    } finally {
      setIsProcessing(false);
      setConfirmDialog(null);
    }
  };

  const monthLabel = format(new Date(year, month - 1), "MMMM yyyy", { locale: ptBR });

  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Fechamento de Ponto</h1>
          <p className="text-sm text-muted-foreground">Feche períodos e persista o banco de horas</p>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
          <Select value={filterUser} onValueChange={setFilterUser}>
            <SelectTrigger><SelectValue placeholder="Funcionário" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {teamProfiles.map(p => (
                <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || "Sem nome"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Employee cards */}
        {employeeSummaries.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-muted-foreground">Nenhum funcionário encontrado</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {employeeSummaries.map(s => (
              <Card key={s.userId} className={s.isClosed ? "border-green-200 dark:border-green-800" : ""}>
                <CardContent className="p-4">
                  {/* Audit trail: who closed / reopened */}
                  {s.closure?.closed_at && (
                    <div className="mb-2 text-[11px] text-muted-foreground bg-muted/30 rounded px-2 py-1 space-y-0.5">
                      <p>🔒 Fechado por {teamProfiles.find(tp => tp.user_id === s.closure?.closed_by)?.full_name || "—"} em {s.closure.closed_at ? format(new Date(s.closure.closed_at), "dd/MM/yyyy HH:mm") : "—"}</p>
                      {s.closure.reopened_at && (
                        <p>🔓 Reaberto por {teamProfiles.find(tp => tp.user_id === s.closure?.reopened_by)?.full_name || "—"} em {format(new Date(s.closure.reopened_at), "dd/MM/yyyy HH:mm")}</p>
                      )}
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="font-medium text-sm">{s.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{monthLabel}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.isClosed ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          <Lock className="h-3 w-3 mr-1" /> Fechado
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <Unlock className="h-3 w-3 mr-1" /> Aberto
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">Trabalhado</p>
                        <p className="text-sm font-semibold">{formatHours(s.totalWorked)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">Extras</p>
                        <p className="text-sm font-semibold">{formatHours(s.totalOvertime)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                      <div>
                        <p className="text-xs text-muted-foreground">Atrasos</p>
                        <p className="text-sm font-semibold">{s.totalLates}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <UserX className="h-3.5 w-3.5 text-destructive" />
                      <div>
                        <p className="text-xs text-muted-foreground">Faltas</p>
                        <p className="text-sm font-semibold">{s.totalAbsences}</p>
                      </div>
                    </div>
                  </div>

                  {/* Policy-driven summary section */}
                  {(() => {
                    const ps = computePolicySummary(overtimePolicy, s.totalWorked, s.expectedMinutes, s.totalOvertime);
                    const empProfile = teamProfiles.find(tp => tp.user_id === s.userId);
                    const empType = (empProfile as any)?.employee_type || "tecnico";
                    const schedule = getScheduleForEmployee(s.userId, empType);
                    const rate = resolveHourlyRate((empProfile as any)?.hourly_rate, schedule.hourly_rate, (settings as any)?.default_hourly_rate);
                    const rateConfig = getOvertimeRateConfig(settings);
                    const breakdown = s.dayOvertimes ? calculateOvertimeBreakdown(s.dayOvertimes, rateConfig) : null;
                    // Use frozen estimated_cost from snapshot when closed, fallback to live calc
                    const estimatedCost = s.isClosed && s.closure?.estimated_cost != null
                      ? s.closure.estimated_cost
                      : calculateEstimatedOvertimeCost(s.totalOvertime, rate, rateConfig, breakdown);
                    const showCost = overtimePolicy === "pay" && estimatedCost != null;
                    return (
                      <div className="space-y-1.5 mb-3">
                        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium">{ps.primaryLabel}</span>
                            <Badge variant="outline" className="text-[9px] px-1 py-0">
                              {ps.policy === "bank" ? "Compensação" : "Pagamento"}
                            </Badge>
                          </div>
                          <Badge variant={ps.primaryValue >= 0 ? "default" : "destructive"}>
                            {formatHours(ps.primaryValue)}
                            {ps.policy === "bank" && s.bankEntry && s.bankEntry.carried_from_previous !== 0 && (
                              <span className="ml-1 text-[10px] opacity-70">
                                (anterior: {formatHours(s.bankEntry.carried_from_previous)})
                              </span>
                            )}
                          </Badge>
                        </div>
                        {showCost && (
                          <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
                            <div>
                              <span className="text-xs text-muted-foreground">Custo estimado</span>
                              <p className="text-[9px] text-muted-foreground/60">Sujeito à conferência</p>
                            </div>
                            <span className="text-xs font-mono font-medium text-foreground">
                              R$ {estimatedCost.toFixed(2).replace(".", ",")}
                            </span>
                          </div>
                        )}
                        {ps.secondaryValue != null && ps.secondaryLabel && (
                          <>
                            <div className="flex items-center justify-between px-2 py-1 rounded-md bg-muted/40">
                              <span className="text-[11px] text-muted-foreground">{ps.secondaryLabel}</span>
                              <span className="text-[11px] font-mono text-muted-foreground">
                                {formatHours(-ps.secondaryValue)}
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground/70 text-center">
                              Extras e déficit são calculados separadamente nesta política.
                            </p>
                          </>
                        )}
                      </div>
                    );
                  })()}

                  <div className="flex gap-2 justify-end">
                    {!canManageClosures ? (
                      <p className="text-xs text-muted-foreground italic">Apenas administradores podem fechar/reabrir períodos</p>
                    ) : s.isClosed ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmDialog({ action: "reopen", userId: s.userId })}
                        disabled={isProcessing}
                      >
                        <Unlock className="h-3.5 w-3.5 mr-1" /> Reabrir
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => setConfirmDialog({ action: "close", userId: s.userId })}
                        disabled={isProcessing || s.totalIncompletes > 0}
                      >
                        <Lock className="h-3.5 w-3.5 mr-1" /> Fechar Período
                      </Button>
                    )}
                  </div>

                  {s.totalIncompletes > 0 && !s.isClosed && (
                    <p className="text-xs text-destructive mt-2 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {s.totalIncompletes} registro(s) incompleto(s). Resolva antes de fechar.
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmDialog?.action === "close" ? "Confirmar Fechamento" : "Confirmar Reabertura"}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog?.action === "close"
                ? "Ao fechar o período, os registros não poderão ser editados e o saldo será persistido no banco de horas. Deseja continuar?"
                : "Ao reabrir o período, novos ajustes poderão ser feitos e o banco de horas será recalculado. Deseja continuar?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDialog(null)} disabled={isProcessing}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!confirmDialog) return;
                if (confirmDialog.action === "close") handleClosePeriod(confirmDialog.userId);
                else handleReopenPeriod(confirmDialog.userId);
              }}
              disabled={isProcessing}
              variant={confirmDialog?.action === "close" ? "default" : "destructive"}
            >
              {isProcessing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {confirmDialog?.action === "close" ? "Fechar Período" : "Reabrir Período"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
