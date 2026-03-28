import { DemoConversionBanner } from "@/components/demo/DemoConversionBanner";
import { GuidedOnboardingCard } from "@/components/onboarding/GuidedOnboardingCard";
import { WhatsAppPromptCard } from "@/components/dashboard/WhatsAppPromptCard";
import { ValueMilestoneBanner } from "@/components/dashboard/ValueMilestoneBanner";
import { PageTutorialBanner } from "@/components/onboarding/PageTutorialBanner";
import { useDemoMode } from "@/hooks/useDemoMode";
import { useGuidedOnboarding } from "@/hooks/useGuidedOnboarding";
import { useAuth } from "@/hooks/useAuth";
import { useProfileSensitiveData } from "@/hooks/useProfileSensitiveData";
import { usePageTutorial } from "@/hooks/usePageTutorial";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Dashboard banner orchestrator.
 *
 * Priority hierarchy (highest → lowest):
 *  1. DemoConversionBanner   — demo mode conversion CTA
 *  2. GuidedOnboardingCard   — activation checklist (real mode only)
 *  3. WhatsAppPromptCard     — collect WhatsApp
 *  4. ValueMilestoneBanner   — celebrate 3+ services
 *  5. PageTutorialBanner     — contextual page tip
 *
 * Rules:
 *  - #1 and #2 are mutually exclusive (demo vs real).
 *  - Only ONE "soft" banner (#3-#5) shows at a time.
 *  - During activation phase (#2 visible), all soft banners are hidden.
 */
export function DashboardBanners() {
  const { isDemoMode } = useDemoMode();
  const { showGuide, allCompleted: checklistDone } = useGuidedOnboarding();
  const { user, profile, session } = useAuth();
  const { sensitiveData } = useProfileSensitiveData();
  const { showTutorial: showDashboardTutorial } = usePageTutorial("dashboard");

  // Activation phase suppresses all soft banners
  const isActivationPhase = !isDemoMode && showGuide && !checklistDone;

  // --- Resolve which soft banner to show (only one) ---
  const hasWhatsapp = !!(profile?.phone || sensitiveData?.whatsapp_personal);
  const whatsappDismissed = (() => {
    const ts = localStorage.getItem("whatsapp_prompt_dismissed_at");
    if (!ts) return false;
    return Date.now() - Number(ts) < 24 * 60 * 60 * 1000;
  })();
  const showWhatsApp = !isDemoMode && !!user && !hasWhatsapp && !whatsappDismissed;

  // ValueMilestone conditions
  const userId = session?.user?.id;
  const { data: milestoneProfile } = useQuery({
    queryKey: ["profile-onboarding", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from("profiles")
        .select("onboarding_completed, organization_id")
        .eq("user_id", userId)
        .single();
      return data;
    },
    enabled: !!userId,
  });

  const { data: realServiceCount = 0 } = useQuery({
    queryKey: ["real-service-count", milestoneProfile?.organization_id],
    queryFn: async () => {
      if (!milestoneProfile?.organization_id) return 0;
      const { count } = await supabase
        .from("services")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", milestoneProfile.organization_id)
        .eq("is_demo_data", false)
        .is("deleted_at", null);
      return count ?? 0;
    },
    enabled: !!milestoneProfile?.organization_id && !isDemoMode && !milestoneProfile?.onboarding_completed,
    staleTime: 5 * 60 * 1000,
  });

  const showMilestone = !isDemoMode && !milestoneProfile?.onboarding_completed && realServiceCount >= 3;
  const showTutorial = !isDemoMode && showDashboardTutorial;

  // Pick highest-priority soft banner
  type SoftBanner = "whatsapp" | "milestone" | "tutorial" | null;
  let activeSoftBanner: SoftBanner = null;
  if (!isActivationPhase) {
    if (showWhatsApp) activeSoftBanner = "whatsapp";
    else if (showMilestone) activeSoftBanner = "milestone";
    else if (showTutorial) activeSoftBanner = "tutorial";
  }

  return (
    <>
      {/* Priority 1: Demo conversion (demo mode only) */}
      {isDemoMode && <DemoConversionBanner />}

      {/* Priority 2: Guided onboarding checklist (real mode only) */}
      {!isDemoMode && <GuidedOnboardingCard />}

      {/* Priority 3-5: At most ONE soft banner */}
      {activeSoftBanner === "whatsapp" && <WhatsAppPromptCard />}
      {activeSoftBanner === "milestone" && <ValueMilestoneBanner />}
      {activeSoftBanner === "tutorial" && (
        <PageTutorialBanner
          pageKey="dashboard"
          title="Visão Geral"
          message="Este é o painel da sua empresa. Aqui você vê o que realmente entrou de dinheiro e o que ainda vai entrar."
        />
      )}
    </>
  );
}
