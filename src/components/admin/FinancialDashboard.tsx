import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, Users, TriangleAlert as AlertTriangle, Calendar, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface OverdueAccount {
  id: string;
  organizationName: string;
  plan: string;
  amount: number;
  daysOverdue: number;
  lastPayment: string;
}

export function FinancialDashboard() {
  const overdueAccounts: OverdueAccount[] = [
    {
      id: "1",
      organizationName: "Tech Solutions Ltda",
      plan: "Pro",
      amount: 397,
      daysOverdue: 15,
      lastPayment: "2024-02-10",
    },
    {
      id: "2",
      organizationName: "Serviços Express",
      plan: "Essential",
      amount: 197,
      daysOverdue: 7,
      lastPayment: "2024-02-18",
    },
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const mrr = 15740;
  const arr = mrr * 12;
  const averageTicket = 263;
  const totalOverdue = overdueAccounts.reduce((sum, acc) => sum + acc.amount, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-primary bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(mrr)}</div>
            <p className="text-xs text-muted-foreground">
              Receita mensal recorrente
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ARR</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(arr)}</div>
            <p className="text-xs text-muted-foreground">
              Receita anual recorrente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(averageTicket)}</div>
            <p className="text-xs text-muted-foreground">
              Por assinante
            </p>
          </CardContent>
        </Card>

        <Card className="border-destructive bg-destructive/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inadimplentes</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalOverdue)}</div>
            <p className="text-xs text-muted-foreground">
              {overdueAccounts.length} contas
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Contas Inadimplentes</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Empresas com pagamentos em atraso
              </p>
            </div>
            <Button variant="outline" size="sm">
              Exportar Relatório
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Dias em Atraso</TableHead>
                <TableHead>Último Pagamento</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overdueAccounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell>
                    <div className="font-medium">{account.organizationName}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{account.plan}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(account.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="destructive"
                      className={account.daysOverdue > 10 ? "" : "bg-yellow-600"}
                    >
                      {account.daysOverdue} dias
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {new Date(account.lastPayment).toLocaleDateString("pt-BR")}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">
                        Enviar Lembrete
                      </Button>
                      <Button variant="ghost" size="sm">
                        Bloquear
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Pagamentos Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { org: "ABC Refrigeração", plan: "Pro", amount: 397, date: "2024-03-15" },
                { org: "Tech Services", plan: "Essential", amount: 197, date: "2024-03-14" },
                { org: "Clima Total", plan: "Pro", amount: 397, date: "2024-03-13" },
                { org: "Serviços XYZ", plan: "Starter", amount: 97, date: "2024-03-13" },
              ].map((payment, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">{payment.org}</div>
                      <div className="text-sm text-muted-foreground">
                        Plano {payment.plan}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-green-600">
                      {formatCurrency(payment.amount)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(payment.date).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Receita por Plano</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Pro</span>
                  <span className="text-sm text-muted-foreground">
                    {formatCurrency(397 * 23)}
                  </span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: "58%" }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Essential</span>
                  <span className="text-sm text-muted-foreground">
                    {formatCurrency(197 * 42)}
                  </span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-chart-2 rounded-full" style={{ width: "34%" }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Starter</span>
                  <span className="text-sm text-muted-foreground">
                    {formatCurrency(97 * 15)}
                  </span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-chart-3 rounded-full" style={{ width: "8%" }} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
