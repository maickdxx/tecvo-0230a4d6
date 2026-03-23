import { describe, it, expect } from "vitest";
import { calculateOvertimeMinutes, computePolicySummary } from "@/lib/timeClockUtils";

/**
 * Overtime Policy Audit Tests
 * 
 * Validates that "bank" vs "pay" policy controls REAL behavioral differences:
 * - Bank: accumulates balance (positive/negative) for compensation
 * - Pay: shows overtime for payment + deficit separately (never mixed)
 */

describe("computePolicySummary — Policy-Driven Behavior", () => {
  const tolerance = 10;

  describe("Bank Policy", () => {
    it("shows positive balance when employee works more than expected", () => {
      const ps = computePolicySummary("bank", 10080, 9600, 480);
      expect(ps.primaryLabel).toBe("Saldo Banco de Horas");
      expect(ps.primaryValue).toBe(480); // +8h credit
      expect(ps.secondaryValue).toBeNull(); // no secondary in bank mode
    });

    it("shows negative balance when employee works less than expected", () => {
      const ps = computePolicySummary("bank", 9120, 9600, 0);
      expect(ps.primaryValue).toBe(-480); // -8h debit
      expect(ps.secondaryValue).toBeNull();
    });

    it("shows zero balance when exactly matching", () => {
      const ps = computePolicySummary("bank", 9600, 9600, 0);
      expect(ps.primaryValue).toBe(0);
    });

    it("badge says 'Compensação'", () => {
      const ps = computePolicySummary("bank", 9600, 9600, 0);
      expect(ps.policy).toBe("bank");
    });
  });

  describe("Pay Policy", () => {
    it("shows only overtime as primary (never negative)", () => {
      const ps = computePolicySummary("pay", 10080, 9600, 480);
      expect(ps.primaryLabel).toBe("Horas Extras a Pagar");
      expect(ps.primaryValue).toBe(480); // 8h overtime
      expect(ps.primaryValue).toBeGreaterThanOrEqual(0);
    });

    it("shows zero overtime when employee works less than expected", () => {
      const ps = computePolicySummary("pay", 9120, 9600, 0);
      expect(ps.primaryValue).toBe(0); // no overtime to pay
      expect(ps.primaryValue).toBeGreaterThanOrEqual(0); // NEVER negative
    });

    it("shows deficit as separate secondary metric", () => {
      const ps = computePolicySummary("pay", 9120, 9600, 0);
      expect(ps.secondaryLabel).toBe("Déficit de Jornada");
      expect(ps.secondaryValue).toBe(480); // 8h deficit
    });

    it("does NOT show deficit when employee meets expectations", () => {
      const ps = computePolicySummary("pay", 9600, 9600, 0);
      expect(ps.secondaryValue).toBeNull();
      expect(ps.secondaryLabel).toBeNull();
    });

    it("shows both overtime AND deficit when employee has mixed days", () => {
      // Employee worked some days with overtime but missed others
      // total worked: 9200, expected: 9600, daily overtime accumulated: 120
      const ps = computePolicySummary("pay", 9200, 9600, 120);
      expect(ps.primaryValue).toBe(120); // 2h overtime to pay
      expect(ps.secondaryValue).toBe(400); // ~6.7h deficit
    });

    it("badge says 'Pagamento'", () => {
      const ps = computePolicySummary("pay", 9600, 9600, 0);
      expect(ps.policy).toBe("pay");
    });
  });

  describe("Policy Switch: Same Data, Different Behavior", () => {
    const worked = 9200;
    const expected = 9600;
    const overtime = 120;

    it("bank shows net balance (-400 = deficit)", () => {
      const ps = computePolicySummary("bank", worked, expected, overtime);
      expect(ps.primaryValue).toBe(-400); // net negative
      expect(ps.secondaryValue).toBeNull();
    });

    it("pay separates overtime from deficit", () => {
      const ps = computePolicySummary("pay", worked, expected, overtime);
      expect(ps.primaryValue).toBe(120); // overtime to pay
      expect(ps.secondaryValue).toBe(400); // deficit to address
    });

    it("bank and pay have different primary labels", () => {
      const bankPs = computePolicySummary("bank", worked, expected, overtime);
      const payPs = computePolicySummary("pay", worked, expected, overtime);
      expect(bankPs.primaryLabel).not.toBe(payPs.primaryLabel);
    });
  });

  describe("calculateOvertimeMinutes (underlying engine)", () => {
    const expectedPerDay = 480;

    it("returns 0 within tolerance", () => {
      expect(calculateOvertimeMinutes(485, expectedPerDay, tolerance, false)).toBe(0);
    });

    it("returns full overtime beyond tolerance", () => {
      expect(calculateOvertimeMinutes(495, expectedPerDay, tolerance, false)).toBe(15);
    });

    it("counts all time on non-work days", () => {
      expect(calculateOvertimeMinutes(240, expectedPerDay, tolerance, true)).toBe(240);
    });
  });

  describe("Edge Cases", () => {
    it("handles zero worked, zero expected", () => {
      const ps = computePolicySummary("bank", 0, 0, 0);
      expect(ps.primaryValue).toBe(0);
      expect(ps.secondaryValue).toBeNull();
    });

    it("handles employee with no entries but expected hours (bank)", () => {
      const ps = computePolicySummary("bank", 0, 9600, 0);
      expect(ps.primaryValue).toBe(-9600);
    });

    it("handles employee with no entries but expected hours (pay)", () => {
      const ps = computePolicySummary("pay", 0, 9600, 0);
      expect(ps.primaryValue).toBe(0); // no overtime
      expect(ps.secondaryValue).toBe(9600); // full deficit
    });
  });
});
