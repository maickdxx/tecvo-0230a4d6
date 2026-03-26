import { useMemo } from "react";
import { useTimeClock } from "@/hooks/useTimeClock";
import { useWorkSchedules } from "@/hooks/useWorkSchedule";
import { useAuth } from "@/hooks/useAuth";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { getDatePartInTz } from "@/lib/timezone";
import { calculateOvertimeMinutes, calculateDeficitMinutes, getEffectiveMaxDay, computePolicySummary, resolveHourlyRate, calculateEstimatedOvertimeCost, calculateOvertimeBreakdown, getOvertimeRateConfig, type OvertimePolicy } from "@/lib/timeClockUtils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Wallet } from "lucide-react";

function formatBalance(minutes: number): string {
  const rounded = Math.round(minutes);
  const h = Math.floor(Math.abs(rounded) / 60);
  const m = Math.abs(rounded) % 60;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "-" : "";
  return `${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function JourneyBalanceCard() {
  const tz = useOrgTimezone();
  const { user, profile } = useAuth();
  const { effectiveMonthEntries, settings } = useTimeClock();
  const { getScheduleForEmployee, isWorkDay } = useWorkSchedules();

  const employeeType = (profile as any)?.employee_type || "tecnico";
  const overtimePolicy: OvertimePolicy = settings?.overtime_policy === "pay" ? "pay" : "bank";
  const toleranceMin = settings?.late_tolerance_minutes ?? 10;

  const schedule = getScheduleForEmployee(user?.id || "", employeeType);
  const expectedPerDay = Math.round(schedule.work_hours_per_day * 60);

  const rateConfig = getOvertimeRateConfig(settings);

  const { policySummary, dayOvertimes } = useMemo(() => {
    if (!effectiveMonthEntries.length || !expectedPerDay) {
      return { policySummary: computePolicySummary(overtimePolicy, 0, 0, 0, 0), dayOvertimes: [] as Array<{ date: string; overtimeMinutes: number }> };
    }

    const byDate = new Map<string, typeof effectiveMonthEntries>();
    const seen = new Set<string>();
    for (const e of effectiveMonthEntries) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      const d = getDatePartInTz(e.recorded_at, tz);
      if (!byDate.has(d)) byDate.set(d, []);
      byDate.get(d)!.push(e);
    }

    let totalOvertime = 0;
    let totalDeficit = 0;
    let totalWorked = 0;
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
      totalWorked += Math.floor(dayMinutes);
      const hasClockOut = sorted.some((e) => e.entry_type === "clock_out");
      if (hasClockOut) {
        const isNonWorkDayToday = !isWorkDay(date, user?.id || "", employeeType);
        const om = calculateOvertimeMinutes(dayMinutes, expectedPerDay, toleranceMin, isNonWorkDayToday);
        const dm = calculateDeficitMinutes(dayMinutes, expectedPerDay, toleranceMin, isNonWorkDayToday);
        totalOvertime += om;
        totalDeficit += dm;
        if (om > 0) dayOvertimes.push({ date, overtimeMinutes: om });
      }
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const maxDay = getEffectiveMaxDay(year, month);
    let expectedTotal = 0;
    for (let d = 1; d <= maxDay; d++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (isWorkDay(dateStr, user?.id || "", employeeType)) {
        expectedTotal += expectedPerDay;
      }
    }

    return {
      policySummary: computePolicySummary(overtimePolicy, Math.round(totalWorked), expectedTotal, Math.round(totalOvertime), Math.round(totalDeficit)),
      dayOvertimes,
    };
  }, [effectiveMonthEntries, expectedPerDay, toleranceMin, tz, user?.id, employeeType, isWorkDay, overtimePolicy, settings]);

  const isBank = policySummary.policy === "bank";
  const Icon = isBank ? Wallet : TrendingUp;

  const primaryPositive = policySummary.primaryValue > 0;
  const primaryNegative = policySummary.primaryValue < 0;
  const primaryZero = policySummary.primaryValue === 0;

  return (
    <div className="space-y-2">
      {/* Primary metric */}
      <Card className={`border ${primaryNegative ? "border-destructive/30" : primaryPositive ? "border-primary/30" : "border-border"}`}>
        <CardContent className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`rounded-full p-2 ${primaryNegative ? "bg-destructive/10" : primaryPositive ? "bg-primary/10" : "bg-muted"}`}>
              <Icon className={`h-4 w-4 ${primaryNegative ? "text-destructive" : primaryPositive ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-muted-foreground">{policySummary.primaryLabel} (mês)</p>
                <Badge variant="outline" className="text-[9px] px-1 py-0 leading-tight">
                  {isBank ? "Compensação" : "Pagamento"}
                </Badge>
              </div>
              <p className={`text-lg font-bold font-mono ${primaryNegative ? "text-destructive" : primaryPositive ? "text-primary" : "text-foreground"}`}>
                {primaryZero ? "00:00" : formatBalance(policySummary.primaryValue)}
              </p>
            </div>
          </div>
          {!primaryZero && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${primaryNegative ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
              {primaryNegative ? "Devendo" : isBank ? "Crédito" : "Acumuladas"}
            </span>
          )}
        </CardContent>
      </Card>

      {/* Estimated cost — pay mode only, employee view */}
      {!isBank && policySummary.primaryValue > 0 && (() => {
        const rate = resolveHourlyRate(
          (profile as any)?.hourly_rate,
          schedule.hourly_rate,
          (settings as any)?.default_hourly_rate,
        );
        const breakdown = calculateOvertimeBreakdown(dayOvertimes, rateConfig);
        const estimatedCost = calculateEstimatedOvertimeCost(policySummary.primaryValue, rate, rateConfig, breakdown);
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

      {/* Secondary metric: deficit in pay mode — visually subdued */}
      {policySummary.secondaryValue != null && policySummary.secondaryLabel && (
        <>
          <div className="flex items-center justify-between px-3 py-1.5 rounded-md bg-muted/40">
            <p className="text-[11px] text-muted-foreground">{policySummary.secondaryLabel}</p>
            <span className="text-[11px] font-mono text-muted-foreground">
              {formatBalance(-policySummary.secondaryValue)}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground/70 text-center">
            Extras e déficit são calculados separadamente nesta política.
          </p>
        </>
      )}
    </div>
  );
}
