import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePaymentFeeAnalytics } from "@/hooks/usePaymentFeeAnalytics";
import { formatPaymentMethod } from "@/lib/formatPaymentMethod";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingDown, Percent, DollarSign, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const COLORS = [
  "hsl(0 84% 60%)",      // red
  "hsl(25 95% 53%)",     // orange
  "hsl(38 92% 50%)",     // amber
  "hsl(48 96% 53%)",     // yellow
  "hsl(142 76% 36%)",    // green
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

interface PaymentFeeReportProps {
  startDate: string;
  endDate: string;
}

export function PaymentFeeReport({ startDate, endDate }: PaymentFeeReportProps) {
  const { data, isLoading } = usePaymentFeeAnalytics(startDate, endDate);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Percent className="h-4 w-4" />
            Taxas de Pagamento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-[160px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.total_gross === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Percent className="h-4 w-4" />
            Taxas de Pagamento
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[120px]">
          <p className="text-sm text-muted-foreground">Nenhum dado no período</p>
        </CardContent>
      </Card>
    );
  }

  const methodsWithFees = data.by_method.filter((m) => m.fee_total > 0.01);
  const methodsWithoutFees = data.by_method.filter((m) => m.fee_total <= 0.01);

  const chartData = methodsWithFees.map((m) => ({
    name: formatPaymentMethod(m.payment_method),
    taxa: m.fee_total,
    pct: m.fee_percentage,
  }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Percent className="h-4 w-4" />
          Análise de Taxas de Pagamento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-lg border bg-card p-2 sm:p-3 text-center">
            <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-[10px] sm:text-[11px] text-muted-foreground">Bruto</p>
            <p className="font-semibold text-xs sm:text-sm">{formatCurrency(data.total_gross)}</p>
          </div>
          <div className="rounded-lg border bg-card p-2 sm:p-3 text-center">
            <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 mx-auto text-destructive mb-1" />
            <p className="text-[10px] sm:text-[11px] text-muted-foreground">Taxas</p>
            <p className="font-semibold text-xs sm:text-sm text-destructive">
              -{formatCurrency(data.total_fees)}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-2 sm:p-3 text-center col-span-2 sm:col-span-1">
            <Percent className="h-3.5 w-3.5 sm:h-4 sm:w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-[10px] sm:text-[11px] text-muted-foreground">Taxa Média</p>
            <p className="font-semibold text-xs sm:text-sm">{data.avg_fee_pct.toFixed(1)}%</p>
          </div>
        </div>

        {/* Chart - only methods with fees */}
        {chartData.length > 0 && (
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 10 }}>
                <XAxis type="number" tickFormatter={(v) => `R$ ${v}`} tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), "Taxa"]}
                  labelFormatter={(label) => label}
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="taxa" radius={[0, 4, 4, 0]}>
                  {chartData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Detail table */}
        <div className="space-y-1">
          {data.by_method.map((m) => (
            <div
              key={m.payment_method}
              className="flex flex-col sm:flex-row sm:items-center justify-between py-2 px-2 rounded-lg border sm:border-none sm:py-1.5 hover:bg-muted/50 gap-1 sm:gap-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate font-medium sm:font-normal">{formatPaymentMethod(m.payment_method)}</span>
                <span className="text-[10px] sm:text-xs text-muted-foreground">({m.count}x)</span>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-3 text-right">
                <span className="text-muted-foreground text-[11px] sm:text-xs">
                  Bruto: {formatCurrency(m.gross_total)}
                </span>
                {m.fee_total > 0.01 ? (
                  <span className="text-destructive font-semibold sm:font-medium text-[11px] sm:text-xs sm:min-w-[80px]">
                    -{formatCurrency(m.fee_total)} ({m.fee_percentage.toFixed(1)}%)
                  </span>
                ) : (
                  <span className="text-primary font-medium text-[11px] sm:text-xs sm:min-w-[80px]">
                    Sem taxa
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Insight */}
        {data.total_fees > 0 && (
          <div className="flex items-start gap-2 rounded-lg bg-accent/50 p-3 text-xs text-accent-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Insight</p>
              <p>
                Você perdeu {formatCurrency(data.total_fees)} em taxas neste período
                ({data.avg_fee_pct.toFixed(1)}% da receita bruta).
                {methodsWithoutFees.length > 0 && (
                  <> Métodos sem taxa: {methodsWithoutFees.map((m) => formatPaymentMethod(m.payment_method)).join(", ")}.</>
                )}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
