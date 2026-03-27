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
import { Users, MousePointer2, UserPlus, Timer, TrendingUp, Search, Globe, Share2, BarChart3, AlertTriangle, CheckCircle2, UserX, UserCheck, Activity, Zap, Filter, ArrowDown, History, Flag, Lightbulb, Trophy, Star, FileText, Layout, Copy, Check, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminAutomations } from "./AdminAutomations";
import { AdminABTests } from "./AdminABTests";
import { AdminPatterns } from "./AdminPatterns";

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
    marketingFunnel,
    leadDropoffs,
    ctaPerformance,
    leadPaths,
    abTestResults,
    winningPatterns,
    templates,
    campaignComparison,
    patternApplications,
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
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{kpis?.activation_rate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Usuários que usaram o sistema</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tempo p/ Ativação</CardTitle>
            <Timer className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{activationMetrics.data?.avg_hours_to_activation?.toFixed(1) || 0}h</div>
            <p className="text-xs text-muted-foreground">Média desde o cadastro</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="leads" className="w-full">
        <TabsList className="grid w-full grid-cols-10">
          <TabsTrigger value="leads" className="gap-2">
            <Filter className="h-4 w-4 text-primary" />
            Leads
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Canais & Campanhas
          </TabsTrigger>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="funnel">Funil & Conversão</TabsTrigger>
          <TabsTrigger value="retention">Retenção</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="automations" className="gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Automações
          </TabsTrigger>
          <TabsTrigger value="ab_tests" className="gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Testes A/B
          </TabsTrigger>
          <TabsTrigger value="patterns" className="gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            Padrões Vencedores
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="space-y-6 pt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Visitantes Únicos</CardTitle>
                <Users className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{marketingFunnel.data?.total_visitors?.toLocaleString() || 0}</div>
                <p className="text-xs text-muted-foreground">Visitantes no site</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Taxa de Clique CTA</CardTitle>
                <MousePointer2 className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{marketingFunnel.data?.cta_click_rate?.toFixed(1) || 0}%</div>
                <p className="text-xs text-muted-foreground">Visitantes vs Cliques</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Taxa Conv. Final</CardTitle>
                <TrendingUp className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{marketingFunnel.data?.final_conversion_rate?.toFixed(2) || 0}%</div>
                <p className="text-xs text-muted-foreground">Visitantes vs Pagamento</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Tempo Médio p/ Conv.</CardTitle>
                <Timer className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {marketingFunnel.data?.avg_time_to_signup_seconds 
                    ? Math.round(marketingFunnel.data.avg_time_to_signup_seconds / 60) 
                    : 0} min
                </div>
                <p className="text-xs text-muted-foreground">Média desde a 1ª visita</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Funil de Venda (Leads)</CardTitle>
                <CardDescription>Etapas críticas antes da ativação</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {[
                  { label: "Visita Landing Page", value: marketingFunnel.data?.landing_page_views, color: "bg-muted-foreground/50" },
                  { label: "Interação", value: marketingFunnel.data?.interactions, color: "bg-muted-foreground/40" },
                  { label: "Clique em Criar Conta", value: marketingFunnel.data?.cta_clicks, color: "bg-primary/70" },
                  { label: "Início de Cadastro", value: marketingFunnel.data?.signups_started, color: "bg-primary/80" },
                  { label: "Cadastro Concluído", value: marketingFunnel.data?.signups_completed, color: "bg-primary" },
                  { label: "Início de Pagamento", value: marketingFunnel.data?.payments_initiated, color: "bg-secondary" },
                  { label: "Pagamento Concluído", value: marketingFunnel.data?.payments_completed, color: "bg-primary" },
                ].map((step, idx, arr) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span>{step.label}</span>
                      <span>{step.value?.toLocaleString() || 0}</span>
                    </div>
                    <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${step.color} transition-all duration-700`} 
                        style={{ 
                          width: `${Math.min(100, ((step.value || 0) / (arr[0].value || 1)) * 100)}%` 
                        }} 
                      />
                    </div>
                    {idx > 0 && (
                      <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
                        <span>Conversão do passo anterior</span>
                        <span>{((step.value || 0) / (arr[idx-1].value || 1) * 100).toFixed(1)}%</span>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Gargalos - Páginas de Abandono</CardTitle>
                  <CardDescription>Onde os leads mais deixam o site (sem converter)</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Página</TableHead>
                        <TableHead className="text-right">Abandonos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leadDropoffs.data?.map((drop, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium text-xs truncate max-w-[200px]">{drop.last_page}</TableCell>
                          <TableCell className="text-right font-bold text-destructive">{drop.dropoff_count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Performance de CTAs</CardTitle>
                  <CardDescription>Cliques por localização e plano</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Local</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead className="text-right">Cliques</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ctaPerformance.data?.map((cta, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="capitalize text-xs">{cta.cta_location?.replace('_', ' ')}</TableCell>
                          <TableCell className="capitalize text-xs">{cta.cta_plan || "Geral"}</TableCell>
                          <TableCell className="text-right font-medium">{cta.click_count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Amostra de Jornadas de Leads</CardTitle>
                <CardDescription>Caminho percorrido até a última interação</CardDescription>
              </div>
              <History className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Visitante (ID)</TableHead>
                    <TableHead>Caminho Percorrido</TableHead>
                    <TableHead className="text-right">Interações</TableHead>
                    <TableHead className="text-right">Tempo Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leadPaths.data?.map((path, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-[10px] truncate max-w-[100px]">{path.visitor_id}</TableCell>
                      <TableCell className="text-[10px] max-w-[400px] truncate" title={path.path}>
                        {path.path}
                      </TableCell>
                      <TableCell className="text-right">{path.interaction_count}</TableCell>
                      <TableCell className="text-right">{Math.round(path.total_time_seconds / 60)} min</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-6 pt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Melhor Campanha</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold truncate">
                  {campaignComparison.data?.[0]?.campaign || "Nenhuma ativa"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Taxa de {campaignComparison.data?.[0]?.conversion_rate || 0}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Melhor Origem</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">
                  {trafficSources.data?.[0]?.source || "Direto"}
                </div>
                <p className="text-xs text-muted-foreground">
                  {trafficSources.data?.[0]?.session_count?.toLocaleString() || 0} sessões
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Melhor Estrutura</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">
                  {winningPatterns.data?.find(p => p.pattern_type === 'structure')?.name || "Padrão Tecvo"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Lift de +{winningPatterns.data?.find(p => p.pattern_type === 'structure')?.performance_lift || 0}%
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Análise de Conversão por Canal</CardTitle>
                  <CardDescription>Comparativo detalhado de ROI e Eficiência de Leads por origem UTM.</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="gap-2">
                  <Share2 className="h-4 w-4" /> Exportar Relatório
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Origem / Mídia</TableHead>
                    <TableHead className="text-right">Sessões</TableHead>
                    <TableHead className="text-right">Signups</TableHead>
                    <TableHead className="text-right">Vendas</TableHead>
                    <TableHead className="text-right">Taxa Conv.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaignComparison.data?.map((comp, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium text-foreground">{comp.campaign || '(Sem Campanha)'}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="mr-1 text-primary border-primary/20">{comp.source}</Badge>
                        <Badge variant="secondary" className="text-foreground">{comp.medium}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-foreground">{comp.session_count.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-foreground">{comp.signups.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-bold text-primary">{comp.conversions.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-bold text-foreground">{comp.conversion_rate}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ab_tests" className="pt-4">
          <AdminABTests />
        </TabsContent>

        <TabsContent value="patterns" className="pt-4">
          <AdminPatterns 
            patterns={winningPatterns.data || []} 
            applications={patternApplications.data || []} 
            onRefetch={() => {
              winningPatterns.refetch();
              patternApplications.refetch();
            }} 
          />
        </TabsContent>

        <TabsContent value="templates" className="space-y-6 pt-4">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {templates.data?.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    {template.name}
                  </CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Badge variant="secondary" className="capitalize">{template.category.replace('_', ' ')}</Badge>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 gap-2 text-xs">
                      <Layout className="h-3 w-3" /> Ver Estrutura
                    </Button>
                    <Button className="flex-1 gap-2 text-xs">
                      <Copy className="h-3 w-3" /> Usar Template
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Default Tecvo Template (Conceptual) */}
            <Card className="border-primary/50 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Star className="h-4 w-4 text-primary" />
                  LP Padrão Tecvo (Alta Conv.)
                </CardTitle>
                <CardDescription>Estrutura otimizada com base em +50 testes validados.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3 w-3 text-primary" /> Headlines Dinâmicas
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3 w-3 text-primary" /> Prova Social Integrada
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3 w-3 text-primary" /> Senso de Urgência no CTA
                  </div>
                </div>
                <Button className="w-full gap-2">
                  <Zap className="h-4 w-4" /> Aplicar em Novo Projeto
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

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
                  <div className="flex items-center justify-between p-4 border rounded-lg bg-primary/5">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Taxa de Conversão Total</p>
                      <p className="text-xs text-muted-foreground">Visita vs Assinatura</p>
                    </div>
                    <div className="text-2xl font-bold text-primary">
                      {((funnel.data?.subscription_completed || 0) / (funnel.data?.landing_page || 1) * 100).toFixed(2)}%
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg bg-secondary/10">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Eficiência de Signup</p>
                      <p className="text-xs text-muted-foreground">Iniciado vs Concluído</p>
                    </div>
                    <div className="text-2xl font-bold text-foreground">
                      {((funnel.data?.signup_completed || 0) / (funnel.data?.signup_started || 1) * 100).toFixed(1)}%
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Poder de Ativação</p>
                      <p className="text-xs text-muted-foreground">Login vs Uso Real</p>
                    </div>
                    <div className="text-2xl font-bold text-muted-foreground">
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
