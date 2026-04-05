import { useState } from "react";
import { formatPaymentMethod } from "@/lib/formatPaymentMethod";
import { format, isPast, isToday, isTomorrow, differenceInCalendarDays } from "date-fns";
import { getTodayInTz } from "@/lib/timezone";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { ptBR } from "date-fns/locale";
import { 
  MoreVertical, 
  Pencil, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  XCircle,
  FileText,
  Eye,
  Copy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Account, AccountStatus, AccountType } from "@/hooks/useAccounts";
import { AccountDetailsDialog } from "./AccountDetailsDialog";
import { useFinancialAccounts } from "@/hooks/useFinancialAccounts";

const SERVICE_TYPE_LABELS: Record<string, string> = {
  instalacao: "Instalação", installation: "Instalação",
  limpeza: "Limpeza", cleaning: "Limpeza",
  manutencao: "Manutenção", maintenance: "Manutenção",
  contratos: "Contratos", maintenance_contract: "Contratos",
  outros: "Outros", other: "Outros",
  reparo: "Reparo", repair: "Reparo",
  visit: "Visita Técnica", quote: "Orçamento",
};

const RECURRENCE_LABELS: Record<string, string> = {
  weekly: "Semanal",
  monthly: "Mensal",
  yearly: "Anual",
};

interface AccountListProps {
  accounts: Account[];
  accountType: AccountType;
  isLoading: boolean;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
  onMarkAsPaid: (account: Account, financialAccountId: string, compensationDate: string) => void;
  onDuplicate?: (account: Account) => void;
  categoryLabels?: Record<string, string>;
}

const STATUS_CONFIG: Record<AccountStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  pending: { label: "Pendente", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800", icon: Clock },
  paid: { label: "Pago", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800", icon: CheckCircle2 },
  overdue: { label: "Atrasado", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800", icon: AlertCircle },
  cancelled: { label: "Cancelado", className: "bg-muted text-muted-foreground border-border", icon: XCircle },
};

function getUrgencyBadge(account: Account, effectiveStatus: AccountStatus) {
  if (effectiveStatus !== "pending" || !account.due_date) return null;
  const dueDate = new Date(account.due_date + "T12:00:00");
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  if (isToday(dueDate)) {
    return <Badge className="text-[10px] px-1.5 py-0 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800">Hoje</Badge>;
  }
  if (isTomorrow(dueDate)) {
    return <Badge className="text-[10px] px-1.5 py-0 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800">Amanhã</Badge>;
  }
  const diff = differenceInCalendarDays(dueDate, today);
  if (diff >= 2 && diff <= 3) {
    return <Badge className="text-[10px] px-1.5 py-0 bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 border-sky-200 dark:border-sky-800">Em {diff} dias</Badge>;
  }
  return null;
}

export function AccountList({
  accounts,
  accountType,
  isLoading,
  onEdit,
  onDelete,
  onMarkAsPaid,
  onDuplicate,
  categoryLabels = {},
}: AccountListProps) {
  const tz = useOrgTimezone();
  const [detailsAccount, setDetailsAccount] = useState<Account | null>(null);
  const [markPaidAccount, setMarkPaidAccount] = useState<Account | null>(null);
  const [markPaidFinancialAccountId, setMarkPaidFinancialAccountId] = useState("");
  const [markPaidCompensationDate, setMarkPaidCompensationDate] = useState(getTodayInTz(tz));
  const { activeAccounts } = useFinancialAccounts();

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return format(new Date(date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR });
  };

  const getStatusWithOverdue = (account: Account): AccountStatus => {
    if (account.status === "pending" && account.due_date) {
      const todayStr = getTodayInTz(tz);
      const dueDateStr = account.due_date.substring(0, 10);
      if (dueDateStr < todayStr) {
        return "overdue";
      }
    }
    return account.status;
  };

  const handleOpenMarkPaid = (account: Account) => {
    setMarkPaidAccount(account);
    setMarkPaidFinancialAccountId((account as any).financial_account_id || "");
    setMarkPaidCompensationDate(getTodayInTz(tz));
  };

  const handleConfirmMarkPaid = () => {
    if (markPaidAccount && markPaidFinancialAccountId && markPaidCompensationDate) {
      onMarkAsPaid(markPaidAccount, markPaidFinancialAccountId, markPaidCompensationDate);
      setMarkPaidAccount(null);
    }
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

  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 p-12">
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Nenhuma conta encontrada
        </h3>
        <p className="text-muted-foreground text-center max-w-md">
          {accountType === "payable" 
            ? "Registre suas contas a pagar para acompanhar vencimentos"
            : "Registre suas contas a receber para controlar seus recebíveis"}
        </p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="h-10">
              <TableHead>Descrição</TableHead>
              <TableHead className="hidden sm:table-cell">
                {accountType === "payable" ? "Fornecedor" : "Cliente"}
              </TableHead>
              <TableHead className="hidden md:table-cell">Vencimento</TableHead>
              <TableHead className="hidden lg:table-cell">Plano de Contas</TableHead>
              <TableHead className="hidden xl:table-cell">Forma Pgto</TableHead>
              <TableHead className="hidden xl:table-cell w-[80px]">Recorrente</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="w-[88px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((account) => {
              const effectiveStatus = getStatusWithOverdue(account);
              const statusConfig = STATUS_CONFIG[effectiveStatus];
              const StatusIcon = statusConfig.icon;
              const urgencyBadge = getUrgencyBadge(account, effectiveStatus);
              const canMarkAsPaid = account.status === "pending" || effectiveStatus === "overdue";

              return (
                <TableRow key={account.id}>
                  <TableCell className="py-2.5 px-3">
                    <div className="space-y-0.5">
                      <p className="font-medium truncate max-w-[200px]">
                        {account.description}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {account.service_id && account.service && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <FileText className="h-3 w-3" />
                            OS #{account.service.quote_number}
                          </Badge>
                        )}
                        {account.service?.service_type && (
                          <span className="text-xs text-muted-foreground">
                            {SERVICE_TYPE_LABELS[account.service.service_type] || account.service.service_type}
                          </span>
                        )}
                        {account.payment_method && effectiveStatus === "paid" && (
                          <span className="text-xs text-muted-foreground">
                            • {formatPaymentMethod(account.payment_method)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground md:hidden">
                        Venc: {formatDate(account.due_date)}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground py-2.5 px-3">
                    {accountType === "payable" 
                      ? account.supplier?.name || "-"
                      : account.client?.name || "-"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell py-2.5 px-3">
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        effectiveStatus === "overdue" && "text-destructive font-medium"
                      )}>
                        {formatDate(account.due_date)}
                      </span>
                      {urgencyBadge}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground py-2.5 px-3">
                    {categoryLabels[account.category] || account.category || "Não informado"}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-sm text-muted-foreground py-2.5 px-3">
                    {formatPaymentMethod(account.payment_method)}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell py-2.5 px-3">
                    {account.recurrence ? (
                      <Badge variant="outline" className="text-xs">
                        {RECURRENCE_LABELS[account.recurrence] || "Sim"}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="py-2.5 px-3">
                    <Badge className={cn("gap-1 border text-[10px] px-1.5 py-0 h-5", statusConfig.className)} variant="outline">
                      <StatusIcon className="h-2.5 w-2.5" />
                      {statusConfig.label}
                    </Badge>
                  </TableCell>
                  <TableCell className={cn("text-right font-semibold text-sm py-2.5 px-3", 
                    effectiveStatus === "paid" && "text-emerald-600 dark:text-emerald-400",
                    effectiveStatus === "overdue" && "text-destructive"
                  )}>
                    {formatCurrency(Number(account.amount))}
                  </TableCell>
                  <TableCell className="py-2.5 px-3">
                    <div className="flex items-center gap-1">
                      {canMarkAsPaid && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                              onClick={() => handleOpenMarkPaid(account)}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Dar Baixa</TooltipContent>
                        </Tooltip>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setDetailsAccount(account)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Ver Detalhes
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onEdit(account)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          {onDuplicate && (
                            <DropdownMenuItem onClick={() => onDuplicate(account)}>
                              <Copy className="mr-2 h-4 w-4" />
                              Duplicar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onDelete(account)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <AccountDetailsDialog
          open={!!detailsAccount}
          onOpenChange={(open) => !open && setDetailsAccount(null)}
          account={detailsAccount}
          accountType={accountType}
        />

        {/* Dialog de Dar Baixa */}
        <Dialog open={!!markPaidAccount} onOpenChange={(open) => !open && setMarkPaidAccount(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Dar Baixa</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                {markPaidAccount?.description} — R$ {Number(markPaidAccount?.amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <div>
                <Label>Conta Financeira *</Label>
                <Select value={markPaidFinancialAccountId} onValueChange={setMarkPaidFinancialAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} — R$ {Number(a.balance).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="compensationDate">Data de Compensação *</Label>
                <Input
                  id="compensationDate"
                  type="date"
                  value={markPaidCompensationDate}
                  onChange={(e) => setMarkPaidCompensationDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Data real em que o dinheiro {accountType === "payable" ? "saiu" : "entrou"} na conta.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setMarkPaidAccount(null)}>Cancelar</Button>
              <Button
                onClick={handleConfirmMarkPaid}
                disabled={!markPaidFinancialAccountId || !markPaidCompensationDate}
                className="gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Confirmar Baixa
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
