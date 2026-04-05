import { useMemo } from "react";
import {
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  ShieldAlert,
  ShieldCheck,
  Shield,
  Landmark,
  Banknote,
  CreditCard,
  Smartphone,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useFinancialAccounts, type AccountType } from "@/hooks/useFinancialAccounts";
import { useTransactions } from "@/hooks/useTransactions";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { getTodayInTz } from "@/lib/timezone";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function addDaysToDateStr(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day + days);
  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

const accountIcon: Record<AccountType, typeof Wallet> = {
  cash: Banknote,
  bank: Landmark,
  digital: Smartphone,
  card: CreditCard,
};

type ForecastLevel = "positive" | "balanced" | "risk";

const forecastConfig: Record<ForecastLevel, { label: string; icon: typeof ShieldCheck; className: string }> = {
  positive: { label: "Positiva", icon: ShieldCheck, className: "bg-success/10 text-success border-success/20" },
  balanced: { label: "Equilibrada", icon: Shield, className: "bg-warning/10 text-warning border-warning/20" },
  risk: { label: "Em risco", icon: ShieldAlert, className: "bg-destructive/10 text-destructive border-destructive/20" },
};

export function CurrentSituationBlock() {
  const tz = useOrgTimezone();
  const { totalBalance, activeAccounts, isLoading: isLoadingAccounts } = useFinancialAccounts();

  const today = useMemo(() => getTodayInTz(tz), [tz]);
  const in15Days = useMemo(() => addDaysToDateStr(today, 15), [today]);

  const { transactions: payables, isLoading: isLoadingPayables } = useTransactions({
    startDate: today,
    endDate: in15Days,
    type: "expense",
    dateField: "due_date",
  });

  const { transactions: receivables, isLoading: isLoadingReceivables } = useTransactions({
    startDate: today,
    endDate: in15Days,
    type: "income",
    dateField: "due_date",
  });

  const { totalPayable, totalReceivable, projectedFlow, projectedBalance, forecastLevel } = useMemo(() => {
    const pending = (txs: typeof payables) =>
      txs.filter((t) => t.status === "pending" || t.status === "overdue").reduce((s, t) => s + Number(t.amount), 0);

    const tp = pending(payables);
    const tr = pending(receivables);

    const pFlow = tr - tp;
    const pBalance = totalBalance + tr - tp;

    let forecast: ForecastLevel = "positive";
    if (pBalance <= 0) {
      forecast = "risk";
    } else if (tp > 0 && totalBalance / tp < 1) {
      forecast = "balanced";
    }

    return {
      totalPayable: tp,
      totalReceivable: tr,
      projectedFlow: pFlow,
      projectedBalance: pBalance,
      forecastLevel: forecast,
    };
  }, [payables, receivables, totalBalance]);

  const forecast = forecastConfig[forecastLevel];
  const ForecastIcon = forecast.icon;
  const isLoading = isLoadingAccounts || isLoadingPayables || isLoadingReceivables;
  const FlowIcon = projectedFlow >= 0 ? TrendingUp : TrendingDown;

  if (isLoading) return null;

  return (
    <Card className="animate-fade-in mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base font-semibold flex-wrap gap-2">
          <span className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            Situação Atual
          </span>
          <Badge variant="outline" className={forecast.className}>
            <ForecastIcon className="h-3 w-3 mr-1" />
            Previsão {forecast.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 entrance-stagger">
          {/* Saldo Consolidado */}
          <div className="rounded-xl border p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Saldo Consolidado</p>
            <p className={`text-2xl number-display mt-1 ${totalBalance >= 0 ? "text-success" : "text-destructive"}`}>
              {formatCurrency(totalBalance)}
            </p>
          </div>

          {/* Saldo por conta */}
          <div className="rounded-xl border p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Contas</p>
            {activeAccounts.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhuma conta cadastrada</p>
            )}
            <div className="space-y-1.5 max-h-28 overflow-y-auto">
              {activeAccounts.map((acc) => {
                const Icon = accountIcon[acc.account_type as AccountType] ?? Wallet;
                return (
                  <div key={acc.id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground truncate">
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{acc.name}</span>
                    </span>
                    <span className={`number-display shrink-0 ${Number(acc.balance) >= 0 ? "text-foreground" : "text-destructive"}`}>
                      {formatCurrency(Number(acc.balance))}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* A Pagar */}
          <div className="flex items-center gap-3 rounded-xl bg-destructive/5 border border-destructive/10 p-3">
            <div className="rounded-lg bg-destructive/10 p-2">
              <ArrowDownCircle className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">A pagar (15d)</p>
              <p className="text-lg number-display text-card-foreground">{formatCurrency(totalPayable)}</p>
            </div>
          </div>

          {/* A Receber */}
          <div className="flex items-center gap-3 rounded-xl bg-success/5 border border-success/10 p-3">
            <div className="rounded-lg bg-success/10 p-2">
              <ArrowUpCircle className="h-4 w-4 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">A receber (15d)</p>
              <p className="text-lg number-display text-card-foreground">{formatCurrency(totalReceivable)}</p>
            </div>
          </div>

          {/* Fluxo Projetado */}
          <div className={`flex items-center gap-3 rounded-xl p-3 border ${projectedFlow >= 0 ? "bg-success/5 border-success/10" : "bg-destructive/5 border-destructive/10"}`}>
            <div className={`rounded-lg p-2 ${projectedFlow >= 0 ? "bg-success/10" : "bg-destructive/10"}`}>
              <FlowIcon className={`h-4 w-4 ${projectedFlow >= 0 ? "text-success" : "text-destructive"}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Fluxo projetado (15d)</p>
              <p className={`text-lg number-display ${projectedFlow >= 0 ? "text-success" : "text-destructive"}`}>
                {formatCurrency(projectedFlow)}
              </p>
            </div>
          </div>
        </div>

        {/* Alerta financeiro inline */}
        {totalPayable > totalReceivable && (
          <div className="flex items-start gap-3 rounded-xl border border-warning/20 bg-warning/5 p-3.5">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-warning">
                Atenção: suas contas a pagar nos próximos 15 dias são maiores que os valores a receber.
              </p>
              <p className="text-xs text-muted-foreground">
                Sugestão: confirme serviços pendentes ou antecipe cobranças.
              </p>
            </div>
          </div>
        )}

        {/* Previsão de caixa descritiva */}
        {forecastLevel === "risk" && (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3.5">
            <Eye className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-destructive">
                Risco de caixa negativo nos próximos 15 dias.
              </p>
              <p className="text-xs text-muted-foreground">
                Saldo projetado: {formatCurrency(projectedBalance)}. Revise despesas ou antecipe recebimentos.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}