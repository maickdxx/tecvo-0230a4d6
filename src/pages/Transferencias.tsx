import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppLayout } from "@/components/layout";
import { ArrowRightLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TransferDialog } from "@/components/finance/TransferDialog";
import { useTransactions } from "@/hooks/useTransactions";
import { useFinancialAccounts } from "@/hooks/useFinancialAccounts";

export default function Transferencias() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { transactions, isLoading } = useTransactions();
  const { activeAccounts } = useFinancialAccounts();

  const transfers = transactions.filter((t) => t.category === "transfer");

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const getAccountName = (accountId: string | null) => {
    if (!accountId) return "—";
    return activeAccounts.find((a) => a.id === accountId)?.name || "—";
  };

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ArrowRightLeft className="h-6 w-6" />
            Transferências entre Contas
          </h1>
          <p className="text-muted-foreground">Movimentação de saldo entre suas contas financeiras</p>
        </div>
        <Button className="gap-2" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Nova Transferência
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : transfers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 p-12">
          <ArrowRightLeft className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Nenhuma transferência</h3>
          <p className="text-muted-foreground text-center max-w-md">
            Realize transferências entre suas contas financeiras para organizar seu fluxo de caixa.
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="hidden sm:table-cell">Observação</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfers.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(t.date), "dd/MM/yyyy", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="font-medium">
                    {getAccountName(t.financial_account_id)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.type === "expense" ? "destructive" : "default"} className="font-normal">
                      {t.type === "expense" ? "Saída" : "Entrada"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    {t.notes || "—"}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(Number(t.amount))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <TransferDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </AppLayout>
  );
}
