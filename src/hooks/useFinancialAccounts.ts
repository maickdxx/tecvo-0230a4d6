import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "./use-toast";

export type AccountType = "cash" | "bank" | "digital" | "card";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: "Dinheiro",
  bank: "Conta Bancária",
  digital: "Carteira Digital",
  card: "Cartão a Receber",
};

export interface FinancialAccount {
  id: string;
  organization_id: string;
  name: string;
  account_type: AccountType;
  balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinancialAccountFormData {
  name: string;
  account_type: AccountType;
  balance?: number;
  is_active?: boolean;
}

export interface TransferData {
  from_account_id: string;
  to_account_id: string;
  amount: number;
  date: string;
  notes?: string;
}

export function useFinancialAccounts() {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["financial-accounts", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("financial_accounts")
        .select("*")
        .eq("organization_id", organizationId)
        .order("name");
      if (error) throw error;
      return data as FinancialAccount[];
    },
    enabled: !!organizationId,
  });

  const activeAccounts = query.data?.filter((a) => a.is_active) ?? [];

  const createMutation = useMutation({
    mutationFn: async (data: FinancialAccountFormData) => {
      if (!organizationId) throw new Error("Organização não encontrada");
      const { data: account, error } = await supabase
        .from("financial_accounts")
        .insert({
          name: data.name,
          account_type: data.account_type,
          balance: data.balance ?? 0,
          is_active: data.is_active ?? true,
          organization_id: organizationId,
        })
        .select()
        .single();
      if (error) throw error;
      return account;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-accounts"] });
      toast({ title: "Conta criada", description: "A conta financeira foi criada com sucesso" });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Erro ao criar conta", description: error.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<FinancialAccountFormData> }) => {
      const { data: account, error } = await supabase
        .from("financial_accounts")
        .update(data)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return account;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-accounts"] });
      toast({ title: "Conta atualizada" });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Erro ao atualizar", description: error.message });
    },
  });

  const transferMutation = useMutation({
    mutationFn: async (data: TransferData) => {
      if (!organizationId) throw new Error("Organização não encontrada");

      const { error } = await supabase.rpc("transfer_between_accounts", {
        _from_account_id: data.from_account_id,
        _to_account_id: data.to_account_id,
        _amount: data.amount,
        _organization_id: organizationId,
        _notes: data.notes || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast({ title: "Transferência realizada", description: "Os saldos foram atualizados" });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Erro na transferência", description: error.message });
    },
  });

  // Atomic balance update via DB function (avoids race conditions)
  const updateBalance = async (accountId: string, amount: number) => {
    const { error } = await supabase.rpc("adjust_financial_account_balance", {
      _account_id: accountId,
      _delta: amount,
    });
    if (error) throw error;
  };

  const totalBalance = activeAccounts.reduce((sum, a) => sum + Number(a.balance), 0);

  return {
    accounts: query.data ?? [],
    activeAccounts,
    isLoading: query.isLoading,
    totalBalance,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    transfer: transferMutation.mutateAsync,
    updateBalance,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isTransferring: transferMutation.isPending,
    refetch: query.refetch,
  };
}
