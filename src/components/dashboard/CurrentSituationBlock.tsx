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
import { format, addDays } from "date-fns";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
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
  const { totalBalance, activeAccounts, isLoading: isLoadingAccounts } = useFinancialAccounts();

  const today = format(new Date(), "yyyy-MM-dd");
  const in15Days = format(addDays(new Date(), 15), "yyyy-MM-dd");

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
    <Card className="animate-fade-in mb-8 border-border/50 shadow-sm overflow-hidden rounded-2xl">
      <CardHeader className="pb-6 px-6 sm:px-8 pt-6 sm:pt-8 border-b border-border/40 bg-muted/20">
        <CardTitle className="flex items-center justify-between text-base font-bold flex-wrap gap-4 uppercase tracking-wider">
          <span className="flex items-center gap-2.5 text-muted-foreground/80">
            <Wallet className="h-4 w-4 text-primary/70" />
            Situação Atual
          </span>
          <Badge variant="outline" className={`border-none shadow-none font-bold text-[10px] tracking-[0.1em] px-3 py-1 ${forecast.className}`}>
            <ForecastIcon className="h-3.5 w-3.5 mr-1.5" />
            Previsão {forecast.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-8 p-6 sm:p-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5 entrance-stagger">
          {/* Saldo Consolidado */}
          <div className="rounded-2xl border border-border/40 p-5 bg-background transition-all duration-300 hover:shadow-sm">
            <p className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-[0.1em] mb-1">Saldo Consolidado</p>
            <p className={`text-3xl font-extrabold tracking-tight number-display mt-2 ${totalBalance >= 0 ? "text-success/90" : "text-destructive/90"}`}>
              {formatCurrency(totalBalance)}
            </p>
          </div>

          {/* Saldo por conta */}
          <div className="rounded-2xl border border-border/40 p-5 bg-background transition-all duration-300 hover:shadow-sm">
            <p className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-[0.1em] mb-3">Contas</p>
            {activeAccounts.length === 0 && (
              <p className="text-xs text-muted-foreground italic">Nenhuma conta ativa</p>
            )}
            <div className="space-y-2.5 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
              {activeAccounts.map((acc) => {
                const Icon = accountIcon[acc.account_type as AccountType] ?? Wallet;
                return (
                  <div key={acc.id} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-muted-foreground/70 font-medium truncate">
                      <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      <span className="truncate">{acc.name}</span>
                    </span>
                    <span className={`font-bold number-display shrink-0 ${Number(acc.balance) >= 0 ? "text-foreground/80" : "text-destructive/80"}`}>
                      {formatCurrency(Number(acc.balance))}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* A Pagar */}
          <div className="flex items-center gap-4 rounded-2xl bg-destructive/[0.02] border border-destructive/10 p-5 transition-all duration-300 hover:bg-destructive/[0.04]">
            <div className="rounded-xl bg-destructive/10 p-2.5">
              <ArrowDownCircle className="h-4 w-4 text-destructive/80" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-[0.1em]">A pagar (15d)</p>
              <p className="text-xl font-extrabold tracking-tight number-display text-foreground/90">{formatCurrency(totalPayable)}</p>
            </div>
          </div>

          {/* A Receber */}
          <div className="flex items-center gap-4 rounded-2xl bg-success/[0.02] border border-success/10 p-5 transition-all duration-300 hover:bg-success/[0.04]">
            <div className="rounded-xl bg-success/10 p-2.5">
              <ArrowUpCircle className="h-4 w-4 text-success/80" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-[0.1em]">A receber (15d)</p>
              <p className="text-xl font-extrabold tracking-tight number-display text-foreground/90">{formatCurrency(totalReceivable)}</p>
            </div>
          </div>

          {/* Fluxo Projetado */}
          <div className={`flex items-center gap-4 rounded-2xl p-5 border transition-all duration-300 ${projectedFlow >= 0 ? "bg-success/[0.04] border-success/10 hover:bg-success/[0.06]" : "bg-destructive/[0.04] border-destructive/10 hover:bg-destructive/[0.06]"}`}>
            <div className={`rounded-xl p-2.5 ${projectedFlow >= 0 ? "bg-success/10" : "bg-destructive/10"}`}>
              <FlowIcon className={`h-4 w-4 ${projectedFlow >= 0 ? "text-success/80" : "text-destructive/80"}`} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-[0.1em]">Fluxo projetado</p>
              <p className={`text-xl font-extrabold tracking-tight number-display ${projectedFlow >= 0 ? "text-success/90" : "text-destructive/90"}`}>
                {formatCurrency(projectedFlow)}
              </p>
            </div>
          </div>
        </div>

        {/* Alerta financeiro inline */}
        {totalPayable > totalReceivable && (
          <div className="flex items-start gap-4 rounded-2xl border border-warning/20 bg-warning/[0.03] p-5 shadow-sm">
            <AlertTriangle className="h-5 w-5 text-warning/70 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-warning/80">
                Alerta de Fluxo de Caixa
              </p>
              <p className="text-xs text-muted-foreground/70 leading-relaxed">
                Suas contas a pagar nos próximos 15 dias superam as previsões de recebimento. Sugerimos revisar prioridades de pagamento ou antecipar cobranças.
              </p>
            </div>
          </div>
        )}

        {/* Previsão de caixa descritiva */}
        {forecastLevel === "risk" && (
          <div className="flex items-start gap-4 rounded-2xl border border-destructive/20 bg-destructive/[0.03] p-5 shadow-sm">
            <Eye className="h-5 w-5 text-destructive/70 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-destructive/80">
                Risco Crítico de Caixa
              </p>
              <p className="text-xs text-muted-foreground/70 leading-relaxed">
                Risco de caixa negativo nos próximos 15 dias. Saldo projetado: <span className="font-bold">{formatCurrency(projectedBalance)}</span>. 
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}