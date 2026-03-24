import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, TrendingUp, AlertTriangle, Activity, Crown, BarChart3 } from "lucide-react";
import type { OrgRanking } from "@/hooks/useAdminDashboard";

interface AdminRankingsProps {
  topByRevenue: OrgRanking[];
  topByUsage: OrgRanking[];
  churnRisk: OrgRanking[];
  lowEngagement: OrgRanking[];
}

function formatDaysAgo(lastAccess: string | null): string {
  if (!lastAccess) return "Nunca";
  const days = Math.floor((Date.now() - new Date(lastAccess).getTime()) / 86400000);
  if (days === 0) return "Hoje";
  if (days === 1) return "Ontem";
  return `${days}d atrás`;
}

function RankingRow({ org, metric, metricLabel, highlight }: {
  org: OrgRanking;
  metric: string | number;
  metricLabel: string;
  highlight?: "danger" | "warning" | "success";
}) {
  return (
    <div className="flex items-center justify-between py-2 px-1 border-b border-border/30 last:border-0">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{org.name}</p>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{org.planName}</Badge>
            <span className="text-[10px] text-muted-foreground">{org.usersCount} usuário{org.usersCount !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={`text-sm font-semibold ${
          highlight === "danger" ? "text-destructive" :
          highlight === "warning" ? "text-amber-600 dark:text-amber-400" :
          highlight === "success" ? "text-emerald-600" : ""
        }`}>
          {metric}
        </p>
        <p className="text-[10px] text-muted-foreground">{metricLabel}</p>
      </div>
    </div>
  );
}

export function AdminRankings({ topByRevenue, topByUsage, churnRisk, lowEngagement }: AdminRankingsProps) {
  const formatCurrency = (v: number) => `R$ ${v.toFixed(0)}`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Crown className="h-4 w-4 text-primary" />
          Rankings & Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="revenue" className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-4">
            <TabsTrigger value="revenue" className="gap-1 text-xs data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <DollarSign className="h-3 w-3" /> Receita
            </TabsTrigger>
            <TabsTrigger value="usage" className="gap-1 text-xs data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <BarChart3 className="h-3 w-3" /> Uso
            </TabsTrigger>
            <TabsTrigger value="churn" className="gap-1 text-xs data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <AlertTriangle className="h-3 w-3" /> Churn
            </TabsTrigger>
            <TabsTrigger value="engagement" className="gap-1 text-xs data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <Activity className="h-3 w-3" /> Engajamento
            </TabsTrigger>
          </TabsList>

          <div className="px-4 py-2 max-h-[350px] overflow-y-auto">
            <TabsContent value="revenue" className="mt-0">
              {topByRevenue.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum assinante ativo</p>
              ) : (
                topByRevenue.map((org, i) => (
                  <RankingRow
                    key={org.id}
                    org={org}
                    metric={formatCurrency(org.pricePerMonth)}
                    metricLabel={`${org.servicesThisMonth} OS/mês`}
                    highlight="success"
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="usage" className="mt-0">
              {topByUsage.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma atividade este mês</p>
              ) : (
                topByUsage.map((org) => (
                  <RankingRow
                    key={org.id}
                    org={org}
                    metric={org.servicesThisMonth}
                    metricLabel="OS este mês"
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="churn" className="mt-0">
              {churnRisk.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum risco identificado 🎉</p>
              ) : (
                churnRisk.map((org) => (
                  <RankingRow
                    key={org.id}
                    org={org}
                    metric={
                      org.cancelAtPeriodEnd ? "Cancelando" :
                      org.daysOverdue > 0 ? `${org.daysOverdue}d vencido` :
                      formatDaysAgo(org.lastAccess)
                    }
                    metricLabel={
                      org.cancelAtPeriodEnd ? formatCurrency(org.pricePerMonth) :
                      org.daysOverdue > 0 ? formatCurrency(org.pricePerMonth) :
                      "Sem acesso recente"
                    }
                    highlight="danger"
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="engagement" className="mt-0">
              {lowEngagement.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Todos os assinantes estão ativos 🎉</p>
              ) : (
                lowEngagement.map((org) => (
                  <RankingRow
                    key={org.id}
                    org={org}
                    metric={formatDaysAgo(org.lastAccess)}
                    metricLabel={`${formatCurrency(org.pricePerMonth)}/mês`}
                    highlight="warning"
                  />
                ))
              )}
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
