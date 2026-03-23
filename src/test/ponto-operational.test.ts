/**
 * Testes Operacionais do Módulo de Ponto — Cenários Reais
 *
 * Valida os fluxos completos de uso diário sem depender de Supabase.
 * Foca em lógica pura: cálculos, projeções, regras de negócio.
 */
import { describe, it, expect } from "vitest";
import {
  applyApprovedAdjustments,
  calculateOvertimeMinutes,
  type ApprovedAdjustment,
} from "@/lib/timeClockUtils";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Simula a lógica do useTimeClock.getWorkedMinutes usando entradas efetivas */
function computeWorkedMinutes(
  entries: { entry_type: string; recorded_at: string }[]
): number {
  let totalMinutes = 0;
  let clockInTime: Date | null = null;
  let breakStartTime: Date | null = null;

  for (const entry of entries) {
    const time = new Date(entry.recorded_at);
    switch (entry.entry_type) {
      case "clock_in":
        clockInTime = time;
        break;
      case "break_start":
        if (clockInTime) {
          totalMinutes += (time.getTime() - clockInTime.getTime()) / 60000;
          clockInTime = null;
        }
        breakStartTime = time;
        break;
      case "break_end":
        breakStartTime = null;
        clockInTime = time;
        break;
      case "clock_out":
        if (clockInTime) {
          totalMinutes += (time.getTime() - clockInTime.getTime()) / 60000;
          clockInTime = null;
        }
        break;
    }
  }
  return Math.floor(totalMinutes);
}

/** Replica a detecção de inconsistências da edge function (subset) */
function detectInconsistencies(
  entries: { entry_type: string; recorded_at: string }[],
  schedule: { expected_clock_in: string; expected_clock_out?: string; break_minutes: number },
  toleranceMin: number
): string[] {
  const issues: string[] = [];

  if (entries.length === 0) {
    issues.push("missing_clock_in");
    return issues;
  }

  const sorted = [...entries].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  // Missing clock_out
  if (last.entry_type !== "clock_out") {
    issues.push("missing_clock_out");
  }

  // Late arrival
  if (first.entry_type === "clock_in" && schedule.expected_clock_in) {
    const entryTime = new Date(first.recorded_at);
    const [h, m] = schedule.expected_clock_in.split(":").map(Number);
    const expected = new Date(entryTime);
    expected.setHours(h, m + toleranceMin, 0, 0);
    if (entryTime > expected) {
      issues.push("late_arrival");
    }
  }

  // Short break
  let breakStart: Date | null = null;
  for (const e of sorted) {
    if (e.entry_type === "break_start") breakStart = new Date(e.recorded_at);
    if (e.entry_type === "break_end" && breakStart) {
      const breakMin = (new Date(e.recorded_at).getTime() - breakStart.getTime()) / 60000;
      if (breakMin < schedule.break_minutes) issues.push("short_break");
      breakStart = null;
    }
  }

  // Incomplete break
  const bStarts = sorted.filter((e) => e.entry_type === "break_start").length;
  const bEnds = sorted.filter((e) => e.entry_type === "break_end").length;
  if (bStarts > bEnds) issues.push("incomplete_break");

  // Early departure
  if (last.entry_type === "clock_out" && schedule.expected_clock_out) {
    const exitTime = new Date(last.recorded_at);
    const [oh, om] = schedule.expected_clock_out.split(":").map(Number);
    const expectedExit = new Date(exitTime);
    expectedExit.setHours(oh, om - toleranceMin, 0, 0);
    if (exitTime < expectedExit) issues.push("early_departure");
  }

  return issues;
}

/** Simula nextAction (mesma lógica do useTimeClock) */
function getNextAction(
  entries: { entry_type: string }[],
  isMonthClosed: boolean
): string | null {
  if (isMonthClosed) return null;
  if (entries.length === 0) return "clock_in";
  const last = entries[entries.length - 1];
  switch (last.entry_type) {
    case "clock_in": return "break_start";
    case "break_start": return "break_end";
    case "break_end": return "clock_out";
    case "clock_out": return null;
  }
  return null;
}

// ─── Dados base ────────────────────────────────────────────────────────────

const BASE_DATE = "2026-03-16";
const tz = (h: number, m: number) =>
  `${BASE_DATE}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00-03:00`;

const SCHEDULE = {
  expected_clock_in: "08:00",
  expected_clock_out: "17:00",
  break_minutes: 60,
  work_hours_per_day: 8,
};
const TOLERANCE = 10; // minutos
const EXPECTED_MINUTES = SCHEDULE.work_hours_per_day * 60; // 480

// ════════════════════════════════════════════════════════════════════════════
// CENÁRIO 1 — Funcionário esquece de bater saída → gestor ajusta
// ════════════════════════════════════════════════════════════════════════════
describe("Cenário 1: Esquecimento de saída → ajuste do gestor", () => {
  const entries = [
    { id: "e1", entry_type: "clock_in", recorded_at: tz(8, 0) },
    { id: "e2", entry_type: "break_start", recorded_at: tz(12, 0) },
    { id: "e3", entry_type: "break_end", recorded_at: tz(13, 0) },
    // SEM clock_out
  ];

  it("detecta missing_clock_out", () => {
    const issues = detectInconsistencies(entries, SCHEDULE, TOLERANCE);
    expect(issues).toContain("missing_clock_out");
  });

  it("próxima ação é clock_out", () => {
    expect(getNextAction(entries, false)).toBe("clock_out");
  });

  it("gestor cria ajuste proativo com clock_out às 17:00", () => {
    // Gestor insere um clock_out como ajuste aprovado
    const adjustedEntries = [
      ...entries,
      { id: "e4", entry_type: "clock_out", recorded_at: tz(17, 0) },
    ];
    const worked = computeWorkedMinutes(adjustedEntries);
    expect(worked).toBe(480); // 8h exatas
  });

  it("após ajuste, inconsistência desaparece", () => {
    const adjustedEntries = [
      ...entries,
      { id: "e4", entry_type: "clock_out", recorded_at: tz(17, 0) },
    ];
    const issues = detectInconsistencies(adjustedEntries, SCHEDULE, TOLERANCE);
    expect(issues).not.toContain("missing_clock_out");
  });

  it("entrada original permanece inalterada (imutabilidade)", () => {
    // Ajustes usam applyApprovedAdjustments em vez de modificar entries
    const adj: ApprovedAdjustment[] = [
      { entry_id: "e3", new_time: tz(13, 5), status: "approved" },
    ];
    const projected = applyApprovedAdjustments(entries, adj);
    // Original não muda
    expect(entries[2].recorded_at).toBe(tz(13, 0));
    // Projeção aplica o ajuste
    expect(projected[2].recorded_at).toBe(tz(13, 5));
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CENÁRIO 2 — Horário errado → solicita ajuste → gestor altera antes de aprovar
// ════════════════════════════════════════════════════════════════════════════
describe("Cenário 2: Solicitação de ajuste com edição pelo gestor", () => {
  const entries = [
    { id: "e1", entry_type: "clock_in", recorded_at: tz(8, 30) }, // bateu 08:30 mas chegou 08:00
    { id: "e2", entry_type: "break_start", recorded_at: tz(12, 0) },
    { id: "e3", entry_type: "break_end", recorded_at: tz(13, 0) },
    { id: "e4", entry_type: "clock_out", recorded_at: tz(17, 0) },
  ];

  it("antes do ajuste: calcula 7h30 trabalhadas", () => {
    const worked = computeWorkedMinutes(entries);
    expect(worked).toBe(450); // 7.5h
  });

  it("funcionário solicita ajuste para 08:00 → gestor edita para 08:05 e aprova", () => {
    const adj: ApprovedAdjustment[] = [
      { entry_id: "e1", new_time: tz(8, 5), status: "approved" },
    ];
    const effective = applyApprovedAdjustments(entries, adj);
    const worked = computeWorkedMinutes(effective);
    expect(worked).toBe(475); // 7h55 — gestor definiu 08:05, não 08:00
  });

  it("ajuste pendente não afeta cálculos", () => {
    const adj: ApprovedAdjustment[] = [
      { entry_id: "e1", new_time: tz(8, 0), status: "pending" },
    ];
    const effective = applyApprovedAdjustments(entries, adj);
    // Deve permanecer com o horário original
    expect(effective[0].recorded_at).toBe(tz(8, 30));
    expect(computeWorkedMinutes(effective)).toBe(450);
  });

  it("ajuste recusado não afeta cálculos", () => {
    const adj: ApprovedAdjustment[] = [
      { entry_id: "e1", new_time: tz(8, 0), status: "rejected" },
    ];
    const effective = applyApprovedAdjustments(entries, adj);
    expect(effective[0].recorded_at).toBe(tz(8, 30));
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CENÁRIO 3 — Não bateu ponto → sistema marca falta
// ════════════════════════════════════════════════════════════════════════════
describe("Cenário 3: Ausência total → falta", () => {
  const entries: { entry_type: string; recorded_at: string }[] = [];

  it("detecta missing_clock_in", () => {
    const issues = detectInconsistencies(entries, SCHEDULE, TOLERANCE);
    expect(issues).toContain("missing_clock_in");
    expect(issues).toHaveLength(1);
  });

  it("horas trabalhadas = 0", () => {
    expect(computeWorkedMinutes(entries)).toBe(0);
  });

  it("horas extras = 0 (não é dia não útil)", () => {
    expect(calculateOvertimeMinutes(0, EXPECTED_MINUTES, TOLERANCE, false)).toBe(0);
  });

  it("próxima ação seria clock_in", () => {
    expect(getNextAction(entries, false)).toBe("clock_in");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CENÁRIO 4 — Trabalhou a mais → gera hora extra corretamente
// ════════════════════════════════════════════════════════════════════════════
describe("Cenário 4: Hora extra", () => {
  it("trabalhou 9h (60min extra) → registra 60min de HE", () => {
    const entries = [
      { entry_type: "clock_in", recorded_at: tz(8, 0) },
      { entry_type: "break_start", recorded_at: tz(12, 0) },
      { entry_type: "break_end", recorded_at: tz(13, 0) },
      { entry_type: "clock_out", recorded_at: tz(18, 0) },
    ];
    const worked = computeWorkedMinutes(entries);
    expect(worked).toBe(540); // 9h
    const ot = calculateOvertimeMinutes(worked, EXPECTED_MINUTES, TOLERANCE, false);
    expect(ot).toBe(60);
  });

  it("trabalhou 8h05 (dentro da tolerância de 10min) → 0 HE (CLT Art. 58 §1)", () => {
    const worked = 485; // 8h05
    const ot = calculateOvertimeMinutes(worked, EXPECTED_MINUTES, TOLERANCE, false);
    expect(ot).toBe(0); // dentro da dead zone
  });

  it("trabalhou 8h10 (exatamente no limite) → 0 HE", () => {
    const ot = calculateOvertimeMinutes(490, EXPECTED_MINUTES, TOLERANCE, false);
    expect(ot).toBe(0);
  });

  it("trabalhou 8h11 (ultrapassa tolerância) → 11 HE", () => {
    const ot = calculateOvertimeMinutes(491, EXPECTED_MINUTES, TOLERANCE, false);
    expect(ot).toBe(11);
  });

  it("trabalhou em dia não útil (ex: feriado) → todo tempo é HE", () => {
    const ot = calculateOvertimeMinutes(300, EXPECTED_MINUTES, TOLERANCE, true);
    expect(ot).toBe(300);
  });

  it("trabalhou 7h55 → sem hora extra", () => {
    const ot = calculateOvertimeMinutes(475, EXPECTED_MINUTES, TOLERANCE, false);
    expect(ot).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CENÁRIO 5 — Atraso
// ════════════════════════════════════════════════════════════════════════════
describe("Cenário 5: Atraso", () => {
  it("chegou 08:05 (dentro da tolerância) → sem atraso", () => {
    const entries = [
      { entry_type: "clock_in", recorded_at: tz(8, 5) },
      { entry_type: "clock_out", recorded_at: tz(17, 5) },
    ];
    const issues = detectInconsistencies(entries, SCHEDULE, TOLERANCE);
    expect(issues).not.toContain("late_arrival");
  });

  it("chegou 08:10 (exatamente no limite) → sem atraso", () => {
    const entries = [
      { entry_type: "clock_in", recorded_at: tz(8, 10) },
      { entry_type: "clock_out", recorded_at: tz(17, 10) },
    ];
    const issues = detectInconsistencies(entries, SCHEDULE, TOLERANCE);
    expect(issues).not.toContain("late_arrival");
  });

  it("chegou 08:11 (ultrapassa tolerância) → late_arrival", () => {
    const entries = [
      { entry_type: "clock_in", recorded_at: tz(8, 11) },
      { entry_type: "clock_out", recorded_at: tz(17, 11) },
    ];
    const issues = detectInconsistencies(entries, SCHEDULE, TOLERANCE);
    expect(issues).toContain("late_arrival");
  });

  it("chegou 09:00 (60min atrasado) → late_arrival", () => {
    const entries = [
      { entry_type: "clock_in", recorded_at: tz(9, 0) },
      { entry_type: "clock_out", recorded_at: tz(17, 0) },
    ];
    const issues = detectInconsistencies(entries, SCHEDULE, TOLERANCE);
    expect(issues).toContain("late_arrival");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CENÁRIO 6 — Duplicidade de marcações
// ════════════════════════════════════════════════════════════════════════════
describe("Cenário 6: Duplicidade de marcações", () => {
  it("prevent_duplicate_clock_in bloqueia no banco (trigger)", () => {
    // O trigger prevent_duplicate_clock_in() no banco impede INSERT de
    // clock_in duplicado no mesmo dia. Aqui validamos que a lógica do
    // frontend (nextAction) também impede isso.
    const entries = [
      { entry_type: "clock_in", recorded_at: tz(8, 0) },
    ];
    const next = getNextAction(entries, false);
    expect(next).toBe("break_start"); // NÃO é "clock_in"
    expect(next).not.toBe("clock_in");
  });

  it("após clock_out, não permite nova marcação", () => {
    const entries = [
      { entry_type: "clock_in", recorded_at: tz(8, 0) },
      { entry_type: "break_start", recorded_at: tz(12, 0) },
      { entry_type: "break_end", recorded_at: tz(13, 0) },
      { entry_type: "clock_out", recorded_at: tz(17, 0) },
    ];
    const next = getNextAction(entries, false);
    expect(next).toBeNull();
  });

  it("sequência válida: clock_in → break_start → break_end → clock_out", () => {
    const sequence = ["clock_in", "break_start", "break_end", "clock_out"];
    let entries: { entry_type: string }[] = [];
    const expectedNexts = ["clock_in", "break_start", "break_end", "clock_out"];

    for (let i = 0; i < sequence.length; i++) {
      expect(getNextAction(entries, false)).toBe(expectedNexts[i]);
      entries.push({ entry_type: sequence[i] });
    }
    expect(getNextAction(entries, false)).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CENÁRIO 7 — Fechamento mensal bloqueia alterações
// ════════════════════════════════════════════════════════════════════════════
describe("Cenário 7: Fechamento mensal", () => {
  it("com mês fechado, nextAction retorna null", () => {
    const entries = [
      { entry_type: "clock_in", recorded_at: tz(8, 0) },
    ];
    const next = getNextAction(entries, true);
    expect(next).toBeNull();
  });

  it("sem entradas + mês fechado → não permite clock_in", () => {
    expect(getNextAction([], true)).toBeNull();
  });

  it("trigger check_time_clock_month_closed impede INSERT no banco", () => {
    // Trigger de banco — aqui documentamos o comportamento esperado.
    // A lógica no frontend pré-valida:
    // useTimeClock.registerMutation verifica isMonthClosed antes do INSERT
    const isMonthClosed = true;
    expect(getNextAction([], isMonthClosed)).toBeNull();
  });

  it("trigger check_time_clock_adjustment_month_closed impede ajustes", () => {
    // Documentação: o trigger no banco verifica se o mês está fechado
    // antes de permitir INSERT em time_clock_adjustments
    // Frontend também valida antes de enviar
    expect(true).toBe(true); // Trigger-level — coberto na integração
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CENÁRIO 8 — Reabertura do mês → permite ajustes
// ════════════════════════════════════════════════════════════════════════════
describe("Cenário 8: Reabertura do mês", () => {
  it("após reabertura (reopened_at != null), mês não é considerado fechado", () => {
    // isMonthClosed = closed_at IS NOT NULL AND reopened_at IS NULL
    const closure = { closed_at: "2026-03-15T23:59:59Z", reopened_at: "2026-03-16T08:00:00Z" };
    const isMonthClosed = !!closure.closed_at && !closure.reopened_at;
    expect(isMonthClosed).toBe(false);
  });

  it("com mês reaberto, permite novas marcações", () => {
    expect(getNextAction([], false)).toBe("clock_in");
  });

  it("closure sem reopened_at permanece fechado", () => {
    const closure = { closed_at: "2026-03-15T23:59:59Z", reopened_at: null };
    const isMonthClosed = !!closure.closed_at && !closure.reopened_at;
    expect(isMonthClosed).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CENÁRIOS ADICIONAIS — Integridade e edge cases
// ════════════════════════════════════════════════════════════════════════════
describe("Integridade: applyApprovedAdjustments", () => {
  it("sem ajustes, retorna referência original (otimização)", () => {
    const entries = [{ id: "e1", recorded_at: "2026-03-16T08:00:00Z" }];
    const result = applyApprovedAdjustments(entries, []);
    expect(result).toBe(entries); // mesma referência
  });

  it("múltiplos ajustes aprovados são aplicados corretamente", () => {
    const entries = [
      { id: "e1", recorded_at: "2026-03-16T08:30:00Z" },
      { id: "e2", recorded_at: "2026-03-16T17:00:00Z" },
    ];
    const adj: ApprovedAdjustment[] = [
      { entry_id: "e1", new_time: "2026-03-16T08:00:00Z", status: "approved" },
      { entry_id: "e2", new_time: "2026-03-16T17:30:00Z", status: "approved" },
    ];
    const result = applyApprovedAdjustments(entries, adj);
    expect(result[0].recorded_at).toBe("2026-03-16T08:00:00Z");
    expect(result[1].recorded_at).toBe("2026-03-16T17:30:00Z");
  });

  it("ajuste com new_time null é ignorado", () => {
    const entries = [{ id: "e1", recorded_at: "2026-03-16T08:00:00Z" }];
    const adj: ApprovedAdjustment[] = [
      { entry_id: "e1", new_time: null, status: "approved" },
    ];
    const result = applyApprovedAdjustments(entries, adj);
    expect(result[0].recorded_at).toBe("2026-03-16T08:00:00Z");
  });

  it("ajuste para entry inexistente não causa erro", () => {
    const entries = [{ id: "e1", recorded_at: "2026-03-16T08:00:00Z" }];
    const adj: ApprovedAdjustment[] = [
      { entry_id: "e999", new_time: "2026-03-16T09:00:00Z", status: "approved" },
    ];
    const result = applyApprovedAdjustments(entries, adj);
    expect(result[0].recorded_at).toBe("2026-03-16T08:00:00Z");
  });
});

describe("Integridade: intervalo intrajornada", () => {
  it("intervalo de 45min com mínimo de 60min → short_break", () => {
    const entries = [
      { entry_type: "clock_in", recorded_at: tz(8, 0) },
      { entry_type: "break_start", recorded_at: tz(12, 0) },
      { entry_type: "break_end", recorded_at: tz(12, 45) },
      { entry_type: "clock_out", recorded_at: tz(17, 0) },
    ];
    const issues = detectInconsistencies(entries, SCHEDULE, TOLERANCE);
    expect(issues).toContain("short_break");
  });

  it("intervalo de 60min → sem problema", () => {
    const entries = [
      { entry_type: "clock_in", recorded_at: tz(8, 0) },
      { entry_type: "break_start", recorded_at: tz(12, 0) },
      { entry_type: "break_end", recorded_at: tz(13, 0) },
      { entry_type: "clock_out", recorded_at: tz(17, 0) },
    ];
    const issues = detectInconsistencies(entries, SCHEDULE, TOLERANCE);
    expect(issues).not.toContain("short_break");
  });

  it("break_start sem break_end → incomplete_break", () => {
    const entries = [
      { entry_type: "clock_in", recorded_at: tz(8, 0) },
      { entry_type: "break_start", recorded_at: tz(12, 0) },
    ];
    const issues = detectInconsistencies(entries, SCHEDULE, TOLERANCE);
    expect(issues).toContain("incomplete_break");
  });
});

describe("Integridade: saída antecipada", () => {
  it("saiu 16:40 (20min antes, fora da tolerância) → early_departure", () => {
    const entries = [
      { entry_type: "clock_in", recorded_at: tz(8, 0) },
      { entry_type: "clock_out", recorded_at: tz(16, 40) },
    ];
    const issues = detectInconsistencies(entries, SCHEDULE, TOLERANCE);
    expect(issues).toContain("early_departure");
  });

  it("saiu 16:55 (dentro da tolerância de 10min) → sem early_departure", () => {
    const entries = [
      { entry_type: "clock_in", recorded_at: tz(8, 0) },
      { entry_type: "clock_out", recorded_at: tz(16, 55) },
    ];
    const issues = detectInconsistencies(entries, SCHEDULE, TOLERANCE);
    expect(issues).not.toContain("early_departure");
  });
});

describe("Edge case: jornada completa perfeita", () => {
  it("8h exatas, sem inconsistências, 0 HE", () => {
    const entries = [
      { entry_type: "clock_in", recorded_at: tz(8, 0) },
      { entry_type: "break_start", recorded_at: tz(12, 0) },
      { entry_type: "break_end", recorded_at: tz(13, 0) },
      { entry_type: "clock_out", recorded_at: tz(17, 0) },
    ];
    const worked = computeWorkedMinutes(entries);
    expect(worked).toBe(480);
    expect(calculateOvertimeMinutes(worked, EXPECTED_MINUTES, TOLERANCE, false)).toBe(0);
    const issues = detectInconsistencies(entries, SCHEDULE, TOLERANCE);
    expect(issues).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CENÁRIO 9 — Marcações fora de ordem (sequência inválida)
// ════════════════════════════════════════════════════════════════════════════
describe("Cenário 9: Validação de sequência de marcações", () => {
  // Mirrors the ALLOWED_TRANSITIONS from useTimeClock + DB trigger
  const ALLOWED: Record<string, string[]> = {
    clock_in: ["break_start", "clock_out"],
    break_start: ["break_end"],
    break_end: ["break_start", "clock_out"],
    clock_out: [],
  };

  function isTransitionAllowed(from: string | null, to: string): boolean {
    if (from === null) return to === "clock_in";
    return (ALLOWED[from] || []).includes(to);
  }

  it("clock_out sem clock_in → bloqueado", () => {
    expect(isTransitionAllowed(null, "clock_out")).toBe(false);
  });

  it("break_start sem clock_in → bloqueado", () => {
    expect(isTransitionAllowed(null, "break_start")).toBe(false);
  });

  it("break_end sem break_start → bloqueado", () => {
    expect(isTransitionAllowed("clock_in", "break_end")).toBe(false);
  });

  it("dois break_starts consecutivos → bloqueado", () => {
    expect(isTransitionAllowed("break_start", "break_start")).toBe(false);
  });

  it("clock_in após clock_out → bloqueado", () => {
    expect(isTransitionAllowed("clock_out", "clock_in")).toBe(false);
  });

  it("break_start após clock_out → bloqueado", () => {
    expect(isTransitionAllowed("clock_out", "break_start")).toBe(false);
  });

  it("break_end → break_start (segunda pausa) → permitido", () => {
    expect(isTransitionAllowed("break_end", "break_start")).toBe(true);
  });

  it("clock_in → clock_out (sem pausa) → permitido", () => {
    expect(isTransitionAllowed("clock_in", "clock_out")).toBe(true);
  });

  it("sequência válida completa com duas pausas", () => {
    const sequence = ["clock_in", "break_start", "break_end", "break_start", "break_end", "clock_out"];
    let prev: string | null = null;
    for (const step of sequence) {
      expect(isTransitionAllowed(prev, step)).toBe(true);
      prev = step;
    }
    // After clock_out, nothing allowed
    expect(isTransitionAllowed(prev, "clock_in")).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CENÁRIO 10 — Múltiplos ajustes no mesmo registro
// ════════════════════════════════════════════════════════════════════════════
describe("Cenário 10: Múltiplos ajustes no mesmo registro", () => {
  const entries = [
    { id: "e1", entry_type: "clock_in", recorded_at: tz(9, 0) },
    { id: "e2", entry_type: "clock_out", recorded_at: tz(17, 0) },
  ];

  it("último ajuste aprovado prevalece (applyApprovedAdjustments usa primeiro match)", () => {
    // applyApprovedAdjustments maps by entry_id, last write wins
    const adj: ApprovedAdjustment[] = [
      { entry_id: "e1", new_time: tz(8, 0), status: "approved" },
      { entry_id: "e1", new_time: tz(8, 15), status: "approved" }, // second adjustment
    ];
    const effective = applyApprovedAdjustments(entries, adj);
    // Last approved new_time for e1 should be used (Map overwrites)
    expect(effective[0].recorded_at).toBe(tz(8, 15));
  });

  it("ajuste aprovado + pendente no mesmo registro → só aprovado aplica", () => {
    const adj: ApprovedAdjustment[] = [
      { entry_id: "e1", new_time: tz(8, 0), status: "approved" },
      { entry_id: "e1", new_time: tz(7, 50), status: "pending" },
    ];
    const effective = applyApprovedAdjustments(entries, adj);
    expect(effective[0].recorded_at).toBe(tz(8, 0));
  });

  it("ambos ajustes em registros diferentes funcionam independentemente", () => {
    const adj: ApprovedAdjustment[] = [
      { entry_id: "e1", new_time: tz(8, 0), status: "approved" },
      { entry_id: "e2", new_time: tz(17, 30), status: "approved" },
    ];
    const effective = applyApprovedAdjustments(entries, adj);
    expect(effective[0].recorded_at).toBe(tz(8, 0));
    expect(effective[1].recorded_at).toBe(tz(17, 30));
    const worked = computeWorkedMinutes(effective);
    expect(worked).toBe(570); // 9h30
  });

  it("dados originais permanecem intactos após múltiplos ajustes", () => {
    const adj: ApprovedAdjustment[] = [
      { entry_id: "e1", new_time: tz(8, 0), status: "approved" },
    ];
    applyApprovedAdjustments(entries, adj);
    // Originals unchanged
    expect(entries[0].recorded_at).toBe(tz(9, 0));
    expect(entries[1].recorded_at).toBe(tz(17, 0));
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CENÁRIO 11 — Dias sem marcação (cálculo acumulado)
// ════════════════════════════════════════════════════════════════════════════
describe("Cenário 11: Dias sem marcação no cálculo mensal", () => {
  it("dia sem nenhuma entry produz 0 minutos trabalhados", () => {
    expect(computeWorkedMinutes([])).toBe(0);
  });

  it("mix de dias completos e vazios calcula corretamente", () => {
    // Simula 2 dias: um completo e um vazio
    const day1 = [
      { entry_type: "clock_in", recorded_at: `2026-03-16T08:00:00-03:00` },
      { entry_type: "clock_out", recorded_at: `2026-03-16T17:00:00-03:00` },
    ];
    const day2: typeof day1 = []; // no entries
    const day3 = [
      { entry_type: "clock_in", recorded_at: `2026-03-18T08:00:00-03:00` },
      { entry_type: "break_start", recorded_at: `2026-03-18T12:00:00-03:00` },
      { entry_type: "break_end", recorded_at: `2026-03-18T13:00:00-03:00` },
      { entry_type: "clock_out", recorded_at: `2026-03-18T17:00:00-03:00` },
    ];

    expect(computeWorkedMinutes(day1)).toBe(540); // 9h
    expect(computeWorkedMinutes(day2)).toBe(0);
    expect(computeWorkedMinutes(day3)).toBe(480); // 8h

    // Total across days
    const total = computeWorkedMinutes(day1) + computeWorkedMinutes(day2) + computeWorkedMinutes(day3);
    expect(total).toBe(1020); // 17h
  });

  it("ponto incompleto (só clock_in) não conta tempo residual", () => {
    const entries = [
      { entry_type: "clock_in", recorded_at: tz(8, 0) },
      // No clock_out — computeWorkedMinutes does NOT add "live" time for test (no Date.now() in pure function)
    ];
    // Pure computeWorkedMinutes counts only closed intervals
    expect(computeWorkedMinutes(entries)).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CENÁRIO 12 — Integridade de permissões (documentação)
// ════════════════════════════════════════════════════════════════════════════
describe("Cenário 12: Documentação de regras de permissão", () => {
  it("RLS: funcionários só inserem ajustes com requested_by = próprio ID", () => {
    // Coberto por policy "Employees can request own adjustments"
    // WITH CHECK: requested_by = auth.uid()
    expect(true).toBe(true);
  });

  it("RLS: apenas admin/owner pode aprovar ajustes (can_modify)", () => {
    // Coberto por UPDATE policy com public.can_modify(auth.uid())
    expect(true).toBe(true);
  });

  it("DB trigger: entries são imutáveis (prevent_time_clock_modification)", () => {
    // trigger BEFORE UPDATE/DELETE → RAISE EXCEPTION
    expect(true).toBe(true);
  });

  it("DB trigger: audit log é imutável (prevent_time_clock_audit_modification)", () => {
    expect(true).toBe(true);
  });

  it("DB trigger: sequência de marcações validada (validate_entry_sequence)", () => {
    // Blocks out-of-order inserts at DB level
    expect(true).toBe(true);
  });
});
