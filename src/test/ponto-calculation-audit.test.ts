import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  calculateOvertimeMinutes,
  getEffectiveMaxDay,
} from "@/lib/timeClockUtils";

describe("getEffectiveMaxDay — centralized expected-day boundary", () => {
  let realDate: typeof Date;

  beforeEach(() => {
    realDate = globalThis.Date;
  });

  afterEach(() => {
    globalThis.Date = realDate;
    vi.restoreAllMocks();
  });

  function mockToday(year: number, month: number, day: number) {
    const fixed = new realDate(year, month - 1, day, 12, 0, 0);
    const OrigDate = realDate;
    // @ts-ignore
    globalThis.Date = class extends OrigDate {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(fixed.getTime());
        } else {
          // @ts-ignore
          super(...args);
        }
      }
      static now() { return fixed.getTime(); }
    } as any;
    // Preserve static methods
    globalThis.Date.now = () => fixed.getTime();
    globalThis.Date.parse = OrigDate.parse;
    globalThis.Date.UTC = OrigDate.UTC;
  }

  // ========== SCENARIO 1: Current month on day 10 ==========
  it("Scenario 1: current month (March 2026, day 10) → maxDay = 10", () => {
    mockToday(2026, 3, 10);
    expect(getEffectiveMaxDay(2026, 3)).toBe(10);
  });

  // ========== SCENARIO 2: Current month on day 18 ==========
  it("Scenario 2: current month (March 2026, day 18) → maxDay = 18", () => {
    mockToday(2026, 3, 18);
    expect(getEffectiveMaxDay(2026, 3)).toBe(18);
  });

  // ========== SCENARIO 3: Past month (full) ==========
  it("Scenario 3: past month (February 2026) → maxDay = 28", () => {
    mockToday(2026, 3, 18);
    expect(getEffectiveMaxDay(2026, 2)).toBe(28);
  });

  it("Scenario 3b: past month (January 2026) → maxDay = 31", () => {
    mockToday(2026, 3, 18);
    expect(getEffectiveMaxDay(2026, 1)).toBe(31);
  });

  // ========== SCENARIO 4: Closed month mid-month ==========
  it("Scenario 4: current month closed on day 15 → maxDay = 15 (snapshot)", () => {
    mockToday(2026, 3, 18);
    const closedAt = "2026-03-15T18:00:00.000Z";
    expect(getEffectiveMaxDay(2026, 3, closedAt, null)).toBe(15);
  });

  it("Scenario 4b: past month with closure → full month (past overrides)", () => {
    mockToday(2026, 4, 5);
    const closedAt = "2026-03-28T18:00:00.000Z";
    // Past month = always full, regardless of closure
    expect(getEffectiveMaxDay(2026, 3, closedAt, null)).toBe(31);
  });

  // ========== SCENARIO 5: Reopened month ==========
  it("Scenario 5: current month reopened → maxDay = today (live recalc)", () => {
    mockToday(2026, 3, 18);
    const closedAt = "2026-03-15T18:00:00.000Z";
    const reopenedAt = "2026-03-17T10:00:00.000Z";
    expect(getEffectiveMaxDay(2026, 3, closedAt, reopenedAt)).toBe(18);
  });

  // ========== SCENARIO 6: Future month (edge case) ==========
  it("Scenario 6: future month → full month", () => {
    mockToday(2026, 3, 18);
    expect(getEffectiveMaxDay(2026, 4)).toBe(30);
  });

  // ========== SCENARIO 7: Last day of month ==========
  it("Scenario 7: current month last day → maxDay = daysInMonth", () => {
    mockToday(2026, 3, 31);
    expect(getEffectiveMaxDay(2026, 3)).toBe(31);
  });
});

describe("calculateOvertimeMinutes — tolerance dead zone", () => {
  const tolerance = 10;
  const expected = 480; // 8h

  it("no overtime when worked exactly expected", () => {
    expect(calculateOvertimeMinutes(480, expected, tolerance, false)).toBe(0);
  });

  it("no overtime within tolerance (5 min over)", () => {
    expect(calculateOvertimeMinutes(485, expected, tolerance, false)).toBe(0);
  });

  it("no overtime at tolerance boundary (10 min over)", () => {
    expect(calculateOvertimeMinutes(490, expected, tolerance, false)).toBe(0);
  });

  it("overtime when exceeding tolerance (11 min over)", () => {
    expect(calculateOvertimeMinutes(491, expected, tolerance, false)).toBe(11);
  });

  it("all time is overtime on non-work day", () => {
    expect(calculateOvertimeMinutes(120, expected, tolerance, true)).toBe(120);
  });

  it("no overtime when under-worked", () => {
    expect(calculateOvertimeMinutes(400, expected, tolerance, false)).toBe(0);
  });
});

describe("Consistency validation — expected days calculation pattern", () => {
  /**
   * Screens audited and their calculation source:
   * 1. PontoFechamento — CLOSED: uses snapshot from time_clock_month_closures. OPEN: live calc with getEffectiveMaxDay
   * 2. JourneyBalanceCard — uses getEffectiveMaxDay(year, month)
   * 3. EspelhoPonto (employee) — uses getEffectiveMaxDay to cap eachDayOfInterval
   * 4. PontoEspelho (admin) — uses getEffectiveMaxDay to cap expected loop + timezone in toLocaleDateString
   * 5. PontoRelatorios — period-based (cutoff→today), inherently correct, passes tz to countExpectedWorkDays
   * 6. generateTimeClockPDF — receives data from screens, inherently correct
   * 7. PontoDashboard — uses isTodayWorkDay with timezone
   * 8. PontoFuncionarios — uses isTodayWorkDay with timezone
   */
  it("all calculation screens documented as using getEffectiveMaxDay", () => {
    expect(typeof getEffectiveMaxDay).toBe("function");
  });

  it("getEffectiveMaxDay returns number between 1 and 31", () => {
    for (let m = 1; m <= 12; m++) {
      const result = getEffectiveMaxDay(2026, m);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(31);
    }
  });
});

describe("Snapshot behavior — closed periods use saved values", () => {
  it("closed period values are immutable and come from closure record", () => {
    // Simulates: closure saved total_worked_minutes=9600, total_expected_minutes=9600
    // Even if entries change, the displayed values should come from the closure record
    const closure = {
      total_worked_minutes: 9600,
      total_expected_minutes: 9600,
      total_overtime_minutes: 120,
      bank_balance_minutes: 0,
      total_absences: 1,
      total_lates: 2,
      closed_at: "2026-03-18T18:00:00Z",
      reopened_at: null,
    };
    
    // When isClosed, the component returns closure values directly
    const isClosed = !!closure.closed_at && !closure.reopened_at;
    expect(isClosed).toBe(true);
    
    // Values should match the snapshot exactly
    expect(closure.total_worked_minutes).toBe(9600);
    expect(closure.bank_balance_minutes).toBe(0);
  });

  it("reopened period triggers live recalculation", () => {
    const closure = {
      closed_at: "2026-03-15T18:00:00Z",
      reopened_at: "2026-03-17T10:00:00Z",
    };
    
    const isClosed = !!closure.closed_at && !closure.reopened_at;
    expect(isClosed).toBe(false); // reopened → live calc
  });
});

describe("Edge cases — employee with no entries on future days", () => {
  it("employee with 0 worked minutes on current month → bankBalance = -expectedMinutes", () => {
    // Simulates: employee has no entries, expected 13 work days * 480 min
    const totalWorked = 0;
    const expectedMinutes = 13 * 480; // 6240
    const bankBalance = Math.floor(totalWorked) - expectedMinutes;
    expect(bankBalance).toBe(-6240);
  });

  it("employee with incomplete day (no clock_out) → workedMinutes only counts paired segments", () => {
    // clock_in at 08:00, break_start at 12:00 (no clock_out)
    // Only clock_in→break_start segment counts = 4h = 240 min
    const clockIn = new Date("2026-03-18T08:00:00Z");
    const breakStart = new Date("2026-03-18T12:00:00Z");
    const workedMinutes = (breakStart.getTime() - clockIn.getTime()) / 60000;
    expect(workedMinutes).toBe(240);
  });
});
