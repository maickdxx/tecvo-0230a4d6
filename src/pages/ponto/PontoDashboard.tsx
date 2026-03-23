import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout";
import { useTimeClockAdmin } from "@/hooks/useTimeClock";
import { useWorkSchedules } from "@/hooks/useWorkSchedule";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { getTodayInTz, formatTimeInTz, getDatePartInTz } from "@/lib/timezone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Users, Clock, TrendingUp, Coffee, UserX, AlertCircle, CheckCircle2, 
  AlertTriangle, ArrowRight, Bell, Timer, ShieldAlert, CalendarOff, Info
} from "lucide-react";

export default function PontoDashboard() {
  const { effectiveEntries, teamProfiles, settings, isLoading } = useTimeClockAdmin();
  const { isTodayWorkDay, isWorkDay, getScheduleForEmployee, getNonWorkDayReason, isConfigured, hasSchedules } = useWorkSchedules();
  const navigate = useNavigate();
  const tz = useOrgTimezone();

  const todayStr = getTodayInTz(tz);
  const todayEntries = effectiveEntries.filter(e => getDatePartInTz(e.recorded_at, tz) === todayStr);

  // Filter team to only those who should work today
  const expectedTeamToday = useMemo(() => {
    return teamProfiles.filter(p => 
      isTodayWorkDay(p.user_id, (p as any).employee_type, tz)
    );
  }, [teamProfiles, isTodayWorkDay, tz]);

  const nonWorkingTeamToday = useMemo(() => {
    return teamProfiles.filter(p => 
      !isTodayWorkDay(p.user_id, (p as any).employee_type, tz)
    );
  }, [teamProfiles, isTodayWorkDay, tz]);

  const stats = useMemo(() => {
    const userEntries = new Map<string, typeof todayEntries>();
    for (const e of todayEntries) {
      if (!userEntries.has(e.user_id)) userEntries.set(e.user_id, []);
      userEntries.get(e.user_id)!.push(e);
    }

    let clockedIn = 0, onBreak = 0, completed = 0, working = 0, lateCount = 0;

    // Only consider expected team
    const expectedUserIds = new Set(expectedTeamToday.map(p => p.user_id));

    for (const [userId, entries] of userEntries) {
      if (!expectedUserIds.has(userId)) continue; // skip non-expected employees
      const sorted = [...entries].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
      const last = sorted[sorted.length - 1];
      clockedIn++;
      if (last.entry_type === "break_start") onBreak++;
      else if (last.entry_type === "clock_out") completed++;
      else working++;

      // Check late using employee's own schedule
      const profile = teamProfiles.find(p => p.user_id === userId);
      const schedule = getScheduleForEmployee(userId, (profile as any)?.employee_type);
      const firstEntry = sorted[0];
      if (firstEntry.entry_type === "clock_in" && schedule.expected_clock_in) {
        const entryTime = new Date(firstEntry.recorded_at);
        const [h, m] = schedule.expected_clock_in.split(":").map(Number);
        const expected = new Date(entryTime);
        const toleranceMin = settings?.late_tolerance_minutes ?? 10;
        expected.setHours(h, m + toleranceMin, 0, 0);
        if (entryTime > expected) lateCount++;
      }
    }

    const absent = expectedTeamToday.length - clockedIn;

    // Inconsistencies from yesterday - only for employees who were expected to work YESTERDAY
    const yesterdayStr = new Date(Date.now() - 86400000).toLocaleDateString("en-CA", { timeZone: tz });
    const yesterdayEntries = effectiveEntries.filter(e => getDatePartInTz(e.recorded_at, tz) === yesterdayStr);
    const yesterdayUsers = new Map<string, typeof todayEntries>();
    for (const e of yesterdayEntries) {
      if (!yesterdayUsers.has(e.user_id)) yesterdayUsers.set(e.user_id, []);
      yesterdayUsers.get(e.user_id)!.push(e);
    }
    let inconsistencies = 0;
    for (const [userId, entries] of yesterdayUsers) {
      // Skip employees who were NOT expected to work yesterday
      const profile = teamProfiles.find(p => p.user_id === userId);
      if (!isWorkDay(yesterdayStr, userId, (profile as any)?.employee_type)) continue;
      const sorted = [...entries].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
      const last = sorted[sorted.length - 1];
      if (last.entry_type !== "clock_out") inconsistencies++;
    }

    return { clockedIn, absent: Math.max(0, absent), onBreak, completed, working, lateCount, inconsistencies, totalExpected: expectedTeamToday.length, totalTeam: teamProfiles.length, totalRecords: todayEntries.length };
  }, [todayEntries, effectiveEntries, teamProfiles, expectedTeamToday, settings, getScheduleForEmployee]);

  // Pending actions - only for expected team
  const pendingActions = useMemo(() => {
    const actions: Array<{ icon: typeof AlertTriangle; label: string; count: number; color: string; route?: string }> = [];
    
    const expectedUserIds = new Set(expectedTeamToday.map(p => p.user_id));
    const usersWithEntry = new Set(todayEntries.map(e => e.user_id));
    
    // Only flag employees who were EXPECTED to work today and have no entry
    const noEntry = expectedTeamToday.filter(p => !usersWithEntry.has(p.user_id));
    if (noEntry.length > 0) {
      actions.push({ icon: UserX, label: "Sem entrada registrada hoje", count: noEntry.length, color: "text-red-600" });
    }

    // Open shifts and short breaks - only for expected team
    const userEntries = new Map<string, typeof todayEntries>();
    for (const e of todayEntries) {
      if (!expectedUserIds.has(e.user_id)) continue;
      if (!userEntries.has(e.user_id)) userEntries.set(e.user_id, []);
      userEntries.get(e.user_id)!.push(e);
    }
    let openShifts = 0;
    let shortBreaks = 0;
    for (const [userId, entries] of userEntries) {
      const sorted = [...entries].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
      const last = sorted[sorted.length - 1];
      if (last.entry_type !== "clock_out") openShifts++;
      
      const profile = teamProfiles.find(p => p.user_id === userId);
      const schedule = getScheduleForEmployee(userId, (profile as any)?.employee_type);
      
      let breakStart: Date | null = null;
      for (const e of sorted) {
        if (e.entry_type === "break_start") breakStart = new Date(e.recorded_at);
        if (e.entry_type === "break_end" && breakStart) {
          const breakMin = (new Date(e.recorded_at).getTime() - breakStart.getTime()) / 60000;
          if (breakMin < schedule.break_minutes) shortBreaks++;
          breakStart = null;
        }
      }
    }

    if (openShifts > 0) {
      actions.push({ icon: Timer, label: "Jornadas sem saída", count: openShifts, color: "text-amber-600" });
    }

    if (stats.lateCount > 0) {
      actions.push({ icon: Clock, label: "Atrasos acima da tolerância", count: stats.lateCount, color: "text-orange-600" });
    }

    if (shortBreaks > 0) {
      actions.push({ icon: Coffee, label: "Intervalo abaixo do mínimo", count: shortBreaks, color: "text-purple-600" });
    }

    if (stats.inconsistencies > 0) {
      actions.push({ icon: ShieldAlert, label: "Inconsistências (ontem)", count: stats.inconsistencies, color: "text-red-600", route: "/ponto-admin/ajustes" });
    }

    return actions;
  }, [todayEntries, expectedTeamToday, teamProfiles, stats, getScheduleForEmployee]);

  const summaryCards = [
    { label: "Equipe Prevista Hoje", value: stats.totalExpected, icon: Users, color: "text-purple-600", bg: "bg-purple-100 dark:bg-purple-900/30" },
    { label: "Presentes", value: stats.clockedIn, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-100 dark:bg-green-900/30" },
    { label: "Atrasados", value: stats.lateCount, icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-100 dark:bg-orange-900/30" },
    { label: "Em Pausa", value: stats.onBreak, icon: Coffee, color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/30" },
    { label: "Trabalhando", value: stats.working, icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/30" },
    { label: "Encerrada", value: stats.completed, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
    { label: "Ausentes", value: stats.absent, icon: UserX, color: "text-red-600", bg: "bg-red-100 dark:bg-red-900/30" },
    { label: "Registros Hoje", value: stats.totalRecords, icon: Clock, color: "text-primary", bg: "bg-primary/10" },
  ];

  // Determine non-work day message
  const todayIsNonWorkForAll = expectedTeamToday.length === 0 && teamProfiles.length > 0;
  const todayNonWorkReason = useMemo(() => {
    if (!todayIsNonWorkForAll || teamProfiles.length === 0) return null;
    return getNonWorkDayReason(todayStr, teamProfiles[0].user_id, (teamProfiles[0] as any).employee_type);
  }, [todayIsNonWorkForAll, teamProfiles, todayStr, getNonWorkDayReason]);

  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Dashboard do Ponto</h1>
          <p className="text-sm text-muted-foreground">Visão geral do controle de ponto</p>
        </div>

        {/* Configuration warning */}
        {!isConfigured && (
          <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
            <CardContent className="p-4 flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Configuração necessária</p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  Configure as escalas de trabalho e jornada para que os cálculos e alertas funcionem corretamente.
                </p>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="outline" onClick={() => navigate("/ponto-admin/escalas")} className="text-xs">
                    Configurar Escalas
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => navigate("/ponto-admin/configuracoes")} className="text-xs">
                    Configurar Jornada
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Non-work day notice */}
        {todayIsNonWorkForAll && (
          <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
            <CardContent className="p-4 flex items-center gap-3">
              <CalendarOff className="h-5 w-5 text-blue-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Hoje não há expediente previsto para a equipe
                </p>
                {todayNonWorkReason && (
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">{todayNonWorkReason}</p>
                )}
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Nenhuma ação pendente para hoje.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending Actions - only show when there are expected workers */}
        {!todayIsNonWorkForAll && pendingActions.length > 0 && (
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
            <CardHeader className="pb-2 pt-3 px-3 sm:px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-600" />
                Ações Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
              <div className="space-y-2">
                {pendingActions.map((action, i) => (
                  <div 
                    key={i} 
                    className="flex items-center justify-between py-2 border-b border-amber-200/50 dark:border-amber-800/50 last:border-0 gap-2 cursor-pointer hover:bg-amber-100/30 dark:hover:bg-amber-900/20 rounded px-2 -mx-2 transition-colors"
                    onClick={() => action.route && navigate(action.route)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <action.icon className={`h-4 w-4 shrink-0 ${action.color}`} />
                      <span className="text-sm text-foreground truncate">{action.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="destructive" className="text-[11px]">{action.count}</Badge>
                      {action.route && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {!todayIsNonWorkForAll && pendingActions.length === 0 && expectedTeamToday.length > 0 && (
          <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <p className="text-sm text-green-900 dark:text-green-100">Nenhuma ação pendente para hoje.</p>
            </CardContent>
          </Card>
        )}

        {/* Operational Summary */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">Resumo Operacional do Dia</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {summaryCards.map(c => (
              <Card key={c.label}>
                <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
                  <div className={`rounded-lg p-1.5 sm:p-2 ${c.bg} shrink-0`}>
                    <c.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${c.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg sm:text-2xl font-bold leading-tight">{isLoading ? "—" : c.value}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{c.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Non-working team notice */}
        {nonWorkingTeamToday.length > 0 && !todayIsNonWorkForAll && (
          <Card>
            <CardHeader className="pb-2 pt-3 px-3 sm:px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <CalendarOff className="h-4 w-4 text-muted-foreground" />
                Fora da escala hoje ({nonWorkingTeamToday.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
              <div className="flex flex-wrap gap-1.5">
                {nonWorkingTeamToday.map(p => (
                  <Badge key={p.user_id} variant="secondary" className="text-[11px]">
                    {p.full_name || "Sem nome"}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Alerts Section - only for expected team */}
        {!todayIsNonWorkForAll && (stats.inconsistencies > 0 || stats.lateCount > 0 || stats.absent > 0) && (
          <Card>
            <CardHeader className="pb-2 pt-3 px-3 sm:px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                Alertas Automáticos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0 space-y-2">
              {stats.lateCount > 0 && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800">
                  <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0" />
                  <span className="text-sm">{stats.lateCount} funcionário(s) atrasado(s) hoje</span>
                </div>
              )}
              {stats.absent > 0 && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                  <UserX className="h-4 w-4 text-red-600 shrink-0" />
                  <span className="text-sm">{stats.absent} funcionário(s) da equipe prevista sem entrada</span>
                </div>
              )}
              {stats.inconsistencies > 0 && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
                  <span className="text-sm">{stats.inconsistencies} jornada(s) inconsistente(s) ontem</span>
                  <Button size="sm" variant="ghost" className="ml-auto text-xs" onClick={() => navigate("/ponto-admin/ajustes")}>
                    Ver <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recent activity */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-3 sm:px-4">
            <CardTitle className="text-sm">Atividade Recente</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
            {todayEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum registro hoje</p>
            ) : (
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {todayEntries.slice(0, 30).map(entry => {
                  const profile = teamProfiles.find(p => p.user_id === entry.user_id);
                  const labels: Record<string, string> = { clock_in: "Entrada", break_start: "Pausa", break_end: "Retorno", clock_out: "Saída" };
                  const colors: Record<string, string> = { 
                    clock_in: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
                    break_start: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
                    break_end: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
                    clock_out: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                  };
                  return (
                    <div key={entry.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{profile?.full_name || "—"}</p>
                          <Badge className={`text-[11px] ${colors[entry.entry_type] || ""}`}>{labels[entry.entry_type] || entry.entry_type}</Badge>
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground font-mono shrink-0">
                        {formatTimeInTz(entry.recorded_at, tz)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
