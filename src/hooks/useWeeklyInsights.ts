import { useMemo } from "react";
import type { TimeClockEntry, TimeClockEntryType } from "@/hooks/useTimeClock";
import { getDatePartInTz } from "@/lib/timezone";
import { calculateOvertimeMinutes } from "@/lib/timeClockUtils";

export interface WeeklyInsight {
  id: string;
  type: "recurring_lateness" | "recurring_incomplete" | "weekly_summary";
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
}

export interface WeeklyImpactMetrics {
  totalOvertimeMinutes: number;
  totalLateMinutes: number;
  totalIncompleteRecords: number;
  daysWorked: number;
  estimatedOvertimeCost: number | null; // null when hourly_rate not set
}

interface DaySummary {
  date: string;
  hasClockIn: boolean;
  hasClockOut: boolean;
  lateMinutes: number;
  workedMinutes: number;
  overtimeMinutes: number;
  isIncomplete: boolean;
}

interface UseWeeklyInsightsOptions {
  recentEntries: TimeClockEntry[];
  expectedClockIn: string; // "HH:mm"
  expectedMinutes: number;
  toleranceMinutes: number;
  tz: string;
  hourlyRate?: number | null;
}

interface UseWeeklyInsightsResult {
  insights: WeeklyInsight[];
  impact: WeeklyImpactMetrics;
}

/**
 * Analyses the last 7 days of time clock entries and returns behavioral insights + impact metrics.
 */
export function useWeeklyInsights({
  recentEntries,
  expectedClockIn,
  expectedMinutes,
  toleranceMinutes,
  tz,
  hourlyRate,
}: UseWeeklyInsightsOptions): UseWeeklyInsightsResult {
  return useMemo(() => {
    const emptyImpact: WeeklyImpactMetrics = {
      totalOvertimeMinutes: 0,
      totalLateMinutes: 0,
      totalIncompleteRecords: 0,
      daysWorked: 0,
      estimatedOvertimeCost: null,
    };

    if (recentEntries.length === 0) return { insights: [], impact: emptyImpact };

    // Group entries by local date
    const byDate = new Map<string, TimeClockEntry[]>();
    for (const e of recentEntries) {
      const d = getDatePartInTz(e.recorded_at, tz);
      if (!byDate.has(d)) byDate.set(d, []);
      byDate.get(d)!.push(e);
    }

    // Today's date — exclude from pattern analysis
    const now = new Date();
    const todayStr = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");

    const [eh, em] = expectedClockIn.split(":").map(Number);
    const expectedMin = eh * 60 + em;

    // Build daily summaries (excluding today)
    const summaries: DaySummary[] = [];
    for (const [date, entries] of byDate) {
      if (date === todayStr) continue;

      const sorted = [...entries].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
      const clockIn = sorted.find((e) => e.entry_type === "clock_in");
      const clockOut = sorted.find((e) => e.entry_type === "clock_out");

      let lateMinutes = 0;
      if (clockIn) {
        const d = new Date(clockIn.recorded_at);
        const actual = d.getHours() * 60 + d.getMinutes();
        const diff = actual - expectedMin;
        if (diff > toleranceMinutes) lateMinutes = diff;
      }

      // Calculate worked
      let worked = 0;
      let ci: Date | null = null;
      for (const e of sorted) {
        const t = new Date(e.recorded_at);
        if (e.entry_type === "clock_in" || e.entry_type === "break_end") ci = t;
        if ((e.entry_type === "break_start" || e.entry_type === "clock_out") && ci) {
          worked += (t.getTime() - ci.getTime()) / 60000;
          ci = null;
        }
      }

      const overtime = clockOut
        ? calculateOvertimeMinutes(worked, expectedMinutes, toleranceMinutes, false)
        : 0;

      summaries.push({
        date,
        hasClockIn: !!clockIn,
        hasClockOut: !!clockOut,
        lateMinutes,
        workedMinutes: Math.round(worked),
        overtimeMinutes: Math.floor(overtime),
        isIncomplete: !!clockIn && !clockOut,
      });
    }

    if (summaries.length === 0) return { insights: [], impact: emptyImpact };

    const insights: WeeklyInsight[] = [];

    // --- Pattern: Recurring lateness ---
    const lateDays = summaries.filter((s) => s.lateMinutes > 0);
    if (lateDays.length >= 3) {
      const avgLate = Math.round(lateDays.reduce((a, s) => a + s.lateMinutes, 0) / lateDays.length);
      insights.push({
        id: "recurring_lateness",
        type: "recurring_lateness",
        severity: "critical",
        title: `Atrasos recorrentes: ${lateDays.length} dias na semana`,
        description: `Média de ${avgLate}min de atraso. Considere revisar o horário ou justificar.`,
      });
    } else if (lateDays.length === 2) {
      insights.push({
        id: "recurring_lateness",
        type: "recurring_lateness",
        severity: "warning",
        title: `Atrasos em ${lateDays.length} dias esta semana`,
        description: "Atenção ao padrão. Um terceiro atraso gera alerta crítico.",
      });
    }

    // --- Pattern: Recurring incomplete ---
    const incompleteDays = summaries.filter((s) => s.isIncomplete);
    if (incompleteDays.length >= 2) {
      insights.push({
        id: "recurring_incomplete",
        type: "recurring_incomplete",
        severity: incompleteDays.length >= 3 ? "critical" : "warning",
        title: `Saída não registrada em ${incompleteDays.length} dias`,
        description: "Lembre-se de registrar a saída ao final da jornada.",
      });
    }

    // --- Impact metrics ---
    const totalLateMinutes = summaries.reduce((a, s) => a + s.lateMinutes, 0);
    const totalOvertimeMinutes = summaries.reduce((a, s) => a + s.overtimeMinutes, 0);
    const totalIncompleteRecords = incompleteDays.length;
    const daysWorked = summaries.filter((s) => s.hasClockIn).length;

    // CLT overtime: 1.5x normal rate
    const estimatedOvertimeCost =
      hourlyRate != null && hourlyRate > 0
        ? (totalOvertimeMinutes / 60) * hourlyRate * 1.5
        : null;

    // --- Weekly summary ---
    const totalInconsistencies = incompleteDays.length + lateDays.length;

    if (daysWorked > 0) {
      const otH = Math.floor(totalOvertimeMinutes / 60);
      const otM = totalOvertimeMinutes % 60;
      const parts: string[] = [];
      if (daysWorked > 0) parts.push(`${daysWorked} dia${daysWorked > 1 ? "s" : ""} trabalhado${daysWorked > 1 ? "s" : ""}`);
      if (lateDays.length > 0) parts.push(`${lateDays.length} atraso${lateDays.length > 1 ? "s" : ""}`);
      if (totalOvertimeMinutes > 0) parts.push(`+${otH}h${String(otM).padStart(2, "0")} extras`);
      if (totalInconsistencies > 0) parts.push(`${totalInconsistencies} inconsistência${totalInconsistencies > 1 ? "s" : ""}`);

      insights.push({
        id: "weekly_summary",
        type: "weekly_summary",
        severity: "info",
        title: "Resumo dos últimos 7 dias",
        description: parts.join(" · "),
      });
    }

    const impact: WeeklyImpactMetrics = {
      totalOvertimeMinutes,
      totalLateMinutes,
      totalIncompleteRecords,
      daysWorked,
      estimatedOvertimeCost,
    };

    return { insights, impact };
  }, [recentEntries, expectedClockIn, expectedMinutes, toleranceMinutes, tz, hourlyRate]);
}
