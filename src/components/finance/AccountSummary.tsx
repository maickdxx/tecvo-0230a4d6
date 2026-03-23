import { Card, CardContent } from "@/components/ui/card";
import { Clock, CheckCircle2, AlertCircle, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AccountType } from "@/hooks/useAccounts";

interface AccountSummaryProps {
  pending: number;
  paid: number;
  overdue: number;
  total: number;
  accountType: AccountType;
}

export function AccountSummary({
  pending,
  paid,
  overdue,
  total,
  accountType,
}: AccountSummaryProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const isPagar = accountType === "payable";

  const cards = [
    {
      label: isPagar ? "Total a Pagar" : "Total a Receber",
      value: pending + overdue,
      icon: Wallet,
      className: "text-foreground",
      bgClassName: "bg-primary/10",
    },
    {
      label: "Pendentes",
      value: pending,
      icon: Clock,
      className: "text-amber-600",
      bgClassName: "bg-amber-500/10",
    },
    {
      label: isPagar ? "Pagos" : "Recebidos",
      value: paid,
      icon: CheckCircle2,
      className: "text-green-600",
      bgClassName: "bg-green-500/10",
    },
    {
      label: "Atrasados",
      value: overdue,
      icon: AlertCircle,
      className: "text-destructive",
      bgClassName: "bg-destructive/10",
    },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2.5">
              <div className={cn("p-1.5 rounded-lg", card.bgClassName)}>
                <card.icon className={cn("h-4 w-4", card.className)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">{card.label}</p>
                <p className={cn("text-base font-bold", card.className)}>
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
