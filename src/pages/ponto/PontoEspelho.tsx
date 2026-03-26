import { useState, useMemo } from "react";
import { calculateOvertimeMinutes, calculateDeficitMinutes, getEffectiveMaxDay, computePolicySummary, resolveHourlyRate, calculateEstimatedOvertimeCost, calculateOvertimeBreakdown, getOvertimeRateConfig, type OvertimePolicy } from "@/lib/timeClockUtils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppLayout } from "@/components/layout";
import { useTimeClockAdmin } from "@/hooks/useTimeClock";
import { useWorkSchedules } from "@/hooks/useWorkSchedule";
import { useOrganization } from "@/hooks/useOrganization";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { formatTimeInTz, getDatePartInTz } from "@/lib/timezone";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, AlertTriangle, Download, Clock, TrendingUp, UserX, FileText, Loader2 } from "lucide-react";
import { generateTimeClockPDF, type TimeClockDayRecord, type TimeClockPDFData } from "@/lib/generateTimeClockPDF";
import { toast } from "@/hooks/use-toast";

export default function PontoEspelho() {
  const { effectiveEntries, teamProfiles, settings, isLoading } = useTimeClockAdmin();
  const { getScheduleForEmployee, isWorkDay, countExpectedWorkDays } = useWorkSchedules();
  const { organization } = useOrganization();
  const tz = useOrgTimezone();
  const [filterUser, setFilterUser] = useState("all");
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [searchName, setSearchName] = useState("");
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const overtimePolicy: OvertimePolicy = settings?.overtime_policy === "pay" ? "pay" : "bank";

  const profileMap = useMemo(() => {
    const map = new Map<string, { name: string; type: string }>();
    for (const p of teamProfiles) {
      map.set(p.user_id, { name: p.full_name || "Sem nome", type: (p as any).employee_type || "tecnico" });
    }
    return map;
  }, [teamProfiles]);

  const toleranceMin = settings?.late_tolerance_minutes ?? 10;

  const dailySummaries = useMemo(() => {
    const grouped = new Map<string, typeof effectiveEntries>();
    for (const e of effectiveEntries) {
      const date = getDatePartInTz(e.recorded_at, tz);
      if (filterMonth && !date.startsWith(filterMonth)) continue;
      const key = `${e.user_id}|${date}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(e);
    }

    const summaries: Array<{
      userId: string; name: string; type: string; date: string;
      clockIn: string | null; breakStart: string | null; breakEnd: string | null; clockOut: string | null;
      breakMinutes: number; workedMinutes: number; overtimeMinutes: number;
      isLate: boolean; isIncomplete: boolean; isNonWorkDay: boolean;
    }> = [];

    for (const [key, entries] of grouped) {
      const [userId, date] = key.split("|");
      const profile = profileMap.get(userId);

      if (filterUser !== "all" && userId !== filterUser) continue;
      if (searchName && !(profile?.name || "").toLowerCase().includes(searchName.toLowerCase())) continue;

      const schedule = getScheduleForEmployee(userId, profile?.type);
      const expectedMinutes = schedule.work_hours_per_day * 60;
      const isNonWorkDay = !isWorkDay(date, userId, profile?.type);

      const sorted = [...entries].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
      let workedMinutes = 0, breakMinutes = 0;
      let clockIn: Date | null = null, breakStart: Date | null = null;
      let firstClockIn: string | null = null, lastClockOut: string | null = null;
      let firstBreakStart: string | null = null, firstBreakEnd: string | null = null;

      for (const e of sorted) {
        const t = new Date(e.recorded_at);
        switch (e.entry_type) {
          case "clock_in": clockIn = t; if (!firstClockIn) firstClockIn = e.recorded_at; break;
          case "break_start": if (clockIn) { workedMinutes += (t.getTime() - clockIn.getTime()) / 60000; clockIn = null; } breakStart = t; if (!firstBreakStart) firstBreakStart = e.recorded_at; break;
          case "break_end": if (breakStart) { breakMinutes += (t.getTime() - breakStart.getTime()) / 60000; breakStart = null; } clockIn = t; if (!firstBreakEnd) firstBreakEnd = e.recorded_at; break;
          case "clock_out": if (clockIn) { workedMinutes += (t.getTime() - clockIn.getTime()) / 60000; clockIn = null; } lastClockOut = e.recorded_at; break;
        }
      }

      let isLate = false;
      if (!isNonWorkDay && firstClockIn && schedule.expected_clock_in) {
        const entryTime = new Date(firstClockIn);
        const [h, m] = schedule.expected_clock_in.split(":").map(Number);
        const expected = new Date(entryTime);
        expected.setHours(h, m + toleranceMin, 0, 0);
        isLate = entryTime > expected;
      }

      const isIncomplete = !lastClockOut && sorted.length > 0;
      const overtimeMinutes = calculateOvertimeMinutes(workedMinutes, expectedMinutes, toleranceMin, isNonWorkDay);

      summaries.push({
        userId, name: profile?.name || "Sem nome", type: profile?.type || "tecnico",
        date, clockIn: firstClockIn, breakStart: firstBreakStart, breakEnd: firstBreakEnd, clockOut: lastClockOut,
        breakMinutes: Math.floor(breakMinutes), workedMinutes: Math.floor(workedMinutes),
        overtimeMinutes: Math.floor(overtimeMinutes),
        isLate, isIncomplete, isNonWorkDay,
      });
    }

    return summaries.sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
  }, [effectiveEntries, profileMap, filterUser, filterMonth, searchName, toleranceMin, getScheduleForEmployee, isWorkDay]);

  // Aggregate stats
  const periodStats = useMemo(() => {
    let totalWorked = 0, totalOvertime = 0, totalLates = 0, totalIncompletes = 0;
    for (const s of dailySummaries) {
      totalWorked += s.workedMinutes;
      totalOvertime += s.overtimeMinutes;
      if (s.isLate && !s.isNonWorkDay) totalLates++;
      if (s.isIncomplete) totalIncompletes++;
    }

    const [year, month] = filterMonth.split("-").map(Number);
    const maxDay = getEffectiveMaxDay(year, month);
    const daysInMonth = new Date(year, month, 0).getDate();
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month - 1, maxDay); // cap at effective end

    let expectedTotal = 0;
    const targetUsers = filterUser === "all" ? teamProfiles : teamProfiles.filter(p => p.user_id === filterUser);
    for (const p of targetUsers) {
      let count = 0;
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toLocaleDateString("en-CA", { timeZone: tz });
        if (isWorkDay(dateStr, p.user_id, (p as any).employee_type)) count++;
      }
      const schedule = getScheduleForEmployee(p.user_id, (p as any).employee_type);
      expectedTotal += Math.round(count * schedule.work_hours_per_day * 60);
    }

    const bankBalance = Math.round(totalWorked - expectedTotal);

    return { totalWorked, totalOvertime, totalLates, totalIncompletes, bankBalance, expectedTotal };
  }, [dailySummaries, filterMonth, filterUser, teamProfiles, isWorkDay, getScheduleForEmployee]);

  const formatTime = (iso: string | null) => {
    return formatTimeInTz(iso, tz);
  };

  const formatHours = (min: number) => {
    const rounded = Math.round(min);
    const h = Math.floor(Math.abs(rounded) / 60);
    const m = Math.abs(rounded) % 60;
    return `${min < 0 ? "-" : ""}${h}h${m.toString().padStart(2, "0")}`;
  };

  const handleExportCSV = () => {
    const rows = dailySummaries.map(s => ({
      Funcionário: s.name,
      Data: format(new Date(s.date + "T12:00:00"), "dd/MM/yyyy"),
      Entrada: formatTime(s.clockIn),
      "Início Pausa": formatTime(s.breakStart),
      "Retorno Pausa": formatTime(s.breakEnd),
      Saída: formatTime(s.clockOut),
      "Pausa (min)": s.breakMinutes,
      "Trabalhado (min)": s.workedMinutes,
      "H.Extra (min)": s.overtimeMinutes,
      Atraso: s.isLate ? "Sim" : "Não",
      Incompleto: s.isIncomplete ? "Sim" : "Não",
      "Dia não útil": s.isNonWorkDay ? "Sim" : "Não",
    }));
    const headers = Object.keys(rows[0] || {});
    const csv = [headers.join(";"), ...rows.map(r => headers.map(h => (r as any)[h]).join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `espelho-ponto-${filterMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    if (filterUser === "all") {
      toast({ variant: "destructive", title: "Selecione um funcionário", description: "O PDF é gerado por funcionário. Selecione um no filtro." });
      return;
    }

    const emp = profileMap.get(filterUser);
    if (!emp) return;

    setGeneratingPDF(true);
    try {
      const [year, month] = filterMonth.split("-").map(Number);
      const monthName = format(new Date(year, month - 1, 1), "MMMM/yyyy", { locale: ptBR });
      const periodLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1);

      // Build records for this employee
      const records: TimeClockDayRecord[] = dailySummaries
        .filter(s => s.userId === filterUser)
        .map(s => ({
          date: s.date,
          clockIn: s.clockIn,
          breakStart: s.breakStart,
          breakEnd: s.breakEnd,
          clockOut: s.clockOut,
          workedMinutes: s.workedMinutes,
          overtimeMinutes: s.isNonWorkDay ? s.workedMinutes : s.overtimeMinutes,
          breakMinutes: s.breakMinutes,
          isLate: s.isLate,
          isIncomplete: s.isIncomplete,
          isNonWorkDay: s.isNonWorkDay,
        }));

      // Calculate expected days for this employee using centralized logic
      const maxDayPdf = getEffectiveMaxDay(year, month);
      const startDate = new Date(year, month - 1, 1);
      const endDatePdf = new Date(year, month - 1, maxDayPdf);
      let expectedDays = 0;
      for (let d = new Date(startDate); d <= endDatePdf; d.setDate(d.getDate() + 1)) {
        if (isWorkDay(d.toLocaleDateString("en-CA", { timeZone: tz }), filterUser, emp.type)) expectedDays++;
      }
      const schedule = getScheduleForEmployee(filterUser, emp.type);
      const expectedMinutes = expectedDays * schedule.work_hours_per_day * 60;

      let totalWorked = 0, totalOvertime = 0, totalLates = 0, totalIncompletes = 0;
      const daysWorkedSet = new Set<string>();
      for (const r of records) {
        totalWorked += r.workedMinutes;
        totalOvertime += r.overtimeMinutes;
        if (r.isLate && !r.isNonWorkDay) totalLates++;
        if (r.isIncomplete) totalIncompletes++;
        daysWorkedSet.add(r.date);
      }
      const totalDaysWorked = records.filter(r => !r.isNonWorkDay).length;
      const totalAbsences = Math.max(0, expectedDays - totalDaysWorked);

      const pdfData: TimeClockPDFData = {
        employeeName: emp.name,
        employeeRole: emp.type,
        periodLabel,
        records,
        summary: {
          totalDaysWorked,
          totalExpectedDays: expectedDays,
          totalWorkedMinutes: totalWorked,
          totalExpectedMinutes: Math.floor(expectedMinutes),
          totalOvertimeMinutes: totalOvertime,
          bankBalanceMinutes: totalWorked - Math.floor(expectedMinutes),
          totalLates,
          totalIncompletes,
          totalAbsences,
        },
        overtimeMode: overtimePolicy,
        organizationName: organization?.name || "Empresa",
        organizationLogo: organization?.logo_url,
        organizationCnpj: organization?.cnpj_cpf,
        organizationPhone: organization?.phone,
        organizationEmail: organization?.email,
        organizationAddress: organization?.address,
        organizationCity: organization?.city,
        organizationState: organization?.state,
        timezone: tz,
      };

      const doc = await generateTimeClockPDF(pdfData);
      const fileName = `espelho-ponto-${emp.name.replace(/\s+/g, "-").toLowerCase()}-${filterMonth}.pdf`;
      doc.save(fileName);
      toast({ title: "PDF gerado com sucesso!" });
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Erro ao gerar PDF" });
    } finally {
      setGeneratingPDF(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">Espelho de Ponto</h1>
            <p className="text-sm text-muted-foreground">Visão consolidada da jornada</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={dailySummaries.length === 0}>
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
            <Button size="sm" onClick={handleExportPDF} disabled={filterUser === "all" || dailySummaries.length === 0 || generatingPDF}>
              {generatingPDF ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
              Exportar PDF
            </Button>
          </div>
        </div>

        {/* Period stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Card><CardContent className="p-3 flex items-center gap-2"><Clock className="h-4 w-4 text-primary shrink-0" /><div><p className="text-sm font-bold">{formatHours(periodStats.totalWorked)}</p><p className="text-[10px] text-muted-foreground">Horas Trabalhadas</p></div></CardContent></Card>
          <Card><CardContent className="p-3 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary shrink-0" /><div><p className="text-sm font-bold">{formatHours(periodStats.totalOvertime)}</p><p className="text-[10px] text-muted-foreground">Horas Extras</p></div></CardContent></Card>
          <Card><CardContent className="p-3 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive shrink-0" /><div><p className="text-sm font-bold">{periodStats.totalLates}</p><p className="text-[10px] text-muted-foreground">Atrasos</p></div></CardContent></Card>
          <Card><CardContent className="p-3 flex items-center gap-2"><UserX className="h-4 w-4 text-destructive shrink-0" /><div><p className="text-sm font-bold">{periodStats.totalIncompletes}</p><p className="text-[10px] text-muted-foreground">Incompletas</p></div></CardContent></Card>
        </div>

        {/* Overtime estimated cost — pay mode only */}
        {overtimePolicy === "pay" && periodStats.totalOvertime > 0 && filterUser !== "all" && (() => {
          const emp = profileMap.get(filterUser);
          const schedule = getScheduleForEmployee(filterUser, emp?.type);
          const profileRate = (teamProfiles.find(p => p.user_id === filterUser) as any)?.hourly_rate;
          const rate = resolveHourlyRate(profileRate, schedule.hourly_rate, (settings as any)?.default_hourly_rate);
          const rateConfig = getOvertimeRateConfig(settings);
          const userDayOvertimes = dailySummaries
            .filter(s => s.userId === filterUser && s.overtimeMinutes > 0)
            .map(s => ({ date: s.date, overtimeMinutes: s.overtimeMinutes }));
          const breakdown = calculateOvertimeBreakdown(userDayOvertimes, rateConfig);
          const estimatedCost = calculateEstimatedOvertimeCost(periodStats.totalOvertime, rate, rateConfig, breakdown);
          if (estimatedCost == null) return null;
          return (
            <Card className="border-muted">
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <span className="text-sm text-muted-foreground">Custo estimado</span>
                  <p className="text-[9px] text-muted-foreground/60">Sujeito à conferência</p>
                </div>
                <span className="text-sm font-semibold text-foreground">
                  R$ {estimatedCost.toFixed(2).replace(".", ",")}
                </span>
              </CardContent>
            </Card>
          );
        })()}

        {/* Policy-driven balance section */}
        {(() => {
          const ps = computePolicySummary(overtimePolicy, periodStats.totalWorked, periodStats.expectedTotal, periodStats.totalOvertime);
          if (ps.primaryValue === 0 && ps.secondaryValue == null) return null;
          return (
            <div className="space-y-1.5">
              {ps.primaryValue !== 0 && (
                <Card className={ps.primaryValue > 0 ? "border-primary/30" : "border-destructive/30"}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium">{ps.primaryLabel}</span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0">
                        {ps.policy === "bank" ? "Compensação" : "Pagamento"}
                      </Badge>
                    </div>
                    <Badge variant={ps.primaryValue > 0 ? "default" : "destructive"} className="text-sm">
                      {formatHours(ps.primaryValue)}
                    </Badge>
                  </CardContent>
                </Card>
              )}
              {ps.secondaryValue != null && ps.secondaryLabel && (
                <>
                  <div className="flex items-center justify-between px-3 py-1.5 rounded-md bg-muted/40">
                    <p className="text-[11px] text-muted-foreground">{ps.secondaryLabel}</p>
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

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar funcionário..." value={searchName} onChange={e => setSearchName(e.target.value)} className="pl-9" /></div>
          <Select value={filterUser} onValueChange={setFilterUser}><SelectTrigger><SelectValue placeholder="Funcionário" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{teamProfiles.map(p => (<SelectItem key={p.user_id} value={p.user_id}>{p.full_name || "Sem nome"}</SelectItem>))}</SelectContent></Select>
          <Input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
        </div>

        {/* PDF hint */}
        {filterUser === "all" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
            <FileText className="h-3.5 w-3.5 shrink-0" />
            Selecione um funcionário para exportar o espelho em PDF.
          </div>
        )}

        {/* Daily records */}
        <div className="space-y-2">
          {dailySummaries.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-muted-foreground">Nenhum registro encontrado</CardContent></Card>
          ) : (
            dailySummaries.slice(0, 200).map((s, i) => {
              const wH = Math.floor(s.workedMinutes / 60);
              const wM = s.workedMinutes % 60;
              return (
                <Card key={i} className={s.isNonWorkDay ? "opacity-60" : ""}>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{s.name}</p>
                        <p className="text-[11px] text-muted-foreground">{format(new Date(s.date + "T12:00:00"), "dd/MM/yyyy")}</p>
                      </div>
                      <div className="flex gap-1 flex-wrap justify-end">
                        {s.isNonWorkDay && <Badge variant="secondary" className="text-[11px]">Dia não útil</Badge>}
                        {s.isLate && !s.isNonWorkDay && <Badge variant="destructive" className="text-[11px]">Atraso</Badge>}
                        {s.isIncomplete && (
                          <Badge variant="outline" className="text-[11px] text-destructive border-destructive/30">
                            <AlertTriangle className="h-3 w-3 mr-0.5" />Incompleto
                          </Badge>
                        )}
                        {s.overtimeMinutes > 0 && (
                          <Badge variant="outline" className="text-[11px] text-primary border-primary/30">+{formatHours(s.overtimeMinutes)}</Badge>
                        )}
                        {!s.isLate && !s.isIncomplete && s.overtimeMinutes === 0 && !s.isNonWorkDay && (
                          <Badge variant="outline" className="text-[11px] text-primary border-primary/30">OK</Badge>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-5 gap-1 sm:gap-2 text-center">
                      <div><p className="text-[10px] text-muted-foreground uppercase">Entrada</p><p className="text-xs sm:text-sm font-mono font-medium">{formatTime(s.clockIn)}</p></div>
                      <div><p className="text-[10px] text-muted-foreground uppercase">Ini. Pausa</p><p className="text-xs sm:text-sm font-mono font-medium">{formatTime(s.breakStart)}</p></div>
                      <div><p className="text-[10px] text-muted-foreground uppercase">Ret. Pausa</p><p className="text-xs sm:text-sm font-mono font-medium">{formatTime(s.breakEnd)}</p></div>
                      <div><p className="text-[10px] text-muted-foreground uppercase">Saída</p><p className="text-xs sm:text-sm font-mono font-medium">{formatTime(s.clockOut)}</p></div>
                      <div><p className="text-[10px] text-muted-foreground uppercase">Total</p><p className="text-xs sm:text-sm font-semibold text-primary">{wH}h{wM.toString().padStart(2, "0")}</p></div>
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
