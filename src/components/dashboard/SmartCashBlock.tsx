import { useMemo } from "react";
import { Wallet, ArrowDownCircle, ArrowUpCircle, ShieldAlert, ShieldCheck, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useFinancialAccounts } from "@/hooks/useFinancialAccounts";
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

export function SmartCashBlock() {
  const { totalBalance, isLoading: isLoadingAccounts } = useFinancialAccounts();

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

  const { totalPayable, totalReceivable, riskLevel } = useMemo(() => {
    const pending = (txs: typeof payables) =>
      txs.filter((t) => (t.status === "pending" || t.status === "overdue") && (t.approval_status === 'approved' || !t.approval_status)).reduce((s, t) => s + Number(t.amount), 0);

    const tp = pending(payables);
    const tr = pending(receivables);

    let risk: "low" | "medium" | "high" = "low";
    if (tp > 0) {
      const ratio = totalBalance / tp;
      if (ratio < 0.5) risk = "high";
      else if (ratio < 1) risk = "medium";
    }

    return { totalPayable: tp, totalReceivable: tr, riskLevel: risk };
  }, [payables, receivables, totalBalance]);

  const riskConfig = {
    low: { label: "Baixo", icon: ShieldCheck, className: "bg-success/10 text-success border-success/20", borderColor: "border-l-success" },
    medium: { label: "Médio", icon: Shield, className: "bg-warning/10 text-warning border-warning/20", borderColor: "border-l-warning" },
    high: { label: "Alto", icon: ShieldAlert, className: "bg-destructive/10 text-destructive border-destructive/20", borderColor: "border-l-destructive" },
  };

  const risk = riskConfig[riskLevel];
  const RiskIcon = risk.icon;
  const isLoading = isLoadingAccounts || isLoadingPayables || isLoadingReceivables;

  if (isLoading) return null;

  return (
    <Card className={`border-l-4 ${risk.borderColor} animate-fade-in`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Wallet className="h-4 w-4 text-primary" />
          Caixa Inteligente
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {/* Saldo */}
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Saldo Atual</p>
            <p className={`text-2xl number-display ${totalBalance >= 0 ? "text-success" : "text-destructive"}`}>
              {formatCurrency(totalBalance)}
            </p>
          </div>

          {/* Risco */}
          <div className="flex flex-col items-end">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Risco de Caixa</p>
            <Badge variant="outline" className={`mt-1 ${risk.className}`}>
              <RiskIcon className="h-3 w-3 mr-1" />
              {risk.label}
            </Badge>
          </div>

          {/* A Pagar */}
          <div className="flex items-center gap-2 rounded-xl bg-destructive/5 border border-destructive/10 p-2.5">
            <div className="rounded-lg bg-destructive/10 p-1.5">
              <ArrowDownCircle className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">A pagar (15d)</p>
              <p className="text-sm number-display text-card-foreground">{formatCurrency(totalPayable)}</p>
            </div>
          </div>

          {/* A Receber */}
          <div className="flex items-center gap-2 rounded-xl bg-success/5 border border-success/10 p-2.5">
            <div className="rounded-lg bg-success/10 p-1.5">
              <ArrowUpCircle className="h-4 w-4 text-success" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">A receber (15d)</p>
              <p className="text-sm number-display text-card-foreground">{formatCurrency(totalReceivable)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
