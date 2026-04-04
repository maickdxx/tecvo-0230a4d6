import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import { useDemoMode } from "@/hooks/useDemoMode";
import { useDemoTour } from "@/hooks/useDemoTour";
import { useGuidedOnboarding } from "@/hooks/useGuidedOnboarding";

/**
 * Global banner priority tiers (highest → lowest):
 *
 *  BLOCKING   — full-screen overlays (DemoTour, PaymentPending)
 *  CRITICAL   — billing emergencies (expired trial, past-due grace expired)
 *  URGENT     — billing warnings (active trial countdown, cancelling, past-due)
 *  ACTIVATION — onboarding / demo conversion
 *  PROMPT     — config nudges (WhatsApp)
 *  INFO       — tips, milestones, install banner
 *
 * Rules:
 *  • BLOCKING  active → suppress ACTIVATION + PROMPT + INFO
 *  • CRITICAL  active → suppress PROMPT + INFO
 *  • URGENT    active → suppress INFO
 *  • ACTIVATION active → suppress PROMPT + INFO  (already handled locally)
 */

export type BannerTier =
  | "blocking"
  | "critical"
  | "urgent"
  | "activation"
  | "prompt"
  | "info"
  | "none";

interface BannerPriorityState {
  /** Highest active tier right now */
  activeTier: BannerTier;
  /** Check if a given tier should be suppressed by a higher active tier */
  isSuppressed: (tier: BannerTier) => boolean;
}

const TIER_RANK: Record<BannerTier, number> = {
  blocking: 6,
  critical: 5,
  urgent: 4,
  activation: 3,
  prompt: 2,
  info: 1,
  none: 0,
};

// How many levels above must a tier be to suppress another
// e.g. critical (5) suppresses prompt (2) and info (1), but NOT activation (3)
// Rule: suppress if activeTier rank >= tier rank + 2 (i.e. at least 2 levels above)
// Exception: blocking suppresses activation and below
const shouldSuppress = (activeTier: BannerTier, targetTier: BannerTier): boolean => {
  const activeRank = TIER_RANK[activeTier];
  const targetRank = TIER_RANK[targetTier];

  if (activeTier === "none") return false;

  // Blocking suppresses everything except other blocking/critical
  if (activeTier === "blocking") return targetRank <= TIER_RANK["activation"];

  // Critical suppresses prompt + info
  if (activeTier === "critical") return targetRank <= TIER_RANK["prompt"];

  // Urgent suppresses info only
  if (activeTier === "urgent") return targetRank <= TIER_RANK["info"];

  // Activation suppresses prompt + info
  if (activeTier === "activation") return targetRank <= TIER_RANK["prompt"];

  return false;
};

const BannerPriorityContext = createContext<BannerPriorityState>({
  activeTier: "none",
  isSuppressed: () => false,
});

export function useBannerPriority() {
  return useContext(BannerPriorityContext);
}

export function BannerPriorityProvider({ children }: { children: ReactNode }) {
  const { showTour } = useDemoTour();
  const { isDemoMode } = useDemoMode();
  const {
    isPastDue,
    isPastDueGraceExpired,
    isCancelledAtPeriodEnd,
  } = useSubscription();
  const { showGuide, allCompleted: checklistDone } = useGuidedOnboarding();

  const activeTier = useMemo<BannerTier>(() => {
    // BLOCKING: demo tour overlay active
    if (showTour) return "blocking";

    // CRITICAL: past-due grace expired
    if (isPastDueGraceExpired) return "critical";

    // URGENT: past-due or cancelling
    if (isPastDue || isCancelledAtPeriodEnd) return "urgent";

    // ACTIVATION: onboarding checklist visible (real mode, not completed)
    if (!isDemoMode && showGuide && !checklistDone) return "activation";
    // Demo mode itself is an activation state
    if (isDemoMode) return "activation";

    return "none";
  }, [showTour, isTrialExpired, isPastDueGraceExpired, isTrial, isPastDue, isCancelledAtPeriodEnd, isDemoMode, showGuide, checklistDone]);

  const value = useMemo<BannerPriorityState>(
    () => ({
      activeTier,
      isSuppressed: (tier: BannerTier) => shouldSuppress(activeTier, tier),
    }),
    [activeTier]
  );

  return (
    <BannerPriorityContext.Provider value={value}>
      {children}
    </BannerPriorityContext.Provider>
  );
}
