import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSystemMetrics } from "@/hooks/useSystemMetrics";
import {
  Building2,
  Users,
  Wrench,
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

export function ExecutiveDashboard() {
  const { metrics, monthlyGrowth, isLoading } = useSystemMetrics();

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

  const stats = [
    {
      title: "Empresas Cadastradas",
      value: metrics.totalOrganizations,
      icon: Building2,
      trend: metrics.growthRate,
      trendLabel: "vs mês anterior",
    },
    {
      title: "Usuários Ativos",
      value: metrics.totalUsers,
      icon: Users,
      subtitle: `${metrics.totalTechnicians} técnicos`,
    },
    {
      title: "Ordens de Serviço",
      value: metrics.totalServices,
      icon: ClipboardList,
      subtitle: `${metrics.servicesThisMonth} este mês`,
      trend: metrics.servicesLastMonth > 0
        ? ((metrics.servicesThisMonth - metrics.servicesLastMonth) / metrics.servicesLastMonth) * 100
        : 0,
    },
    {
      title: "Mensagens WhatsApp",
      value: metrics.totalWhatsAppMessages.toLocaleString("pt-BR"),
      icon: MessageSquare,
      subtitle: `${metrics.messagesThisMonth.toLocaleString("pt-BR")} este mês`,
    },
    {
      title: "MRR (Receita Mensal)",
      value: formatCurrency(metrics.monthlyRevenue),
      icon: DollarSign,
      highlight: true,
    },
    {
      title: "ARR (Receita Anual)",
      value: formatCurrency(metrics.annualRevenue),
      icon: TrendingUp,
      highlight: true,
    },
    {
      title: "Ticket Médio",
      value: formatCurrency(metrics.averageTicket),
      icon: DollarSign,
    },
    {
      title: "Taxa de Churn",
      value: `${metrics.churnRate.toFixed(1)}%`,
      icon: metrics.churnRate > 5 ? TrendingDown : TrendingUp,
      alert: metrics.churnRate > 5,
    },
    {
      title: "Assinaturas Ativas",
      value: metrics.activeSubscriptions,
      icon: UserCheck,
      subtitle: `${metrics.trialAccounts} em teste`,
    },
    {
      title: "Contas Inadimplentes",
      value: metrics.overdueAccounts,
      icon: UserX,
      alert: metrics.overdueAccounts > 0,
    },
    {
      title: "Novos Cadastros (Hoje)",
      value: metrics.newSignupsToday,
      icon: Calendar,
    },
    {
      title: "Novos Cadastros (Mês)",
      value: metrics.newSignupsMonth,
      icon: Calendar,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
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
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${
                stat.highlight
                  ? "text-primary"
                  : stat.alert
                  ? "text-destructive"
                  : "text-muted-foreground"
              }`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              {stat.trend !== undefined && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  {stat.trend >= 0 ? (
                    <ArrowUpRight className="h-3 w-3 text-green-600" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 text-red-600" />
                  )}
                  <span className={stat.trend >= 0 ? "text-green-600" : "text-red-600"}>
                    {formatPercent(stat.trend)}
                  </span>
                  {stat.trendLabel && <span className="ml-1">{stat.trendLabel}</span>}
                </p>
              )}
              {stat.subtitle && (
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.subtitle}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Crescimento de Empresas</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyGrowth}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="organizations"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  name="Empresas"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Evolução de Receita</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyGrowth}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Bar
                  dataKey="revenue"
                  fill="hsl(var(--primary))"
                  name="Receita"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ordens de Serviço por Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyGrowth}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar
                  dataKey="services"
                  fill="hsl(var(--chart-2))"
                  name="Serviços"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Crescimento de Usuários</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyGrowth}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="users"
                  stroke="hsl(var(--chart-3))"
                  strokeWidth={2}
                  name="Usuários"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
