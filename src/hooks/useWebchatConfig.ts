import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";

export interface WebchatConfig {
  id: string;
  organization_id: string;
  is_active: boolean;
  position: string;
  color: string;
  button_text: string | null;
  welcome_message: string | null;
  auto_show_welcome: boolean;
  display_name: string | null;
  avatar_url: string | null;
  bottom_distance: number;
}

export function useWebchatConfig() {
  const { organization } = useOrganization();
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["webchat-config", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webchat_configs" as any)
        .select("*")
        .eq("organization_id", organization!.id)
        .maybeSingle();

      if (error) throw error;
      return (data as unknown as WebchatConfig) || null;
    },
    enabled: !!organization?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: Partial<WebchatConfig>) => {
      if (config?.id) {
        const { error } = await supabase
          .from("webchat_configs" as any)
          .update(values as any)
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("webchat_configs" as any)
          .insert({ ...values, organization_id: organization!.id } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webchat-config"] });
      toast.success("Configuração salva com sucesso");
    },
    onError: () => {
      toast.error("Erro ao salvar configuração");
    },
  });

  return {
    config,
    isLoading,
    save: saveMutation.mutate,
    isSaving: saveMutation.isPending,
  };
}
