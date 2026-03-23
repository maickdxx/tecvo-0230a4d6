import { ArrowDownCircle, ArrowUpCircle, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface FinanceSummaryProps {
  income: number;
  expense: number;
  balance: number;
}

export function FinanceSummary({ income, expense, balance }: FinanceSummaryProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const cards = [
    {
      title: "Entradas",
      value: income,
      icon: ArrowUpCircle,
      color: "text-green-600",
      bgColor: "bg-green-100 dark:bg-green-900/30",
    },
    {
      title: "Saídas",
      value: expense,
      icon: ArrowDownCircle,
      color: "text-red-600",
      bgColor: "bg-red-100 dark:bg-red-900/30",
    },
    {
      title: "Saldo",
      value: balance,
      icon: Wallet,
      color: balance >= 0 ? "text-primary" : "text-red-600",
      bgColor: balance >= 0 ? "bg-primary/10" : "bg-red-100 dark:bg-red-900/30",
    },
  ];

  return (
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
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
