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
  Cell
} from "recharts";
import { Users, MousePointer2, UserPlus, Timer, TrendingUp, Search, Globe, Share2, BarChart3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export function AdminAnalytics() {
  const { dailyMetrics, trafficSources, pageViews, funnel, kpis, isLoading } = useAdminAnalytics();

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
            <CardTitle className="text-sm font-medium text-muted-foreground">Conversão</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis?.conversion_rate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Taxa de cadastro concluído</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tempo Médio</CardTitle>
            <Timer className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.floor((kpis?.avg_session_duration || 0) / 60)}m {Math.floor((kpis?.avg_session_duration || 0) % 60)}s</div>
            <p className="text-xs text-muted-foreground">Duração por sessão</p>
          </CardContent>
        </Card>
      </div>

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

      <div className="grid gap-6 md:grid-cols-2">
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
                {(!pageViews.data || pageViews.data.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                      Nenhum dado de página coletado ainda
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Funnel Concept */}
        <Card>
          <CardHeader>
            <CardTitle>Funil de Conversão</CardTitle>
            <CardDescription>Jornada do visitante até a primeira ação</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Landing Page</span>
                <span className="font-bold">{funnel.data?.landing_page?.toLocaleString() || 0}</span>
              </div>
              <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 w-full" />
              </div>
            </div>

            <div className="space-y-2 pl-4 border-l-2 border-slate-200">
              <div className="flex justify-between text-sm">
                <span>Iniciaram Cadastro</span>
                <span className="font-bold">{funnel.data?.signup_started?.toLocaleString() || 0}</span>
              </div>
              <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-400" 
                  style={{ 
                    width: `${Math.min(100, ((funnel.data?.signup_started || 0) / (funnel.data?.landing_page || 1)) * 100)}%` 
                  }} 
                />
              </div>
            </div>

            <div className="space-y-2 pl-8 border-l-2 border-slate-200">
              <div className="flex justify-between text-sm">
                <span>Cadastros Concluídos</span>
                <span className="font-bold">{funnel.data?.signup_completed?.toLocaleString() || 0}</span>
              </div>
              <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500" 
                  style={{ 
                    width: `${Math.min(100, ((funnel.data?.signup_completed || 0) / (funnel.data?.landing_page || 1)) * 100)}%` 
                  }} 
                />
              </div>
            </div>

            <div className="space-y-2 pl-12 border-l-2 border-slate-200">
              <div className="flex justify-between text-sm">
                <span>Primeira Ação Importante</span>
                <span className="font-bold">{funnel.data?.first_action?.toLocaleString() || 0}</span>
              </div>
              <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-orange-500" 
                  style={{ 
                    width: `${Math.min(100, ((funnel.data?.first_action || 0) / (funnel.data?.landing_page || 1)) * 100)}%` 
                  }} 
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}