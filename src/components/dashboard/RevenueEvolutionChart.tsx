import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useCashFlowChartData, type Granularity } from "@/hooks/useDashboardStats";
import { Skeleton } from "@/components/ui/skeleton";

interface RevenueEvolutionChartProps {
  granularity: Granularity;
  chartStartDate: string;
  chartEndDate: string;
}

function smartYFormat(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `R$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `R$${(value / 1_000).toFixed(1)}k`;
  return `R$${value}`;
}

export function RevenueEvolutionChart({ granularity, chartStartDate, chartEndDate }: RevenueEvolutionChartProps) {
  const { data, isLoading } = useCashFlowChartData(granularity, chartStartDate, chartEndDate);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 shadow-card">
        <Skeleton className="h-6 w-44 mb-2" />
        <Skeleton className="h-4 w-36 mb-3" />
        <Skeleton className="h-52 w-full" />
      </div>
    );
  }

  const hasData = data.some((d) => d.receitas > 0);

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-card">
      <h3 className="text-base font-semibold text-card-foreground mb-1">Evolução da Receita</h3>
      <p className="text-xs text-muted-foreground mb-3">Tendência no período selecionado</p>
      <div className="h-52">
        {!hasData ? (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
            Nenhuma receita registrada no período.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="hsl(var(--chart-1))" />
                  <stop offset="100%" stopColor="hsl(158 65% 42%)" />
                </linearGradient>
              </defs>
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
                formatter={(value: number) => [
                  `R$ ${value.toLocaleString("pt-BR")}`,
                  "Receita",
                ]}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Line
                type={data.length <= 2 ? "linear" : "monotone"}
                dataKey="receitas"
                stroke="url(#lineGradient)"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "hsl(var(--chart-1))", stroke: "hsl(var(--card))", strokeWidth: 2 }}
                activeDot={{ r: 6 }}
                name="Receita"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
