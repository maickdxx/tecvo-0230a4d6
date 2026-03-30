import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getTodayInTz, DEFAULT_TIMEZONE } from "@/lib/timezone";
import { useAuth } from "./useAuth";
import { toast } from "./use-toast";

export type AccountStatus = "pending" | "paid" | "overdue" | "cancelled";
export type AccountType = "payable" | "receivable";
export type RecurrenceType = "weekly" | "monthly" | "yearly" | null;
export type PaymentSourceType = "supplier" | "employee" | null;

export interface Account {
  id: string;
  organization_id: string;
  type: "income" | "expense";
  category: string;
  amount: number;
  description: string;
  date: string;
  due_date: string | null;
  payment_date: string | null;
  status: AccountStatus;
  recurrence: RecurrenceType;
  payment_method: string | null;
  notes: string | null;
  supplier_id: string | null;
  client_id: string | null;
  service_id: string | null;
  employee_id: string | null;
  payment_source_type: PaymentSourceType;
  created_at: string;
  updated_at: string;
  // Joined data
  supplier?: { id: string; name: string } | null;
  client?: { id: string; name: string } | null;
  service?: { id: string; service_type: string; quote_number: number } | null;
}

export interface AccountFormData {
  type: "income" | "expense";
  category: string;
  amount: number;
  description: string;
  date: string;
  due_date?: string;
  payment_date?: string;
  status?: AccountStatus;
  recurrence?: RecurrenceType;
  payment_method?: string;
  notes?: string;
  supplier_id?: string;
  client_id?: string;
  service_id?: string;
  employee_id?: string;
  payment_source_type?: PaymentSourceType;
  financial_account_id?: string;
  compensation_date?: string;
}

interface UseAccountsOptions {
  accountType?: AccountType;
  status?: AccountStatus;
  startDate?: string;
  endDate?: string;
}

export function useAccounts(options: UseAccountsOptions = {}) {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["accounts", organizationId, options],
    queryFn: async () => {
      if (!organizationId) return [];

      let queryBuilder = supabase
        .from("transactions")
        .select(`
          *,
          supplier:suppliers(id, name),
          client:clients(id, name),
          service:services(id, service_type, quote_number)
        `)
        .order("due_date", { ascending: true, nullsFirst: false });

      // Filter by account type (payable = expense, receivable = income)
      if (options.accountType === "payable") {
        queryBuilder = queryBuilder.eq("type", "expense").neq("category", "taxas");
      } else if (options.accountType === "receivable") {
        queryBuilder = queryBuilder.eq("type", "income");
      }

      // Filter by status
      if (options.status) {
        queryBuilder = queryBuilder.eq("status", options.status);
      }

      // Filter by date range (using due_date)
      if (options.startDate) {
        queryBuilder = queryBuilder.gte("due_date", options.startDate);
      }
      if (options.endDate) {
        queryBuilder = queryBuilder.lte("due_date", options.endDate);
      }

      const { data, error } = await queryBuilder.range(0, 999);
      if (error) throw error;
      return (data ?? []) as Account[];
    },
    enabled: !!organizationId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: AccountFormData) => {
      if (!organizationId) throw new Error("Organização não encontrada");

      const status = data.status || "pending";
      const { data: account, error } = await supabase
        .from("transactions")
        .insert({
          type: data.type,
          category: data.category,
          amount: data.amount,
          description: data.description,
          date: data.date,
          due_date: data.due_date || data.date,
          payment_date: data.payment_date || null,
          status,
          recurrence: data.recurrence || null,
          payment_method: data.payment_method,
          notes: data.notes,
          supplier_id: data.supplier_id || null,
          client_id: data.client_id || null,
          service_id: data.service_id || null,
          employee_id: data.employee_id || null,
          payment_source_type: data.payment_source_type || null,
          financial_account_id: data.financial_account_id || null,
          compensation_date: data.compensation_date || null,
          organization_id: organizationId,
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Update financial account balance when created as already paid
      if (status === "paid" && data.financial_account_id) {
        const { data: finAccount, error: finError } = await supabase
          .from("financial_accounts")
          .select("balance")
          .eq("id", data.financial_account_id)
          .single();

        if (finError) throw finError;

        const currentBalance = Number(finAccount.balance);
        const newBalance = data.type === "expense"
          ? currentBalance - data.amount
          : currentBalance + data.amount;

        const { error: updateError } = await supabase
          .from("financial_accounts")
          .update({ balance: newBalance })
          .eq("id", data.financial_account_id);

        if (updateError) throw updateError;
      }

      return account;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["financial-accounts"] });
      toast({
        title: "Conta registrada",
        description: "A conta foi adicionada com sucesso",
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
    mutationFn: async ({ id, data, previousStatus }: { id: string; data: Partial<AccountFormData>; previousStatus?: string }) => {
      const updateData: Record<string, unknown> = { ...data };
      
      // Handle empty IDs as null
      if (data.supplier_id === "") updateData.supplier_id = null;
      if (data.client_id === "") updateData.client_id = null;
      if (data.employee_id === "") updateData.employee_id = null;
      if (data.service_id === "") updateData.service_id = null;

      // Remove previousStatus from the data sent to the DB
      delete updateData.previousStatus;

      const { data: account, error } = await supabase
        .from("transactions")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Adjust financial account balance on status transition
      const newStatus = data.status;
      if (previousStatus && newStatus && previousStatus !== newStatus) {
        const txAmount = Number((account as any).amount);

        if (previousStatus === "paid" && newStatus === "pending") {
          // Paid -> Pending: revert the balance (subtract for income, add for expense)
          const finAccountId = (account as any).financial_account_id;
          if (finAccountId) {
            const { data: finAccount, error: finError } = await supabase
              .from("financial_accounts")
              .select("balance")
              .eq("id", finAccountId)
              .single();
            if (finError) throw finError;

            const currentBalance = Number(finAccount.balance);
            const txType = (account as any).type;
            const newBalance = txType === "income"
              ? currentBalance - txAmount
              : currentBalance + txAmount;

            const { error: updateError } = await supabase
              .from("financial_accounts")
              .update({ balance: newBalance })
              .eq("id", finAccountId);
            if (updateError) throw updateError;
          }
        } else if (previousStatus === "pending" && newStatus === "paid") {
          // Pending -> Paid: add to balance
          const finAccountId = data.financial_account_id || (account as any).financial_account_id;
          if (finAccountId) {
            const { data: finAccount, error: finError } = await supabase
              .from("financial_accounts")
              .select("balance")
              .eq("id", finAccountId)
              .single();
            if (finError) throw finError;

            const currentBalance = Number(finAccount.balance);
            const txType = (account as any).type;
            const newBalance = txType === "income"
              ? currentBalance + txAmount
              : currentBalance - txAmount;

            const { error: updateError } = await supabase
              .from("financial_accounts")
              .update({ balance: newBalance })
              .eq("id", finAccountId);
            if (updateError) throw updateError;
          }
        }
      }

      return account;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["financial-accounts"] });
      toast({
        title: "Conta atualizada",
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

  const markAsPaidMutation = useMutation({
    mutationFn: async ({ id, payment_date, compensation_date, financial_account_id }: { 
      id: string; 
      payment_date?: string; 
      compensation_date?: string;
      financial_account_id?: string;
    }) => {
      // Update the transaction
      const { data: account, error } = await supabase
        .from("transactions")
        .update({
          status: "paid",
          payment_date: payment_date || getTodayInTz(DEFAULT_TIMEZONE),
          compensation_date: compensation_date || null,
          financial_account_id: financial_account_id || null,
        } as any)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Only update financial account balance if both are provided
      if (financial_account_id && compensation_date) {
        // Get the transaction type and amount
        const txType = (account as any).type;
        const txAmount = Number((account as any).amount);

        // Get current balance
        const { data: finAccount, error: finError } = await supabase
          .from("financial_accounts")
          .select("balance")
          .eq("id", financial_account_id)
          .single();

        if (finError) throw finError;

        const currentBalance = Number(finAccount.balance);
        // expense = debit (subtract), income = credit (add)
        const newBalance = txType === "expense" 
          ? currentBalance - txAmount 
          : currentBalance + txAmount;

        const { error: updateError } = await supabase
          .from("financial_accounts")
          .update({ balance: newBalance })
          .eq("id", financial_account_id);

        if (updateError) throw updateError;
      }

      return account;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["financial-accounts"] });
      toast({
        title: "Conta baixada",
        description: "A conta foi marcada como paga",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao baixar conta",
        description: error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // First get the transaction to check if we need to revert balance
      const { data: tx, error: fetchError } = await supabase
        .from("transactions")
        .select("type, amount, status, financial_account_id")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      // Revert financial account balance if the transaction was paid
      if (tx && tx.status === "paid" && tx.financial_account_id) {
        const delta = tx.type === "income"
          ? -Number(tx.amount)
          : Number(tx.amount);

        const { error: balError } = await supabase.rpc("adjust_financial_account_balance", {
          _account_id: tx.financial_account_id,
          _delta: delta,
        });
        if (balError) throw balError;
      }

      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast({
        title: "Conta excluída",
        description: "A conta foi removida com sucesso",
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

  // Calculate totals
  const totals = query.data?.reduce(
    (acc, t) => {
      const amount = Number(t.amount);
      if (t.status === "pending" || t.status === "overdue") {
        acc.pending += amount;
      }
      if (t.status === "paid") {
        acc.paid += amount;
      }
      if (t.status === "overdue") {
        acc.overdue += amount;
      }
      acc.total += amount;
      return acc;
    },
    { pending: 0, paid: 0, overdue: 0, total: 0 }
  ) ?? { pending: 0, paid: 0, overdue: 0, total: 0 };

  return {
    accounts: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    totals,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    markAsPaid: markAsPaidMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

export async function getLinkedFees(serviceId: string, organizationId: string) {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("service_id", serviceId)
    .eq("organization_id", organizationId)
    .eq("type", "expense")
    .eq("category", "taxas");

  if (error) throw error;
  return data ?? [];
}
