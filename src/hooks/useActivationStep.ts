import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type ActivationStep = "welcome" | "create_os" | "completed";

export function useActivationStep() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: step, isLoading } = useQuery({
    queryKey: ["activation_step", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return "completed" as ActivationStep;

      const { data, error } = await supabase
        .from("organizations")
        .select("activation_step")
        .eq("id", profile.organization_id)
        .maybeSingle();

      if (error) throw error;
      return ((data as any)?.activation_step ?? "completed") as ActivationStep;
    },
    enabled: !!profile?.organization_id,
    staleTime: 30_000,
  });

  const advanceMutation = useMutation({
    mutationFn: async (newStep: ActivationStep) => {
      if (!profile?.organization_id) throw new Error("No org");

      const { error } = await supabase
        .from("organizations")
        .update({ activation_step: newStep } as any)
        .eq("id", profile.organization_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activation_step"] });
    },
  });

  return {
    step: step ?? "completed",
    isLoading,
    advance: advanceMutation.mutateAsync,
    isCompleted: step === "completed",
  };
}
