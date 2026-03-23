import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface ServicePayment {
  id: string;
  organization_id: string;
  service_id: string;
  payment_method: string;
  amount: number;
  financial_account_id: string;
  created_at: string;
}

export interface ServicePaymentInput {
  payment_method: string;
  amount: number;
  financial_account_id: string;
}

export function useServicePayments(serviceId?: string) {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["service-payments", serviceId],
    queryFn: async () => {
      if (!serviceId) return [];
      const { data, error } = await supabase
        .from("service_payments")
        .select("*")
        .eq("service_id", serviceId)
        .order("created_at");
      if (error) throw error;
      return data as ServicePayment[];
    },
    enabled: !!serviceId,
  });

  const createPaymentsMutation = useMutation({
    mutationFn: async ({
      serviceId,
      payments,
    }: {
      serviceId: string;
      payments: ServicePaymentInput[];
    }) => {
      if (!organizationId) throw new Error("Organização não encontrada");

      const { data: { user } } = await supabase.auth.getUser();

      const rows = payments.map((p) => ({
        organization_id: organizationId,
        service_id: serviceId,
        payment_method: p.payment_method,
        amount: p.amount,
        financial_account_id: p.financial_account_id,
        registered_by: user?.id ?? null,
      }));

      const { error } = await supabase.from("service_payments").insert(rows as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-payments"] });
    },
  });

  return {
    payments: query.data ?? [],
    isLoading: query.isLoading,
    createPayments: createPaymentsMutation.mutateAsync,
  };
}
