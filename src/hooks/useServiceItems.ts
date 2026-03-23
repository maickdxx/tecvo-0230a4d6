import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "./use-toast";

export interface ServiceItem {
  id: string;
  service_id: string;
  organization_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  discount_type: "percentage" | "fixed";
  created_at: string;
}

export interface ServiceItemFormData {
  description: string;
  quantity: number;
  unit_price: number;
  discount?: number;
  discount_type?: "percentage" | "fixed";
}

export function useServiceItems(serviceId: string) {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["service-items", serviceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_items")
        .select("*")
        .eq("service_id", serviceId)
        .order("created_at");

      if (error) throw error;
      return data as ServiceItem[];
    },
    enabled: !!serviceId && !!organizationId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: ServiceItemFormData) => {
      if (!organizationId) throw new Error("Organização não encontrada");

      const { data: item, error } = await supabase
        .from("service_items")
        .insert({
          ...data,
          service_id: serviceId,
          organization_id: organizationId,
        })
        .select()
        .single();

      if (error) throw error;
      return item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-items", serviceId] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao adicionar item",
        description: error.message,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ServiceItemFormData> }) => {
      const { data: item, error } = await supabase
        .from("service_items")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-items", serviceId] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar item",
        description: error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("service_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-items", serviceId] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao remover item",
        description: error.message,
      });
    },
  });

  const total = query.data?.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  ) ?? 0;

  return {
    items: query.data ?? [],
    total,
    isLoading: query.isLoading,
    error: query.error,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
