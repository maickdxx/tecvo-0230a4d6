import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import { useCashFlowChartData, Granularity } from "@/hooks/useDashboardStats";
import { Skeleton } from "@/components/ui/skeleton";

interface CashFlowChartProps {
  granularity: Granularity;
  chartStartDate: string;
  chartEndDate: string;
}

export function CashFlowChart({ granularity, chartStartDate, chartEndDate }: CashFlowChartProps) {
  const { data, isLoading } = useCashFlowChartData(granularity, chartStartDate, chartEndDate);

  const subtitleMap: Record<Granularity, string> = {
    month: "Receitas vs Despesas (últimos 6 meses)",
    week: "Receitas vs Despesas (semana selecionada)",
    day: "Receitas vs Despesas (últimos 7 dias)",
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 shadow-card">
        <div className="mb-4">
          <Skeleton className="h-6 w-40 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const hasData = data.some(d => d.receitas > 0 || d.despesas > 0);

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-card-foreground">Fluxo de Caixa</h3>
        <p className="text-sm text-muted-foreground">{subtitleMap[granularity]}</p>
      </div>
      <div className="h-40">
        {!hasData ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <p className="text-center">
              Nenhuma transação registrada neste período.<br />
              <span className="text-sm">Adicione receitas e despesas para ver o gráfico.</span>
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorReceitas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(158 65% 42%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(158 65% 42%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorDespesas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0 75% 55%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(0 75% 55%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))" 
                vertical={false} 
              />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                tickFormatter={(value) => `R$${value / 1000}k`}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                }}
                formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, '']}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Area
                type="monotone"
                dataKey="receitas"
                stroke="hsl(158 65% 42%)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorReceitas)"
                name="Receitas"
              />
              <Area
                type="monotone"
                dataKey="despesas"
                stroke="hsl(0 75% 55%)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorDespesas)"
                name="Despesas"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="mt-4 flex items-center justify-center gap-6">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-success" />
          <span className="text-sm text-muted-foreground">Receitas</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-destructive" />
          <span className="text-sm text-muted-foreground">Despesas</span>
        </div>
      </div>

      {/* Financial Summary */}
      {hasData && (() => {
        const totalReceitas = data.reduce((sum, d) => sum + d.receitas, 0);
        const totalDespesas = data.reduce((sum, d) => sum + d.despesas, 0);
        const saldo = totalReceitas - totalDespesas;
        const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
        return (
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
              <p className="text-xs font-medium text-muted-foreground">Total Receitas</p>
              <p className="text-sm font-bold text-success">{fmt(totalReceitas)}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
              <p className="text-xs font-medium text-muted-foreground">Total Despesas</p>
              <p className="text-sm font-bold text-destructive">{fmt(totalDespesas)}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
              <p className="text-xs font-medium text-muted-foreground">Saldo Acumulado</p>
              <p className={`text-sm font-bold ${saldo >= 0 ? "text-success" : "text-destructive"}`}>{fmt(saldo)}</p>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
