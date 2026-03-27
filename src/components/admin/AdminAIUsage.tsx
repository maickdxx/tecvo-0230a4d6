import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, DollarSign, Zap, TrendingUp } from "lucide-react";

type PeriodFilter = "7d" | "30d" | "90d";

interface UsageLog {
  id: string;
  organization_id: string | null;
  user_id: string | null;
  action_slug: string;
  model: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  duration_ms: number;
  status: string;
  created_at: string;
}

interface OrgInfo {
  id: string;
  name: string;
}

export function AdminAIUsage() {
  const [period, setPeriod] = useState<PeriodFilter>("7d");

  const periodDays = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const startDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - periodDays);
    return d.toISOString();
  }, [periodDays]);

  // Fetch usage logs
  const { data: logs, isLoading } = useQuery({
    queryKey: ["ai-usage-logs", period],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ai_usage_logs")
        .select("*")
        .gte("created_at", startDate)
        .order("created_at", { ascending: false })
        .limit(5000);
      
      if (error) throw error;
      return (data || []) as UsageLog[];
    },
  });

  // Fetch organization names for mapping
  const { data: orgs } = useQuery({
    queryKey: ["admin-orgs-names"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name")
        .limit(1000);
      if (error) throw error;
      return (data || []) as OrgInfo[];
    },
  });

  const orgMap = useMemo(() => {
    const map: Record<string, string> = {};
    orgs?.forEach(o => { map[o.id] = o.name; });
    return map;
  }, [orgs]);

  // Calculate summary stats
  const summary = useMemo(() => {
    if (!logs) return null;
    
    const totalCalls = logs.length;
    const totalTokens = logs.reduce((sum, l) => sum + l.total_tokens, 0);
    const totalCost = logs.reduce((sum, l) => sum + Number(l.estimated_cost_usd || 0), 0);
    const avgCostPerCall = totalCalls > 0 ? totalCost / totalCalls : 0;
    const avgTokensPerCall = totalCalls > 0 ? totalTokens / totalCalls : 0;
    const successRate = totalCalls > 0 
      ? (logs.filter(l => l.status === "success").length / totalCalls) * 100 
      : 0;

    return { totalCalls, totalTokens, totalCost, avgCostPerCall, avgTokensPerCall, successRate };
  }, [logs]);

  // Stats by action
  const actionStats = useMemo(() => {
    if (!logs) return [];
    
    const map: Record<string, { calls: number; tokens: number; cost: number }> = {};
    logs.forEach(l => {
      if (!map[l.action_slug]) map[l.action_slug] = { calls: 0, tokens: 0, cost: 0 };
      map[l.action_slug].calls++;
      map[l.action_slug].tokens += l.total_tokens;
      map[l.action_slug].cost += Number(l.estimated_cost_usd || 0);
    });

    return Object.entries(map)
      .map(([action, stats]) => ({
        action,
        calls: stats.calls,
        avgTokens: stats.calls > 0 ? Math.round(stats.tokens / stats.calls) : 0,
        avgCost: stats.calls > 0 ? stats.cost / stats.calls : 0,
        totalCost: stats.cost,
      }))
      .sort((a, b) => b.calls - a.calls);
  }, [logs]);

  // Stats by organization (top 20)
  const orgStats = useMemo(() => {
    if (!logs) return [];
    
    const map: Record<string, { calls: number; tokens: number; cost: number }> = {};
    logs.forEach(l => {
      const orgId = l.organization_id || "unknown";
      if (!map[orgId]) map[orgId] = { calls: 0, tokens: 0, cost: 0 };
      map[orgId].calls++;
      map[orgId].tokens += l.total_tokens;
      map[orgId].cost += Number(l.estimated_cost_usd || 0);
    });

    return Object.entries(map)
      .map(([orgId, stats]) => ({
        orgId,
        orgName: orgMap[orgId] || orgId === "unknown" ? "(Sistema)" : orgId.substring(0, 8),
        calls: stats.calls,
        tokens: stats.tokens,
        cost: stats.cost,
      }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 20);
  }, [logs, orgMap]);

  const USD_TO_BRL = 5.5; // Taxa de câmbio aproximada
  const formatBRL = (valueUSD: number) => `R$ ${(valueUSD * USD_TO_BRL).toFixed(2)}`;
  const formatTokens = (value: number) => value.toLocaleString("pt-BR");

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period filter */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Período:</span>
        <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">7 dias</SelectItem>
            <SelectItem value="30d">30 dias</SelectItem>
            <SelectItem value="90d">90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Chamadas</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalCalls.toLocaleString("pt-BR")}</div>
            <p className="text-xs text-muted-foreground">
              {summary?.successRate.toFixed(1)}% sucesso
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tokens Consumidos</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatTokens(summary?.totalTokens || 0)}</div>
            <p className="text-xs text-muted-foreground">
              ~{formatTokens(summary?.avgTokensPerCall || 0)} por chamada
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custo Estimado</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBRL(summary?.totalCost || 0)}</div>
            <p className="text-xs text-muted-foreground">
              BRL total acumulado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custo Médio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBRL(summary?.avgCostPerCall || 0)}</div>
            <p className="text-xs text-muted-foreground">
              por chamada
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Stats by action */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Uso por Funcionalidade</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ação</TableHead>
                <TableHead className="text-right">Chamadas</TableHead>
                <TableHead className="text-right">Tokens Médio</TableHead>
                <TableHead className="text-right">Custo Médio</TableHead>
                <TableHead className="text-right">Custo Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {actionStats.map((stat) => (
                <TableRow key={stat.action}>
                  <TableCell className="font-medium">{stat.action}</TableCell>
                  <TableCell className="text-right">{stat.calls.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right">{formatTokens(stat.avgTokens)}</TableCell>
                  <TableCell className="text-right">{formatBRL(stat.avgCost)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatBRL(stat.totalCost)}</TableCell>
                </TableRow>
              ))}
              {actionStats.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhum dado de uso registrado no período
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Stats by organization */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 20 Organizações por Custo</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organização</TableHead>
                <TableHead className="text-right">Chamadas</TableHead>
                <TableHead className="text-right">Tokens Total</TableHead>
                <TableHead className="text-right">Custo Estimado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgStats.map((stat) => (
                <TableRow key={stat.orgId}>
                  <TableCell className="font-medium">{stat.orgName}</TableCell>
                  <TableCell className="text-right">{stat.calls.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right">{formatTokens(stat.tokens)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatBRL(stat.cost)}</TableCell>
                </TableRow>
              ))}
              {orgStats.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Nenhum dado de uso registrado no período
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
