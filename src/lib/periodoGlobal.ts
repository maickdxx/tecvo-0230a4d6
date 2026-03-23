/**
 * PeriodoGlobal — Módulo central de período do Tecvo
 *
 * Única fonte de verdade para cálculo de intervalos de data.
 * Todos os módulos (Visão Geral, Agenda, IA) devem usar estas funções
 * em vez de calcular períodos isoladamente.
 *
 * IMPORTANTE: Todas as datas usam formato date-only (yyyy-MM-dd)
 * pois as colunas no banco (payment_date, due_date, date) são tipo DATE.
 */

import {
  format,
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  subDays, subWeeks, subMonths,
  addDays, addWeeks, addMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Retorna a data "hoje" no fuso America/Sao_Paulo.
 * Necessário porque o preview pode rodar em UTC.
 */
export function getHojeBRT(): Date {
  const now = new Date();
  // Converte para string no fuso local da org (America/Sao_Paulo)
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // returns "yyyy-MM-dd"
  // Parse como data local (meia-noite)
  const [y, m, d] = parts.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function fmtDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type Granularity = "day" | "week" | "month";

export interface PeriodoAtivo {
  tipo: Granularity;
  data_inicio: string; // yyyy-MM-dd
  data_fim: string;    // yyyy-MM-dd
}

/**
 * getPeriodoAtivo — Função central obrigatória.
 * Gera o intervalo correto para o filtro selecionado.
 * Nenhum card/módulo pode calcular período isoladamente.
 *
 * TODAS as datas são retornadas como yyyy-MM-dd (date-only).
 */
export function getPeriodoAtivo(granularity: Granularity, refDate: Date): PeriodoAtivo {
  switch (granularity) {
    case "day":
      return {
        tipo: "day",
        data_inicio: fmtDate(refDate),
        data_fim: fmtDate(refDate),
      };
    case "week":
      return {
        tipo: "week",
        data_inicio: fmtDate(startOfWeek(refDate, { weekStartsOn: 0 })),
        data_fim: fmtDate(endOfWeek(refDate, { weekStartsOn: 0 })),
      };
    case "month":
      return {
        tipo: "month",
        data_inicio: fmtDate(startOfMonth(refDate)),
        data_fim: fmtDate(endOfMonth(refDate)),
      };
  }
}

/**
 * Retorna o período anterior (para cálculo de variação %).
 */
export function getPeriodoAnterior(granularity: Granularity, refDate: Date): PeriodoAtivo {
  switch (granularity) {
    case "day":
      return getPeriodoAtivo("day", subDays(refDate, 1));
    case "week":
      return getPeriodoAtivo("week", subWeeks(refDate, 1));
    case "month":
      return getPeriodoAtivo("month", subMonths(refDate, 1));
  }
}

/**
 * Retorna intervalo estendido para gráficos de fluxo de caixa.
 */
export function getPeriodoGrafico(granularity: Granularity, refDate: Date): { data_inicio: string; data_fim: string } {
  switch (granularity) {
    case "month": {
      const start = startOfMonth(subMonths(refDate, 5));
      const end = endOfMonth(refDate);
      return { data_inicio: fmtDate(start), data_fim: fmtDate(end) };
    }
    case "week": {
      const p = getPeriodoAtivo("week", refDate);
      return { data_inicio: p.data_inicio, data_fim: p.data_fim };
    }
    case "day": {
      const end = refDate;
      const start = subDays(refDate, 6);
      return { data_inicio: fmtDate(start), data_fim: fmtDate(end) };
    }
  }
}

/**
 * Navega a data de referência para frente ou para trás.
 */
export function navegarPeriodo(granularity: Granularity, refDate: Date, direction: 1 | -1): Date {
  switch (granularity) {
    case "day":
      return direction === 1 ? addDays(refDate, 1) : subDays(refDate, 1);
    case "week":
      return direction === 1 ? addWeeks(refDate, 1) : subWeeks(refDate, 1);
    case "month":
      return direction === 1 ? addMonths(refDate, 1) : subMonths(refDate, 1);
  }
}

/**
 * Label legível do período para exibição.
 */
export function getLabelPeriodo(granularity: Granularity, refDate: Date): string {
  switch (granularity) {
    case "day":
      return format(refDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    case "week": {
      const start = startOfWeek(refDate, { weekStartsOn: 0 });
      const end = endOfWeek(refDate, { weekStartsOn: 0 });
      return `${format(start, "dd", { locale: ptBR })} - ${format(end, "dd MMM yyyy", { locale: ptBR })}`;
    }
    case "month":
      return format(refDate, "MMMM yyyy", { locale: ptBR });
  }
}
