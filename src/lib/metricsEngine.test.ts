import { describe, it, expect } from "vitest";
import { getReceitaPrevista, getReceitaReal } from "./metricsEngine";
import type { Service } from "@/hooks/useServices";
import type { Transaction } from "@/hooks/useTransactions";

const makeService = (overrides: Partial<Service>): Service => ({
  id: "1",
  organization_id: "org1",
  client_id: "c1",
  service_type: "maintenance",
  status: "scheduled",
  document_type: "service_order",
  value: 500,
  scheduled_date: "2026-02-15T10:00:00+00:00",
  completed_date: null,
  description: null,
  notes: null,
  payment_conditions: null,
  quote_validity_days: null,
  quote_number: null,
  assigned_to: null,
  service_zip_code: null,
  service_street: null,
  service_number: null,
  service_complement: null,
  service_neighborhood: null,
  service_city: null,
  service_state: null,
  equipment_type: null,
  equipment_brand: null,
  equipment_model: null,
  solution: null,
  payment_method: null,
  payment_due_date: null,
  payment_notes: null,
  entry_date: null,
  exit_date: null,
  created_at: "2026-02-10T12:00:00+00:00",
  updated_at: "2026-02-10T12:00:00+00:00",
  ...overrides,
});

const makeTransaction = (overrides: Partial<Transaction>): Transaction => ({
  id: "t1",
  organization_id: "org1",
  type: "income",
  category: "service",
  amount: 500,
  description: "Test",
  date: "2026-02-15",
  status: "paid",
  due_date: null,
  payment_date: null,
  payment_method: null,
  financial_account_id: null,
  client_id: null,
  service_id: null,
  supplier_id: null,
  employee_id: null,
  notes: null,
  recurrence: null,
  deleted_at: null,
  created_at: "2026-02-10T12:00:00+00:00",
  updated_at: "2026-02-10T12:00:00+00:00",
  compensation_date: null,
  payment_source_type: null,
  ...overrides,
} as Transaction);

describe("getReceitaPrevista", () => {
  it("sums scheduled and in_progress services within period", () => {
    const services = [
      makeService({ id: "1", status: "completed", value: 500 }),
      makeService({ id: "2", status: "scheduled", value: 800 }),
      makeService({ id: "3", status: "in_progress", value: 700 }),
    ];

    const result = getReceitaPrevista(services, "2026-02-01", "2026-02-28");
    expect(result).toBe(1500);
  });

  it("excludes services without scheduled_date", () => {
    const services = [
      makeService({ id: "1", status: "scheduled", value: 300, scheduled_date: null }),
      makeService({ id: "2", status: "scheduled", value: 400 }),
    ];

    const result = getReceitaPrevista(services, "2026-02-01", "2026-02-28");
    expect(result).toBe(400);
  });

  it("excludes services outside period", () => {
    const services = [
      makeService({ id: "1", status: "scheduled", value: 500, scheduled_date: "2026-03-05T10:00:00+00:00" }),
      makeService({ id: "2", status: "scheduled", value: 200 }),
    ];

    const result = getReceitaPrevista(services, "2026-02-01", "2026-02-28");
    expect(result).toBe(200);
  });

  it("includes services on last day of period with timestamp", () => {
    const services = [
      makeService({ id: "1", status: "scheduled", value: 1000, scheduled_date: "2026-02-28T08:00:00+00:00" }),
    ];

    const result = getReceitaPrevista(services, "2026-02-01", "2026-02-28");
    expect(result).toBe(1000);
  });

  it("handles day granularity with T23:59:59 data_fim", () => {
    const services = [
      makeService({ id: "1", status: "scheduled", value: 220, scheduled_date: "2026-02-13T15:00:00+00:00" }),
    ];

    const result = getReceitaPrevista(services, "2026-02-13", "2026-02-13T23:59:59");
    expect(result).toBe(220);
  });
});

describe("getReceitaReal", () => {
  it("sums only paid income transactions", () => {
    const transactions = [
      makeTransaction({ id: "t1", amount: 500, status: "paid" }),
      makeTransaction({ id: "t2", amount: 300, status: "pending" }),
      makeTransaction({ id: "t3", amount: 200, status: "paid" }),
    ];

    const result = getReceitaReal(transactions);
    expect(result).toBe(700);
  });

  it("returns 0 when no paid transactions", () => {
    const transactions = [
      makeTransaction({ id: "t1", amount: 500, status: "pending" }),
    ];

    const result = getReceitaReal(transactions);
    expect(result).toBe(0);
  });
});
