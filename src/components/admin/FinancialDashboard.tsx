import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, Users, TriangleAlert as AlertTriangle, Calendar, CreditCard, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { PLAN_CONFIG } from "@/lib/planConfig";
import type { PlanSlug } from "@/lib/planConfig";
import { format, differenceInDays } from "date-fns";

interface OverdueOrg {
  id: string;
  name: string;
  plan: string;
  planDisplayName: string;
  pricePerMonth: number;
  daysOverdue: number;
  planExpiresAt: string;
}

export function FinancialDashboard() {
  const { isSuperAdmin } = useSuperAdmin();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-financial-dashboard"],
    queryFn: async () => {
      const { data: orgs, error } = await supabase
        .from("organizations")
        .select("id, name, plan, plan_expires_at, cancel_at_period_end, trial_ends_at, stripe_subscription_id")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const now = new Date();

      const getPlanPrice = (slug: string): number => {
        if (slug in PLAN_CONFIG) {
          return PLAN_CONFIG[slug as Exclude<PlanSlug, "free">].pricePerMonth;
        }
        return 0;
      };

      const getPlanDisplayName = (slug: string) => {
        if (slug in PLAN_CONFIG) {
          return PLAN_CONFIG[slug as Exclude<PlanSlug, "free">].name;
        }
        return slug;
      };

      // Active paying subscribers (not trial, not expired, not cancelled)
      const activePayingOrgs = (orgs || []).filter(org => {
        const hasPaidPlan = org.plan && org.plan !== "free";
        if (!hasPaidPlan) return false;
        if (org.cancel_at_period_end) return false;
        
        // Check if in trial
        if (org.trial_ends_at && new Date(org.trial_ends_at) > now && !org.stripe_subscription_id) return false;
        
        // Must have valid expiry or be lifetime
        const hasValidExpiry = org.plan_expires_at && new Date(org.plan_expires_at) > now;
        return hasValidExpiry || (!org.plan_expires_at && !org.trial_ends_at);
      });

      const mrr = activePayingOrgs.reduce((sum, org) => {
        return sum + (planPrices[org.plan || ""] || 0);
      }, 0);

      const arr = mrr * 12;
      const averageTicket = activePayingOrgs.length > 0 ? mrr / activePayingOrgs.length : 0;

      // Overdue accounts: plan expired but was paid
      const overdueOrgs: OverdueOrg[] = (orgs || [])
        .filter(org => {
          const hasPaidPlan = org.plan && org.plan !== "free";
          if (!hasPaidPlan) return false;
          if (!org.plan_expires_at) return false;
          // Expired
          return new Date(org.plan_expires_at) < now;
        })
        .map(org => ({
          id: org.id,
          name: org.name,
          plan: org.plan || "",
          planDisplayName: getPlanDisplayName(org.plan || ""),
          pricePerMonth: planPrices[org.plan || ""] || 0,
          daysOverdue: differenceInDays(now, new Date(org.plan_expires_at!)),
          planExpiresAt: org.plan_expires_at!,
        }))
        .sort((a, b) => b.daysOverdue - a.daysOverdue);

      const totalOverdue = overdueOrgs.reduce((sum, o) => sum + o.pricePerMonth, 0);

      // Recent billing events
      const { data: recentEvents } = await supabase
        .from("billing_events")
        .select("id, event_type, plan, amount_cents, created_at, organization_id")
        .in("event_type", ["payment_succeeded", "subscription_created", "subscription_updated"])
        .order("created_at", { ascending: false })
        .limit(10);

      // Get org names for events
      const eventOrgIds = [...new Set((recentEvents || []).map(e => e.organization_id))];
      const { data: eventOrgs } = await supabase
        .from("organizations")
        .select("id, name")
        .in("id", eventOrgIds.length > 0 ? eventOrgIds : ["00000000-0000-0000-0000-000000000000"]);

      const orgNameMap = new Map((eventOrgs || []).map(o => [o.id, o.name]));

      const recentPayments = (recentEvents || []).map(e => ({
        id: e.id,
        orgName: orgNameMap.get(e.organization_id) || "Desconhecido",
        plan: getPlanDisplayName(e.plan || ""),
        amount: (e.amount_cents || 0) / 100,
        date: e.created_at,
        eventType: e.event_type,
      }));

      // Revenue by plan
      const revenueByPlan = Object.entries(planPrices).map(([slug, price]) => {
        const count = activePayingOrgs.filter(o => o.plan === slug).length;
        return {
          slug,
          name: getPlanDisplayName(slug),
          count,
          total: count * price,
        };
      }).filter(p => p.count > 0);

      const totalRevenue = revenueByPlan.reduce((s, p) => s + p.total, 0);

      return {
        mrr,
        arr,
        averageTicket,
        totalOverdue,
        overdueOrgs,
        activeCount: activePayingOrgs.length,
        recentPayments,
        revenueByPlan,
        totalRevenue,
      };
    },
    enabled: isSuperAdmin,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { mrr = 0, arr = 0, averageTicket = 0, totalOverdue = 0, overdueOrgs = [], recentPayments = [], revenueByPlan = [], totalRevenue = 0, activeCount = 0 } = data || {};

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-primary bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(mrr)}</div>
            <p className="text-xs text-muted-foreground">
              Receita mensal recorrente ({activeCount} assinantes)
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ARR</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(arr)}</div>
            <p className="text-xs text-muted-foreground">
              Receita anual recorrente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(averageTicket)}</div>
            <p className="text-xs text-muted-foreground">
              Por assinante
            </p>
          </CardContent>
        </Card>

        <Card className={overdueOrgs.length > 0 ? "border-destructive bg-destructive/5" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inadimplentes</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalOverdue)}</div>
            <p className="text-xs text-muted-foreground">
              {overdueOrgs.length} conta{overdueOrgs.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Contas Inadimplentes</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Empresas com plano expirado
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {overdueOrgs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma conta inadimplente 🎉
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Dias Expirado</TableHead>
                  <TableHead>Data Expiração</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overdueOrgs.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>
                      <div className="font-medium">{account.name}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{account.planDisplayName}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(account.pricePerMonth)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="destructive"
                        className={account.daysOverdue > 10 ? "" : "bg-yellow-600"}
                      >
                        {account.daysOverdue} dias
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {new Date(account.planExpiresAt).toLocaleDateString("pt-BR")}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Eventos de Billing Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {recentPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum evento de billing registrado
              </p>
            ) : (
              <div className="space-y-3">
                {recentPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <CreditCard className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">{payment.orgName}</div>
                        <div className="text-sm text-muted-foreground">
                          {payment.plan} — {payment.eventType.replace(/_/g, " ")}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {payment.amount > 0 && (
                        <div className="font-medium text-green-600">
                          {formatCurrency(payment.amount)}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {new Date(payment.date).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Receita por Plano</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueByPlan.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum assinante ativo
              </p>
            ) : (
              <div className="space-y-4">
                {revenueByPlan.map((plan, idx) => (
                  <div key={plan.slug}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">
                        {plan.name} ({plan.count} assinante{plan.count !== 1 ? "s" : ""})
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {formatCurrency(plan.total)}
                      </span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          idx === 0 ? "bg-primary" : idx === 1 ? "bg-chart-2" : "bg-chart-3"
                        }`}
                        style={{ width: `${totalRevenue > 0 ? (plan.total / totalRevenue) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
