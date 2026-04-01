import { useState, useMemo } from "react";
import { calculateOvertimeMinutes, calculateDeficitMinutes } from "@/lib/timeClockUtils";
import { AppLayout } from "@/components/layout";
import { useTimeClockAdmin } from "@/hooks/useTimeClock";
import { useWorkSchedules } from "@/hooks/useWorkSchedule";
import { useAuth } from "@/hooks/useAuth";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { getTodayInTz, getDatePartInTz } from "@/lib/timezone";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { BarChart3, Clock, AlertTriangle, UserX, TrendingUp, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PontoRelatorios() {
  const { profile } = useAuth();
  const { getScheduleForEmployee, countExpectedWorkDays } = useWorkSchedules();
  const tz = useOrgTimezone();
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  // Derive date range from selected month
  const dateRange = useMemo(() => {
    const [year, month] = filterMonth.split("-").map(Number);
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return { start, end };
  }, [filterMonth]);

  const { effectiveEntries, teamProfiles, settings } = useTimeClockAdmin(dateRange);

  const toleranceMin = settings?.late_tolerance_minutes ?? 10;

  const profileMap = useMemo(() => {
    const map = new Map<string, { name: string; type: string }>();
    for (const p of teamProfiles) {
      map.set(p.user_id, { name: p.full_name || "Sem nome", type: (p as any).employee_type || "tecnico" });
    }
    return map;
  }, [teamProfiles]);

  const report = useMemo(() => {
    const [year, month] = filterMonth.split("-").map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // last day of month

    const userDays = new Map<string, Map<string, typeof effectiveEntries>>();
    for (const e of effectiveEntries) {
      if (!userDays.has(e.user_id)) userDays.set(e.user_id, new Map());
      const date = getDatePartInTz(e.recorded_at, tz);
      const days = userDays.get(e.user_id)!;
      if (!days.has(date)) days.set(date, []);
      days.get(date)!.push(e);
    }

    return teamProfiles.map(p => {
      const empType = (p as any).employee_type || "tecnico";
      const schedule = getScheduleForEmployee(p.user_id, empType);
      const expectedMinutes = schedule.work_hours_per_day * 60;

      const days = userDays.get(p.user_id) || new Map<string, typeof effectiveEntries>();
      let totalWorkedMinutes = 0, totalBreakMinutes = 0, lateCount = 0, incompleteCount = 0, daysWorked = 0, overtimeMinutes = 0, deficitMinutes = 0;

      for (const [, entries] of days) {
        const sorted = [...entries].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
        daysWorked++;

        let workedMin = 0, breakMin = 0;
        let clockIn: Date | null = null, breakStart: Date | null = null;
        let firstClockIn: string | null = null, hasClockOut = false;

        for (const e of sorted) {
          const t = new Date(e.recorded_at);
          switch (e.entry_type) {
            case "clock_in": clockIn = t; if (!firstClockIn) firstClockIn = e.recorded_at; break;
            case "break_start": if (clockIn) { workedMin += (t.getTime() - clockIn.getTime()) / 60000; clockIn = null; } breakStart = t; break;
            case "break_end": if (breakStart) { breakMin += (t.getTime() - breakStart.getTime()) / 60000; breakStart = null; } clockIn = t; break;
            case "clock_out": if (clockIn) { workedMin += (t.getTime() - clockIn.getTime()) / 60000; clockIn = null; } hasClockOut = true; break;
          }
        }

        totalWorkedMinutes += workedMin;
        totalBreakMinutes += breakMin;
        overtimeMinutes += calculateOvertimeMinutes(workedMin, expectedMinutes, toleranceMin, false);
        deficitMinutes += calculateDeficitMinutes(workedMin, expectedMinutes, toleranceMin, false);

        if (firstClockIn && schedule.expected_clock_in) {
          const entryTime = new Date(firstClockIn);
          const [h, m] = schedule.expected_clock_in.split(":").map(Number);
          const expected = new Date(entryTime);
          expected.setHours(h, m + toleranceMin, 0, 0);
          if (entryTime > expected) lateCount++;
        }
        if (!hasClockOut) incompleteCount++;
      }

      const expectedDays = countExpectedWorkDays(p.user_id, empType, startDate, endDate, tz);
      const absentDays = Math.max(0, expectedDays - daysWorked);
      const pInfo = profileMap.get(p.user_id);
      
      return {
        userId: p.user_id,
        name: pInfo?.name || "Sem nome",
        type: pInfo?.type || "tecnico",
        daysWorked,
        expectedDays,
        totalWorkedHours: Math.floor(totalWorkedMinutes / 60),
        totalWorkedMins: Math.floor(totalWorkedMinutes % 60),
        totalBreakMinutes: Math.floor(totalBreakMinutes),
        overtimeMinutes: Math.floor(overtimeMinutes),
        lateCount,
        incompleteCount,
        absentDays,
        avgDailyMinutes: daysWorked > 0 ? Math.floor(totalWorkedMinutes / daysWorked) : 0,
      };
    }).sort((a, b) => b.daysWorked - a.daysWorked);
  }, [effectiveEntries, teamProfiles, filterMonth, profileMap, toleranceMin, getScheduleForEmployee, countExpectedWorkDays]);

  const EMPLOYEE_TYPE_LABELS: Record<string, string> = { tecnico: "Técnico", ajudante: "Ajudante", atendente: "Atendente" };

  const totals = useMemo(() => {
    return report.reduce((acc, r) => ({
      daysWorked: acc.daysWorked + r.daysWorked,
      lateCount: acc.lateCount + r.lateCount,
      incompleteCount: acc.incompleteCount + r.incompleteCount,
      absentDays: acc.absentDays + r.absentDays,
      overtimeMinutes: acc.overtimeMinutes + r.overtimeMinutes,
    }), { daysWorked: 0, lateCount: 0, incompleteCount: 0, absentDays: 0, overtimeMinutes: 0 });
  }, [report]);

  const formatHours = (min: number) => { const r = Math.round(min); return `${Math.floor(r / 60)}h${(r % 60).toString().padStart(2, "0")}`; };

  const handleExportCSV = () => {
    const rows = report.map(r => ({
      Funcionário: r.name, Cargo: EMPLOYEE_TYPE_LABELS[r.type],
      "Dias Trabalhados": r.daysWorked, "Dias Esperados": r.expectedDays,
      "Total Horas": `${r.totalWorkedHours}h${r.totalWorkedMins.toString().padStart(2, "0")}`,
      "Horas Extras": formatHours(r.overtimeMinutes), Atrasos: r.lateCount, Faltas: r.absentDays, Incompletas: r.incompleteCount,
    }));
    const headers = Object.keys(rows[0] || {});
    if (headers.length === 0) return;
    const csv = [headers.join(";"), ...rows.map(r => headers.map(h => (r as any)[h]).join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `relatorio-ponto-${filterMonth}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">Relatórios de Ponto</h1>
            <p className="text-sm text-muted-foreground">Resumo de horas, atrasos e faltas</p>
          </div>
          <div className="flex gap-2">
            <Input
              type="month"
              value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)}
              className="w-[170px]"
            />
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={report.length === 0}>
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card><CardContent className="p-3 sm:p-4 flex items-center gap-3"><div className="rounded-lg bg-primary/10 p-2 shrink-0"><BarChart3 className="h-5 w-5 text-primary" /></div><div><p className="text-xl sm:text-2xl font-bold">{totals.daysWorked}</p><p className="text-[11px] text-muted-foreground">Dias trabalhados</p></div></CardContent></Card>
          <Card><CardContent className="p-3 sm:p-4 flex items-center gap-3"><div className="rounded-lg bg-blue-100 dark:bg-blue-900/30 p-2 shrink-0"><TrendingUp className="h-5 w-5 text-blue-600" /></div><div><p className="text-xl sm:text-2xl font-bold">{formatHours(totals.overtimeMinutes)}</p><p className="text-[11px] text-muted-foreground">Horas extras</p></div></CardContent></Card>
          <Card><CardContent className="p-3 sm:p-4 flex items-center gap-3"><div className="rounded-lg bg-amber-100 dark:bg-amber-900/30 p-2 shrink-0"><Clock className="h-5 w-5 text-amber-600" /></div><div><p className="text-xl sm:text-2xl font-bold">{totals.lateCount}</p><p className="text-[11px] text-muted-foreground">Atrasos</p></div></CardContent></Card>
          <Card><CardContent className="p-3 sm:p-4 flex items-center gap-3"><div className="rounded-lg bg-red-100 dark:bg-red-900/30 p-2 shrink-0"><UserX className="h-5 w-5 text-red-600" /></div><div><p className="text-xl sm:text-2xl font-bold">{totals.absentDays}</p><p className="text-[11px] text-muted-foreground">Faltas</p></div></CardContent></Card>
          <Card><CardContent className="p-3 sm:p-4 flex items-center gap-3"><div className="rounded-lg bg-orange-100 dark:bg-orange-900/30 p-2 shrink-0"><AlertTriangle className="h-5 w-5 text-orange-600" /></div><div><p className="text-xl sm:text-2xl font-bold">{totals.incompleteCount}</p><p className="text-[11px] text-muted-foreground">Incompletas</p></div></CardContent></Card>
        </div>

        <div className="space-y-2">
          {report.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-muted-foreground">Nenhum dado no período</CardContent></Card>
          ) : (
            report.map(r => {
              const avgH = Math.floor(r.avgDailyMinutes / 60);
              const avgM = r.avgDailyMinutes % 60;
              return (
                <Card key={r.userId}>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{r.name}</p>
                        <Badge variant="outline" className="text-[11px]">{EMPLOYEE_TYPE_LABELS[r.type]}</Badge>
                      </div>
                      <Badge variant="secondary" className="text-xs shrink-0">{r.totalWorkedHours}h{r.totalWorkedMins.toString().padStart(2, "0")}</Badge>
                    </div>
                    <div className="grid grid-cols-5 gap-2 text-center text-xs">
                      <div><p className="text-[10px] text-muted-foreground">Dias</p><p className="font-semibold">{r.daysWorked}/{r.expectedDays}</p></div>
                      <div><p className="text-[10px] text-muted-foreground">Média/dia</p><p className="font-semibold">{avgH}h{avgM.toString().padStart(2, "0")}</p></div>
                      <div><p className="text-[10px] text-muted-foreground">H.Extra</p><p className={`font-semibold ${r.overtimeMinutes > 0 ? "text-blue-600" : ""}`}>{formatHours(r.overtimeMinutes)}</p></div>
                      <div><p className="text-[10px] text-muted-foreground">Atrasos</p><p className={`font-semibold ${r.lateCount > 0 ? "text-red-600" : ""}`}>{r.lateCount}</p></div>
                      <div><p className="text-[10px] text-muted-foreground">Faltas</p><p className={`font-semibold ${r.absentDays > 0 ? "text-red-600" : ""}`}>{r.absentDays}</p></div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </AppLayout>
  );
}
