import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useOrganization } from "./useOrganization";
import { toast } from "./use-toast";

export interface OperationalCapacityConfig {
  id: string;
  organization_id: string;
  active_teams: number;
  schedule_mode: "total_hours" | "start_end";
  start_time: string | null;
  end_time: string | null;
  break_minutes: number | null;
  total_minutes_per_day: number;
  works_saturday: boolean;
  saturday_minutes: number | null;
  default_travel_minutes: number;
}

export interface OperationalCapacityConfigFormData {
  active_teams: number;
  schedule_mode: "total_hours" | "start_end";
  start_time?: string | null;
  end_time?: string | null;
  break_minutes?: number | null;
  total_minutes_per_day: number;
  works_saturday: boolean;
  saturday_minutes?: number | null;
  default_travel_minutes: number;
}

export function useOperationalCapacityConfig() {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();
  const orgId = organization?.id;

  const { data: config, isLoading, isFetched } = useQuery({
    queryKey: ["operational-capacity-config", orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from("operational_capacity_config")
        .select("*")
        .eq("organization_id", orgId)
        .maybeSingle();
      if (error) throw error;
      return data as OperationalCapacityConfig | null;
    },
    enabled: !!orgId && !!user,
  });

  const saveMutation = useMutation({
    mutationFn: async (formData: OperationalCapacityConfigFormData) => {
      if (!orgId) throw new Error("No org");

      if (config) {
        const { error } = await supabase
          .from("operational_capacity_config")
          .update({
            active_teams: formData.active_teams,
            schedule_mode: formData.schedule_mode,
            start_time: formData.start_time ?? null,
            end_time: formData.end_time ?? null,
            break_minutes: formData.break_minutes ?? 0,
            total_minutes_per_day: formData.total_minutes_per_day,
            works_saturday: formData.works_saturday,
            saturday_minutes: formData.saturday_minutes ?? 0,
            default_travel_minutes: formData.default_travel_minutes,
          })
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("operational_capacity_config")
          .insert({
            organization_id: orgId,
            active_teams: formData.active_teams,
            schedule_mode: formData.schedule_mode,
            start_time: formData.start_time ?? null,
            end_time: formData.end_time ?? null,
            break_minutes: formData.break_minutes ?? 0,
            total_minutes_per_day: formData.total_minutes_per_day,
            works_saturday: formData.works_saturday,
            saturday_minutes: formData.saturday_minutes ?? 0,
            default_travel_minutes: formData.default_travel_minutes,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operational-capacity-config", orgId] });
      toast({ title: "Configuração salva", description: "Capacidade operacional atualizada." });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível salvar a configuração.", variant: "destructive" });
    },
  });

  return {
    config,
    isLoading,
    isFetched,
    isConfigured: !!config,
    save: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  };
}
