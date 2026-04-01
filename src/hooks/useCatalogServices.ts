import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "./use-toast";

export interface CatalogService {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  unit_price: number;
  default_discount: number;
  notes: string | null;
  is_active: boolean;
  service_type: string | null;
  category: string | null;
  estimated_duration: string | null;
  checklist_id: string | null;
  standard_checklist: string[];
  is_non_standard: boolean;
  created_at: string;
  updated_at: string;
}

export interface CatalogServiceFormData {
  name: string;
  description?: string;
  unit_price: number;
  default_discount?: number;
  notes?: string;
  is_active?: boolean;
  service_type?: string;
  category?: string;
  estimated_duration?: string;
  checklist_id?: string;
  standard_checklist?: string[];
  is_non_standard?: boolean;
}

export function useCatalogServices() {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["catalog-services", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalog_services")
        .select("*")
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return (data ?? []) as CatalogService[];
    },
    enabled: !!organizationId,
  });

  const activeServices = query.data?.filter((s) => s.is_active) ?? [];

  const createMutation = useMutation({
    mutationFn: async (data: CatalogServiceFormData) => {
      if (!organizationId) throw new Error("Organização não encontrada");

      const { data: service, error } = await supabase
        .from("catalog_services")
        .insert({
          ...data,
          organization_id: organizationId,
        })
        .select()
        .single();

      if (error) throw error;
      return service;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalog-services"] });
      toast({
        title: "Serviço cadastrado",
        description: "O serviço foi adicionado ao catálogo.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao cadastrar serviço",
        description: error.message,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CatalogServiceFormData>;
    }) => {
      const { data: service, error } = await supabase
        .from("catalog_services")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return service;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalog-services"] });
      toast({
        title: "Serviço atualizado",
        description: "As alterações foram salvas.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar serviço",
        description: error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("catalog_services")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalog-services"] });
      toast({
        title: "Serviço movido para a lixeira",
        description: "O serviço ficará na lixeira por 30 dias.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao remover serviço",
        description: error.message,
      });
    },
  });

  return {
    services: query.data ?? [],
    activeServices,
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
