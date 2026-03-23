import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "./use-toast";

export interface ClientPortalConfig {
  id: string;
  organization_id: string;
  is_active: boolean;
  display_name: string | null;
  welcome_message: string | null;
  contact_phone: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  slug: string | null;
  custom_domain: string | null;
  domain_status: string;
  created_at: string;
  updated_at: string;
}

export type ClientPortalConfigUpdate = Partial<Omit<ClientPortalConfig, "id" | "organization_id" | "created_at" | "updated_at">>;

export function useClientPortalConfig() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const { data: config, isLoading } = useQuery({
    queryKey: ["client-portal-config", orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from("client_portal_config")
        .select("*")
        .eq("organization_id", orgId)
        .maybeSingle();
      if (error) throw error;
      return data as ClientPortalConfig | null;
    },
    enabled: !!orgId,
  });

  const upsertMutation = useMutation({
    mutationFn: async (updates: ClientPortalConfigUpdate) => {
      if (!orgId) throw new Error("No org");

      if (config?.id) {
        const { error } = await supabase
          .from("client_portal_config")
          .update({ ...updates, updated_at: new Date().toISOString() } as any)
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("client_portal_config")
          .insert({ organization_id: orgId, ...updates } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-portal-config", orgId] });
      toast({ title: "Configuração salva" });
    },
    onError: (err: any) => {
      const msg = err?.message || "";
      if (msg.includes("duplicate key") && msg.includes("slug")) {
        toast({ title: "Erro", description: "Este slug já está em uso. Escolha outro.", variant: "destructive" });
      } else {
        toast({ title: "Erro ao salvar", description: msg, variant: "destructive" });
      }
    },
  });

  return {
    config,
    isLoading,
    updateConfig: upsertMutation.mutate,
    isSaving: upsertMutation.isPending,
  };
}
