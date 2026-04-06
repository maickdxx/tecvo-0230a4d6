import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "./use-toast";
import { useDemoMode } from "./useDemoMode";
import { trackFBCustomEvent } from "@/lib/fbPixel";

export interface Client {
  id: string;
  organization_id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  zip_code: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  person_type: string;
  document: string | null;
  company_name: string | null;
  trade_name: string | null;
  contact_name: string | null;
  state_registration: string | null;
  whatsapp: string | null;
  client_origin: string | null;
  client_type: string | null;
  client_status: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientFormData {
  name: string;
  phone: string;
  email?: string;
  zip_code?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  notes?: string;
  person_type?: string;
  document?: string;
  company_name?: string;
  trade_name?: string;
  contact_name?: string;
  state_registration?: string;
  whatsapp?: string;
  client_origin?: string;
  client_type?: string;
  client_status?: string;
  internal_notes?: string;
}

export function useClients() {
  const { organizationId } = useAuth();
  const { isDemoMode } = useDemoMode();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["clients", organizationId, isDemoMode],
    queryFn: async () => {
      if (!organizationId) return [];
      
      let queryBuilder = supabase
        .from("clients")
        .select("*")
        .order("name");

      if (!isDemoMode) {
        queryBuilder = queryBuilder.eq("is_demo_data", false);
      }

      const { data, error } = await queryBuilder.range(0, 999);
      if (error) throw error;
      return (data ?? []) as Client[];
    },
    enabled: !!organizationId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: ClientFormData) => {
      if (!organizationId) throw new Error("Organização não encontrada");

      const { data: client, error } = await supabase
        .from("clients")
        .insert({
          ...data,
          organization_id: organizationId,
        })
        .select()
        .single();

      if (error) throw error;
      return client;
    },
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      trackFBCustomEvent("ClientCreated");
      toast({
        title: "Cliente cadastrado",
        description: "O cliente foi adicionado com sucesso",
      });

      // Fire-and-forget: send Laura's welcome message to the new client
      if (client?.phone && organizationId) {
        supabase.functions.invoke("dispatch-client-welcome", {
          body: {
            organization_id: organizationId,
            client_phone: client.whatsapp || client.phone,
            client_name: client.name,
          },
        }).catch(() => { /* silent – welcome is best-effort */ });
      }
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao cadastrar",
        description: error.message,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ClientFormData }) => {
      const { data: client, error } = await supabase
        .from("clients")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return client;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast({
        title: "Cliente atualizado",
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
      const { error } = await supabase
        .from("clients")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast({
        title: "Cliente movido para a lixeira",
        description: "O cliente ficará na lixeira por 30 dias antes de ser excluído permanentemente",
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

  return {
    clients: query.data ?? [],
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
