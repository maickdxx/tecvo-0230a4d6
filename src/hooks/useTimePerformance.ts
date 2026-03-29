import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDemoMode } from "@/hooks/useDemoMode";
import { parseDurationToMinutes } from "@/lib/timezone";

export interface ServiceTimeMetrics {
  serviceId: string;
  estimatedMin: number;
  actualMin: number;
  diffMin: number;
  diffPercent: number;
  /** "on_time" | "slight_delay" | "big_delay" | "faster" */
  status: "on_time" | "slight_delay" | "big_delay" | "faster";
}

export interface TechnicianPerformance {
  userId: string;
  fullName: string;
  avgEstimatedMin: number;
  avgActualMin: number;
  avgDiffMin: number;
  efficiencyPercent: number;
  serviceCount: number;
}

export interface TypePerformance {
  serviceType: string;
  avgEstimatedMin: number;
  avgActualMin: number;
  avgDiffMin: number;
  count: number;
}

export interface TimePerformanceSummary {
  avgEstimatedMin: number;
  avgActualMin: number;
  avgDiffMin: number;
  delayRate: number; // % of services with delay
  totalAnalyzed: number;
  byTechnician: TechnicianPerformance[];
  byType: TypePerformance[];
}

/** Calculate time metrics for a single completed service */
export function calcServiceTimeMetrics(
  entryDate: string,
  exitDate: string,
  estimatedDuration: string | null | undefined,
): ServiceTimeMetrics | null {
  const estimatedMin = parseDurationToMinutes(estimatedDuration);
  if (estimatedMin <= 0) return null;

  const entry = new Date(entryDate).getTime();
  const exit = new Date(exitDate).getTime();
  const actualMin = Math.round((exit - entry) / 60000);
  if (actualMin <= 0) return null;

  const diffMin = actualMin - estimatedMin;
  const diffPercent = Math.round((diffMin / estimatedMin) * 100);

  let status: ServiceTimeMetrics["status"];
  if (diffPercent <= -5) status = "faster";
  else if (diffPercent <= 10) status = "on_time";
  else if (diffPercent <= 30) status = "slight_delay";
  else status = "big_delay";

  return { serviceId: "", estimatedMin, actualMin, diffMin, diffPercent, status };
}

/** Format minutes to human-readable */
export function formatMinutes(min: number): string {
  if (min === 0) return "0min";
  const h = Math.floor(Math.abs(min) / 60);
  const m = Math.abs(min) % 60;
  const sign = min < 0 ? "-" : "";
  if (h === 0) return `${sign}${m}min`;
  if (m === 0) return `${sign}${h}h`;
  return `${sign}${h}h${m.toString().padStart(2, "0")}`;
}

/** Hook to load completed services with time data for a period */
export function useTimePerformance(startDate?: string, endDate?: string) {
  const { organizationId } = useAuth();
  const { isDemoMode } = useDemoMode();

  const { data: services, isLoading } = useQuery({
    queryKey: ["time-performance", organizationId, startDate, endDate, isDemoMode],
    queryFn: async () => {
      if (!organizationId) return [];
      let q = supabase
        .from("services")
        .select("id, entry_date, exit_date, estimated_duration, assigned_to, service_type, status")
        .eq("organization_id", organizationId)
        .eq("status", "completed")
        .not("entry_date", "is", null)
        .not("exit_date", "is", null)
        .not("estimated_duration", "is", null)
        .is("deleted_at", null);

      if (!isDemoMode) q = q.eq("is_demo_data", false);
      if (startDate) q = q.gte("completed_date", startDate);
      if (endDate) q = q.lte("completed_date", endDate);

      const { data, error } = await q.order("completed_date", { ascending: false }).limit(500);
      if (error) throw error;

      // Fetch profiles separately to avoid join issues with auth.users
      const assignedIds = [...new Set((data || []).map(s => s.assigned_to).filter(Boolean))] as string[];
      let profilesMap: Record<string, string> = {};

      if (assignedIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", assignedIds);
        if (profiles) {
          profilesMap = Object.fromEntries(profiles.map(p => [p.user_id, p.full_name || ""]));
        }
      }

      return (data || []).map(s => ({
        ...s,
        profiles: s.assigned_to && profilesMap[s.assigned_to] 
          ? { full_name: profilesMap[s.assigned_to] } 
          : null
      }));
    },
    enabled: !!organizationId,
  });

  const summary = useMemo((): TimePerformanceSummary => {
    const empty: TimePerformanceSummary = {
      avgEstimatedMin: 0, avgActualMin: 0, avgDiffMin: 0,
      delayRate: 0, totalAnalyzed: 0, byTechnician: [], byType: [],
    };
    if (!services || services.length === 0) return empty;

    const analyzed: { metrics: ServiceTimeMetrics; svc: any }[] = [];

    for (const svc of services) {
      if (!svc.entry_date || !svc.exit_date || !svc.estimated_duration) continue;
      const m = calcServiceTimeMetrics(svc.entry_date, svc.exit_date, svc.estimated_duration);
      if (m) analyzed.push({ metrics: { ...m, serviceId: svc.id }, svc });
    }

    if (analyzed.length === 0) return empty;

    const totalEst = analyzed.reduce((s, a) => s + a.metrics.estimatedMin, 0);
    const totalAct = analyzed.reduce((s, a) => s + a.metrics.actualMin, 0);
    const totalDiff = analyzed.reduce((s, a) => s + a.metrics.diffMin, 0);
    const delayed = analyzed.filter(a => a.metrics.status === "slight_delay" || a.metrics.status === "big_delay");

    // By technician
    const techMap = new Map<string, { name: string; est: number; act: number; count: number }>();
    for (const { metrics, svc } of analyzed) {
      if (!svc.assigned_to) continue;
      const profile = svc.profiles as any;
      const name = profile?.full_name || "Sem nome";
      const existing = techMap.get(svc.assigned_to) || { name, est: 0, act: 0, count: 0 };
      existing.est += metrics.estimatedMin;
      existing.act += metrics.actualMin;
      existing.count++;
      techMap.set(svc.assigned_to, existing);
    }

    const byTechnician: TechnicianPerformance[] = Array.from(techMap.entries()).map(([userId, d]) => ({
      userId,
      fullName: d.name,
      avgEstimatedMin: Math.round(d.est / d.count),
      avgActualMin: Math.round(d.act / d.count),
      avgDiffMin: Math.round((d.act - d.est) / d.count),
      efficiencyPercent: Math.round((d.est / d.act) * 100),
      serviceCount: d.count,
    })).sort((a, b) => b.efficiencyPercent - a.efficiencyPercent);

    // By type
    const typeMap = new Map<string, { est: number; act: number; count: number }>();
    for (const { metrics, svc } of analyzed) {
      const t = svc.service_type || "outros";
      const existing = typeMap.get(t) || { est: 0, act: 0, count: 0 };
      existing.est += metrics.estimatedMin;
      existing.act += metrics.actualMin;
      existing.count++;
      typeMap.set(t, existing);
    }

    const byType: TypePerformance[] = Array.from(typeMap.entries()).map(([serviceType, d]) => ({
      serviceType,
      avgEstimatedMin: Math.round(d.est / d.count),
      avgActualMin: Math.round(d.act / d.count),
      avgDiffMin: Math.round((d.act - d.est) / d.count),
      count: d.count,
    })).sort((a, b) => b.count - a.count);

    return {
      avgEstimatedMin: Math.round(totalEst / analyzed.length),
      avgActualMin: Math.round(totalAct / analyzed.length),
      avgDiffMin: Math.round(totalDiff / analyzed.length),
      delayRate: Math.round((delayed.length / analyzed.length) * 100),
      totalAnalyzed: analyzed.length,
      byTechnician,
      byType,
    };
  }, [services]);

  return { summary, isLoading };
}
