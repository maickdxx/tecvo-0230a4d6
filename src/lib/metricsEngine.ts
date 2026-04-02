/**
 * MetricsEngine — Módulo central de cálculos do Tecvo
 *
 * Todas as métricas da Visão Geral devem ser calculadas
 * exclusivamente através deste módulo.
 * Nenhum card pode calcular métricas isoladamente.
 *
 * Dependências:
 * - CoreServiceEngine (filtro de serviços por scheduled_date)
 * - PeriodoGlobal (intervalo de datas)
 */

import type { Service } from "@/hooks/useServices";
import type { Transaction } from "@/hooks/useTransactions";
import {
  getServicosAtivos,
  getServicosConcluidos,
  getServicosPendentes,
} from "./coreServiceEngine";

export interface MetricasVisaoGeral {
  // Resultado Real
  receita: number;
  despesa: number;
  lucroReal: number;
  margem: number;

  // Variação vs período anterior
  receitaChange: number | null;
  despesaChange: number | null;
  lucroChange: number | null;
  margemChange: number | null;

  // Projeção e Operação
  receitaPrevista: number;
  ticketMedio: number;

  // Serviços
  totalServicos: number;
  servicosConcluidos: number;
  servicosPendentes: number;
}

// --- Funções de cálculo individuais ---

/**
 * getReceitaReal — Soma de TODAS as income transactions com status "paid".
 * Inclui tanto transações vinculadas a OS (confirmadas pelo gestor)
 * quanto transações manuais.
 */
export function getReceitaReal(incomeTransactions: Transaction[]): number {
  return incomeTransactions
    .filter((t) => t.status === "paid")
    .reduce((sum, t) => sum + Number(t.amount), 0);
}

/**
 * getDespesaReal — Soma despesas pagas (transactions type=expense, status=paid) no período.
 * Despesas são filtradas por due_date no hook, aqui apenas somamos.
 */
export function getDespesaReal(expenseTransactions: Transaction[]): number {
  return expenseTransactions
    .filter((t) => t.status === "paid")
    .reduce((sum, t) => sum + Number(t.amount), 0);
}

/**
 * getLucroReal — Receita Real - Despesas.
 */
export function getLucroReal(receita: number, despesa: number): number {
  return receita - despesa;
}

/**
 * getMargem — (Lucro / Receita) × 100. Retorna 0 se receita = 0.
 */
export function getMargem(receita: number, lucro: number): number {
  if (receita <= 0) return 0;
  return (lucro / receita) * 100;
}

/**
 * getReceitaPrevista — Soma valor_total dos serviços AGENDADOS ou EM ANDAMENTO no período.
 * Nunca inclui serviços concluídos (para não duplicar Receita Real).
 * Usa filtro próprio independente para evitar dependência de funções genéricas.
 */
export function getReceitaPrevista(services: Service[], dataInicio: string, dataFim: string): number {
  const inicioDate = dataInicio.substring(0, 10);
  const fimDate = dataFim.substring(0, 10);

  return services
    .filter((s) => {
      if (!s.scheduled_date) return false;
      if (s.document_type === "quote") return false;

      const dataDate = getDatePartInTz(s.scheduled_date, DEFAULT_TIMEZONE);
      const isDentroPeriodo = dataDate >= inicioDate && dataDate <= fimDate;

      const isPrevisto =
        s.status === "scheduled" ||
        s.status === "in_progress";

      return isDentroPeriodo && isPrevisto;
    })
    .reduce((sum, s) => sum + Number(s.value || 0), 0);
}

/**
 * getContadorServicos — Contagem de serviços no período com breakdown.
 */
export function getContadorServicos(services: Service[], dataInicio: string, dataFim: string) {
  const ativos = getServicosAtivos(services, dataInicio, dataFim);
  const concluidos = getServicosConcluidos(services, dataInicio, dataFim);
  const pendentes = getServicosPendentes(services, dataInicio, dataFim);

  return {
    total: ativos.length,
    concluidos: concluidos.length,
    pendentes: pendentes.length,
  };
}

/**
 * getTicketMedio — Receita real / transações income pagas vinculadas a serviços.
 * Reflete valores realmente recebidos.
 */
export function getTicketMedio(receita: number, incomeTransactions: Transaction[]): number {
  const servicePaidCount = incomeTransactions
    .filter((t) => t.status === "paid" && t.service_id)
    .length;
  if (servicePaidCount <= 0) return 0;
  return receita / servicePaidCount;
}

// --- Variação percentual ---

export function calcularVariacao(atual: number, anterior: number): number | null {
  if (anterior === 0) return atual > 0 ? 100 : null;
  return Math.round(((atual - anterior) / anterior) * 100);
}

// --- Cálculo unificado ---

/**
 * calcularMetricasCompletas — Calcula TODAS as métricas da Visão Geral
 * a partir do CoreServiceEngine e PeriodoGlobal.
 *
 * O Dashboard apenas exibe o retorno desta função.
 */
export function calcularMetricasCompletas(
  services: Service[],
  currentExpenses: Transaction[],
  previousExpenses: Transaction[],
  currentIncomeTransactions: Transaction[],
  previousIncomeTransactions: Transaction[],
  dataInicio: string,
  dataFim: string,
  prevDataInicio: string,
  prevDataFim: string,
): MetricasVisaoGeral {
  // Período atual — Receita Real = soma de income transactions pagas
  const receita = getReceitaReal(currentIncomeTransactions);
  
  const despesa = getDespesaReal(currentExpenses);
  const lucroReal = getLucroReal(receita, despesa);
  const margem = getMargem(receita, lucroReal);
  const receitaPrevista = getReceitaPrevista(services, dataInicio, dataFim);
  const contagem = getContadorServicos(services, dataInicio, dataFim);
  const ticketMedio = getTicketMedio(receita, currentIncomeTransactions);

  // Período anterior (para variação %)
  const prevReceita = getReceitaReal(previousIncomeTransactions);
  const prevDespesa = getDespesaReal(previousExpenses);
  const prevLucro = getLucroReal(prevReceita, prevDespesa);
  const prevMargem = getMargem(prevReceita, prevLucro);

  return {
    receita,
    despesa,
    lucroReal,
    margem,
    receitaChange: calcularVariacao(receita, prevReceita),
    despesaChange: calcularVariacao(despesa, prevDespesa),
    lucroChange: calcularVariacao(lucroReal, prevLucro),
    margemChange: calcularVariacao(margem, prevMargem),
    receitaPrevista,
    ticketMedio,
    totalServicos: contagem.total,
    servicosConcluidos: contagem.concluidos,
    servicosPendentes: contagem.pendentes,
  };
}
