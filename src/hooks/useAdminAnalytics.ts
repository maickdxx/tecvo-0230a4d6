import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Admin Analytics hook — now accepts an `activeTab` parameter so that
 * only the queries relevant to the currently visible tab are enabled.
 * This eliminates the 19+ simultaneous queries on mount.
 */

type AnalyticsTab = "overview" | "engagement" | "marketing" | "leads" | "ab_tests" | "automations" | "patterns" | string;

export function useAdminAnalytics(activeTab: AnalyticsTab = "overview") {
  // ── Helper: is a given tab active? ──
  const isTab = (tabs: AnalyticsTab[]) => tabs.includes(activeTab);

  // ═══════════════ QUERIES ═══════════════

  const dailyMetrics = useQuery({
    queryKey: ["admin-analytics-daily"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("view_analytics_daily_metrics")
        .select("*")
        .order("day", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: isTab(["overview"]),
  });

  const trafficSources = useQuery({
    queryKey: ["admin-analytics-traffic"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("view_analytics_traffic_sources")
        .select("*")
        .order("session_count", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isTab(["overview"]),
  });

  const pageViews = useQuery({
    queryKey: ["admin-analytics-pages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("view_analytics_pages")
        .select("*")
        .order("total_views", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: isTab(["overview"]),
  });

  const funnel = useQuery({
    queryKey: ["admin-analytics-funnel"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("view_analytics_funnel_advanced")
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    enabled: isTab(["overview"]),
  });

  const userScores = useQuery({
    queryKey: ["admin-analytics-user-scores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("view_analytics_user_scores")
        .select("*")
        .order("total_events_30d", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isTab(["engagement"]),
  });

  const activationMetrics = useQuery({
    queryKey: ["admin-analytics-activation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("view_analytics_activation_metrics")
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    enabled: isTab(["overview", "engagement"]),
  });

  const retentionCohorts = useQuery({
    queryKey: ["admin-analytics-retention"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("view_analytics_retention_cohorts")
        .select("*")
        .order("cohort_month", { ascending: true })
        .order("month_number", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: isTab(["engagement"]),
  });

  const alerts = useQuery({
    queryKey: ["admin-analytics-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analytics_alerts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: isTab(["overview"]),
  });

  const marketingFunnel = useQuery({
    queryKey: ["admin-analytics-marketing-funnel"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("view_analytics_marketing_funnel")
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    enabled: isTab(["marketing", "ab_tests"]),
  });

  const leadDropoffs = useQuery({
    queryKey: ["admin-analytics-lead-dropoffs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("view_analytics_lead_dropoffs")
        .select("*")
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: isTab(["marketing", "ab_tests"]),
  });

  const ctaPerformance = useQuery({
    queryKey: ["admin-analytics-cta-performance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("view_analytics_cta_performance")
        .select("*");
      if (error) throw error;
      return data;
    },
    enabled: isTab(["marketing"]),
  });

  const leadPaths = useQuery({
    queryKey: ["admin-analytics-lead-paths"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("view_analytics_lead_paths")
        .select("*")
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: isTab(["marketing"]),
  });

  const leadJourneys = useQuery({
    queryKey: ["admin-analytics-lead-journeys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("view_lead_journeys_summary")
        .select("*")
        .order("last_seen", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isTab(["leads"]),
  });

  const fetchLeadJourneyDetail = async (visitorId: string) => {
    const { data, error } = await supabase
      .rpc("get_lead_journey_timeline", { p_visitor_id: visitorId });
    if (error) throw error;
    return data;
  };

  const abTestResults = useQuery({
    queryKey: ["admin-analytics-ab-tests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("view_analytics_ab_test_results")
        .select("*")
        .order("test_name", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: isTab(["ab_tests"]),
  });

  const hypotheses = useQuery({
    queryKey: ["admin-analytics-hypotheses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ab_test_hypotheses")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isTab(["ab_tests"]),
  });

  const winningPatterns = useQuery({
    queryKey: ["admin-analytics-winning-patterns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ab_test_winning_patterns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isTab(["patterns"]),
  });

  const templates = useQuery({
    queryKey: ["admin-analytics-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ab_test_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isTab(["patterns"]),
  });

  const campaignComparison = useQuery({
    queryKey: ["admin-analytics-campaign-comparison"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("view_campaign_comparison")
        .select("*")
        .order("conversion_rate", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isTab(["marketing"]),
  });

  const patternApplications = useQuery({
    queryKey: ["admin-analytics-pattern-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ab_test_pattern_applications")
        .select(`*, ab_test_winning_patterns (name, pattern_type, category)`)
        .order("applied_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isTab(["patterns"]),
  });

  // ═══════════════ LOADING STATE ═══════════════
  // Only consider queries that are actually enabled for this tab
  const isLoading = (() => {
    switch (activeTab) {
      case "overview":
        return dailyMetrics.isLoading || trafficSources.isLoading || pageViews.isLoading || funnel.isLoading || activationMetrics.isLoading || alerts.isLoading;
      case "engagement":
        return userScores.isLoading || activationMetrics.isLoading || retentionCohorts.isLoading;
      case "marketing":
        return marketingFunnel.isLoading || leadDropoffs.isLoading || ctaPerformance.isLoading || leadPaths.isLoading || campaignComparison.isLoading;
      case "leads":
        return leadJourneys.isLoading;
      case "ab_tests":
        return abTestResults.isLoading || hypotheses.isLoading || marketingFunnel.isLoading || leadDropoffs.isLoading;
      case "patterns":
        return winningPatterns.isLoading || templates.isLoading || patternApplications.isLoading;
      default:
        return false;
    }
  })();

  // KPIs (only computed when overview data is loaded)
  const kpis = dailyMetrics.data ? {
    total_sessions: dailyMetrics.data.reduce((acc, curr) => acc + (curr.total_sessions || 0), 0),
    unique_visitors: dailyMetrics.data.reduce((acc, curr) => acc + (curr.unique_visitors || 0), 0),
    signups_completed: dailyMetrics.data.reduce((acc, curr) => acc + (curr.signups_completed || 0), 0),
    avg_session_duration: dailyMetrics.data.length > 0
      ? dailyMetrics.data.reduce((acc, curr) => acc + (curr.avg_session_duration || 0), 0) / dailyMetrics.data.length
      : 0,
    conversion_rate: dailyMetrics.data.length > 0
      ? (dailyMetrics.data.reduce((acc, curr) => acc + (curr.signups_completed || 0), 0) /
         dailyMetrics.data.reduce((acc, curr) => acc + (curr.unique_visitors || 1), 0)) * 100
      : 0,
    activation_rate: activationMetrics.data
      ? (activationMetrics.data.total_activated / (activationMetrics.data.total_users || 1)) * 100
      : 0
  } : null;

  return {
    dailyMetrics,
    trafficSources,
    pageViews,
    funnel,
    userScores,
    activationMetrics,
    retentionCohorts,
    alerts,
    marketingFunnel,
    leadDropoffs,
    ctaPerformance,
    leadPaths,
    leadJourneys,
    fetchLeadJourneyDetail,
    abTestResults,
    hypotheses,
    winningPatterns,
    templates,
    campaignComparison,
    patternApplications,
    kpis,
    isLoading,
  };
}
