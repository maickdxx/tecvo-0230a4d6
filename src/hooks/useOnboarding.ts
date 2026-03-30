import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { trackFBEvent } from "@/lib/fbPixel";

export function useOnboarding() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: onboardingStatus, isLoading } = useQuery({
    queryKey: ["onboarding", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return { completed: true };

      const { data, error } = await supabase
        .from("organizations")
        .select("onboarding_completed")
        .eq("id", profile.organization_id)
        .maybeSingle();

      if (error) throw error;
      return {
        completed: data?.onboarding_completed ?? false,
      };
    },
    enabled: !!profile?.organization_id,
  });

  const completeOnboardingMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.organization_id) throw new Error("Organização não encontrada");

      const { error } = await supabase
        .from("organizations")
        .update({ onboarding_completed: true })
        .eq("id", profile.organization_id);

      if (error) throw error;

      // Welcome is now dispatched automatically by DB trigger on profile creation.
      // No client-side welcome dispatch needed — idempotent dispatch-welcome handles it.
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding"] });
      queryClient.invalidateQueries({ queryKey: ["organization"] });
    },
  });

  return {
    isOnboardingCompleted: onboardingStatus?.completed ?? true,
    isLoading,
    completeOnboarding: completeOnboardingMutation.mutateAsync,
    isCompleting: completeOnboardingMutation.isPending,
  };
}
