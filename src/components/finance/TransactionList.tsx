import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowDownCircle, ArrowUpCircle, ArrowRightLeft } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/hooks/useTransactions";
import { CATEGORY_LABELS } from "@/hooks/useTransactions";
import type { FinancialAccount } from "@/hooks/useFinancialAccounts";

function getOriginLabel(t: Transaction): { label: string; variant: "default" | "secondary" | "outline" } {
  if (t.category === "transfer") return { label: "Transferência", variant: "outline" };
  if (t.service_id) return { label: "OS", variant: "default" };
  return { label: "Manual", variant: "secondary" };
}

interface TransactionListProps {
  transactions: Transaction[];
  isLoading: boolean;
  accounts?: FinancialAccount[];
}

export function TransactionList({
  transactions,
  isLoading,
  accounts = [],
}: TransactionListProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const formatDate = (date: string) =>
    format(new Date(date), "dd/MM/yyyy", { locale: ptBR });

  const getAccountName = (id: string | null) => {
    if (!id) return "—";
    return accounts.find((a) => a.id === id)?.name || "—";
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 p-12">
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Nenhuma transação encontrada
        </h3>
        <p className="text-muted-foreground text-center max-w-md">
          As transações aparecerão aqui automaticamente conforme o uso do sistema
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"></TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead className="hidden sm:table-cell">Categoria</TableHead>
            <TableHead className="hidden md:table-cell">Conta</TableHead>
            <TableHead className="hidden lg:table-cell">Origem</TableHead>
            <TableHead className="hidden md:table-cell">Data</TableHead>
            <TableHead className="text-right">Valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((transaction) => {
            const origin = getOriginLabel(transaction);
            const isTransfer = transaction.category === "transfer";

            return (
              <TableRow key={transaction.id}>
                <TableCell>
                  {isTransfer ? (
                    <ArrowRightLeft className="h-5 w-5 text-blue-500" />
                  ) : transaction.type === "income" ? (
                    <ArrowUpCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <ArrowDownCircle className="h-5 w-5 text-red-500" />
                  )}
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium truncate max-w-[200px]">
                      {transaction.description}
                    </p>
                    <p className="text-xs text-muted-foreground sm:hidden">
                      {formatDate(transaction.date)}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Badge variant="secondary" className="font-normal">
                    {CATEGORY_LABELS[transaction.category] || transaction.category}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">
                  {getAccountName(transaction.financial_account_id)}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <Badge variant={origin.variant} className="font-normal">
                    {origin.label}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">
                  {formatDate(transaction.date)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-semibold",
                    isTransfer
                      ? "text-blue-600"
                      : transaction.type === "income" ? "text-green-600" : "text-red-600"
                  )}
                >
                  {transaction.type === "income" ? "+" : "-"}
                  {formatCurrency(Number(transaction.amount))}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
