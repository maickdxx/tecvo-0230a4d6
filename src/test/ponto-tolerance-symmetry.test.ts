import { describe, it, expect } from "vitest";
import { calculateOvertimeMinutes, calculateDeficitMinutes, computePolicySummary } from "@/lib/timeClockUtils";

describe("Symmetric Tolerance Rules", () => {
  const tolerance = 10;
  const expected = 480;

  describe("calculateOvertimeMinutes", () => {
    it("returns 0 when overtime is exactly the tolerance", () => {
      expect(calculateOvertimeMinutes(490, expected, tolerance, false)).toBe(0);
    });

    it("returns full overtime when it exceeds tolerance", () => {
      expect(calculateOvertimeMinutes(491, expected, tolerance, false)).toBe(11);
    });

    it("returns 0 when worked is less than expected", () => {
      expect(calculateOvertimeMinutes(470, expected, tolerance, false)).toBe(0);
    });
  });

  describe("calculateDeficitMinutes", () => {
    it("returns 0 when deficit is exactly the tolerance", () => {
      expect(calculateDeficitMinutes(470, expected, tolerance, false)).toBe(0);
    });

    it("returns full deficit when it exceeds tolerance", () => {
      expect(calculateDeficitMinutes(469, expected, tolerance, false)).toBe(11);
    });

    it("returns 0 when worked is more than expected", () => {
      expect(calculateDeficitMinutes(490, expected, tolerance, false)).toBe(0);
    });

    it("returns 0 on non-work days even if worked is 0", () => {
      expect(calculateDeficitMinutes(0, expected, tolerance, true)).toBe(0);
    });
  });

  describe("Symmetric Bank Balance (computePolicySummary)", () => {
    it("results in 0 balance for small overtime (within tolerance)", () => {
      const worked = 485;
      const om = calculateOvertimeMinutes(worked, expected, tolerance, false);
      const dm = calculateDeficitMinutes(worked, expected, tolerance, false);
      const ps = computePolicySummary("bank", worked, expected, om, dm);
      
      expect(om).toBe(0);
      expect(dm).toBe(0);
      expect(ps.bankBalance).toBe(0);
    });

    it("results in 0 balance for small delay (within tolerance)", () => {
      const worked = 475;
      const om = calculateOvertimeMinutes(worked, expected, tolerance, false);
      const dm = calculateDeficitMinutes(worked, expected, tolerance, false);
      const ps = computePolicySummary("bank", worked, expected, om, dm);
      
      expect(om).toBe(0);
      expect(dm).toBe(0);
      expect(ps.bankBalance).toBe(0);
    });

    it("results in full balance for large overtime", () => {
      const worked = 500;
      const om = calculateOvertimeMinutes(worked, expected, tolerance, false);
      const dm = calculateDeficitMinutes(worked, expected, tolerance, false);
      const ps = computePolicySummary("bank", worked, expected, om, dm);
      
      expect(om).toBe(20);
      expect(dm).toBe(0);
      expect(ps.bankBalance).toBe(20);
    });

    it("results in full negative balance for large delay", () => {
      const worked = 460;
      const om = calculateOvertimeMinutes(worked, expected, tolerance, false);
      const dm = calculateDeficitMinutes(worked, expected, tolerance, false);
      const ps = computePolicySummary("bank", worked, expected, om, dm);
      
      expect(om).toBe(0);
      expect(dm).toBe(20);
      expect(ps.bankBalance).toBe(-20);
    });
  });

  describe("Non-Work Days", () => {
    it("counts all worked time as positive balance", () => {
      const worked = 120;
      const om = calculateOvertimeMinutes(worked, 0, tolerance, true);
      const dm = calculateDeficitMinutes(worked, 0, tolerance, true);
      const ps = computePolicySummary("bank", worked, 0, om, dm);
      
      expect(om).toBe(120);
      expect(dm).toBe(0);
      expect(ps.bankBalance).toBe(120);
    });
  });
});
