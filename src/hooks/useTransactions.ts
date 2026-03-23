import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "./use-toast";
import { useDemoMode } from "./useDemoMode";

export type TransactionType = "income" | "expense";

// Keep for backwards compatibility with existing data
export type TransactionCategory = 
  | "service" | "product" | "other_income"
  | "material" | "labor" | "fuel" | "maintenance" | "rent" | "utilities" | "marketing" | "other_expense"
  | string; // Allow dynamic categories

export interface Transaction {
  id: string;
  organization_id: string;
  service_id: string | null;
  client_id: string | null;
  supplier_id: string | null;
  employee_id: string | null;
  financial_account_id: string | null;
  type: TransactionType;
  category: string;
  amount: number;
  description: string;
  date: string;
  due_date: string | null;
  payment_date: string | null;
  status: string | null;
  payment_method: string | null;
  payment_source_type: string | null;
  notes: string | null;
  recurrence: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionFormData {
  type: TransactionType;
  category: string;
  amount: number;
  description: string;
  date: string;
  payment_method?: string;
  notes?: string;
  service_id?: string;
  supplier_id?: string;
  client_id?: string;
  employee_id?: string;
  due_date?: string;
  payment_date?: string;
  status?: string;
  recurrence?: string;
  payment_source_type?: string;
}

export const INCOME_CATEGORIES: { value: TransactionCategory; label: string }[] = [
  { value: "service", label: "Serviço" },
  { value: "product", label: "Produto" },
  { value: "instalacao", label: "Instalação" },
  { value: "limpeza_receita", label: "Limpeza" },
  { value: "manutencao_receita", label: "Manutenção" },
  { value: "contrato_recorrente", label: "Contrato Recorrente" },
  { value: "other_income", label: "Outras Receitas" },
];

export const EXPENSE_CATEGORIES: { value: TransactionCategory; label: string }[] = [
  { value: "material", label: "Material" },
  { value: "labor", label: "Mão de Obra" },
  { value: "fuel", label: "Combustível" },
  { value: "maintenance", label: "Manutenção" },
  { value: "rent", label: "Aluguel" },
  { value: "utilities", label: "Contas (Água/Luz/Internet)" },
  { value: "marketing", label: "Marketing" },
  { value: "salario", label: "Salário" },
  { value: "impostos", label: "Impostos" },
  { value: "contas_utilidades", label: "Contas (Água/Luz/Internet)" },
  { value: "prolabore", label: "Pró-labore" },
  { value: "other_expense", label: "Outras Despesas" },
];

export const CATEGORY_LABELS: Record<string, string> = {
  transfer: "Transferência",
  service: "Serviço",
  product: "Produto",
  other_income: "Outras Receitas",
  material: "Material",
  labor: "Mão de Obra",
  fuel: "Combustível",
  maintenance: "Manutenção",
  rent: "Aluguel",
  utilities: "Contas",
  marketing: "Marketing",
  other_expense: "Outras Despesas",
  salario: "Salário",
  impostos: "Impostos",
  contas_utilidades: "Contas",
  instalacao: "Instalação",
  limpeza_receita: "Limpeza",
  manutencao_receita: "Manutenção",
  contrato_recorrente: "Contrato Recorrente",
  prolabore: "Pró-labore",
};

export const PAYMENT_METHODS = [
  { value: "pix", label: "PIX" },
  { value: "cash", label: "Dinheiro" },
  { value: "credit_card", label: "Cartão de Crédito" },
  { value: "debit_card", label: "Cartão de Débito" },
  { value: "bank_transfer", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
];

interface UseTransactionsOptions {
  startDate?: string;
  endDate?: string;
  type?: TransactionType;
  dateField?: "date" | "due_date" | "payment_date";
}

export function useTransactions(options: UseTransactionsOptions = {}) {
  const { organizationId } = useAuth();
  const { isDemoMode } = useDemoMode();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["transactions", organizationId, options, isDemoMode],
    queryFn: async () => {
      if (!organizationId) return [];

      let queryBuilder = supabase
        .from("transactions")
        .select("*")
        .order("date", { ascending: false });

      // Filter demo data based on demo mode
      if (!isDemoMode) {
        queryBuilder = queryBuilder.eq("is_demo_data", false);
      }

      const filterField = options.dateField || "date";

      if (options.startDate) {
        queryBuilder = queryBuilder.gte(filterField, options.startDate);
      }
      if (options.endDate) {
        queryBuilder = queryBuilder.lte(filterField, options.endDate);
      }
      if (options.type) {
        queryBuilder = queryBuilder.eq("type", options.type);
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!organizationId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: TransactionFormData) => {
      if (!organizationId) throw new Error("Organização não encontrada");

      const { data: transaction, error } = await supabase
        .from("transactions")
        .insert({
          type: data.type,
          category: data.category,
          amount: data.amount,
          description: data.description,
          date: data.date,
          payment_method: data.payment_method,
          notes: data.notes,
          service_id: data.service_id || null,
          supplier_id: data.supplier_id || null,
          client_id: data.client_id || null,
          employee_id: data.employee_id || null,
          due_date: data.due_date || null,
          payment_date: data.payment_date || null,
          status: data.status || "paid",
          recurrence: data.recurrence || null,
          payment_source_type: data.payment_source_type || null,
          organization_id: organizationId,
        })
        .select()
        .single();

      if (error) throw error;
      return transaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast({
        title: "Transação registrada",
        description: "A transação foi adicionada com sucesso",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao registrar",
        description: error.message,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TransactionFormData> }) => {
      const updateData: Record<string, unknown> = { ...data };
      
      // Handle empty IDs as null
      if (data.supplier_id === "") updateData.supplier_id = null;
      if (data.client_id === "") updateData.client_id = null;
      if (data.employee_id === "") updateData.employee_id = null;
      if (data.service_id === "") updateData.service_id = null;

      const { data: transaction, error } = await supabase
        .from("transactions")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return transaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast({
        title: "Transação atualizada",
        description: "Os dados foram salvos com sucesso",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar",
        description: error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast({
        title: "Transação excluída",
        description: "A transação foi removida com sucesso",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: error.message,
      });
    },
  });

  // Calculate totals - only count paid transactions for actual cash flow
  const totals = query.data?.reduce(
    (acc, t) => {
      // Only count transactions that are actually paid/received
      if (t.status === "paid") {
        if (t.type === "income") {
          acc.income += Number(t.amount);
        } else {
          acc.expense += Number(t.amount);
        }
      }
      return acc;
    },
    { income: 0, expense: 0 }
  ) ?? { income: 0, expense: 0 };

  return {
    transactions: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    totals: {
      ...totals,
      balance: totals.income - totals.expense,
    },
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
