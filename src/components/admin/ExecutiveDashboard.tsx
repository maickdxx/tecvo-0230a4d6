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
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Lightbulb,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Line, LineChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis, Bar, BarChart } from "recharts";

interface ExecutiveDashboardProps {
  onNavigateTab?: (tab: string) => void;
}

type HealthStatus = "good" | "warning" | "danger";

interface KpiConfig {
  title: string;
  technicalLabel?: string;
  value: string | number;
  icon: typeof DollarSign;
  tooltip: string;
  status: HealthStatus;
  statusLabel: string;
  recommendation?: string;
  trend?: number;
  trendLabel?: string;
  subtitle?: string;
  highlight?: boolean;
}

function getStatusConfig(status: HealthStatus) {
  switch (status) {
    case "good":
      return { color: "text-emerald-600", bg: "bg-emerald-500/10 border-emerald-500/30", icon: CheckCircle2, label: "🟢" };
    case "warning":
      return { color: "text-amber-600", bg: "bg-amber-500/10 border-amber-500/30", icon: AlertTriangle, label: "🟡" };
    case "danger":
      return { color: "text-destructive", bg: "bg-destructive/10 border-destructive/30", icon: XCircle, label: "🔴" };
  }
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

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const formatPercent = (value: number) =>
    `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;

  // === BUSINESS SUMMARY ===
  const summaryParts: string[] = [];
  const recommendations: string[] = [];

  if (metrics.monthlyRevenue > 0 && metrics.growthRate > 0) {
    summaryParts.push("seu negócio está crescendo");
  } else if (metrics.monthlyRevenue > 0) {
    summaryParts.push("seu faturamento está estável");
  } else {
    summaryParts.push("nenhuma receita registrada ainda");
  }

  if (metrics.churnRate > 5) {
    summaryParts.push(`mas você perdeu clientes este mês (${metrics.churnRate.toFixed(1)}%)`);
    recommendations.push("Entre em contato com clientes que cancelaram para entender o motivo");
  }
  if (metrics.overdueAccounts > 0) {
    summaryParts.push(`${metrics.overdueAccounts} cliente${metrics.overdueAccounts > 1 ? "s" : ""} com pagamento atrasado`);
    recommendations.push("Verifique os inadimplentes e envie lembretes de pagamento");
  }
  if (metrics.servicesThisMonth < metrics.servicesLastMonth * 0.7 && metrics.servicesLastMonth > 0) {
    recommendations.push("A atividade caiu — incentive o uso do sistema pelas empresas");
  }
  if (metrics.newSignupsMonth === 0) {
    recommendations.push("Nenhum cadastro novo este mês — revise sua estratégia de aquisição");
  }
  if (recommendations.length === 0) {
    recommendations.push("Tudo está indo bem! Continue monitorando os indicadores");
  }

  const summaryText = summaryParts.join(", ") + ".";

  // === KPI DEFINITIONS ===
  const kpis: KpiConfig[] = [
    {
      title: "Faturamento Mensal",
      technicalLabel: "MRR",
      value: formatCurrency(metrics.monthlyRevenue),
      icon: DollarSign,
      tooltip: "Quanto sua plataforma fatura por mês com assinaturas ativas. Exemplo: se 3 clientes pagam R$149, o faturamento mensal é R$447.",
      status: metrics.monthlyRevenue > 0 ? "good" : "warning",
      statusLabel: metrics.monthlyRevenue > 0 ? "Receita ativa" : "Sem receita",
      recommendation: metrics.monthlyRevenue === 0 ? "Converta clientes em teste para planos pagos" : undefined,
      highlight: true,
    },
    {
      title: "Faturamento Anual",
      technicalLabel: "ARR",
      value: formatCurrency(metrics.annualRevenue),
      icon: TrendingUp,
      tooltip: "Estimativa do faturamento anual se o ritmo atual se mantiver. É o faturamento mensal multiplicado por 12.",
      status: metrics.annualRevenue > 0 ? "good" : "warning",
      statusLabel: metrics.annualRevenue > 0 ? "Projeção positiva" : "Sem projeção",
      highlight: true,
    },
    {
      title: "Empresas",
      value: metrics.totalOrganizations,
      icon: Building2,
      tooltip: "Total de empresas cadastradas na plataforma, incluindo testes gratuitos e planos pagos.",
      status: metrics.totalOrganizations > 0 ? "good" : "warning",
      statusLabel: metrics.totalOrganizations > 0 ? "Base ativa" : "Sem empresas",
      trend: metrics.growthRate,
      trendLabel: "vs mês anterior",
    },
    {
      title: "Assinaturas Ativas",
      value: metrics.activeSubscriptions,
      icon: UserCheck,
      tooltip: "Quantas empresas estão com plano pago e ativo (não expirado). Inclui quem está em período de teste.",
      status: metrics.activeSubscriptions > 0 ? "good" : "warning",
      statusLabel: metrics.activeSubscriptions > 0 ? "Clientes pagando" : "Nenhuma assinatura",
      subtitle: `${metrics.trialAccounts} em teste`,
    },
    {
      title: "Pagamentos Atrasados",
      value: metrics.overdueAccounts,
      icon: UserX,
      tooltip: "Empresas com plano pago que já expirou e não renovaram. Essas empresas podem perder acesso se não regularizarem.",
      status: metrics.overdueAccounts === 0 ? "good" : metrics.overdueAccounts <= 2 ? "warning" : "danger",
      statusLabel: metrics.overdueAccounts === 0 ? "Nenhum atraso" : `${metrics.overdueAccounts} em atraso`,
      recommendation: metrics.overdueAccounts > 0 ? "Envie lembretes de pagamento para os inadimplentes" : undefined,
    },
    {
      title: "Clientes Perdidos",
      technicalLabel: "Churn",
      value: `${metrics.churnRate.toFixed(1)}%`,
      icon: metrics.churnRate > 5 ? TrendingDown : TrendingUp,
      tooltip: "Porcentagem de clientes que cancelaram o plano este mês. Se 10 clientes ativos e 1 cancelou, o churn é 10%. Abaixo de 5% é saudável.",
      status: metrics.churnRate === 0 ? "good" : metrics.churnRate <= 5 ? "warning" : "danger",
      statusLabel: metrics.churnRate === 0 ? "Nenhum cancelamento" : metrics.churnRate <= 5 ? "Dentro do normal" : "Cancelamentos altos!",
      recommendation: metrics.churnRate > 5 ? "Entre em contato com clientes inativos para entender o motivo" : undefined,
    },
    {
      title: "Usuários",
      value: metrics.totalUsers,
      icon: Users,
      tooltip: "Total de pessoas usando a plataforma (donos + técnicos). Quanto mais usuários ativos, mais engajada está a base.",
      status: "good",
      statusLabel: `${metrics.totalTechnicians} técnicos`,
      subtitle: `${metrics.totalTechnicians} técnicos`,
    },
    {
      title: "OS no Mês",
      value: metrics.servicesThisMonth,
      icon: ClipboardList,
      tooltip: "Quantas ordens de serviço foram criadas este mês por todas as empresas. Indica o nível de uso real da plataforma.",
      status: metrics.servicesThisMonth >= metrics.servicesLastMonth ? "good" : "warning",
      statusLabel: metrics.servicesThisMonth >= metrics.servicesLastMonth ? "Uso estável" : "Uso caiu",
      trend: metrics.servicesLastMonth > 0
        ? ((metrics.servicesThisMonth - metrics.servicesLastMonth) / metrics.servicesLastMonth) * 100
        : 0,
      subtitle: `${metrics.totalServices.toLocaleString("pt-BR")} total`,
      recommendation: metrics.servicesThisMonth < metrics.servicesLastMonth ? "Incentive as empresas a registrarem serviços pelo sistema" : undefined,
    },
    {
      title: "Mensagens WhatsApp",
      value: metrics.messagesThisMonth.toLocaleString("pt-BR"),
      icon: MessageSquare,
      tooltip: "Total de mensagens de WhatsApp trocadas na plataforma este mês, incluindo automações e atendimentos.",
      status: "good",
      statusLabel: "Canal ativo",
      subtitle: `${metrics.totalWhatsAppMessages.toLocaleString("pt-BR")} total`,
    },
    {
      title: "Valor Médio por Assinatura",
      technicalLabel: "Ticket Médio",
      value: formatCurrency(metrics.averageTicket),
      icon: DollarSign,
      tooltip: "Quanto cada cliente paga em média por mês. Calculado dividindo o faturamento mensal pelo número de assinaturas ativas.",
      status: metrics.averageTicket > 0 ? "good" : "warning",
      statusLabel: metrics.averageTicket > 0 ? "Preço saudável" : "Sem dados",
    },
    {
      title: "Cadastros Hoje",
      value: metrics.newSignupsToday,
      icon: Calendar,
      tooltip: "Empresas que se cadastraram na plataforma hoje. Um bom indicador de tração e efetividade do marketing.",
      status: metrics.newSignupsToday > 0 ? "good" : "warning",
      statusLabel: metrics.newSignupsToday > 0 ? "Novos entrando!" : "Nenhum hoje",
    },
    {
      title: "Cadastros no Mês",
      value: metrics.newSignupsMonth,
      icon: Calendar,
      tooltip: "Total de novos cadastros este mês. Compare com meses anteriores para avaliar tendência de crescimento.",
      status: metrics.newSignupsMonth > 0 ? "good" : "warning",
      statusLabel: metrics.newSignupsMonth > 0 ? "Crescendo" : "Sem novos cadastros",
      recommendation: metrics.newSignupsMonth === 0 ? "Revise a estratégia de aquisição de clientes" : undefined,
    },
  ];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* === RESUMO DO DIA === */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-start gap-3 mb-3">
              <Lightbulb className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <h2 className="text-base font-semibold text-foreground">Resumo do dia</h2>
                <p className="text-sm text-muted-foreground mt-0.5 capitalize">{summaryText}</p>
              </div>
            </div>
            {recommendations.length > 0 && (
              <div className="ml-8 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">O que fazer agora:</p>
                {recommendations.slice(0, 3).map((rec, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-xs mt-0.5">→</span>
                    <p className="text-sm text-foreground">{rec}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Smart Alerts */}
        {!dashLoading && dashData.alerts.length > 0 && (
          <AdminSmartAlerts alerts={dashData.alerts} onNavigate={handleNavigate} />
        )}

        {/* Quick Actions */}
        <AdminQuickActions onNavigate={handleNavigate} />

        {/* KPI Grid */}
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {kpis.map((kpi, index) => {
            const statusCfg = getStatusConfig(kpi.status);
            return (
              <Card
                key={index}
                className={
                  kpi.highlight
                    ? "border-primary bg-primary/5"
                    : kpi.status === "danger"
                    ? "border-destructive bg-destructive/5"
                    : kpi.status === "warning"
                    ? "border-amber-500/30 bg-amber-500/5"
                    : ""
                }
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
                  <div className="flex items-center gap-1 min-w-0">
                    <CardTitle className="text-xs font-medium text-muted-foreground truncate">
                      {kpi.title}
                    </CardTitle>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3 w-3 text-muted-foreground/50 flex-shrink-0 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[250px] text-xs">
                        <p>{kpi.tooltip}</p>
                        {kpi.technicalLabel && (
                          <p className="text-muted-foreground mt-1 text-[10px]">Termo técnico: {kpi.technicalLabel}</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <kpi.icon className={`h-3.5 w-3.5 ${
                    kpi.highlight
                      ? "text-primary"
                      : kpi.status === "danger"
                      ? "text-destructive"
                      : kpi.status === "warning"
                      ? "text-amber-600"
                      : "text-muted-foreground"
                  }`} />
                </CardHeader>
                <CardContent className="pb-3 px-3">
                  <div className="text-lg sm:text-xl font-bold truncate">{kpi.value}</div>

                  {/* Status indicator */}
                  <p className={`text-[10px] flex items-center gap-1 mt-0.5 ${statusCfg.color}`}>
                    <span>{statusCfg.label}</span>
                    <span>{kpi.statusLabel}</span>
                  </p>

                  {kpi.trend !== undefined && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                      {kpi.trend >= 0 ? (
                        <ArrowUpRight className="h-3 w-3 text-emerald-600" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3 text-destructive" />
                      )}
                      <span className={kpi.trend >= 0 ? "text-emerald-600" : "text-destructive"}>
                        {formatPercent(kpi.trend)}
                      </span>
                      {kpi.trendLabel && <span className="ml-0.5">{kpi.trendLabel}</span>}
                    </p>
                  )}
                  {kpi.subtitle && !kpi.statusLabel.includes(kpi.subtitle) && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">{kpi.subtitle}</p>
                  )}

                  {/* Recommendation */}
                  {kpi.recommendation && (
                    <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-1 leading-tight">
                      💡 {kpi.recommendation}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Rankings + Growth Charts */}
        <div className="grid gap-4 lg:grid-cols-2">
          {!dashLoading && (
            <AdminRankings
              topByRevenue={dashData.rankings.topByRevenue}
              topByUsage={dashData.rankings.topByUsage}
              churnRisk={dashData.rankings.churnRisk}
              lowEngagement={dashData.rankings.lowEngagement}
            />
          )}

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm">Evolução de Receita</CardTitle>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/50 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[220px] text-xs">
                    Quanto a plataforma faturou em cada mês dos últimos 6 meses.
                  </TooltipContent>
                </Tooltip>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyGrowth}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
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
              <CardTitle className="text-sm">Empresas Cadastradas</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={monthlyGrowth}>
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <RechartsTooltip />
                  <Line type="monotone" dataKey="organizations" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Empresas" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Usuários Ativos</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={monthlyGrowth}>
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <RechartsTooltip />
                  <Line type="monotone" dataKey="users" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} name="Usuários" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Serviços por Mês</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyGrowth}>
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <RechartsTooltip />
                  <Bar dataKey="services" fill="hsl(var(--chart-2))" name="Serviços" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}
