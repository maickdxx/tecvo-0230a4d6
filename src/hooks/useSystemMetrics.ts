import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "./useSuperAdmin";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";

export interface SystemMetrics {
  totalOrganizations: number;
  totalUsers: number;
  totalTechnicians: number;
  totalServices: number;
  totalWhatsAppMessages: number;
  monthlyRevenue: number;
  annualRevenue: number;
  averageTicket: number;
  churnRate: number;
  growthRate: number;
  activeSubscriptions: number;
  trialAccounts: number;
  overdueAccounts: number;
  newSignupsToday: number;
  newSignupsMonth: number;
  servicesThisMonth: number;
  servicesLastMonth: number;
  messagesThisMonth: number;
  messagesLastMonth: number;
}

export interface MonthlyGrowth {
  month: string;
  organizations: number;
  users: number;
  revenue: number;
  services: number;
}

export function useSystemMetrics() {
  const { isSuperAdmin } = useSuperAdmin();

  const { data: metrics, isLoading } = useQuery({
    queryKey: ["system-metrics"],
    queryFn: async (): Promise<SystemMetrics> => {
      const now = new Date();
      const startOfThisMonth = startOfMonth(now);
      const endOfThisMonth = endOfMonth(now);
      const startOfLastMonth = startOfMonth(subMonths(now, 1));
      const endOfLastMonth = endOfMonth(subMonths(now, 1));
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const [
        orgsResult,
        usersResult,
        techsResult,
        servicesResult,
        messagesResult,
        servicesThisMonthResult,
        servicesLastMonthResult,
        messagesThisMonthResult,
        messagesLastMonthResult,
        newSignupsTodayResult,
        newSignupsMonthResult,
      ] = await Promise.all([
        supabase.from("organizations").select("id, plan, plan_expires_at, cancel_at_period_end, trial_ends_at, created_at", { count: "exact" }),
        supabase.from("profiles").select("id", { count: "exact" }),
        supabase.from("profiles").select("id", { count: "exact" }).eq("field_worker", true),
        supabase.from("services").select("id", { count: "exact" }),
        supabase.from("whatsapp_messages").select("id", { count: "exact" }),
        supabase.from("services").select("id", { count: "exact" }).gte("created_at", startOfThisMonth.toISOString()).lte("created_at", endOfThisMonth.toISOString()),
        supabase.from("services").select("id", { count: "exact" }).gte("created_at", startOfLastMonth.toISOString()).lte("created_at", endOfLastMonth.toISOString()),
        supabase.from("whatsapp_messages").select("id", { count: "exact" }).gte("created_at", startOfThisMonth.toISOString()).lte("created_at", endOfThisMonth.toISOString()),
        supabase.from("whatsapp_messages").select("id", { count: "exact" }).gte("created_at", startOfLastMonth.toISOString()).lte("created_at", endOfLastMonth.toISOString()),
        supabase.from("organizations").select("id", { count: "exact" }).gte("created_at", startOfToday.toISOString()),
        supabase.from("organizations").select("id", { count: "exact" }).gte("created_at", startOfThisMonth.toISOString()),
      ]);

      const organizations = orgsResult.data || [];
      const totalOrgs = orgsResult.count || 0;
      const totalUsers = usersResult.count || 0;
      const totalTechnicians = (techsResult.data as number) || 0;
      const totalServices = servicesResult.count || 0;
      const totalMessages = messagesResult.count || 0;

      const activeSubscriptions = organizations.filter(org => {
        const hasPaidPlan = org.plan && org.plan !== "free";
        if (!hasPaidPlan) return false;
        const hasValidExpiry = org.plan_expires_at && new Date(org.plan_expires_at) > now;
        return hasValidExpiry || (!org.plan_expires_at && !org.trial_ends_at);
      }).length;

      const trialAccounts = organizations.filter(org => {
        if (!org.trial_ends_at) return false;
        return new Date(org.trial_ends_at) > now;
      }).length;

      const overdueAccounts = organizations.filter(org => {
        const hasPaidPlan = org.plan && org.plan !== "free";
        if (!hasPaidPlan) return false;
        if (!org.plan_expires_at) return false;
        return new Date(org.plan_expires_at) < now;
      }).length;

      const planPrices: Record<string, number> = {
        starter: 97,
        essential: 197,
        pro: 397,
      };

      const monthlyRevenue = organizations.reduce((sum, org) => {
        const price = planPrices[org.plan || ""] || 0;
        if (org.plan && org.plan !== "free" && !org.cancel_at_period_end) {
          if (org.plan_expires_at && new Date(org.plan_expires_at) > now) {
            return sum + price;
          }
          if (!org.plan_expires_at && !org.trial_ends_at) {
            return sum + price;
          }
        }
        return sum;
      }, 0);

      const annualRevenue = monthlyRevenue * 12;
      const averageTicket = activeSubscriptions > 0 ? monthlyRevenue / activeSubscriptions : 0;

      const orgsLastMonth = organizations.filter(org =>
        new Date(org.created_at) >= startOfLastMonth &&
        new Date(org.created_at) <= endOfLastMonth
      ).length;

      const orgsThisMonth = organizations.filter(org =>
        new Date(org.created_at) >= startOfThisMonth
      ).length;

      const cancelledThisMonth = organizations.filter(org =>
        org.cancel_at_period_end && org.plan_expires_at &&
        new Date(org.plan_expires_at) >= startOfThisMonth &&
        new Date(org.plan_expires_at) <= endOfThisMonth
      ).length;

      const churnRate = activeSubscriptions > 0 ? (cancelledThisMonth / activeSubscriptions) * 100 : 0;
      const growthRate = orgsLastMonth > 0 ? ((orgsThisMonth - orgsLastMonth) / orgsLastMonth) * 100 : 0;

      return {
        totalOrganizations: totalOrgs,
        totalUsers,
        totalTechnicians,
        totalServices,
        totalWhatsAppMessages: totalMessages,
        monthlyRevenue,
        annualRevenue,
        averageTicket,
        churnRate,
        growthRate,
        activeSubscriptions,
        trialAccounts,
        overdueAccounts,
        newSignupsToday: newSignupsTodayResult.count || 0,
        newSignupsMonth: newSignupsMonthResult.count || 0,
        servicesThisMonth: servicesThisMonthResult.count || 0,
        servicesLastMonth: servicesLastMonthResult.count || 0,
        messagesThisMonth: messagesThisMonthResult.count || 0,
        messagesLastMonth: messagesLastMonthResult.count || 0,
      };
    },
    enabled: isSuperAdmin,
    refetchInterval: 60000,
  });

  const { data: monthlyGrowth } = useQuery({
    queryKey: ["monthly-growth"],
    queryFn: async (): Promise<MonthlyGrowth[]> => {
      const months: MonthlyGrowth[] = [];
      const now = new Date();

      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(now, i);
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);
        const monthLabel = format(monthDate, "MMM/yy");

        const [orgsResult, usersResult, servicesResult] = await Promise.all([
          supabase.from("organizations").select("id, plan, created_at", { count: "exact" })
            .lte("created_at", monthEnd.toISOString()),
          supabase.from("profiles").select("id", { count: "exact" })
            .lte("created_at", monthEnd.toISOString()),
          supabase.from("services").select("id", { count: "exact" })
            .gte("created_at", monthStart.toISOString())
            .lte("created_at", monthEnd.toISOString()),
        ]);

        const planPrices: Record<string, number> = {
          starter: 97,
          essential: 197,
          pro: 397,
        };

        const revenue = (orgsResult.data || []).reduce((sum, org) => {
          const price = planPrices[org.plan || ""] || 0;
          if (org.plan && org.plan !== "free") {
            return sum + price;
          }
          return sum;
        }, 0);

        months.push({
          month: monthLabel,
          organizations: orgsResult.count || 0,
          users: usersResult.count || 0,
          revenue,
          services: servicesResult.count || 0,
        });
      }

      return months;
    },
    enabled: isSuperAdmin,
  });

  return {
    metrics,
    monthlyGrowth: monthlyGrowth || [],
    isLoading,
  };
}
