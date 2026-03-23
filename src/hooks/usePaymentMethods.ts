import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "./use-toast";

export type FeeType = "percentage" | "fixed";

export interface PaymentMethod {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  fee_type: FeeType;
  fee_value: number;
  is_active: boolean;
  is_default: boolean;
  installments: number | null;
  default_financial_account_id: string | null;
  created_at: string;
}

export interface PaymentMethodFormData {
  name: string;
  slug?: string;
  fee_type: FeeType;
  fee_value: number;
  installments?: number | null;
  default_financial_account_id?: string | null;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function usePaymentMethods() {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["payment-methods", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .order("installments", { ascending: true, nullsFirst: true })
        .order("name");

      if (error) throw error;
      return data as PaymentMethod[];
    },
    enabled: !!organizationId,
  });

  const allPaymentMethodsQuery = useQuery({
    queryKey: ["payment-methods-all", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .order("is_default", { ascending: false })
        .order("installments", { ascending: true, nullsFirst: true })
        .order("name");

      if (error) throw error;
      return data as PaymentMethod[];
    },
    enabled: !!organizationId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: PaymentMethodFormData) => {
      if (!organizationId) throw new Error("Organização não encontrada");

      const slug = data.slug || generateSlug(data.name);

      const { data: method, error } = await supabase
        .from("payment_methods")
        .insert({
          name: data.name,
          slug,
          fee_type: data.fee_type,
          fee_value: data.fee_value,
          organization_id: organizationId,
          is_default: false,
          installments: data.installments ?? null,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("Já existe uma forma de pagamento com esse nome");
        }
        throw error;
      }
      return method;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
      queryClient.invalidateQueries({ queryKey: ["payment-methods-all"] });
      toast({
        title: "Forma de pagamento criada",
        description: "A nova forma de pagamento foi adicionada com sucesso",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao criar",
        description: error.message,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PaymentMethodFormData> }) => {
      const updateData: Record<string, unknown> = { ...data };
      if (data.name && !data.slug) {
        updateData.slug = generateSlug(data.name);
      }

      const { data: method, error } = await supabase
        .from("payment_methods")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("Já existe uma forma de pagamento com esse nome");
        }
        throw error;
      }
      return method;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
      queryClient.invalidateQueries({ queryKey: ["payment-methods-all"] });
      toast({
        title: "Forma de pagamento atualizada",
        description: "A forma de pagamento foi atualizada com sucesso",
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
      // Soft delete - just mark as inactive
      const { error } = await supabase
        .from("payment_methods")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
      queryClient.invalidateQueries({ queryKey: ["payment-methods-all"] });
      toast({
        title: "Forma de pagamento removida",
        description: "A forma de pagamento foi desativada com sucesso",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao remover",
        description: error.message,
      });
    },
  });

  // Create a labels map from the payment methods
  const paymentMethodLabels: Record<string, string> = {};
  query.data?.forEach((method) => {
    paymentMethodLabels[method.slug] = method.name;
  });

  // Calculate fee for a given amount
  const calculateFee = (slug: string, amount: number): number => {
    const method = query.data?.find((m) => m.slug === slug);
    if (!method || !method.fee_value) return 0;

    if (method.fee_type === "percentage") {
      return amount * (method.fee_value / 100);
    }
    return method.fee_value;
  };

  // Format fee for display
  const formatFee = (method: PaymentMethod): string => {
    if (method.fee_value === 0) return "Sem taxa";
    if (method.fee_type === "percentage") {
      return `${method.fee_value}%`;
    }
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(method.fee_value);
  };

  // Get credit card methods (those with installments)
  const creditCardMethods = query.data?.filter((m) => m.installments !== null) ?? [];
  
  // Get non-credit card methods (those without installments)
  const regularMethods = query.data?.filter((m) => m.installments === null) ?? [];
  
  // Get base payment method options for select (unique base types)
  const basePaymentOptions = [
    ...regularMethods,
    // Add a single "Cartão de Crédito" option if any credit card methods exist
    ...(creditCardMethods.length > 0 
      ? [{ 
          id: "credit_card_group", 
          slug: "credit_card", 
          name: "Cartão de Crédito", 
          fee_type: "percentage" as FeeType,
          fee_value: 0,
          is_active: true,
          is_default: false,
          installments: null,
          organization_id: organizationId || "",
          created_at: "",
        }] 
      : []),
  ];

  // Check if a slug is a credit card method
  const isCreditCard = (slug: string): boolean => {
    return slug === "credit_card" || slug.startsWith("credit_card_");
  };

  // Get installment options for credit card
  const getInstallmentOptions = () => {
    return creditCardMethods.map((m) => ({
      slug: m.slug,
      installments: m.installments!,
      fee: m.fee_value,
      feeFormatted: formatFee(m),
    }));
  };

  return {
    paymentMethods: query.data ?? [],
    allPaymentMethods: allPaymentMethodsQuery.data ?? [],
    paymentMethodLabels,
    isLoading: query.isLoading,
    isLoadingAll: allPaymentMethodsQuery.isLoading,
    error: query.error,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    calculateFee,
    formatFee,
    // New helper functions for installments
    creditCardMethods,
    regularMethods,
    basePaymentOptions,
    isCreditCard,
    getInstallmentOptions,
  };
}
