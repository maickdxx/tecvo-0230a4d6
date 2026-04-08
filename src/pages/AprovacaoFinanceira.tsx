import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePendingApprovals, usePendingApprovalSummary, useTransactionApproval } from "@/hooks/useTransactionApproval";
import { CATEGORY_LABELS } from "@/hooks/useTransactions";
import { useNavigate } from "react-router-dom";

const ORIGIN_LABELS: Record<string, string> = {
  laura: "Laura (IA)",
  employee: "Funcionário",
  panel: "Painel",
  automation: "Automação",
  system: "Sistema",
};

export default function AprovacaoFinanceira() {
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [originFilter, setOriginFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingIds, setRejectingIds] = useState<string[]>([]);

  const today = format(new Date(), "yyyy-MM-dd");
  const { data: pendingTransactions = [], isLoading } = usePendingApprovals();
  const { data: summary } = usePendingApprovalSummary();
  const { approve, reject, isApproving, isRejecting } = useTransactionApproval();

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const filtered = useMemo(() => {
    return pendingTransactions.filter((t: any) => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (originFilter !== "all" && t.transaction_origin !== originFilter) return false;
      if (searchTerm && !t.description?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [pendingTransactions, typeFilter, originFilter, searchTerm]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((t: any) => t.id)));
    }
  };

  const handleApprove = async (ids?: string[]) => {
    const toApprove = ids || Array.from(selectedIds);
    if (toApprove.length === 0) return;
    await approve(toApprove);
    setSelectedIds(new Set());
  };

  const handleRejectStart = (ids?: string[]) => {
    setRejectingIds(ids || Array.from(selectedIds));
    setRejectReason("");
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = async () => {
    await reject({ transactionIds: rejectingIds, reason: rejectReason || undefined });
    setRejectDialogOpen(false);
    setRejectingIds([]);
    setSelectedIds(new Set());
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <Button variant="ghost" size="sm" className="gap-2 mb-2" onClick={() => navigate("/financeiro")}>
          <ChevronLeft className="h-4 w-4" />
          Voltar ao Financeiro
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Aprovação Financeira</h1>
        <p className="text-muted-foreground">Revise e aprove transações pendentes antes de consolidar no saldo</p>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg p-2 bg-amber-100 dark:bg-amber-900/30">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pendentes</p>
                  <p className="text-xl font-bold">{summary.total_pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg p-2 bg-green-100 dark:bg-green-900/30">
                  <ArrowUpCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Receitas pendentes</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(summary.pending_income_total)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg p-2 bg-red-100 dark:bg-red-900/30">
                  <ArrowDownCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Despesas pendentes</p>
                  <p className="text-xl font-bold text-red-600">{formatCurrency(summary.pending_expense_total)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg p-2 bg-primary/10">
                  <Filter className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Balanço pendente</p>
                  <p className={cn("text-xl font-bold", summary.pending_balance >= 0 ? "text-primary" : "text-red-600")}>
                    {formatCurrency(summary.pending_balance)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and actions */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Input
          placeholder="Buscar por descrição..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="sm:max-w-[250px]"
        />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="sm:w-[160px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="income">Receitas</SelectItem>
            <SelectItem value="expense">Despesas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={originFilter} onValueChange={setOriginFilter}>
          <SelectTrigger className="sm:w-[160px]">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas origens</SelectItem>
            <SelectItem value="laura">Laura (IA)</SelectItem>
            <SelectItem value="employee">Funcionário</SelectItem>
            <SelectItem value="panel">Painel</SelectItem>
            <SelectItem value="automation">Automação</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-2 sm:ml-auto">
          <Button
            onClick={() => handleApprove()}
            disabled={selectedIds.size === 0 || isApproving}
            className="gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            Aprovar ({selectedIds.size})
          </Button>
          <Button
            variant="destructive"
            onClick={() => handleRejectStart()}
            disabled={selectedIds.size === 0 || isRejecting}
            className="gap-2"
          >
            <XCircle className="h-4 w-4" />
            Reprovar ({selectedIds.size})
          </Button>
        </div>
      </div>

      {/* Transaction table */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Tudo em dia!</h3>
            <p className="text-muted-foreground text-center">
              Não há transações pendentes de aprovação.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead className="w-10"></TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="hidden sm:table-cell">Categoria</TableHead>
                <TableHead className="hidden md:table-cell">Origem</TableHead>
                <TableHead className="hidden md:table-cell">Data</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t: any) => (
                <TableRow key={t.id} className={selectedIds.has(t.id) ? "bg-muted/50" : ""}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(t.id)}
                      onCheckedChange={() => toggleSelect(t.id)}
                    />
                  </TableCell>
                  <TableCell>
                    {t.type === "income" ? (
                      <ArrowUpCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <ArrowDownCircle className="h-5 w-5 text-red-500" />
                    )}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium truncate max-w-[200px]">{t.description}</p>
                      {t.notes && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{t.notes}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="secondary" className="font-normal">
                      {CATEGORY_LABELS[t.category] || t.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="outline" className="font-normal">
                      {ORIGIN_LABELS[t.transaction_origin] || t.transaction_origin || "Painel"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {format(new Date(t.date), "dd/MM/yyyy", { locale: ptBR })}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-semibold",
                      t.type === "income" ? "text-green-600" : "text-red-600"
                    )}
                  >
                    {t.type === "income" ? "+" : "-"}
                    {formatCurrency(Number(t.amount))}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => handleApprove([t.id])}
                        disabled={isApproving}
                        title="Aprovar"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleRejectStart([t.id])}
                        disabled={isRejecting}
                        title="Reprovar"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Reject dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reprovar transação</DialogTitle>
            <DialogDescription>
              Essa transação será reprovada e não impactará o saldo consolidado.
              Informe o motivo (opcional).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Motivo da reprovação (opcional)..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleRejectConfirm} disabled={isRejecting}>
              Confirmar reprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
