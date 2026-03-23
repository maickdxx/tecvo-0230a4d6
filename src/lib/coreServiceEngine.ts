/**
 * CoreServiceEngine — Módulo central de serviços do Tecvo
 *
 * Única fonte de verdade para filtragem e consulta de serviços.
 * Agenda, OS, Visão Geral, Financeiro e IA devem consumir serviços
 * exclusivamente através deste módulo (ou do hook useCoreServices).
 *
 * Campo de referência temporal: scheduled_date (data_execucao)
 * Nunca usar created_at ou payment_date para filtros de período.
 */

import type { Service } from "@/hooks/useServices";
import { getDatePartInTz, DEFAULT_TIMEZONE } from "@/lib/timezone";

export interface FiltroServicos {
  data_inicio: string;
  data_fim: string;
  status?: string[];
  excluirCancelados?: boolean;
}

/**
 * Filtra serviços pelo período usando scheduled_date.
 * Esta é a ÚNICA função que deve ser usada para filtrar serviços por período.
 *
 * Compara apenas a parte de data (yyyy-MM-dd) para evitar inconsistências
 * quando data_fim é date-only mas scheduled_date é timestamp.
 */
export function filtrarServicosPorPeriodo(
  services: Service[],
  filtro: FiltroServicos
): Service[] {
  const inicioDate = getDatePartInTz(filtro.data_inicio, DEFAULT_TIMEZONE) || filtro.data_inicio.substring(0, 10);
  const fimDate = getDatePartInTz(filtro.data_fim, DEFAULT_TIMEZONE) || filtro.data_fim.substring(0, 10);

  return services.filter((s) => {
    // Excluir orçamentos — nunca contabilizar como serviço
    if (s.document_type === "quote") return false;

    // Excluir cancelados por padrão
    if (filtro.excluirCancelados !== false && s.status === "cancelled") return false;

    // Filtrar por status específico se fornecido
    if (filtro.status && !filtro.status.includes(s.status)) return false;

    // Usar scheduled_date como campo de referência temporal
    const dataExecucao = s.scheduled_date || s.created_at;
    const dataDate = getDatePartInTz(dataExecucao, DEFAULT_TIMEZONE);
    return dataDate >= inicioDate && dataDate <= fimDate;
  });
}

/**
 * Retorna serviços concluídos no período.
 */
export function getServicosConcluidos(services: Service[], data_inicio: string, data_fim: string): Service[] {
  return filtrarServicosPorPeriodo(services, {
    data_inicio,
    data_fim,
    status: ["completed"],
  });
}

/**
 * Retorna serviços pendentes (agendados + em andamento) no período.
 */
export function getServicosPendentes(services: Service[], data_inicio: string, data_fim: string): Service[] {
  return filtrarServicosPorPeriodo(services, {
    data_inicio,
    data_fim,
    status: ["scheduled", "in_progress"],
  });
}

/**
 * Retorna todos os serviços não-cancelados no período.
 */
export function getServicosAtivos(services: Service[], data_inicio: string, data_fim: string): Service[] {
  return filtrarServicosPorPeriodo(services, {
    data_inicio,
    data_fim,
    excluirCancelados: true,
  });
}
