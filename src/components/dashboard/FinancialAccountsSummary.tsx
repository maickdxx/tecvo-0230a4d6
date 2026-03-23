import { useFinancialAccounts, ACCOUNT_TYPE_LABELS } from "@/hooks/useFinancialAccounts";
import { useNavigate } from "react-router-dom";
import { Landmark, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = [
  "hsl(210, 70%, 55%)",
  "hsl(160, 55%, 45%)",
  "hsl(280, 50%, 55%)",
  "hsl(35, 75%, 50%)",
  "hsl(340, 55%, 55%)",
  "hsl(190, 60%, 45%)",
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { name, value, percent } = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-foreground">{name}</p>
      <p className="text-muted-foreground">{formatCurrency(value)}</p>
      <p className="text-muted-foreground">{(percent * 100).toFixed(1)}%</p>
    </div>
  );
}

export function FinancialAccountsSummary() {
  const { activeAccounts, totalBalance, isLoading } = useFinancialAccounts();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (activeAccounts.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Landmark className="h-4 w-4 text-primary" />
            Contas Financeiras
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-full bg-muted p-3 mb-3">
              <Wallet className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhuma conta financeira cadastrada</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Cadastre suas contas em Configurações</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = activeAccounts
    .filter((a) => Number(a.balance) > 0)
    .map((a) => ({
      name: a.name,
      value: Number(a.balance),
      percent: totalBalance > 0 ? Number(a.balance) / totalBalance : 0,
    }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Landmark className="h-4 w-4 text-primary" />
          Contas Financeiras
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs text-muted-foreground">Saldo Total</p>
          <p className={`text-xl font-bold ${totalBalance <= 0 ? "text-destructive" : "text-foreground"}`}>
            {formatCurrency(totalBalance)}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          {/* Account list */}
          <div className="divide-y divide-border">
            {activeAccounts.map((account) => {
              const balance = Number(account.balance);
              const idx = activeAccounts.indexOf(account);
              return (
                <div
                  key={account.id}
                  className="flex items-center justify-between py-2.5 cursor-pointer hover:bg-muted/50 -mx-2 px-2 rounded-lg transition-colors"
                  onClick={() => navigate("/configuracoes?tab=financial-accounts")}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                    />
                    <span className="text-sm font-medium text-foreground">{account.name}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {ACCOUNT_TYPE_LABELS[account.account_type as keyof typeof ACCOUNT_TYPE_LABELS] ?? account.account_type}
                    </Badge>
                  </div>
                  <span className={`text-sm font-semibold ${balance <= 0 ? "text-destructive" : "text-foreground"}`}>
                    {formatCurrency(balance)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Donut chart */}
          {chartData.length > 0 && (
            <div className="flex flex-col items-center">
              <div className="relative w-full" style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      dataKey="value"
                      stroke="none"
                      paddingAngle={2}
                    >
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground leading-none">Total</p>
                    <p className="text-xs font-bold text-foreground mt-0.5">{formatCurrency(totalBalance)}</p>
                  </div>
                </div>
              </div>
              {/* Legend */}
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
                {chartData.map((d, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-[11px] text-muted-foreground">{d.name} ({(d.percent * 100).toFixed(0)}%)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
