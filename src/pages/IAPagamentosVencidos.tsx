import { useMemo } from "react";
import { AppLayout } from "@/components/layout";
import { useTransactions } from "@/hooks/useTransactions";
import { useClients } from "@/hooks/useClients";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, AlertTriangle, CheckCircle, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getTodayInTz } from "@/lib/timezone";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { differenceInDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function IAPagamentosVencidos() {
  const navigate = useNavigate();
  const tz = useOrgTimezone();
  const { transactions, update } = useTransactions();
  const { clients } = useClients();

  const clientMap = useMemo(() => {
    const m: Record<string, string> = {};
    (clients || []).forEach((c) => (m[c.id] = c.name));
    return m;
  }, [clients]);

  const data = useMemo(() => {
    const now = new Date();
    return (transactions || [])
      .filter(
        (t) =>
          t.type === "income" &&
          t.status === "pending" &&
          t.due_date &&
          new Date(t.due_date) < now
      )
      .map((t) => ({
        ...t,
        daysOverdue: differenceInDays(now, new Date(t.due_date!)),
        clientName: t.client_id ? clientMap[t.client_id] || "—" : "—",
      }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [transactions, clientMap]);

  const total = data.reduce((s, t) => s + t.amount, 0);

  const handleMarkPaid = async (id: string) => {
    await update({
      id,
      data: {
        status: "paid",
        payment_date: getTodayInTz(tz),
      },
    });
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Pagamentos Vencidos</h1>
            <p className="text-sm text-muted-foreground">
              Contas a receber com vencimento ultrapassado
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                {data.length} pagamento{data.length !== 1 ? "s" : ""} vencido{data.length !== 1 ? "s" : ""}
              </CardTitle>
              <Badge variant="destructive" className="text-sm">
                Total: R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {data.length === 0 ? (
              <p className="text-muted-foreground text-sm p-6">Nenhum pagamento vencido. 🎉</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-center">Dias em Atraso</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.description}</TableCell>
                      <TableCell>{t.clientName}</TableCell>
                      <TableCell>
                        {format(new Date(t.due_date!), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="destructive">{t.daysOverdue}d</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        R$ {t.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" onClick={() => handleMarkPaid(t.id)}>
                            <CheckCircle className="h-3.5 w-3.5 mr-1" /> Pago
                          </Button>
                          <Button size="sm" variant="ghost" title="Enviar cobrança (em breve)">
                            <MessageCircle className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
