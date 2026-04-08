import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "./use-toast";

export type ApprovalStatus = "pending_approval" | "approved" | "rejected";

interface PendingApprovalSummary {
  total_pending: number;
  pending_income_count: number;
  pending_expense_count: number;
  pending_income_total: number;
  pending_expense_total: number;
  pending_balance: number;
}

interface UsePendingApprovalsOptions {
  startDate?: string;
  endDate?: string;
}

export function usePendingApprovals(options: UsePendingApprovalsOptions = {}) {
  const { organizationId } = useAuth();

  return useQuery({
    queryKey: ["pending-approvals", organizationId, options],
    queryFn: async () => {
      if (!organizationId) return [];

      let query = supabase
        .from("transactions")
        .select(`
          *,
          supplier:suppliers(id, name),
          client:clients(id, name),
          service:services(id, service_type, quote_number)
        `)
        .eq("organization_id", organizationId)
        .eq("approval_status", "pending_approval")
        .is("deleted_at", null)
        .order("date", { ascending: false });

      if (options.startDate) {
        query = query.gte("date", options.startDate);
      }
      if (options.endDate) {
        query = query.lte("date", options.endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!organizationId,
  });
}

export function usePendingApprovalSummary(date?: string) {
  const { organizationId } = useAuth();

  return useQuery({
    queryKey: ["pending-approval-summary", organizationId, date],
    queryFn: async (): Promise<PendingApprovalSummary> => {
      if (!organizationId) return { total_pending: 0, pending_income_count: 0, pending_expense_count: 0, pending_income_total: 0, pending_expense_total: 0, pending_balance: 0 };

      const { data, error } = await supabase.rpc("get_pending_approval_summary", {
        _organization_id: organizationId,
        ...(date ? { _date: date } : {}),
      });
      if (error) throw error;
      return (data as unknown as PendingApprovalSummary) ?? { total_pending: 0, pending_income_count: 0, pending_expense_count: 0, pending_income_total: 0, pending_expense_total: 0, pending_balance: 0 };
    },
    enabled: !!organizationId,
  });
}

export function useTransactionApproval() {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();

  const approveMutation = useMutation({
    mutationFn: async (transactionIds: string[]) => {
      if (!organizationId) throw new Error("Organização não encontrada");

      const { data, error } = await supabase.rpc("approve_transactions", {
        _transaction_ids: transactionIds,
        _organization_id: organizationId,
      });
      if (error) throw error;
      return data as unknown as { approved_count: number };
    },
    onSuccess: (data) => {
      const count = (data as any)?.approved_count ?? 0;
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["financial-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["pending-approval-summary"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      toast({
        title: "Transações aprovadas",
        description: `${count} transação(ões) aprovada(s) e consolidada(s) no saldo.`,
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao aprovar",
        description: error.message,
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ transactionIds, reason }: { transactionIds: string[]; reason?: string }) => {
      if (!organizationId) throw new Error("Organização não encontrada");

      const { data, error } = await supabase.rpc("reject_transactions", {
        _transaction_ids: transactionIds,
        _organization_id: organizationId,
        _reason: reason || null,
      });
      if (error) throw error;
      return data as unknown as { rejected_count: number };
    },
    onSuccess: (data) => {
      const count = (data as any)?.rejected_count ?? 0;
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["pending-approval-summary"] });
      toast({
        title: "Transações reprovadas",
        description: `${count} transação(ões) reprovada(s). Não impactam o saldo.`,
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao reprovar",
        description: error.message,
      });
    },
  });

  return {
    approve: approveMutation.mutateAsync,
    reject: rejectMutation.mutateAsync,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
  };
}
