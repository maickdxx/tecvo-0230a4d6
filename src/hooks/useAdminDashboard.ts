import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "./useSuperAdmin";
import { PLAN_CONFIG } from "@/lib/planConfig";
import type { PlanSlug } from "@/lib/planConfig";

function getPlanPrice(slug: string): number {
  if (slug in PLAN_CONFIG) {
    return PLAN_CONFIG[slug as Exclude<PlanSlug, "free">].pricePerMonth;
  }
  return 0;
}

function getPlanName(slug: string): string {
  if (slug in PLAN_CONFIG) {
    return PLAN_CONFIG[slug as Exclude<PlanSlug, "free">].name;
  }
  return slug || "Free";
}

export interface AdminAlert {
  id: string;
  type: "danger" | "warning" | "info";
  title: string;
  description: string;
  action?: { label: string; tab: string };
  count?: number;
}

export interface OrgRanking {
  id: string;
  name: string;
  plan: string;
  planName: string;
  pricePerMonth: number;
  servicesThisMonth: number;
  totalServices: number;
  daysOverdue: number;
  engagementLevel?: string;
  engagementScore?: number;
  lastAccess?: string | null;
  usersCount: number;
  cancelAtPeriodEnd: boolean;
}

export interface AdminDashboardData {
  alerts: AdminAlert[];
  rankings: {
    topByRevenue: OrgRanking[];
    topByUsage: OrgRanking[];
    churnRisk: OrgRanking[];
    lowEngagement: OrgRanking[];
  };
  disconnectedChannels: {
    orgName: string;
    instanceName: string;
    phoneNumber: string | null;
  }[];
}

export function useAdminDashboard() {
  const { isSuperAdmin } = useSuperAdmin();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard-strategic"],
    queryFn: async (): Promise<AdminDashboardData> => {
      const now = new Date();
      const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      // Fetch all data in parallel
      const [
        orgsResult,
        usageResult,
        channelsResult,
        profilesResult,
        aiCreditsResult,
      ] = await Promise.all([
        supabase.from("organizations").select("id, name, plan, plan_expires_at, cancel_at_period_end, trial_ends_at, stripe_subscription_id, created_at"),
        supabase.from("organization_usage").select("organization_id, services_created, month_year"),
        supabase.from("whatsapp_channels").select("id, instance_name, name, is_connected, phone_number, organization_id"),
        supabase.from("profiles").select("organization_id, last_access"),
        supabase.from("ai_credits").select("organization_id, balance"),
      ]);

      const orgs = orgsResult.data || [];
      const usageData = usageResult.data || [];
      const channels = channelsResult.data || [];
      const profiles = profilesResult.data || [];
      const aiCredits = aiCreditsResult.data || [];

      // Build org enrichment maps
      const usageByOrg = new Map<string, number>();
      const totalServicesByOrg = new Map<string, number>();
      usageData.forEach(u => {
        if (u.month_year === currentMonthYear) {
          usageByOrg.set(u.organization_id, (usageByOrg.get(u.organization_id) || 0) + (u.services_created || 0));
        }
        totalServicesByOrg.set(u.organization_id, (totalServicesByOrg.get(u.organization_id) || 0) + (u.services_created || 0));
      });

      const usersByOrg = new Map<string, number>();
      const lastAccessByOrg = new Map<string, string | null>();
      profiles.forEach(p => {
        usersByOrg.set(p.organization_id, (usersByOrg.get(p.organization_id) || 0) + 1);
        const current = lastAccessByOrg.get(p.organization_id);
        if (p.last_access && (!current || p.last_access > current)) {
          lastAccessByOrg.set(p.organization_id, p.last_access);
        }
      });

      const aiBalanceByOrg = new Map<string, number>();
      aiCredits.forEach(c => aiBalanceByOrg.set(c.organization_id, c.balance));

      // Build rankings
      const orgRankings: OrgRanking[] = orgs.map(org => {
        const price = getPlanPrice(org.plan || "");
        const daysOverdue = org.plan_expires_at && new Date(org.plan_expires_at) < now
          ? Math.floor((now.getTime() - new Date(org.plan_expires_at).getTime()) / 86400000)
          : 0;

        return {
          id: org.id,
          name: org.name,
          plan: org.plan || "free",
          planName: getPlanName(org.plan || ""),
          pricePerMonth: price,
          servicesThisMonth: usageByOrg.get(org.id) || 0,
          totalServices: totalServicesByOrg.get(org.id) || 0,
          daysOverdue,
          lastAccess: lastAccessByOrg.get(org.id) || null,
          usersCount: usersByOrg.get(org.id) || 0,
          cancelAtPeriodEnd: org.cancel_at_period_end,
        };
      });

      // Top by revenue (paid plans)
      const topByRevenue = [...orgRankings]
        .filter(o => o.pricePerMonth > 0 && o.daysOverdue === 0)
        .sort((a, b) => b.pricePerMonth - a.pricePerMonth || b.servicesThisMonth - a.servicesThisMonth)
        .slice(0, 10);

      // Top by usage
      const topByUsage = [...orgRankings]
        .filter(o => o.servicesThisMonth > 0)
        .sort((a, b) => b.servicesThisMonth - a.servicesThisMonth)
        .slice(0, 10);

      // Churn risk: cancelling, overdue, or no access in 14+ days
      const churnRisk = [...orgRankings]
        .filter(o => {
          if (o.cancelAtPeriodEnd) return true;
          if (o.daysOverdue > 0 && o.pricePerMonth > 0) return true;
          if (o.lastAccess) {
            const daysSince = Math.floor((now.getTime() - new Date(o.lastAccess).getTime()) / 86400000);
            return daysSince >= 14 && o.plan !== "free";
          }
          return false;
        })
        .sort((a, b) => b.daysOverdue - a.daysOverdue)
        .slice(0, 10);

      // Low engagement: have paid plan but zero usage this month
      const lowEngagement = [...orgRankings]
        .filter(o => o.pricePerMonth > 0 && o.servicesThisMonth === 0 && o.daysOverdue === 0)
        .sort((a, b) => {
          const daysA = a.lastAccess ? Math.floor((now.getTime() - new Date(a.lastAccess).getTime()) / 86400000) : 999;
          const daysB = b.lastAccess ? Math.floor((now.getTime() - new Date(b.lastAccess).getTime()) / 86400000) : 999;
          return daysB - daysA;
        })
        .slice(0, 10);

      // Disconnected channels
      const disconnectedChannels = channels
        .filter(c => !c.is_connected)
        .map(c => {
          const org = orgs.find(o => o.id === c.organization_id);
          return {
            orgName: org?.name || "Desconhecida",
            instanceName: c.instance_name || c.name,
            phoneNumber: c.phone_number,
          };
        });

      // Build alerts
      const alerts: AdminAlert[] = [];

      const overdueOrgs = orgRankings.filter(o => o.daysOverdue > 0 && o.pricePerMonth > 0);
      if (overdueOrgs.length > 0) {
        const totalLost = overdueOrgs.reduce((s, o) => s + o.pricePerMonth, 0);
        alerts.push({
          id: "overdue",
          type: "danger",
          title: `${overdueOrgs.length} empresa${overdueOrgs.length > 1 ? "s" : ""} inadimplente${overdueOrgs.length > 1 ? "s" : ""}`,
          description: `Receita em risco: R$ ${totalLost.toFixed(0)}/mês`,
          action: { label: "Ver financeiro", tab: "financial" },
          count: overdueOrgs.length,
        });
      }

      if (disconnectedChannels.length > 0) {
        alerts.push({
          id: "whatsapp-disconnected",
          type: "warning",
          title: `${disconnectedChannels.length} canal${disconnectedChannels.length > 1 ? "is" : ""} WhatsApp desconectado${disconnectedChannels.length > 1 ? "s" : ""}`,
          description: disconnectedChannels.slice(0, 3).map(c => c.orgName).join(", ") + (disconnectedChannels.length > 3 ? ` e mais ${disconnectedChannels.length - 3}` : ""),
          action: { label: "Ver WhatsApp", tab: "whatsapp" },
          count: disconnectedChannels.length,
        });
      }

      const cancellingOrgs = orgRankings.filter(o => o.cancelAtPeriodEnd);
      if (cancellingOrgs.length > 0) {
        alerts.push({
          id: "cancelling",
          type: "warning",
          title: `${cancellingOrgs.length} empresa${cancellingOrgs.length > 1 ? "s" : ""} com cancelamento pendente`,
          description: cancellingOrgs.slice(0, 3).map(c => c.name).join(", "),
          action: { label: "Ver empresas", tab: "organizations" },
          count: cancellingOrgs.length,
        });
      }

      const lowBalanceOrgs = aiCredits.filter(c => c.balance <= 5);
      if (lowBalanceOrgs.length > 0) {
        alerts.push({
          id: "ai-low-credits",
          type: "info",
          title: `${lowBalanceOrgs.length} empresa${lowBalanceOrgs.length > 1 ? "s" : ""} com créditos IA baixos`,
          description: "Saldo ≤ 5 créditos",
          action: { label: "Ver créditos IA", tab: "ai-credits" },
          count: lowBalanceOrgs.length,
        });
      }

      if (lowEngagement.length >= 3) {
        alerts.push({
          id: "low-engagement",
          type: "info",
          title: `${lowEngagement.length} assinante${lowEngagement.length > 1 ? "s" : ""} sem uso este mês`,
          description: "Empresas pagantes sem nenhuma OS criada no mês atual",
          action: { label: "Ver detalhes", tab: "users" },
          count: lowEngagement.length,
        });
      }

      return {
        alerts,
        rankings: { topByRevenue, topByUsage, churnRisk, lowEngagement },
        disconnectedChannels,
      };
    },
    enabled: isSuperAdmin,
    refetchInterval: 60000,
  });

  return {
    data: data || { alerts: [], rankings: { topByRevenue: [], topByUsage: [], churnRisk: [], lowEngagement: [] }, disconnectedChannels: [] },
    isLoading,
  };
}
