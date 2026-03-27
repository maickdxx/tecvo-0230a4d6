import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useAdminAnalytics() {
  const fetchDailyMetrics = async () => {
    const { data, error } = await supabase
      .from("view_analytics_daily_metrics")
      .select("*")
      .order("day", { ascending: true });
    
    if (error) throw error;
    return data;
  };

  const fetchTrafficSources = async () => {
    const { data, error } = await supabase
      .from("view_analytics_traffic_sources")
      .select("*")
      .order("session_count", { ascending: false });
    
    if (error) throw error;
    return data;
  };

  const fetchPageViews = async () => {
    const { data, error } = await supabase
      .from("view_analytics_pages")
      .select("*")
      .order("total_views", { ascending: false })
      .limit(10);
    
    if (error) throw error;
    return data;
  };

  const fetchFunnel = async () => {
    const { data, error } = await supabase
      .from("view_analytics_funnel_advanced")
      .select("*")
      .single();
    
    if (error) throw error;
    return data;
  };

  const fetchUserScores = async () => {
    const { data, error } = await supabase
      .from("view_analytics_user_scores")
      .select("*")
      .order("total_events_30d", { ascending: false });
    
    if (error) throw error;
    return data;
  };

  const fetchActivationMetrics = async () => {
    const { data, error } = await supabase
      .from("view_analytics_activation_metrics")
      .select("*")
      .single();
    
    if (error) throw error;
    return data;
  };

  const fetchRetentionCohorts = async () => {
    const { data, error } = await supabase
      .from("view_analytics_retention_cohorts")
      .select("*")
      .order("cohort_month", { ascending: true })
      .order("month_number", { ascending: true });
    
    if (error) throw error;
    return data;
  };

  const fetchMarketingFunnel = async () => {
    const { data, error } = await supabase
      .from("view_analytics_marketing_funnel")
      .select("*")
      .single();
    
    if (error) throw error;
    return data;
  };

  const fetchLeadDropoffs = async () => {
    const { data, error } = await supabase
      .from("view_analytics_lead_dropoffs")
      .select("*")
      .limit(10);
    
    if (error) throw error;
    return data;
  };

  const fetchCTAPerformance = async () => {
    const { data, error } = await supabase
      .from("view_analytics_cta_performance")
      .select("*");
    
    if (error) throw error;
    return data;
  };

  const fetchLeadPaths = async () => {
    const { data, error } = await supabase
      .from("view_analytics_lead_paths")
      .select("*")
      .limit(20);
    
    if (error) throw error;
    return data;
  };

  const fetchABTestResults = async () => {
    const { data, error } = await supabase
      .from("view_analytics_ab_test_results")
      .select("*")
      .order("test_name", { ascending: true });
    
    if (error) throw error;
    return data;
  };

  const fetchAlerts = async () => {
    const { data, error } = await supabase
      .from("analytics_alerts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    
    if (error) throw error;
    return data;
  };

  const fetchHypotheses = async () => {
    const { data, error } = await supabase
      .from("ab_test_hypotheses")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    return data;
  };

  const fetchWinningPatterns = async () => {
    const { data, error } = await supabase
      .from("ab_test_winning_patterns")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    return data;
  };

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from("ab_test_templates")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    return data;
  };

  const fetchCampaignComparison = async () => {
    const { data, error } = await supabase
      .from("view_campaign_comparison")
      .select("*")
      .order("conversion_rate", { ascending: false });
    
    if (error) throw error;
    return data;
  };

  const fetchPatternApplications = async () => {
    const { data, error } = await supabase
      .from("ab_test_pattern_applications")
      .select(`
        *,
        ab_test_winning_patterns (
          name,
          pattern_type,
          category
        )
      `)
      .order("applied_at", { ascending: false });
    
    if (error) throw error;
    return data;
  };

  const dailyMetrics = useQuery({
    queryKey: ["admin-analytics-daily"],
    queryFn: fetchDailyMetrics,
  });

  const trafficSources = useQuery({
    queryKey: ["admin-analytics-traffic"],
    queryFn: fetchTrafficSources,
  });

  const pageViews = useQuery({
    queryKey: ["admin-analytics-pages"],
    queryFn: fetchPageViews,
  });

  const funnel = useQuery({
    queryKey: ["admin-analytics-funnel"],
    queryFn: fetchFunnel,
  });

  const userScores = useQuery({
    queryKey: ["admin-analytics-user-scores"],
    queryFn: fetchUserScores,
  });

  const activationMetrics = useQuery({
    queryKey: ["admin-analytics-activation"],
    queryFn: fetchActivationMetrics,
  });

  const retentionCohorts = useQuery({
    queryKey: ["admin-analytics-retention"],
    queryFn: fetchRetentionCohorts,
  });

  const alerts = useQuery({
    queryKey: ["admin-analytics-alerts"],
    queryFn: fetchAlerts,
  });

  const winningPatterns = useQuery({
    queryKey: ["admin-analytics-winning-patterns"],
    queryFn: fetchWinningPatterns,
  });

  const templates = useQuery({
    queryKey: ["admin-analytics-templates"],
    queryFn: fetchTemplates,
  });

  const campaignComparison = useQuery({
    queryKey: ["admin-analytics-campaign-comparison"],
    queryFn: fetchCampaignComparison,
  });

  const patternApplications = useQuery({
    queryKey: ["admin-analytics-pattern-applications"],
    queryFn: fetchPatternApplications,
  });

  const marketingFunnel = useQuery({
    queryKey: ["admin-analytics-marketing-funnel"],
    queryFn: fetchMarketingFunnel,
  });

  const leadDropoffs = useQuery({
    queryKey: ["admin-analytics-lead-dropoffs"],
    queryFn: fetchLeadDropoffs,
  });

  const ctaPerformance = useQuery({
    queryKey: ["admin-analytics-cta-performance"],
    queryFn: fetchCTAPerformance,
  });

  const leadPaths = useQuery({
    queryKey: ["admin-analytics-lead-paths"],
    queryFn: fetchLeadPaths,
  });

  const abTestResults = useQuery({
    queryKey: ["admin-analytics-ab-tests"],
    queryFn: fetchABTestResults,
  });

  const hypotheses = useQuery({
    queryKey: ["admin-analytics-hypotheses"],
    queryFn: fetchHypotheses,
  });

  const isLoading = 
    dailyMetrics.isLoading || 
    trafficSources.isLoading || 
    pageViews.isLoading || 
    funnel.isLoading ||
    userScores.isLoading ||
    activationMetrics.isLoading ||
    retentionCohorts.isLoading ||
    alerts.isLoading ||
    hypotheses.isLoading ||
    winningPatterns.isLoading ||
    templates.isLoading ||
    patternApplications.isLoading ||
    campaignComparison.isLoading;

  // Calculate overall KPIs
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
    abTestResults,
    hypotheses,
    winningPatterns,
    templates,
    campaignComparison,
    patternApplications,
    kpis,
    isLoading: isLoading || 
               marketingFunnel.isLoading || 
               leadDropoffs.isLoading || 
               ctaPerformance.isLoading || 
               leadPaths.isLoading || 
               abTestResults.isLoading || 
               hypotheses.isLoading ||
               patternApplications.isLoading
  };
}
