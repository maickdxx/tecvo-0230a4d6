import { ArrowDownCircle, ArrowUpCircle, Wallet, CalendarDays, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface FinanceSummaryProps {
  income: number;
  expense: number;
  balance: number;
  pendingIncome?: number;
  forecastedRevenue?: number;
}

export function FinanceSummary({ income, expense, balance, pendingIncome = 0, forecastedRevenue = 0 }: FinanceSummaryProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  const cards = [
    {
      title: "Entradas (Pagas)",
      value: income,
      icon: ArrowUpCircle,
      color: "text-green-600",
      bgColor: "bg-green-100 dark:bg-green-900/30",
    },
    {
      title: "Saídas (Pagas)",
      value: expense,
      icon: ArrowDownCircle,
      color: "text-red-600",
      bgColor: "bg-red-100 dark:bg-red-900/30",
    },
    {
      title: "Saldo (Real)",
      value: balance,
      icon: Wallet,
      color: balance >= 0 ? "text-primary" : "text-red-600",
      bgColor: balance >= 0 ? "bg-primary/10" : "bg-red-100 dark:bg-red-900/30",
    },
    {
      title: "A Receber (Faturado)",
      value: pendingIncome,
      icon: TrendingUp,
      color: "text-blue-600",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
    },
    {
      title: "Receita Prevista (Potencial)",
      value: forecastedRevenue,
      icon: CalendarDays,
      color: "text-purple-600",
      bgColor: "bg-purple-100 dark:bg-purple-900/30",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.title} className="border-none shadow-sm ring-1 ring-border/40 overflow-hidden hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn("rounded-lg p-2.5", card.bgColor)}>
                <card.icon className={cn("h-5 w-5", card.color)} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate">{card.title}</p>
                <p className={cn("text-xl font-bold tabular-nums mt-0.5", card.color)}>
                  {formatCurrency(card.value)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
