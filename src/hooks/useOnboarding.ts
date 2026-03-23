import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useOnboarding() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: onboardingStatus, isLoading } = useQuery({
    queryKey: ["onboarding", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return { completed: true, welcomeSent: true };

      const { data, error } = await supabase
        .from("organizations")
        .select("onboarding_completed, welcome_whatsapp_sent")
        .eq("id", profile.organization_id)
        .maybeSingle();

      if (error) throw error;
      return {
        completed: data?.onboarding_completed ?? false,
        welcomeSent: data?.welcome_whatsapp_sent ?? false,
      };
    },
    enabled: !!profile?.organization_id,
  });

  // Retry welcome WhatsApp if onboarding is done but message wasn't sent
  useEffect(() => {
    if (onboardingStatus?.completed && !onboardingStatus?.welcomeSent) {
      supabase.functions.invoke("send-welcome-whatsapp").catch((err) => {
        console.warn("Welcome WhatsApp retry failed:", err);
      });
    }
  }, [onboardingStatus?.completed, onboardingStatus?.welcomeSent]);

  const completeOnboardingMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.organization_id) throw new Error("Organização não encontrada");

      const { error } = await supabase
        .from("organizations")
        .update({ onboarding_completed: true })
        .eq("id", profile.organization_id);

      if (error) throw error;

      // Send welcome WhatsApp message (fire-and-forget)
      supabase.functions.invoke("send-welcome-whatsapp").catch((err) => {
        console.warn("Welcome WhatsApp failed:", err);
      });
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
