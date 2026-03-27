import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAdminAnalytics } from "@/hooks/useAdminAnalytics";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar,
  Legend,
  Cell,
  ComposedChart,
  Area
} from "recharts";
import { Users, MousePointer2, UserPlus, Timer, TrendingUp, Search, Globe, Share2, BarChart3, AlertTriangle, CheckCircle2, UserX, UserCheck, Activity, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminAutomations } from "./AdminAutomations";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export function AdminAnalytics() {
  const { 
    dailyMetrics, 
    trafficSources, 
    pageViews, 
    funnel, 
    userScores,
    activationMetrics,
    retentionCohorts,
    alerts,
    kpis, 
    isLoading 
  } = useAdminAnalytics();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-[400px] w-full" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    );
  }

  const chartData = dailyMetrics.data?.map(m => ({
    date: format(new Date(m.day), 'dd/MM', { locale: ptBR }),
    sessions: m.total_sessions || 0,
    signups: m.signups_completed || 0,
    visitors: m.unique_visitors || 0
  })) || [];

  const sourceData = trafficSources.data?.slice(0, 5).map(s => ({
    name: s.source === 'direct' ? 'Direto' : s.source,
    value: s.session_count || 0
  })) || [];

  const cohortData = retentionCohorts.data?.map(c => ({
    month: format(new Date(c.cohort_month), 'MMM/yy', { locale: ptBR }),
    active: c.active_users,
    period: `Mês ${c.month_number}`
  })) || [];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sessões Totais</CardTitle>
            <MousePointer2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis?.total_sessions.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">No período selecionado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Usuários Únicos</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis?.unique_visitors.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Visitantes distintos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Taxa de Ativação</CardTitle>
            <Activity className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis?.activation_rate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Usuários que usaram o sistema</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tempo p/ Ativação</CardTitle>
            <Timer className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activationMetrics.data?.avg_hours_to_activation?.toFixed(1) || 0}h</div>
            <p className="text-xs text-muted-foreground">Média desde o cadastro</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="funnel">Funil & Conversão</TabsTrigger>
          <TabsTrigger value="retention">Retenção & Coorte</TabsTrigger>
          <TabsTrigger value="users">Usuários & Alertas</TabsTrigger>
          <TabsTrigger value="automations" className="gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Automações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 pt-4">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Evolution Chart */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Evolução de Acessos</CardTitle>
                <CardDescription>Sessões e cadastros concluídos por dia</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', backgroundColor: 'var(--card)', color: 'var(--card-foreground)' }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="sessions" 
                        name="Sessões" 
                        stroke="var(--primary)" 
                        strokeWidth={2} 
                        dot={{ r: 4, fill: "var(--primary)" }} 
                        activeDot={{ r: 6 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="signups" 
                        name="Cadastros" 
                        stroke="#10b981" 
                        strokeWidth={2} 
                        dot={{ r: 4, fill: "#10b981" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Traffic Sources */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Origens de Tráfego</CardTitle>
                <CardDescription>Top 5 fontes de sessões</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sourceData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={80} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                      <Tooltip cursor={{ fill: 'var(--accent)' }} contentStyle={{ borderRadius: '8px', border: 'none', backgroundColor: 'var(--card)', color: 'var(--card-foreground)' }} />
                      <Bar dataKey="value" name="Sessões" radius={[0, 4, 4, 0]}>
                        {sourceData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? "var(--primary)" : `hsl(var(--primary) / ${0.8 - index * 0.15})`} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Most Visited Pages */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Páginas Mais Acessadas</CardTitle>
                <CardDescription>Páginas com maior volume de visualizações</CardDescription>
              </div>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Página</TableHead>
                    <TableHead className="text-right">Visualizações</TableHead>
                    <TableHead className="text-right">Visitantes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageViews.data?.map((page, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium max-w-[200px] truncate" title={page.page_path}>
                        {page.page_path}
                      </TableCell>
                      <TableCell className="text-right">{page.total_views.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{page.unique_views.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="funnel" className="space-y-6 pt-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Funil de Negócio Completo</CardTitle>
                <CardDescription>Da visita à assinatura concluída</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "Visita Landing Page", value: funnel.data?.landing_page, color: "bg-blue-600" },
                  { label: "Signup Iniciado", value: funnel.data?.signup_started, color: "bg-blue-500" },
                  { label: "Signup Concluído", value: funnel.data?.signup_completed, color: "bg-blue-400" },
                  { label: "Primeiro Login", value: funnel.data?.first_login, color: "bg-indigo-400" },
                  { label: "Primeira Ação", value: funnel.data?.first_action, color: "bg-indigo-500" },
                  { label: "Ativado (Uso Real)", value: funnel.data?.activated, color: "bg-emerald-500" },
                  { label: "Início Assinatura", value: funnel.data?.subscription_started, color: "bg-amber-500" },
                  { label: "Assinatura Concluída", value: funnel.data?.subscription_completed, color: "bg-emerald-600" },
                ].map((step, idx, arr) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span>{step.label}</span>
                      <span>{step.value?.toLocaleString() || 0}</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${step.color} transition-all duration-500`} 
                        style={{ 
                          width: `${Math.min(100, ((step.value || 0) / (arr[0].value || 1)) * 100)}%` 
                        }} 
                      />
                    </div>
                    {idx > 0 && (
                      <p className="text-[10px] text-muted-foreground text-right">
                        {((step.value || 0) / (arr[idx-1].value || 1) * 100).toFixed(1)}% de retenção do passo anterior
                      </p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Métricas de Conversão</CardTitle>
                <CardDescription>Performance por etapa do funil</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 border rounded-lg bg-emerald-50/50">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Taxa de Conversão Total</p>
                      <p className="text-xs text-muted-foreground">Visita vs Assinatura</p>
                    </div>
                    <div className="text-2xl font-bold text-emerald-600">
                      {((funnel.data?.subscription_completed || 0) / (funnel.data?.landing_page || 1) * 100).toFixed(2)}%
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg bg-blue-50/50">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Eficiência de Signup</p>
                      <p className="text-xs text-muted-foreground">Iniciado vs Concluído</p>
                    </div>
                    <div className="text-2xl font-bold text-blue-600">
                      {((funnel.data?.signup_completed || 0) / (funnel.data?.signup_started || 1) * 100).toFixed(1)}%
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg bg-indigo-50/50">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Poder de Ativação</p>
                      <p className="text-xs text-muted-foreground">Login vs Uso Real</p>
                    </div>
                    <div className="text-2xl font-bold text-indigo-600">
                      {((funnel.data?.activated || 0) / (funnel.data?.first_login || 1) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="retention" className="space-y-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Análise de Retenção (Coorte)</CardTitle>
              <CardDescription>Usuários ativos por mês de entrada</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cohortData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="active" name="Usuários Ativos" fill="var(--primary)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6 pt-4">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Classificação de Comportamento</CardTitle>
                <CardDescription>Engajamento dos usuários nos últimos 30 dias</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Dias Ativos</TableHead>
                      <TableHead className="text-right">Risco Churn</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userScores.data?.slice(0, 10).map((user, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{user.full_name || "Usuário"}</TableCell>
                        <TableCell>
                          <Badge variant={
                            user.classification === 'engajado' ? 'default' :
                            user.classification === 'potencial' ? 'secondary' :
                            user.classification === 'em risco' ? 'destructive' : 'outline'
                          }>
                            {user.classification}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{user.active_days_30d}</TableCell>
                        <TableCell className="text-right">
                          {user.is_churn_risk ? (
                            <Badge variant="destructive" className="animate-pulse">Alto</Badge>
                          ) : (
                            <Badge variant="outline">Baixo</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="md:col-span-1">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <CardTitle>Alertas Ativos</CardTitle>
                </div>
                <CardDescription>Detecção automática de problemas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {alerts.data?.map((alert, idx) => (
                  <div key={idx} className="p-3 border rounded-lg bg-muted/30 space-y-1">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-bold uppercase text-muted-foreground">{alert.alert_type}</span>
                      <span className="text-[10px] text-muted-foreground">{format(new Date(alert.created_at), 'dd/MM HH:mm')}</span>
                    </div>
                    <p className="text-sm font-medium">{alert.message}</p>
                    <div className="flex justify-between items-center pt-2">
                      <Badge variant="outline" className="text-[10px] h-4">
                        {alert.severity}
                      </Badge>
                      <button className="text-[10px] text-primary hover:underline">Resolver</button>
                    </div>
                  </div>
                ))}
                {(!alerts.data || alerts.data.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">Nenhum alerta crítico detectado</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="automations" className="space-y-6 pt-4">
          <AdminAutomations />
        </TabsContent>
      </Tabs>
    </div>
  );
}
