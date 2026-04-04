import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { format } from "date-fns";
import { PLAN_CONFIG, FREE_PLAN_INFO } from "@/lib/planConfig";
import type { PlanSlug } from "@/lib/planConfig";

export type PlanType = PlanSlug;

// Grace period: 7 days of past_due before restricting access
const PAST_DUE_GRACE_DAYS = 7;

export interface SubscriptionData {
  plan: PlanType;
  planExpiresAt: Date | null;
  servicesUsed: number;
  servicesLimit: number;
  canCreateService: boolean;
  isFreePlan: boolean;
  isStarterPlan: boolean;
  isEssentialPlan: boolean;
  isProPlan: boolean;
  usagePercentage: number;
  isNearLimit: boolean;
  canInviteMembers: boolean;
  canHaveEmployees: boolean;
  canAccessFinance: boolean;
  canAccessCatalog: boolean;
  canAccessAgenda: boolean;
  hasWhatsAppFull: boolean;
  hasRecurrence: boolean;
  hasDigitalSignature: boolean;
  hasAdvancedFinance: boolean;
  hasPermissions: boolean;
  hasTeamManagement: boolean;
  hasTimeClock: boolean;
  hasClientPortal: boolean;
  maxUsers: number;
  maxWhatsAppChannels: number;
  // Trial fields (legacy — always false/zero/null)
  isTrial: boolean;
  trialEndsAt: null;
  trialDaysLeft: 0;
  isTrialExpired: boolean;
  // Cancellation fields
  isCancelledAtPeriodEnd: boolean;
  daysUntilExpiration: number;
  // Stripe status
  subscriptionStatus: string;
  hasActiveStripeSubscription: boolean;
  // Past due
  isPastDue: boolean;
  isPastDueGraceExpired: boolean;
  pastDueDaysLeft: number;
  // Welcome page
  welcomeShown: boolean;
}

const PLAN_LIMITS: Record<PlanType, number> = {
  free: FREE_PLAN_INFO.servicesLimit,
  teste: PLAN_CONFIG.teste.servicesLimit,
  starter: PLAN_CONFIG.starter.servicesLimit,
  essential: PLAN_CONFIG.essential.servicesLimit,
  pro: PLAN_CONFIG.pro.servicesLimit,
};

export function useSubscription() {
  const { organizationId, session } = useAuth();

  const query = useQuery({
    queryKey: ["subscription", organizationId],
    queryFn: async (): Promise<SubscriptionData> => {
      if (!organizationId) {
        return getDefaultData();
      }

      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("plan, plan_expires_at, cancel_at_period_end, welcome_shown, subscription_status, stripe_subscription_id, past_due_since")
        .eq("id", organizationId)
        .single();

      if (orgError) throw orgError;

      const rawPlan = (org?.plan as PlanType) || "free";
      const planExpiresAt = org?.plan_expires_at ? new Date(org.plan_expires_at) : null;
      const cancelAtPeriodEnd = org?.cancel_at_period_end ?? false;
      const welcomeShown = org?.welcome_shown ?? true;
      const subscriptionStatus = (org as Record<string, unknown>)?.subscription_status as string || "inactive";
      const stripeSubId = (org as Record<string, unknown>)?.stripe_subscription_id as string | null;
      const pastDueSince = (org as Record<string, unknown>)?.past_due_since as string | null;

      const now = new Date();

      // ── PAST DUE ──
      const isPastDue = subscriptionStatus === "past_due";
      let isPastDueGraceExpired = false;
      let pastDueDaysLeft = PAST_DUE_GRACE_DAYS;
      if (isPastDue && pastDueSince) {
        const daysSincePastDue = Math.floor((now.getTime() - new Date(pastDueSince).getTime()) / (1000 * 60 * 60 * 24));
        pastDueDaysLeft = Math.max(0, PAST_DUE_GRACE_DAYS - daysSincePastDue);
        isPastDueGraceExpired = daysSincePastDue >= PAST_DUE_GRACE_DAYS;
      }

      // ── STRIPE SUBSCRIPTION STATE ──
      const hasStripeSubscription = !!stripeSubId;

      // ── TRIAL STATE — legacy, kept for backward compatibility but no longer granted ──
      const isTrial = false;
      const isTrialActive = false;
      const isTrialExpired = false;
      const trialDaysLeft = 0;

      // ══════════════════════════════════════════════════════════
      // EFFECTIVE PLAN — single clear decision tree
      // Priority: Stripe subscription > Free
      // ══════════════════════════════════════════════════════════
      let plan: PlanType;

      if (hasStripeSubscription) {
        const isStatusUsable =
          subscriptionStatus === "active" ||
          subscriptionStatus === "trialing" ||
          (isPastDue && !isPastDueGraceExpired);

        const isPlanNotExpired = !planExpiresAt || planExpiresAt > now;

        if (rawPlan !== "free" && isStatusUsable && isPlanNotExpired) {
          plan = rawPlan;
        } else {
          plan = "free";
        }
      } else {
        plan = "free";
      }

      // Usage
      const currentMonth = format(new Date(), "yyyy-MM");
      const { data: usage } = await supabase
        .from("organization_usage")
        .select("services_created")
        .eq("organization_id", organizationId)
        .eq("month_year", currentMonth)
        .single();

      const servicesUsed = usage?.services_created || 0;
      const servicesLimit = PLAN_LIMITS[plan];
      const canCreateService = isTrialExpired ? false : (plan === "pro" || servicesUsed < PLAN_LIMITS[plan]);
      const usagePercentage = plan === "pro" ? 0 : (servicesUsed / PLAN_LIMITS[plan]) * 100;
      const isNearLimit = plan !== "pro" && servicesUsed >= PLAN_LIMITS[plan] * 0.8;

      const isCancelledAtPeriodEnd = cancelAtPeriodEnd && plan !== "free";
      const daysUntilExpiration = planExpiresAt
        ? Math.max(0, Math.ceil((planExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

      const planConfig = plan !== "free" ? PLAN_CONFIG[plan as Exclude<PlanType, "free">] : null;
      const hasActiveStripeSubscription = !!stripeSubId && (subscriptionStatus === "active" || subscriptionStatus === "trialing");

      return {
        plan,
        planExpiresAt,
        servicesUsed,
        servicesLimit,
        canCreateService,
        isFreePlan: plan === "free",
        isStarterPlan: plan === "starter",
        isEssentialPlan: plan === "essential",
        isProPlan: plan === "pro",
        usagePercentage: Math.min(usagePercentage, 100),
        isNearLimit,
        canInviteMembers: plan === "essential" || plan === "pro" || plan === "starter",
        canHaveEmployees: plan === "pro",
        canAccessFinance: plan !== "free" || isTrialActive,
        canAccessCatalog: plan !== "free" || isTrialActive,
        canAccessAgenda: plan !== "free" || isTrialActive,
        hasWhatsAppFull: planConfig?.hasWhatsAppFull ?? false,
        hasRecurrence: planConfig?.hasRecurrence ?? false,
        hasDigitalSignature: planConfig?.hasDigitalSignature ?? false,
        hasAdvancedFinance: planConfig?.hasAdvancedFinance ?? false,
        hasPermissions: planConfig?.hasPermissions ?? false,
        hasTeamManagement: planConfig?.hasTeamManagement ?? false,
        hasTimeClock: planConfig?.hasTimeClock ?? false,
        hasClientPortal: planConfig?.hasClientPortal ?? false,
        maxUsers: planConfig?.maxUsers ?? 1,
        maxWhatsAppChannels: planConfig?.maxWhatsAppChannels ?? 0,
        isTrial: isTrialActive,
        trialEndsAt,
        trialDaysLeft,
        isTrialExpired,
        isCancelledAtPeriodEnd,
        daysUntilExpiration,
        subscriptionStatus,
        hasActiveStripeSubscription,
        isPastDue,
        isPastDueGraceExpired,
        pastDueDaysLeft,
        welcomeShown,
      };
    },
    enabled: !!organizationId && !!session,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  const checkSubscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error checking subscription:", error);
      return null;
    }
  };

  return {
    ...query.data ?? getDefaultData(),
    isLoading: query.isLoading || (!!session && !organizationId),
    error: query.error,
    refetch: query.refetch,
    checkSubscription,
  };
}

function getDefaultData(): SubscriptionData {
  return {
    plan: "free",
    planExpiresAt: null,
    servicesUsed: 0,
    servicesLimit: PLAN_LIMITS.free,
    canCreateService: true,
    isFreePlan: true,
    isStarterPlan: false,
    isEssentialPlan: false,
    isProPlan: false,
    usagePercentage: 0,
    isNearLimit: false,
    canInviteMembers: false,
    canHaveEmployees: false,
    canAccessFinance: false,
    canAccessCatalog: false,
    canAccessAgenda: false,
    hasWhatsAppFull: false,
    hasRecurrence: false,
    hasDigitalSignature: false,
    hasAdvancedFinance: false,
    hasPermissions: false,
    hasTeamManagement: false,
    hasTimeClock: false,
    hasClientPortal: false,
    maxUsers: 1,
    maxWhatsAppChannels: 0,
    isTrial: false,
    trialEndsAt: null,
    trialDaysLeft: 0,
    isTrialExpired: false,
    isCancelledAtPeriodEnd: false,
    daysUntilExpiration: 0,
    subscriptionStatus: "inactive",
    hasActiveStripeSubscription: false,
    isPastDue: false,
    isPastDueGraceExpired: false,
    pastDueDaysLeft: 7,
    welcomeShown: true,
  };
}
