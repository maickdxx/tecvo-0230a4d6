import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSystemMetrics } from "@/hooks/useSystemMetrics";
import { useAdminDashboard } from "@/hooks/useAdminDashboard";
import { AdminSmartAlerts } from "./AdminSmartAlerts";
import { AdminQuickActions } from "./AdminQuickActions";
import { AdminRankings } from "./AdminRankings";
import {
  Building2,
  Users,
  ClipboardList,
  MessageSquare,
  DollarSign,
  TrendingUp,
  TrendingDown,
  UserCheck,
  UserX,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart } from "recharts";

interface ExecutiveDashboardProps {
  onNavigateTab?: (tab: string) => void;
}

export function ExecutiveDashboard({ onNavigateTab }: ExecutiveDashboardProps) {
  const { metrics, monthlyGrowth, isLoading } = useSystemMetrics();
  const { data: dashData, isLoading: dashLoading } = useAdminDashboard();

  const handleNavigate = (tab: string) => {
    onNavigateTab?.(tab);
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-32" />
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  if (!metrics) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
  };

  const kpis = [
    {
      title: "MRR",
      value: formatCurrency(metrics.monthlyRevenue),
      icon: DollarSign,
      highlight: true,
    },
    {
      title: "ARR",
      value: formatCurrency(metrics.annualRevenue),
      icon: TrendingUp,
      highlight: true,
    },
    {
      title: "Empresas",
      value: metrics.totalOrganizations,
      icon: Building2,
      trend: metrics.growthRate,
      trendLabel: "vs mês anterior",
    },
    {
      title: "Assinaturas Ativas",
      value: metrics.activeSubscriptions,
      icon: UserCheck,
      subtitle: `${metrics.trialAccounts} em teste`,
    },
    {
      title: "Inadimplentes",
      value: metrics.overdueAccounts,
      icon: UserX,
      alert: metrics.overdueAccounts > 0,
    },
    {
      title: "Churn",
      value: `${metrics.churnRate.toFixed(1)}%`,
      icon: metrics.churnRate > 5 ? TrendingDown : TrendingUp,
      alert: metrics.churnRate > 5,
    },
    {
      title: "Usuários",
      value: metrics.totalUsers,
      icon: Users,
      subtitle: `${metrics.totalTechnicians} técnicos`,
    },
    {
      title: "OS (mês)",
      value: metrics.servicesThisMonth,
      icon: ClipboardList,
      trend: metrics.servicesLastMonth > 0
        ? ((metrics.servicesThisMonth - metrics.servicesLastMonth) / metrics.servicesLastMonth) * 100
        : 0,
      subtitle: `${metrics.totalServices.toLocaleString("pt-BR")} total`,
    },
    {
      title: "WhatsApp (mês)",
      value: metrics.messagesThisMonth.toLocaleString("pt-BR"),
      icon: MessageSquare,
      subtitle: `${metrics.totalWhatsAppMessages.toLocaleString("pt-BR")} total`,
    },
    {
      title: "Ticket Médio",
      value: formatCurrency(metrics.averageTicket),
      icon: DollarSign,
    },
    {
      title: "Cadastros Hoje",
      value: metrics.newSignupsToday,
      icon: Calendar,
    },
    {
      title: "Cadastros (mês)",
      value: metrics.newSignupsMonth,
      icon: Calendar,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Smart Alerts */}
      {!dashLoading && dashData.alerts.length > 0 && (
        <AdminSmartAlerts alerts={dashData.alerts} onNavigate={handleNavigate} />
      )}

      {/* Quick Actions */}
      <AdminQuickActions onNavigate={handleNavigate} />

      {/* KPI Grid */}
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {kpis.map((stat, index) => (
          <Card
            key={index}
            className={
              stat.highlight
                ? "border-primary bg-primary/5"
                : stat.alert
                ? "border-destructive bg-destructive/5"
                : ""
            }
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-3.5 w-3.5 ${
                stat.highlight
                  ? "text-primary"
                  : stat.alert
                  ? "text-destructive"
                  : "text-muted-foreground"
              }`} />
            </CardHeader>
            <CardContent className="pb-3 px-3">
              <div className="text-lg sm:text-xl font-bold truncate">{stat.value}</div>
              {stat.trend !== undefined && (
                <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                  {stat.trend >= 0 ? (
                    <ArrowUpRight className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 text-destructive" />
                  )}
                  <span className={stat.trend >= 0 ? "text-emerald-600" : "text-destructive"}>
                    {formatPercent(stat.trend)}
                  </span>
                  {stat.trendLabel && <span className="ml-0.5">{stat.trendLabel}</span>}
                </p>
              )}
              {stat.subtitle && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {stat.subtitle}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Rankings + Growth Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Rankings */}
        {!dashLoading && (
          <AdminRankings
            topByRevenue={dashData.rankings.topByRevenue}
            topByUsage={dashData.rankings.topByUsage}
            churnRisk={dashData.rankings.churnRisk}
            lowEngagement={dashData.rankings.lowEngagement}
          />
        )}

        {/* Revenue Growth */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Evolução de Receita</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyGrowth}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" name="Receita" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Growth Charts Row */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Empresas</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthlyGrowth}>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="organizations" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Empresas" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Usuários</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthlyGrowth}>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="users" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} name="Usuários" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">OS por Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyGrowth}>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="services" fill="hsl(var(--chart-2))" name="Serviços" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
