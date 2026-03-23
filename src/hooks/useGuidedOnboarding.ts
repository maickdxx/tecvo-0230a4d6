import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useSubscription } from "./useSubscription";

interface GuidedStep {
  completed: boolean;
  label: string;
}

interface GuidedOnboardingData {
  showGuide: boolean;
  currentStep: number;
  steps: GuidedStep[];
  allCompleted: boolean;
  dismissGuide: () => void;
  isLoading: boolean;
}

export function useGuidedOnboarding(): GuidedOnboardingData {
  const { organizationId, session } = useAuth();
  const { isTrial, isLoading: subLoading } = useSubscription();
  const queryClient = useQueryClient();

  const { data, isLoading: dataLoading } = useQuery({
    queryKey: ["guided-onboarding", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;

      // Fetch dismissed flag
      const { data: org } = await supabase
        .from("organizations")
        .select("guided_onboarding_dismissed")
        .eq("id", organizationId)
        .single();

      const dismissed = (org as any)?.guided_onboarding_dismissed ?? false;

      // Count real clients (exclude demo data)
      const { count: clientCount } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("is_demo_data", false)
        .is("deleted_at", null);

      // Count real services (exclude demo data)
      const { count: serviceCount } = await supabase
        .from("services")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("is_demo_data", false)
        .is("deleted_at", null);

      // Count real scheduled services (exclude demo data)
      const { count: scheduledCount } = await supabase
        .from("services")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("is_demo_data", false)
        .is("deleted_at", null)
        .not("scheduled_date", "is", null);

      return {
        dismissed,
        hasClients: (clientCount ?? 0) > 0,
        hasServices: (serviceCount ?? 0) > 0,
        hasScheduled: (scheduledCount ?? 0) > 0,
      };
    },
    enabled: !!organizationId && !!session,
    staleTime: 30_000,
  });

  const dismissMutation = useMutation({
    mutationFn: async () => {
      if (!organizationId) return;
      await supabase
        .from("organizations")
        .update({ guided_onboarding_dismissed: true } as any)
        .eq("id", organizationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guided-onboarding"] });
    },
  });

  const steps: GuidedStep[] = [
    { completed: data?.hasClients ?? false, label: "Criar primeiro cliente" },
    { completed: data?.hasServices ?? false, label: "Criar primeiro serviço" },
    { completed: data?.hasScheduled ?? false, label: "Criar primeiro agendamento" },
  ];

  const allCompleted = steps.every((s) => s.completed);

  // Current step: first incomplete, or last if all done
  const currentStep = allCompleted
    ? 3
    : steps.findIndex((s) => !s.completed) + 1;

  const showGuide =
    !subLoading &&
    !dataLoading &&
    !!data &&
    !data.dismissed;

  return {
    showGuide,
    currentStep,
    steps,
    allCompleted,
    dismissGuide: () => dismissMutation.mutate(),
    isLoading: subLoading || dataLoading,
  };
}
