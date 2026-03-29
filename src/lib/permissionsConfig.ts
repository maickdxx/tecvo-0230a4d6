import type { AppRole } from "@/hooks/useUserRole";

export interface PermissionItem {
  key: string;
  label: string;
}

export interface PermissionCategory {
  key: string;
  label: string;
  icon: string;
  permissions: PermissionItem[];
}

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    key: "finance",
    label: "Financeiro",
    icon: "DollarSign",
    permissions: [
      { key: "finance.view", label: "Ver financeiro" },
      { key: "finance.receivable.create", label: "Criar contas a receber" },
      { key: "finance.receivable.edit", label: "Editar contas a receber" },
      { key: "finance.receivable.approve", label: "Aprovar recebimento" },
      { key: "finance.payable.create", label: "Criar contas a pagar" },
      { key: "finance.payable.edit", label: "Editar contas a pagar" },
      { key: "finance.transaction.delete", label: "Excluir transações" },
      { key: "finance.account.delete", label: "Excluir conta bancária" },
    ],
  },
  {
    key: "operational",
    label: "Operacional",
    icon: "Wrench",
    permissions: [
      { key: "service.create", label: "Criar OS" },
      { key: "service.edit", label: "Editar OS" },
      { key: "service.delete", label: "Excluir OS" },
      { key: "service.status", label: "Alterar status OS" },
      { key: "service.complete", label: "Concluir serviço" },
    ],
  },
  {
    key: "registrations",
    label: "Cadastros",
    icon: "Users",
    permissions: [
      { key: "client.create", label: "Criar clientes" },
      { key: "client.edit", label: "Editar clientes" },
      { key: "client.delete", label: "Excluir clientes" },
      { key: "catalog.create", label: "Criar serviços no catálogo" },
      { key: "catalog.edit", label: "Editar serviços no catálogo" },
      { key: "catalog.delete", label: "Excluir serviços no catálogo" },
    ],
  },
  {
    key: "system",
    label: "Sistema",
    icon: "Settings",
    permissions: [
      { key: "settings.access", label: "Acessar configurações" },
      { key: "team.manage", label: "Gerenciar equipe" },
      { key: "permissions.manage", label: "Alterar permissões" },
      { key: "reports.strategic", label: "Ver relatórios estratégicos" },
    ],
  },
];

export const ALL_PERMISSION_KEYS = PERMISSION_CATEGORIES.flatMap(c =>
  c.permissions.map(p => p.key)
);

const GESTOR_PRESET = [...ALL_PERMISSION_KEYS];
const ADM_PRESET = [...ALL_PERMISSION_KEYS];

const ATENDENTE_PRESET = [
  // Operacional
  "service.create",
  "service.edit",
  "service.status",
  "service.complete",
  // Cadastros
  "client.create",
  "client.edit",
  "catalog.create",
  "catalog.edit",
];

const FUNCIONARIO_PRESET = [
  "service.status",
  "service.complete",
];

export const ROLE_PRESETS: Record<AppRole, string[]> = {
  super_admin: GESTOR_PRESET,
  owner: GESTOR_PRESET,
  admin: ADM_PRESET,
  member: ATENDENTE_PRESET,
  employee: FUNCIONARIO_PRESET,
};
