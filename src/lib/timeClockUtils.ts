/**
 * Shared utilities for time clock calculations.
 * Single source of truth for all ponto modules.
 */

export interface ApprovedAdjustment {
  entry_id: string;
  new_time: string | null;
  status: string;
}

/**
 * Applies approved adjustments to time clock entries.
 * Returns entries with recorded_at replaced by the approved new_time when applicable.
 * The original entries remain immutable in the database — this is a read-layer projection.
 */
export function applyApprovedAdjustments<T extends { id: string; recorded_at: string }>(
  entries: T[],
  adjustments: ApprovedAdjustment[]
): T[] {
  const adjMap = new Map<string, string>();
  for (const adj of adjustments) {
    if (adj.status === "approved" && adj.new_time) {
      adjMap.set(adj.entry_id, adj.new_time);
    }
  }

  if (adjMap.size === 0) return entries;

  return entries.map(e => {
    const correctedTime = adjMap.get(e.id);
    if (!correctedTime) return e;
    return { ...e, recorded_at: correctedTime };
  });
}

/**
 * Calculate overtime with tolerance dead zone.
 * Based on CLT Art. 58 §1 — small variations within tolerance are NOT counted.
 *
 * @param workedMinutes - Total minutes worked in the day
 * @param expectedMinutes - Expected minutes based on employee's schedule
 * @param toleranceMinutes - Tolerance from org settings (late_tolerance_minutes)
 * @param isNonWorkDay - If true, all worked time counts as overtime
 * @returns Overtime minutes (floored)
 */
export function calculateOvertimeMinutes(
  workedMinutes: number,
  expectedMinutes: number,
  toleranceMinutes: number,
  isNonWorkDay: boolean
): number {
  if (isNonWorkDay) return Math.floor(workedMinutes);
  const diff = workedMinutes - expectedMinutes;
  if (diff <= 0) return 0;
  // Within tolerance band — not counted as overtime
  if (diff <= toleranceMinutes) return 0;
  return Math.floor(diff);
}

/**
 * Calculate journey deficit with tolerance dead zone.
 * Small variations within tolerance are NOT counted as deficit.
 *
 * @param workedMinutes - Total minutes worked in the day
 * @param expectedMinutes - Expected minutes based on employee's schedule
 * @param toleranceMinutes - Tolerance from org settings (late_tolerance_minutes)
 * @param isNonWorkDay - If true, it is NEVER a deficit
 * @returns Deficit minutes (floored)
 */
export function calculateDeficitMinutes(
  workedMinutes: number,
  expectedMinutes: number,
  toleranceMinutes: number,
  isNonWorkDay: boolean
): number {
  if (isNonWorkDay) return 0;
  const diff = expectedMinutes - workedMinutes;
  if (diff <= 0) return 0;
  // Within tolerance band — not counted as deficit
  if (diff <= toleranceMinutes) return 0;
  return Math.floor(diff);
}

/**
 * Policy-driven summary result.
 * Both policies calculate the same raw data, but surface different metrics.
 */
export type OvertimePolicy = "bank" | "pay";

export interface PolicySummary {
  policy: OvertimePolicy;
  /** Total minutes worked */
  totalWorked: number;
  /** Total expected minutes */
  expectedMinutes: number;
  /** Daily-accumulated overtime (CLT tolerance applied) — always >= 0 */
  totalOvertime: number;
  /** Daily-accumulated deficit (CLT tolerance applied) — always >= 0 */
  totalDeficit: number;
  
  // === BANK MODE fields ===
  /** Net balance (overtime - deficit) — can be negative */
  bankBalance: number;
  
  // === PAY MODE fields ===
  /** Deficit: days/minutes where employee worked less than expected — always >= 0 */
  journeyDeficit: number;
  
  /** Primary display value based on policy */
  primaryValue: number;
  /** Primary label */
  primaryLabel: string;
  /** Secondary display (deficit in pay mode, null in bank mode) */
  secondaryValue: number | null;
  /** Secondary label */
  secondaryLabel: string | null;
}

/**
 * Compute a policy-aware summary from raw calculation data.
 * This is the single source of truth for what to display.
 */
export function computePolicySummary(
  policy: OvertimePolicy,
  totalWorked: number,
  expectedMinutes: number,
  totalOvertime: number,
  totalDeficit?: number, // Optional for backward compat, but recommended
): PolicySummary {
  // If totalDeficit is not provided (legacy), we fall back to raw calculation (inconsistent but safe for now)
  const effectiveDeficit = totalDeficit !== undefined ? totalDeficit : Math.max(0, expectedMinutes - totalWorked);
  
  // Bank balance is now symmetric: Overtime - Deficit
  const bankBalance = Math.round(totalOvertime - effectiveDeficit);
  
  if (policy === "bank") {
    return {
      policy,
      totalWorked,
      expectedMinutes,
      totalOvertime,
      totalDeficit: effectiveDeficit,
      bankBalance,
      journeyDeficit: effectiveDeficit,
      primaryValue: bankBalance,
      primaryLabel: "Saldo Banco de Horas",
      secondaryValue: null,
      secondaryLabel: null,
    };
  }
  
  // PAY mode: show overtime for payment, deficit separately
  return {
    policy,
    totalWorked,
    expectedMinutes,
    totalOvertime,
    totalDeficit: effectiveDeficit,
    bankBalance,
    journeyDeficit: effectiveDeficit,
    primaryValue: totalOvertime,
    primaryLabel: "Horas Extras a Pagar",
    secondaryValue: effectiveDeficit > 0 ? effectiveDeficit : null,
    secondaryLabel: effectiveDeficit > 0 ? "Déficit de Jornada" : null,
  };
}

/**
 * Determine the effective end date for expected-days calculations.
 *
 * Rules:
 * - Past month: full month (last day)
 * - Current month (open): today
 * - Current month (closed): closure date (snapshot stability)
 * - Reopened month: today (recalculates live)
 *
 * @param year - calendar year
 * @param month - calendar month (1-12)
 * @param closedAt - ISO string of when the period was closed, or null
 * @param reopenedAt - ISO string of when the period was reopened, or null
 * @returns day-of-month to count up to (inclusive)
 */
export function getEffectiveMaxDay(
  year: number,
  month: number,
  closedAt?: string | null,
  reopenedAt?: string | null,
): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === (now.getMonth() + 1);

  if (!isCurrentMonth) return daysInMonth; // past or future month → full

  const isClosed = !!closedAt && !reopenedAt;
  if (isClosed) {
    // Use the day the period was closed as the snapshot boundary
    const closedDate = new Date(closedAt!);
    return Math.min(closedDate.getDate(), daysInMonth);
  }

  // Open current month → up to today
  return Math.min(now.getDate(), daysInMonth);
}

/**
 * Source of the resolved hourly rate.
 */
export type HourlyRateSource = "profile" | "schedule" | "default" | null;

export interface ResolvedHourlyRate {
  value: number | null;
  source: HourlyRateSource;
}

/**
 * Resolve the effective hourly rate for an employee.
 * Priority: employee profile > work schedule > org default settings.
 *
 * @param profileHourlyRate - From profiles.hourly_rate
 * @param scheduleHourlyRate - From time_clock_work_schedules.hourly_rate
 * @param defaultHourlyRate - From time_clock_settings.default_hourly_rate
 * @returns The resolved hourly rate, or null if none configured
 */
export function resolveHourlyRate(
  profileHourlyRate?: number | null,
  scheduleHourlyRate?: number | null,
  defaultHourlyRate?: number | null,
): number | null {
  return resolveHourlyRateWithSource(profileHourlyRate, scheduleHourlyRate, defaultHourlyRate).value;
}

/**
 * Same as resolveHourlyRate but also returns the source of the resolved value.
 */
export function resolveHourlyRateWithSource(
  profileHourlyRate?: number | null,
  scheduleHourlyRate?: number | null,
  defaultHourlyRate?: number | null,
): ResolvedHourlyRate {
  if (profileHourlyRate != null && profileHourlyRate > 0) return { value: profileHourlyRate, source: "profile" };
  if (scheduleHourlyRate != null && scheduleHourlyRate > 0) return { value: scheduleHourlyRate, source: "schedule" };
  if (defaultHourlyRate != null && defaultHourlyRate > 0) return { value: defaultHourlyRate, source: "default" };
  return { value: null, source: null };
}

// ─── Overtime Rate Configuration ───────────────────────────────────

export interface OvertimeRateConfig {
  /** Additional percentage for weekday overtime (e.g. 50 = 50%) */
  overtimeRateWeekday: number;
  /** Additional percentage for weekend/holiday overtime (e.g. 100 = 100%) */
  overtimeRateWeekend: number;
  /** Whether Saturday counts as weekend for overtime purposes */
  considerSaturdayWeekend: boolean;
}

/** Default overtime rates (CLT standard) */
export const DEFAULT_OVERTIME_RATES: OvertimeRateConfig = {
  overtimeRateWeekday: 50,
  overtimeRateWeekend: 100,
  considerSaturdayWeekend: true,
};

/**
 * Extract overtime rate config from settings object.
 * Returns defaults if not configured — ensures backward compatibility.
 */
export function getOvertimeRateConfig(settings: any): OvertimeRateConfig {
  if (!settings) return DEFAULT_OVERTIME_RATES;
  return {
    overtimeRateWeekday: settings.overtime_rate_weekday ?? DEFAULT_OVERTIME_RATES.overtimeRateWeekday,
    overtimeRateWeekend: settings.overtime_rate_weekend ?? DEFAULT_OVERTIME_RATES.overtimeRateWeekend,
    considerSaturdayWeekend: settings.consider_saturday_weekend ?? DEFAULT_OVERTIME_RATES.considerSaturdayWeekend,
  };
}

// ─── Overtime Breakdown ────────────────────────────────────────────

export interface OvertimeBreakdown {
  weekdayMinutes: number;
  weekendMinutes: number;
  totalMinutes: number;
}

/**
 * Classify overtime minutes by day type (weekday vs weekend).
 * Each entry in dayOvertimes must include the date string and overtime minutes.
 *
 * @param dayOvertimes - Array of { date: "YYYY-MM-DD", overtimeMinutes: number }
 * @param config - Overtime rate configuration
 * @returns Breakdown of overtime by day type
 */
export function calculateOvertimeBreakdown(
  dayOvertimes: Array<{ date: string; overtimeMinutes: number }>,
  config: OvertimeRateConfig,
): OvertimeBreakdown {
  let weekdayMinutes = 0;
  let weekendMinutes = 0;

  for (const { date, overtimeMinutes } of dayOvertimes) {
    if (overtimeMinutes <= 0) continue;
    const dayOfWeek = new Date(date + "T12:00:00").getDay(); // 0=Sun, 6=Sat
    const isSunday = dayOfWeek === 0;
    const isSaturday = dayOfWeek === 6;
    const isWeekend = isSunday || (isSaturday && config.considerSaturdayWeekend);

    if (isWeekend) {
      weekendMinutes += overtimeMinutes;
    } else {
      weekdayMinutes += overtimeMinutes;
    }
  }

  return {
    weekdayMinutes: Math.round(weekdayMinutes),
    weekendMinutes: Math.round(weekendMinutes),
    totalMinutes: Math.round(weekdayMinutes + weekendMinutes),
  };
}

// ─── Estimated Overtime Cost ───────────────────────────────────────

/**
 * Calculate estimated overtime cost with CLT-style multipliers.
 *
 * When breakdown is provided, applies different rates to weekday vs weekend minutes.
 * When breakdown is NOT provided (fallback), uses the old simple calculation
 * with the weekday rate applied uniformly — ensuring backward compatibility.
 *
 * @param overtimeMinutes - Total overtime minutes (used as fallback)
 * @param hourlyRate - Resolved hourly rate
 * @param rateConfig - Overtime rate configuration (optional for backward compat)
 * @param breakdown - Overtime breakdown by day type (optional for backward compat)
 * @returns Estimated cost in BRL, or null if rate/overtime unavailable
 */
export function calculateEstimatedOvertimeCost(
  overtimeMinutes: number,
  hourlyRate: number | null,
  rateConfig?: OvertimeRateConfig | null,
  breakdown?: OvertimeBreakdown | null,
): number | null {
  if (!hourlyRate || hourlyRate <= 0 || overtimeMinutes <= 0) return null;

  // Fallback: no config or breakdown → simple multiplication (legacy behavior)
  if (!rateConfig || !breakdown) {
    return (overtimeMinutes / 60) * hourlyRate;
  }

  // Apply differentiated rates
  const weekdayCost = (breakdown.weekdayMinutes / 60) * hourlyRate * (1 + rateConfig.overtimeRateWeekday / 100);
  const weekendCost = (breakdown.weekendMinutes / 60) * hourlyRate * (1 + rateConfig.overtimeRateWeekend / 100);

  return weekdayCost + weekendCost;
}
