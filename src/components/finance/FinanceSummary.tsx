import { ArrowDownCircle, ArrowUpCircle, Wallet, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface FinanceSummaryProps {
  income: number;
  expense: number;
  balance: number;
  pendingIncome?: number;
  pendingExpense?: number;
  pendingCount?: number;
}

export function FinanceSummary({ income, expense, balance, pendingIncome, pendingExpense, pendingCount }: FinanceSummaryProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const hasPending = pendingCount && pendingCount > 0;

  const cards = [
    {
      title: "Entradas (Aprovadas)",
      value: income,
      icon: ArrowUpCircle,
      color: "text-green-600",
      bgColor: "bg-green-100 dark:bg-green-900/30",
      pending: pendingIncome,
    },
    {
      title: "Saídas (Aprovadas)",
      value: expense,
      icon: ArrowDownCircle,
      color: "text-red-600",
      bgColor: "bg-red-100 dark:bg-red-900/30",
      pending: pendingExpense,
    },
    {
      title: "Saldo Consolidado",
      value: balance,
      icon: Wallet,
      color: balance >= 0 ? "text-primary" : "text-red-600",
      bgColor: balance >= 0 ? "bg-primary/10" : "bg-red-100 dark:bg-red-900/30",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn("rounded-lg p-2", card.bgColor)}>
                  <card.icon className={cn("h-5 w-5", card.color)} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{card.title}</p>
                  <p className={cn("text-xl font-bold", card.color)}>
                    {formatCurrency(card.value)}
                  </p>
                  {card.pending !== undefined && card.pending > 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                      + {formatCurrency(card.pending)} pendente
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {hasPending && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="p-3 flex items-center gap-3">
            <Clock className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              <strong>{pendingCount}</strong> transação(ões) aguardando aprovação financeira.
              <a href="/financeiro/aprovacoes" className="ml-1 underline font-medium hover:text-amber-800">
                Revisar agora →
              </a>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
