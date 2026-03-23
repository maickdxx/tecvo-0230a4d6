import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "./use-toast";

export interface ServiceType {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  is_default: boolean;
  created_at: string;
}

export interface ServiceTypeFormData {
  name: string;
  slug?: string;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function useServiceTypes() {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["service-types", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from("service_types")
        .select("*")
        .order("is_default", { ascending: false })
        .order("name");

      if (error) throw error;
      return data as ServiceType[];
    },
    enabled: !!organizationId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: ServiceTypeFormData) => {
      if (!organizationId) throw new Error("Organização não encontrada");

      const slug = data.slug || generateSlug(data.name);

      const { data: serviceType, error } = await supabase
        .from("service_types")
        .insert({
          name: data.name,
          slug,
          organization_id: organizationId,
          is_default: false,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("Já existe um tipo com esse nome");
        }
        throw error;
      }
      return serviceType;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-types"] });
      toast({
        title: "Tipo de serviço criado",
        description: "O novo tipo foi adicionado com sucesso",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao criar tipo",
        description: error.message,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ServiceTypeFormData> }) => {
      const updateData: Record<string, unknown> = { ...data };
      if (data.name && !data.slug) {
        updateData.slug = generateSlug(data.name);
      }

      const { data: serviceType, error } = await supabase
        .from("service_types")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("Já existe um tipo com esse nome");
        }
        throw error;
      }
      return serviceType;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-types"] });
      toast({
        title: "Tipo atualizado",
        description: "O tipo foi atualizado com sucesso",
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
      // Get the slug first
      const { data: typeData } = await supabase
        .from("service_types")
        .select("slug, is_default")
        .eq("id", id)
        .single();

      if (typeData?.is_default) {
        throw new Error("Tipos padrão não podem ser excluídos");
      }

      const { error } = await supabase.from("service_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-types"] });
      toast({
        title: "Tipo excluído",
        description: "O tipo foi removido com sucesso",
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

  // Create a labels map from the service types
  const typeLabels: Record<string, string> = {};
  query.data?.forEach((type) => {
    typeLabels[type.slug] = type.name;
  });

  return {
    serviceTypes: query.data ?? [],
    typeLabels,
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
