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
    <Card className="animate-fade-in mb-12 border-border/40 shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden rounded-[2.5rem] bg-card transition-all duration-500 hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] group">
      <CardHeader className="pb-8 px-10 sm:px-12 pt-10 sm:pt-12 border-b border-border/10 bg-muted/[0.05] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16" />
        <CardTitle className="flex items-center justify-between text-base font-black flex-wrap gap-6 uppercase tracking-[0.2em] relative">
          <span className="flex items-center gap-3 text-foreground/80">
            <div className="p-2 rounded-xl bg-primary/10 shadow-sm">
              <Wallet className="h-4 w-4 text-primary" />
            </div>
            Situação Patrimonial
          </span>
          <Badge variant="outline" className={`border-none shadow-sm font-black text-[10px] tracking-[0.15em] px-5 py-2 rounded-full transition-all duration-300 group-hover:scale-105 ${forecast.className}`}>
            <ForecastIcon className="h-4 w-4 mr-2" />
            Previsão {forecast.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-12 p-10 sm:p-12 bg-gradient-to-b from-transparent to-muted/[0.02]">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5 entrance-stagger">
          {/* Saldo Consolidado */}
          <div className="rounded-[1.5rem] border border-border/60 p-7 bg-background shadow-sm transition-all duration-500 hover:shadow-md hover:border-primary/20 hover:-translate-y-1 group/item">
            <p className="text-[10px] text-muted-foreground/40 font-black uppercase tracking-[0.2em] mb-2 group-hover/item:text-primary/60 transition-colors">Saldo Consolidado</p>
            <p className={`text-4xl font-black tracking-tighter number-display mt-3 ${totalBalance >= 0 ? "text-success bg-gradient-to-br from-success to-success/60 bg-clip-text text-transparent" : "text-destructive"}`}>
              {formatCurrency(totalBalance)}
            </p>
          </div>

          {/* Saldo por conta */}
          <div className="rounded-[1.5rem] border border-border/60 p-7 bg-background shadow-sm transition-all duration-500 hover:shadow-md hover:-translate-y-1">
            <p className="text-[10px] text-muted-foreground/40 font-black uppercase tracking-[0.2em] mb-4">Portfólio de Contas</p>
            {activeAccounts.length === 0 && (
              <p className="text-xs text-muted-foreground italic">Nenhuma conta ativa</p>
            )}
            <div className="space-y-3.5 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
              {activeAccounts.map((acc) => {
                const Icon = accountIcon[acc.account_type as AccountType] ?? Wallet;
                return (
                  <div key={acc.id} className="flex items-center justify-between text-[11px] group/account">
                    <span className="flex items-center gap-2.5 text-muted-foreground/70 font-bold truncate group-hover/account:text-foreground/80 transition-colors">
                      <Icon className="h-4 w-4 shrink-0 opacity-40 group-hover/account:opacity-80 transition-opacity" />
                      <span className="truncate tracking-tight">{acc.name}</span>
                    </span>
                    <span className={`font-black number-display shrink-0 tracking-tight ${Number(acc.balance) >= 0 ? "text-foreground/90" : "text-destructive/90"}`}>
                      {formatCurrency(Number(acc.balance))}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* A Pagar */}
          <div className="flex items-center gap-5 rounded-[1.5rem] bg-destructive/[0.01] border border-destructive/10 p-7 transition-all duration-500 hover:bg-destructive/[0.03] hover:-translate-y-1 group/item">
            <div className="rounded-2xl bg-destructive/10 p-3.5 shadow-sm ring-4 ring-destructive/[0.02]">
              <ArrowDownCircle className="h-5 w-5 text-destructive/80" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground/40 font-black uppercase tracking-[0.2em] mb-1">A pagar (15d)</p>
              <p className="text-2xl font-black tracking-tight number-display text-foreground/90">{formatCurrency(totalPayable)}</p>
            </div>
          </div>

          {/* A Receber */}
          <div className="flex items-center gap-5 rounded-[1.5rem] bg-success/[0.01] border border-success/10 p-7 transition-all duration-500 hover:bg-success/[0.03] hover:-translate-y-1 group/item">
            <div className="rounded-2xl bg-success/10 p-3.5 shadow-sm ring-4 ring-success/[0.02]">
              <ArrowUpCircle className="h-5 w-5 text-success/80" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground/40 font-black uppercase tracking-[0.2em] mb-1">A receber (15d)</p>
              <p className="text-2xl font-black tracking-tight number-display text-foreground/90">{formatCurrency(totalReceivable)}</p>
            </div>
          </div>

          {/* Fluxo Projetado */}
          <div className={`flex items-center gap-5 rounded-[1.5rem] p-7 border transition-all duration-500 hover:-translate-y-1 shadow-sm ${projectedFlow >= 0 ? "bg-success/[0.02] border-success/10 hover:bg-success/[0.05] hover:shadow-success/5" : "bg-destructive/[0.02] border-destructive/10 hover:bg-destructive/[0.05] hover:shadow-destructive/5"}`}>
            <div className={`rounded-2xl p-3.5 shadow-sm ${projectedFlow >= 0 ? "bg-success/10 ring-4 ring-success/[0.02]" : "bg-destructive/10 ring-4 ring-destructive/[0.02]"}`}>
              <FlowIcon className={`h-5 w-5 ${projectedFlow >= 0 ? "text-success/80" : "text-destructive/80"}`} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground/40 font-black uppercase tracking-[0.2em] mb-1">Fluxo projetado</p>
              <p className={`text-2xl font-black tracking-tight number-display ${projectedFlow >= 0 ? "text-success bg-gradient-to-br from-success to-success/60 bg-clip-text text-transparent" : "text-destructive"}`}>
                {formatCurrency(projectedFlow)}
              </p>
            </div>
          </div>
        </div>

        {/* Alerta financeiro inline */}
        {totalPayable > totalReceivable && (
          <div className="flex items-start gap-6 rounded-[1.5rem] border border-warning/20 bg-warning/[0.02] p-7 shadow-sm transition-all duration-300 hover:bg-warning/[0.04]">
            <div className="p-2.5 rounded-xl bg-warning/10 mt-0.5 shadow-sm">
              <AlertTriangle className="h-6 w-6 text-warning/70 shrink-0" />
            </div>
            <div className="space-y-2">
              <p className="text-[13px] font-black uppercase tracking-[0.1em] text-warning/80">
                Alerta de Saúde Financeira
              </p>
              <p className="text-[13px] text-muted-foreground/60 leading-relaxed font-medium">
                Atenção estratégica: as obrigações para o próximo ciclo de 15 dias superam a receita prevista. <span className="text-warning/60 font-bold">Recomendamos otimizar prioridades ou acelerar recebimentos.</span>
              </p>
            </div>
          </div>
        )}

        {/* Previsão de caixa descritiva */}
        {forecastLevel === "risk" && (
          <div className="flex items-start gap-6 rounded-[1.5rem] border border-destructive/20 bg-destructive/[0.02] p-7 shadow-sm transition-all duration-300 hover:bg-destructive/[0.04]">
            <div className="p-2.5 rounded-xl bg-destructive/10 mt-0.5 shadow-sm">
              <Eye className="h-6 w-6 text-destructive/70 shrink-0" />
            </div>
            <div className="space-y-2">
              <p className="text-[13px] font-black uppercase tracking-[0.1em] text-destructive/80">
                Monitoramento de Risco Crítico
              </p>
              <p className="text-[13px] text-muted-foreground/60 leading-relaxed font-medium">
                Identificamos uma exposição de caixa negativa no horizonte de 15 dias. Saldo projetado: <span className="font-black text-destructive/80">{formatCurrency(projectedBalance)}</span>. 
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}