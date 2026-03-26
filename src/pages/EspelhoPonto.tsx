import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout";
import { useTimeClock } from "@/hooks/useTimeClock";
import { useWorkSchedules } from "@/hooks/useWorkSchedule";
import { useAuth } from "@/hooks/useAuth";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { useOrganization } from "@/hooks/useOrganization";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatTimeInTz, getDatePartInTz } from "@/lib/timezone";
import { format, subMonths, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Loader2, HelpCircle, AlertTriangle } from "lucide-react";
import { calculateOvertimeMinutes, calculateDeficitMinutes, getEffectiveMaxDay, computePolicySummary, resolveHourlyRate, calculateEstimatedOvertimeCost, calculateOvertimeBreakdown, getOvertimeRateConfig, type OvertimePolicy } from "@/lib/timeClockUtils";
import { generateTimeClockPDF, type TimeClockDayRecord, type TimeClockPDFData } from "@/lib/generateTimeClockPDF";
import { toast } from "@/hooks/use-toast";
import { DayCalculationDetail, SummaryTooltip, type DayExplanation } from "@/components/ponto/DayCalculationDetail";

function getMonthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = subMonths(now, i);
    const value = format(d, "yyyy-MM");
    const label = format(d, "MMMM yyyy", { locale: ptBR });
    options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return options;
}

interface RecordWithExplanation extends TimeClockDayRecord {
  explanation: DayExplanation;
}

export default function EspelhoPonto() {
  const { user, profile } = useAuth();
  const tz = useOrgTimezone();
  const { settings } = useTimeClock();
  const { organization } = useOrganization();
  const { getScheduleForEmployee, isWorkDay, countExpectedWorkDays } = useWorkSchedules();
  const employeeType = (profile as any)?.employee_type || "tecnico";
  const schedule = getScheduleForEmployee(user?.id || "", employeeType);
  const toleranceMin = settings?.late_tolerance_minutes ?? 10;
  const expectedPerDay = Math.round(schedule.work_hours_per_day * 60);

  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const monthOptions = useMemo(() => getMonthOptions(), []);

  // Fetch entries
  const { data: entries = [] } = useQuery({
    queryKey: ["espelho-ponto-entries", user?.id, selectedMonth],
    queryFn: async () => {
      const [y, m] = selectedMonth.split("-").map(Number);
      const start = new Date(y, m - 1, 1).toISOString();
      const end = new Date(y, m, 0, 23, 59, 59).toISOString();
      const { data, error } = await supabase
        .from("time_clock_entries")
        .select("*")
        .eq("user_id", user!.id)
        .gte("recorded_at", start)
        .lte("recorded_at", end)
        .order("recorded_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch adjustments with details (who adjusted, reason)
  const entryIds = useMemo(() => entries.map((e: any) => e.id), [entries]);
  const { data: adjustments = [] } = useQuery({
    queryKey: ["espelho-ponto-adj", entryIds],
    queryFn: async () => {
      if (entryIds.length === 0) return [];
      const { data, error } = await supabase
        .from("time_clock_adjustments")
        .select("entry_id, new_time, status, original_time, reason, adjusted_by, profiles!time_clock_adjustments_adjusted_by_fkey(full_name)")
        .in("entry_id", entryIds)
        .eq("status", "approved");
      if (error) {
        // Fallback without join if fkey doesn't exist
        const { data: fallback, error: err2 } = await supabase
          .from("time_clock_adjustments")
          .select("entry_id, new_time, status, original_time, reason, adjusted_by")
          .in("entry_id", entryIds)
          .eq("status", "approved");
        if (err2) throw err2;
        return fallback || [];
      }
      return data || [];
    },
    enabled: entryIds.length > 0,
  });

  const adjMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of adjustments) {
      if (a.new_time) map.set(a.entry_id, a.new_time);
    }
    return map;
  }, [adjustments]);

  // Index adjustments by entry_id for explanation
  const adjDetailMap = useMemo(() => {
    const map = new Map<string, typeof adjustments>();
    for (const a of adjustments) {
      const list = map.get(a.entry_id) || [];
      list.push(a);
      map.set(a.entry_id, list);
    }
    return map;
  }, [adjustments]);

  // Build daily records with explanation
  const { records, summary, dayOvertimes } = useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const maxDay = getEffectiveMaxDay(y, m);
    const start = startOfMonth(new Date(y, m - 1));
    const end = new Date(y, m - 1, maxDay); // cap at effective end
    const days = eachDayOfInterval({ start, end });

    const byDate = new Map<string, any[]>();
    for (const e of entries) {
      const d = getDatePartInTz(e.recorded_at, tz);
      if (!byDate.has(d)) byDate.set(d, []);
      byDate.get(d)!.push(e);
    }

    let totalWorked = 0;
    let totalOvertime = 0;
    let totalDaysWorked = 0;
    const dayOvertimes: Array<{ date: string; overtimeMinutes: number }> = [];
    const expectedDays = countExpectedWorkDays(user?.id || "", employeeType, start, end, tz);

    const records: RecordWithExplanation[] = days.map((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const dayEntries = (byDate.get(dateStr) || []).sort((a: any, b: any) =>
        a.recorded_at.localeCompare(b.recorded_at)
      );

      const getTime = (type: string) => {
        const entry = dayEntries.find((e: any) => e.entry_type === type);
        if (!entry) return null;
        const effective = adjMap.get(entry.id) || entry.recorded_at;
        return formatTimeInTz(effective, tz);
      };

      let workedMinutes = 0;
      let breakMinutes = 0;
      let ci: Date | null = null;
      let bs: Date | null = null;
      for (const e of dayEntries) {
        const effective = adjMap.get(e.id) || e.recorded_at;
        const t = new Date(effective);
        if (e.entry_type === "clock_in" || e.entry_type === "break_end") ci = t;
        if (e.entry_type === "break_start") { bs = t; if (ci) { workedMinutes += (t.getTime() - ci.getTime()) / 60000; ci = null; } }
        if (e.entry_type === "break_end" && bs) { breakMinutes += (t.getTime() - bs.getTime()) / 60000; bs = null; }
        if (e.entry_type === "clock_out" && ci) { workedMinutes += (t.getTime() - ci.getTime()) / 60000; ci = null; }
      }

      const nonWorkDay = !isWorkDay(dateStr, user?.id || "", employeeType);
      const hasClockOut = dayEntries.some((e: any) => e.entry_type === "clock_out");
      const isIncomplete = !nonWorkDay && dayEntries.length > 0 && !hasClockOut;

      const wm = Math.round(workedMinutes);
      const om = hasClockOut ? Math.max(0, calculateOvertimeMinutes(wm, expectedPerDay, toleranceMin, false)) : 0;

      if (dayEntries.length > 0 && hasClockOut) {
        totalWorked += wm;
        totalOvertime += om;
        totalDaysWorked++;
        if (om > 0) dayOvertimes.push({ date: dateStr, overtimeMinutes: om });
      }

      // Build adjustment details for explanation
      const dayAdjustments: DayExplanation["adjustments"] = [];
      for (const e of dayEntries) {
        const adjs = adjDetailMap.get(e.id);
        if (adjs) {
          for (const adj of adjs) {
            const adjByName = (adj as any)?.profiles?.full_name || null;
            dayAdjustments.push({
              entryType: e.entry_type,
              originalTime: formatTimeInTz(adj.original_time || e.recorded_at, tz),
              newTime: formatTimeInTz(adj.new_time, tz),
              adjustedBy: adjByName,
              reason: (adj as any).reason || null,
            });
          }
        }
      }

      // Calculate lateness and early departure
      let lateMinutes = 0;
      let earlyDepartureMinutes = 0;
      const effectiveIn = getTime("clock_in");
      const effectiveOut = getTime("clock_out");

      if (!nonWorkDay && schedule.expected_clock_in && effectiveIn) {
        const [expH, expM] = schedule.expected_clock_in.split(":").map(Number);
        const [actH, actM] = effectiveIn.split(":").map(Number);
        const diff = (actH * 60 + actM) - (expH * 60 + expM);
        if (diff > toleranceMin) lateMinutes = diff;
      }
      if (!nonWorkDay && schedule.expected_clock_out && effectiveOut) {
        const [expH, expM] = schedule.expected_clock_out.split(":").map(Number);
        const [actH, actM] = effectiveOut.split(":").map(Number);
        const diff = (expH * 60 + expM) - (actH * 60 + actM);
        if (diff > toleranceMin) earlyDepartureMinutes = diff;
      }

      const explanation: DayExplanation = {
        expectedClockIn: schedule.expected_clock_in || null,
        expectedClockOut: schedule.expected_clock_out || null,
        expectedBreakMin: schedule.break_minutes,
        expectedWorkMin: expectedPerDay,
        toleranceMin,
        effectiveClockIn: effectiveIn,
        effectiveBreakStart: getTime("break_start"),
        effectiveBreakEnd: getTime("break_end"),
        effectiveClockOut: effectiveOut,
        adjustments: dayAdjustments,
        workedMinutes: wm,
        breakMinutes: Math.round(breakMinutes),
        overtimeMinutes: om,
        lateMinutes,
        earlyDepartureMinutes,
        isNonWorkDay: nonWorkDay,
        isIncomplete,
      };

      return {
        date: dateStr,
        clockIn: effectiveIn,
        breakStart: getTime("break_start"),
        breakEnd: getTime("break_end"),
        clockOut: effectiveOut,
        workedMinutes: wm,
        overtimeMinutes: om,
        breakMinutes: Math.round(breakMinutes),
        isLate: lateMinutes > 0,
        isIncomplete,
        isNonWorkDay: nonWorkDay,
        explanation,
      };
    });

    const bankBalance = totalOvertime - totalDeficit;

    return {
      records,
      dayOvertimes,
      summary: {
        totalDaysWorked,
        totalExpectedDays: expectedDays,
        totalWorkedMinutes: totalWorked,
        totalExpectedMinutes: expectedDays * expectedPerDay,
        totalOvertimeMinutes: totalOvertime,
        totalDeficitMinutes: totalDeficit,
        bankBalanceMinutes: bankBalance,
        totalLates: records.filter((r) => r.isLate).length,
        totalIncompletes: records.filter((r) => r.isIncomplete).length,
        totalAbsences: Math.max(0, expectedDays - totalDaysWorked),
      },
    };
  }, [entries, adjMap, adjDetailMap, selectedMonth, tz, user, employeeType, expectedPerDay, toleranceMin, countExpectedWorkDays, isWorkDay, schedule]);

  const [y, mo] = selectedMonth.split("-").map(Number);
  const periodLabel = format(new Date(y, mo - 1), "MMMM yyyy", { locale: ptBR });

  const handleDownloadPDF = async () => {
    setGeneratingPDF(true);
    try {
      const pdfData: TimeClockPDFData = {
        employeeName: profile?.full_name || "Funcionário",
        employeeRole: employeeType === "ajudante" ? "Ajudante" : "Técnico",
        periodLabel: periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1),
        records,
        summary,
        overtimeMode: (settings as any)?.overtime_policy === "pay" ? "pay" : "bank",
        organizationName: organization?.name || "Empresa",
        organizationLogo: organization?.logo_url || undefined,
      };
      generateTimeClockPDF(pdfData);
      toast({ title: "PDF gerado!", description: "O espelho de ponto foi baixado." });
    } catch {
      toast({ variant: "destructive", title: "Erro", description: "Falha ao gerar PDF." });
    } finally {
      setGeneratingPDF(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Espelho de Ponto</h1>
            <p className="text-sm text-muted-foreground">{profile?.full_name || "Funcionário"}</p>
          </div>
          <Button onClick={handleDownloadPDF} disabled={generatingPDF} size="sm">
            {generatingPDF ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Baixar PDF
          </Button>
        </div>

        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Summary with tooltips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryTooltip content={`${summary.totalDaysWorked} dias com ponto completo de ${summary.totalExpectedDays} dias úteis esperados no período.`}>
            <Card className="cursor-help"><CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Dias Trab.</p>
              <p className="text-lg font-bold">{summary.totalDaysWorked}/{summary.totalExpectedDays}</p>
            </CardContent></Card>
          </SummaryTooltip>

          <SummaryTooltip content={`Total de horas trabalhadas no período. Esperado: ${Math.floor(summary.totalExpectedMinutes / 60)}h${String(summary.totalExpectedMinutes % 60).padStart(2, "0")}. Clique em cada dia para ver o detalhamento.`}>
            <Card className="cursor-help"><CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Horas Trab.</p>
              <p className="text-lg font-bold">{Math.floor(summary.totalWorkedMinutes / 60)}h{String(summary.totalWorkedMinutes % 60).padStart(2, "0")}</p>
            </CardContent></Card>
          </SummaryTooltip>

          <SummaryTooltip content={`Horas que ultrapassaram a jornada diária de ${Math.floor(expectedPerDay / 60)}h${String(expectedPerDay % 60).padStart(2, "0")} além da tolerância de ${toleranceMin}min (CLT Art. 58 §1).`}>
            <Card className="cursor-help"><CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Extras</p>
              <p className="text-lg font-bold text-green-600 dark:text-green-400">+{Math.floor(summary.totalOvertimeMinutes / 60)}h{String(summary.totalOvertimeMinutes % 60).padStart(2, "0")}</p>
            </CardContent></Card>
          </SummaryTooltip>

          <SummaryTooltip content={`Dias úteis sem nenhuma marcação de ponto. ${summary.totalAbsences === 0 ? "Nenhuma falta registrada!" : `${summary.totalAbsences} dia(s) sem registro.`}`}>
            <Card className="cursor-help"><CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Faltas</p>
              <p className="text-lg font-bold text-destructive">{summary.totalAbsences}</p>
            </CardContent></Card>
          </SummaryTooltip>
        </div>

        {/* Policy-driven balance section */}
        {(() => {
          const policy: OvertimePolicy = (settings as any)?.overtime_policy === "pay" ? "pay" : "bank";
          const ps = computePolicySummary(policy, summary.totalWorkedMinutes, summary.totalExpectedMinutes, summary.totalOvertimeMinutes, summary.totalDeficitMinutes);
          
          return (
            <div className="space-y-2">
              {/* Primary metric */}
              {ps.primaryValue !== 0 && (
                <Card className={ps.primaryValue > 0 ? "border-primary/30" : "border-destructive/30"}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{ps.primaryLabel}</span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0">
                        {ps.policy === "bank" ? "Compensação" : "Pagamento"}
                      </Badge>
                    </div>
                    <Badge variant={ps.primaryValue > 0 ? "default" : "destructive"} className="text-sm font-mono">
                      {ps.primaryValue > 0 ? "+" : ""}{Math.floor(Math.abs(ps.primaryValue) / 60)}h{String(Math.abs(ps.primaryValue) % 60).padStart(2, "0")}
                    </Badge>
                  </CardContent>
                </Card>
              )}

              {/* Estimated cost — pay mode, employee view */}
              {policy === "pay" && ps.primaryValue > 0 && (() => {
                const rate = resolveHourlyRate(
                  (profile as any)?.hourly_rate,
                  schedule.hourly_rate,
                  (settings as any)?.default_hourly_rate,
                );
                const rcfg = getOvertimeRateConfig(settings);
                const breakdown = calculateOvertimeBreakdown(dayOvertimes, rcfg);
                const estimatedCost = calculateEstimatedOvertimeCost(ps.primaryValue, rate, rcfg, breakdown);
                if (estimatedCost == null) return null;
                return (
                  <div className="flex items-center justify-between px-3 py-1.5 rounded-md bg-muted/40">
                    <div>
                      <p className="text-[11px] text-muted-foreground">Valor estimado</p>
                      <p className="text-[9px] text-muted-foreground/60">Sujeito à conferência</p>
                    </div>
                    <span className="text-xs font-mono font-medium text-foreground">
                      R$ {estimatedCost.toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                );
              })()}
              
              {/* Secondary: deficit in pay mode — visually subdued */}
              {ps.secondaryValue != null && ps.secondaryLabel && (
                <>
                  <div className="flex items-center justify-between px-3 py-1.5 rounded-md bg-muted/40">
                    <p className="text-[11px] text-muted-foreground">{ps.secondaryLabel}</p>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      -{Math.floor(ps.secondaryValue / 60)}h{String(ps.secondaryValue % 60).padStart(2, "0")}
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

        {/* Records Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Data</th>
                    <th className="px-3 py-2 text-center font-medium text-muted-foreground">Entrada</th>
                    <th className="px-3 py-2 text-center font-medium text-muted-foreground">Almoço</th>
                    <th className="px-3 py-2 text-center font-medium text-muted-foreground">Retorno</th>
                    <th className="px-3 py-2 text-center font-medium text-muted-foreground">Saída</th>
                    <th className="px-3 py-2 text-center font-medium text-muted-foreground">Total</th>
                    <th className="px-3 py-2 text-center font-medium text-muted-foreground">Status</th>
                    <th className="px-3 py-2 text-center font-medium text-muted-foreground w-10">
                      <HelpCircle className="h-3.5 w-3.5 mx-auto text-muted-foreground" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => {
                    const isFuture = new Date(r.date) > new Date();
                    if (isFuture) return null;
                    const wH = Math.floor(r.workedMinutes / 60);
                    const wM = r.workedMinutes % 60;
                    const hasAdj = r.explanation.adjustments.length > 0;
                    return (
                      <tr key={r.date} className={`border-b last:border-0 ${r.isNonWorkDay ? "bg-muted/20" : ""}`}>
                        <td className="px-3 py-2 font-medium">
                          {format(new Date(r.date + "T12:00:00"), "dd/MM EEE", { locale: ptBR })}
                        </td>
                        <td className="px-3 py-2 text-center font-mono">
                          {r.clockIn || "—"}
                          {hasAdj && r.explanation.adjustments.some(a => a.entryType === "clock_in") && (
                            <Badge variant="outline" className="ml-1 text-[9px] px-1 py-0 border-blue-500/50 text-blue-600 dark:text-blue-400">Aj.</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center font-mono">{r.breakStart || "—"}</td>
                        <td className="px-3 py-2 text-center font-mono">{r.breakEnd || "—"}</td>
                        <td className="px-3 py-2 text-center font-mono">
                          {r.clockOut || "—"}
                          {hasAdj && r.explanation.adjustments.some(a => a.entryType === "clock_out") && (
                            <Badge variant="outline" className="ml-1 text-[9px] px-1 py-0 border-blue-500/50 text-blue-600 dark:text-blue-400">Aj.</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center font-mono">
                          {r.workedMinutes > 0 ? `${wH}h${String(wM).padStart(2, "0")}` : "—"}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {r.isNonWorkDay ? (
                            <Badge variant="secondary" className="text-[10px]">Folga</Badge>
                          ) : r.isIncomplete ? (
                            <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600 dark:text-amber-400">Incompleto</Badge>
                          ) : r.isLate ? (
                            <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600 dark:text-amber-400">Atraso</Badge>
                          ) : r.workedMinutes > 0 ? (
                            <Badge variant="outline" className="text-[10px] border-green-500/50 text-green-600 dark:text-green-400">OK</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] border-destructive/50 text-destructive">Falta</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <DayCalculationDetail explanation={r.explanation} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
