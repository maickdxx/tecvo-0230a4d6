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
      .from("view_analytics_funnel")
      .select("*")
      .single();
    
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

  const isLoading = dailyMetrics.isLoading || trafficSources.isLoading || pageViews.isLoading || funnel.isLoading;

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
      : 0
  } : null;

  return {
    dailyMetrics,
    trafficSources,
    pageViews,
    kpis,
    isLoading
  };
}