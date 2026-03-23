import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";

interface RevenueVsExpenseBarChartProps {
  income: number;
  expense: number;
}

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
}

const BAR_COLORS = ["hsl(158 65% 42%)", "hsl(0 75% 55%)"];

function smartYFormat(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `R$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `R$${(value / 1_000).toFixed(1)}k`;
  return `R$${value}`;
}

export function RevenueVsExpenseBarChart({ income, expense }: RevenueVsExpenseBarChartProps) {
  const data = [
    { name: "Receita", valor: income },
    { name: "Gastos", valor: expense },
  ];

  const hasData = income > 0 || expense > 0;

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-card">
      <h3 className="text-base font-semibold text-card-foreground mb-1">Receita × Gastos</h3>
      <p className="text-xs text-muted-foreground mb-3">Comparativo real do período</p>
      <div className="h-52">
        {!hasData ? (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
            Nenhuma transação confirmada no período.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                tickFormatter={smartYFormat}
                domain={[0, 'auto']}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
                formatter={(value: number) => [fmt(value), ""]}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Bar dataKey="valor" radius={[6, 6, 0, 0]} barSize={60}>
                {data.map((_, i) => (
                  <Cell key={i} fill={BAR_COLORS[i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      {hasData && (
        <div className="mt-3 flex items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-success" />
            <span className="text-sm text-muted-foreground">Receita: {fmt(income)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-destructive" />
            <span className="text-sm text-muted-foreground">Gastos: {fmt(expense)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
