import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { usePaymentMethodStats } from "@/hooks/useDashboardStats";
import { CreditCard } from "lucide-react";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(142 76% 36%)", // green
  "hsl(38 92% 50%)", // orange
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: {
      name: string;
      value: number;
      count: number;
    };
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-lg border bg-popover p-3 shadow-md">
        <p className="font-medium">{data.name}</p>
        <p className="text-sm text-muted-foreground">
          {formatCurrency(data.value)}
        </p>
        <p className="text-xs text-muted-foreground">
          {data.count} {data.count === 1 ? "transação" : "transações"}
        </p>
      </div>
    );
  }
  return null;
}

interface PaymentMethodChartProps {
  startDate: string;
  endDate: string;
}

export function PaymentMethodChart({ startDate, endDate }: PaymentMethodChartProps) {
  const { data, total, isLoading } = usePaymentMethodStats(startDate, endDate);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4" />
            Vendas por Pagamento
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-end gap-2 justify-center h-[200px] px-6 pb-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="w-8 rounded-t-md bg-muted animate-pulse"
              style={{ height: `${25 + Math.random() * 55}%` }}
            />
          ))}
        </CardContent>
      </Card>
    );
  }

  const allUndefined = data.length === 1 && data[0].name === "Não definido";

  if (data.length === 0 || allUndefined) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4" />
            Vendas por Pagamento
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[200px]">
          <p className="text-sm text-muted-foreground text-center">
            {allUndefined ? "Sem dados de pagamento definidos ainda." : "Nenhuma receita registrada neste período"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-4 w-4" />
          Vendas por Pagamento
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={65}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Legend */}
        <div className="mt-3 space-y-1.5">
          {data.slice(0, 4).map((item, index) => {
            const percentage = total > 0 ? ((item.value / total) * 100).toFixed(0) : 0;
            return (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-muted-foreground truncate max-w-[100px]">
                    {item.name}
                  </span>
                </div>
                <span className="font-medium">{percentage}%</span>
              </div>
            );
          })}
          {data.length > 4 && (
            <p className="text-xs text-muted-foreground text-center pt-1">
              +{data.length - 4} outros
            </p>
          )}
        </div>

        {/* Insight: forma mais utilizada */}
        {data.length > 0 && (() => {
          const topMethod = data[0];
          const topPercentage = total > 0 ? ((topMethod.value / total) * 100).toFixed(0) : 0;
          return (
            <p className="mt-3 text-[11px] text-muted-foreground text-center">
              Forma mais utilizada: <span className="font-medium">{topMethod.name} ({topPercentage}%)</span>
            </p>
          );
        })()}
      </CardContent>
    </Card>
  );
}
