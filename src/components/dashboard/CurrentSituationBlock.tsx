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
  CalendarDays,
  ArrowRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useFinancialAccounts, type AccountType } from "@/hooks/useFinancialAccounts";
import { useTransactions } from "@/hooks/useTransactions";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { format, addDays } from "date-fns";
import { useNavigate } from "react-router-dom";

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

  // Fetch services for forecasted revenue
  const { transactions: servicesData, isLoading: isLoadingServices } = useTransactions({
    startDate: today,
    endDate: in15Days,
    type: "income",
    dateField: "due_date", // We'll filter differently if needed, but for now let's see
  });

  // Actually we need the services hook to get scheduled value
  const dashboardMetrics = useDashboardMetrics(today, in15Days, today, today);

  const { totalPayable, totalReceivable, forecastedRevenue, projectedFlow, projectedBalance, forecastLevel } = useMemo(() => {
    const pending = (txs: typeof payables) =>
      txs.filter((t) => t.status === "pending" || t.status === "overdue").reduce((s, t) => s + Number(t.amount), 0);

    const tp = pending(payables);
    const tr = pending(receivables);
    const fr = dashboardMetrics?.forecastedRevenue || 0;

    // Projected Flow considers real money (A Receber - A Pagar)
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
      forecastedRevenue: fr,
      projectedFlow: pFlow,
      projectedBalance: pBalance,
      forecastLevel: forecast,
    };
  }, [payables, receivables, totalBalance, dashboardMetrics]);

  const forecast = forecastConfig[forecastLevel];
  const ForecastIcon = forecast.icon;
  const navigate = useNavigate();
  const isLoading = isLoadingAccounts || isLoadingPayables || isLoadingReceivables || dashboardMetrics.isLoading;
  const FlowIcon = projectedFlow >= 0 ? TrendingUp : TrendingDown;

  if (isLoading) return null;

  return (
    <Card className="animate-fade-in mb-6 border-none shadow-lg ring-1 ring-border/40 overflow-hidden">
      <CardHeader className="pb-6 px-6 pt-6">
        <CardTitle className="flex items-center justify-between text-base font-bold flex-wrap gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Wallet className="h-4 w-4 text-primary" />
            </div>
            <span className="tracking-tight opacity-90">Situação de Caixa</span>
          </div>
          <Badge variant="outline" className={cn("font-bold px-3 py-1 text-[10px] uppercase tracking-wider", forecast.className)}>
            <ForecastIcon className="h-3.5 w-3.5 mr-1.5" />
            Saúde {forecast.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-8 px-6 pb-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5 entrance-stagger">
          {/* Saldo Consolidado */}
          <div className="rounded-2xl bg-muted/20 border border-border/40 p-5 group hover:bg-muted/30 transition-all">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-70">Saldo Disponível</p>
            <p className={`text-3xl font-black tabular-nums mt-2 tracking-tight ${totalBalance >= 0 ? "text-foreground" : "text-destructive"}`}>
              {formatCurrency(totalBalance)}
            </p>
          </div>

          {/* Saldo por conta */}
          <div className="rounded-2xl border border-border/40 p-5 group hover:bg-muted/5 transition-all">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-70 mb-3">Contas Ativas</p>
            {activeAccounts.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhuma conta cadastrada</p>
            )}
            <div className="space-y-2.5 max-h-32 overflow-y-auto pr-1 scrollbar-thin">
              {activeAccounts.map((acc) => {
                const Icon = accountIcon[acc.account_type as AccountType] ?? Wallet;
                return (
                  <div key={acc.id} className="flex items-center justify-between text-[13px]">
                    <span className="flex items-center gap-2 text-muted-foreground/80 truncate">
                      <Icon className="h-3.5 w-3.5 shrink-0 opacity-60" />
                      <span className="truncate font-medium">{acc.name}</span>
                    </span>
                    <span className={`font-bold tabular-nums shrink-0 ${Number(acc.balance) >= 0 ? "text-foreground/90" : "text-destructive"}`}>
                      {formatCurrency(Number(acc.balance))}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* A Pagar */}
          <div className="flex flex-col justify-between rounded-2xl bg-destructive/[0.03] border border-destructive/10 p-5 group hover:bg-destructive/[0.06] transition-all">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold text-destructive/80 uppercase tracking-widest">A pagar (15d)</p>
              <div className="rounded-full bg-destructive/10 p-1.5 group-hover:scale-110 transition-transform">
                <ArrowDownCircle className="h-4 w-4 text-destructive" />
              </div>
            </div>
            <p className="text-2xl font-black tabular-nums text-foreground tracking-tight">{formatCurrency(totalPayable)}</p>
          </div>

          {/* A Receber */}
          <div className="flex flex-col justify-between rounded-2xl bg-success/[0.03] border border-success/10 p-5 group hover:bg-success/[0.06] transition-all">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold text-success/80 uppercase tracking-widest">A receber (15d)</p>
              <div className="rounded-full bg-success/10 p-1.5 group-hover:scale-110 transition-transform">
                <ArrowUpCircle className="h-4 w-4 text-success" />
              </div>
            </div>
            <p className="text-2xl font-black tabular-nums text-foreground tracking-tight">{formatCurrency(totalReceivable)}</p>
          </div>

          {/* Fluxo Projetado */}
          <div className={cn(
            "flex flex-col justify-between rounded-2xl p-5 border transition-all",
            projectedFlow >= 0 
              ? "bg-primary/[0.03] border-primary/10 group hover:bg-primary/[0.06]" 
              : "bg-destructive/[0.03] border-destructive/10 group hover:bg-destructive/[0.06]"
          )}>
            <div className="flex items-center justify-between mb-3">
              <p className={cn(
                "text-[10px] font-bold uppercase tracking-widest",
                projectedFlow >= 0 ? "text-primary/80" : "text-destructive/80"
              )}>
                Fluxo (15d)
              </p>
              <div className={cn(
                "rounded-full p-1.5 group-hover:scale-110 transition-transform",
                projectedFlow >= 0 ? "bg-primary/10" : "bg-destructive/10"
              )}>
                <FlowIcon className={cn("h-4 w-4", projectedFlow >= 0 ? "text-primary" : "text-destructive")} />
              </div>
            </div>
            <p className={cn(
              "text-2xl font-black tabular-nums tracking-tight",
              projectedFlow >= 0 ? "text-primary" : "text-destructive"
            )}>
              {formatCurrency(projectedFlow)}
            </p>
          </div>
        </div>

        {/* Alertas dinâmicos com design refinado */}
        {(totalPayable > totalReceivable || forecastLevel === "risk") && (
          <div className="grid gap-4 sm:grid-cols-2">
            {totalPayable > totalReceivable && (
              <div className="flex items-start gap-3.5 rounded-2xl border border-warning/20 bg-warning/5 p-4.5 group hover:bg-warning/[0.08] transition-all">
                <div className="p-2 rounded-xl bg-warning/10 text-warning shrink-0">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <p className="text-[13px] font-bold text-warning tracking-tight">
                    Equilíbrio de Contas
                  </p>
                  <p className="text-[11px] text-muted-foreground/80 font-medium leading-relaxed">
                    Pagamentos superam recebimentos em <span className="text-warning font-bold">{formatCurrency(totalPayable - totalReceivable)}</span> nos próximos 15 dias.
                  </p>
                </div>
              </div>
            )}

            {forecastLevel === "risk" && (
              <div className="flex items-start gap-3.5 rounded-2xl border border-destructive/20 bg-destructive/5 p-4.5 group hover:bg-destructive/[0.08] transition-all">
                <div className="p-2 rounded-xl bg-destructive/10 text-destructive shrink-0">
                  <Eye className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <p className="text-[13px] font-bold text-destructive tracking-tight">
                    Risco de Liquidez
                  </p>
                  <p className="text-[11px] text-muted-foreground/80 font-medium leading-relaxed">
                    Saldo projetado crítico: <span className="text-destructive font-bold">{formatCurrency(projectedBalance)}</span>. Sugerimos antecipar cobranças.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}