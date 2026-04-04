/**
 * Dynamic message variables for automations.
 * Pattern: {{variable_name}}
 */

export interface MessageVariable {
  key: string;       // e.g. "primeiro_nome"
  label: string;     // human-readable label
  category: VariableCategory;
  example: string;   // example value for preview
  fallback?: string; // default when value is empty
}

export type VariableCategory =
  | "cliente"
  | "servico"
  | "equipamento"
  | "empresa"
  | "recorrencia";

export const CATEGORY_LABELS: Record<VariableCategory, string> = {
  cliente: "Cliente",
  servico: "Serviço",
  equipamento: "Equipamento",
  empresa: "Empresa",
  recorrencia: "Recorrência",
};

export const MESSAGE_VARIABLES: MessageVariable[] = [
  // Cliente
  { key: "primeiro_nome", label: "Primeiro nome", category: "cliente", example: "João" },
  { key: "nome_completo", label: "Nome completo", category: "cliente", example: "João da Silva" },
  { key: "telefone", label: "Telefone", category: "cliente", example: "(11) 98765-4321" },
  { key: "email", label: "E-mail", category: "cliente", example: "joao@email.com" },
  { key: "empresa_cliente", label: "Empresa do cliente", category: "cliente", example: "Empresa ABC" },
  { key: "primeiro_nome_atendente", label: "Primeiro nome do atendente", category: "servico", example: "Carlos" },

  // Serviço
  { key: "tipo_servico", label: "Tipo de serviço", category: "servico", example: "Limpeza" },
  { key: "data_agendada", label: "Data agendada", category: "servico", example: "15/07/2026" },
  { key: "horario_agendado", label: "Horário agendado", category: "servico", example: "14:00" },
  { key: "valor", label: "Valor", category: "servico", example: "R$ 350,00" },
  { key: "forma_pagamento", label: "Forma de pagamento", category: "servico", example: "PIX" },
  { key: "status_atendimento", label: "Status do atendimento", category: "servico", example: "Agendado" },
  { key: "numero_os", label: "Número da OS", category: "servico", example: "#1042" },

  // Equipamento
  { key: "tipo_equipamento", label: "Tipo de equipamento", category: "equipamento", example: "Split" },
  { key: "marca_equipamento", label: "Marca", category: "equipamento", example: "Samsung" },
  { key: "modelo_equipamento", label: "Modelo", category: "equipamento", example: "AR12BVHZCWK" },
  { key: "btus", label: "BTUs", category: "equipamento", example: "12.000" },
  { key: "quantidade_equipamentos", label: "Qtd. equipamentos", category: "equipamento", example: "3" },

  // Empresa
  { key: "nome_empresa", label: "Nome da empresa", category: "empresa", example: "ClimaTech" },
  { key: "telefone_empresa", label: "Telefone da empresa", category: "empresa", example: "(11) 3333-4444" },
  { key: "whatsapp_empresa", label: "WhatsApp da empresa", category: "empresa", example: "(11) 99999-0000" },
  { key: "site_empresa", label: "Site da empresa", category: "empresa", example: "www.climatech.com.br" },

  // Recorrência
  { key: "ultima_limpeza", label: "Última limpeza", category: "recorrencia", example: "10/01/2026" },
  { key: "proxima_manutencao", label: "Próxima manutenção", category: "recorrencia", example: "10/07/2026" },
  { key: "mes_proxima_limpeza", label: "Mês da próxima limpeza", category: "recorrencia", example: "Julho" },
];

/** Group variables by category */
export function getVariablesByCategory(): Record<VariableCategory, MessageVariable[]> {
  const grouped: Record<VariableCategory, MessageVariable[]> = {
    cliente: [],
    servico: [],
    equipamento: [],
    empresa: [],
    recorrencia: [],
  };
  for (const v of MESSAGE_VARIABLES) {
    grouped[v.category].push(v);
  }
  return grouped;
}

/** Regex to find all {{variable}} placeholders */
const VAR_REGEX = /\{\{(\w+)\}\}/g;

/** Replace variables in a template string with actual values */
export function resolveVariables(
  template: string,
  values: Record<string, string | null | undefined>,
  options?: { fallback?: string }
): string {
  const defaultFallback = options?.fallback ?? "";
  return template.replace(VAR_REGEX, (match, key) => {
    const val = values[key];
    if (val != null && val !== "") return val;
    const varDef = MESSAGE_VARIABLES.find((v) => v.key === key);
    return varDef?.fallback ?? defaultFallback;
  });
}

/** Replace variables with example values for preview */
export function previewWithExamples(template: string): string {
  return template.replace(VAR_REGEX, (match, key) => {
    const varDef = MESSAGE_VARIABLES.find((v) => v.key === key);
    return varDef?.example ?? match;
  });
}

/** Find invalid variable keys in a template */
export function findInvalidVariables(template: string): string[] {
  const invalid: string[] = [];
  let m: RegExpExecArray | null;
  const regex = new RegExp(VAR_REGEX);
  while ((m = regex.exec(template)) !== null) {
    if (!MESSAGE_VARIABLES.find((v) => v.key === m![1])) {
      invalid.push(m[1]);
    }
  }
  return [...new Set(invalid)];
}
