import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { differenceInCalendarDays } from "date-fns";
import { AppLayout } from "@/components/layout";
import { PageTutorialBanner } from "@/components/onboarding";
import { Plus, ChevronLeft, ChevronRight, CalendarClock, AlertTriangle, TrendingUp, ListChecks, Clock } from "lucide-react";
import { type Granularity, getPeriodoAtivo, navegarPeriodo, getLabelPeriodo, getHojeBRT } from "@/lib/periodoGlobal";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  AccountDialog,
  AccountList,
  AccountSummary,
} from "@/components/finance";
import {
  useAccounts,
  type Account,
  type AccountFormData,
} from "@/hooks/useAccounts";
import { useTransactionCategories } from "@/hooks/useTransactionCategories";
import { cn } from "@/lib/utils";

function getEffectiveStatus(account: Account, tz: string) {
  if (account.status === "paid" || account.status === "cancelled") return account.status;
  if (account.status === "pending" && account.due_date) {
    const todayStr = getTodayInTz(tz);
    if (account.due_date.substring(0, 10) < todayStr) return "overdue";
  }
  return account.status;
}

function sortAccountsByPriority(accounts: Account[], tz: string): Account[] {
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: tz });
  const todayDate = new Date(todayStr + "T12:00:00");

  return [...accounts].sort((a, b) => {
    const statusA = getEffectiveStatus(a, tz);
    const statusB = getEffectiveStatus(b, tz);

    // Paid/cancelled go to the bottom
    const groupOf = (status: string) => {
      if (status === "paid") return 2;
      if (status === "cancelled") return 2;
      return 0; // pending or overdue = active
    };

    const gA = groupOf(statusA);
    const gB = groupOf(statusB);
    if (gA !== gB) return gA - gB;

    // Within active accounts: sort by proximity to today (closest date first)
    const dA = a.due_date || "9999-12-31";
    const dB = b.due_date || "9999-12-31";
    const distA = Math.abs(differenceInCalendarDays(new Date(dA.substring(0, 10) + "T12:00:00"), todayDate));
    const distB = Math.abs(differenceInCalendarDays(new Date(dB.substring(0, 10) + "T12:00:00"), todayDate));
    if (distA !== distB) return distA - distB;

    return dA.localeCompare(dB);
  });
}

export default function ContasReceber() {
  const navigate = useNavigate();
  const tz = useOrgTimezone();
  const [granularity, setGranularity] = useState<Granularity>("month");
  const [referenceDate, setReferenceDate] = useState(() => getHojeBRT());
  const [activeTab, setActiveTab] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [deleteAccount, setDeleteAccount] = useState<Account | null>(null);

  const periodo = getPeriodoAtivo(granularity, referenceDate);
  const startDate = periodo.data_inicio;
  const endDate = periodo.data_fim;

  const { 
    accounts, 
    isLoading, 
    create, 
    update, 
    markAsPaid,
    remove, 
    isCreating, 
    isUpdating 
  } = useAccounts({ 
    accountType: "receivable",
    startDate,
    endDate,
  });

  // Recalculate totals locally using effective status (timezone-aware)
  const localTotals = useMemo(() => {
    const result = { pending: 0, paid: 0, overdue: 0, total: 0 };
    for (const acc of accounts) {
      const status = getEffectiveStatus(acc, tz);
      const amount = Number(acc.amount);
      if (status === "pending") result.pending += amount;
      else if (status === "overdue") result.overdue += amount;
      else if (status === "paid") result.paid += amount;
      result.total += amount;
    }
    return result;
  }, [accounts]);

  const { categoryLabels } = useTransactionCategories("income");

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  // Smart summary calculations
  const smartSummary = useMemo(() => {
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: tz });

    let pendingCount = 0;
    let dueTodayCount = 0;
    let overdueCount = 0;
    let forecast7Days = 0;

    for (const acc of accounts) {
      const status = getEffectiveStatus(acc, tz);
      if (status === "pending" || status === "overdue") {
        pendingCount++;
      }
      if (status === "overdue") {
        overdueCount++;
      }
      if (status === "pending" && acc.due_date && acc.due_date.substring(0, 10) === todayStr) {
        dueTodayCount++;
      }
      if (status === "pending" && acc.due_date) {
        const dueDateStr = acc.due_date.substring(0, 10);
        const dueDate = new Date(dueDateStr + "T12:00:00");
        const todayDate = new Date(todayStr + "T12:00:00");
        const diff = differenceInCalendarDays(dueDate, todayDate);
        if (diff >= 0 && diff <= 7) {
          forecast7Days += Number(acc.amount);
        }
      }
    }

    return {
      total: accounts.length,
      pendingCount,
      dueTodayCount,
      overdueCount,
      forecast7Days,
    };
  }, [accounts]);

  const sortedAccounts = useMemo(() => sortAccountsByPriority(accounts, tz), [accounts, tz]);

  // Filter by active tab locally
  const filteredAccounts = useMemo(() => {
    if (activeTab === "all") return sortedAccounts;
    return sortedAccounts.filter((acc) => getEffectiveStatus(acc, tz) === activeTab);
  }, [sortedAccounts, activeTab, tz]);

  const handlePrev = () => setReferenceDate(navegarPeriodo(granularity, referenceDate, -1));
  const handleNext = () => setReferenceDate(navegarPeriodo(granularity, referenceDate, 1));

  const handleNew = () => {
    navigate("/contas-receber/nova");
  };

  const handleEdit = (account: Account) => {
    navigate(`/contas-receber/editar/${account.id}`);
  };

  const handleDelete = (account: Account) => {
    setDeleteAccount(account);
  };

  const handleMarkAsPaid = async (account: Account, financialAccountId: string, compensationDate: string) => {
    await markAsPaid({ id: account.id, financial_account_id: financialAccountId, compensation_date: compensationDate });
  };

  const handleDuplicate = (account: Account) => {
    setSelectedAccount({
      ...account,
      id: "",
      status: "pending",
      payment_date: null,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (data: AccountFormData) => {
    if (selectedAccount && selectedAccount.id) {
      await update({ id: selectedAccount.id, data });
    } else {
      await create({ ...data, type: "income" });
    }
  };

  const confirmDelete = async () => {
    if (deleteAccount) {
      await remove(deleteAccount.id);
      setDeleteAccount(null);
    }
  };

  return (
    <AppLayout>
      <PageTutorialBanner pageKey="contas-receber" title="Contas a Receber" message="Quando você confirma um recebimento aqui, o dinheiro entra nas métricas reais. Isso mantém seu financeiro confiável." />
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contas a Receber</h1>
          <p className="text-muted-foreground">Gerencie seus recebíveis e cobranças</p>
        </div>
        <Button className="gap-2 h-9" onClick={handleNew}>
          <Plus className="h-4 w-4" />
          <span className="sm:hidden">Adicionar</span>
          <span className="hidden sm:inline">Adicionar Conta a Receber</span>
        </Button>
      </div>

      {/* Period selector */}
      <div className="mb-6 flex flex-col sm:flex-row items-center justify-center gap-4">
        <Tabs value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
          <TabsList>
            <TabsTrigger value="day">Dia</TabsTrigger>
            <TabsTrigger value="week">Semana</TabsTrigger>
            <TabsTrigger value="month">Mês</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handlePrev}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="text-lg font-semibold min-w-[150px] text-center capitalize">
            {getLabelPeriodo(granularity, referenceDate)}
          </span>
          <Button variant="ghost" size="icon" onClick={handleNext}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Smart Summary */}
      {!isLoading && accounts.length > 0 && (
        <Card className="mb-3">
          <CardContent className="py-2.5 px-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="font-semibold">{smartSummary.total} contas</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                  <p className="font-semibold">{smartSummary.pendingCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CalendarClock className={cn("h-3.5 w-3.5", smartSummary.dueTodayCount > 0 ? "text-orange-500" : "text-muted-foreground")} />
                <div>
                  <p className="text-xs text-muted-foreground">Vencem hoje</p>
                  <p className={cn("font-semibold", smartSummary.dueTodayCount > 0 && "text-orange-600 dark:text-orange-400")}>
                    {smartSummary.dueTodayCount}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className={cn("h-3.5 w-3.5", smartSummary.overdueCount > 0 ? "text-destructive" : "text-muted-foreground")} />
                <div>
                  <p className="text-xs text-muted-foreground">Atrasadas</p>
                  <p className={cn("font-semibold", smartSummary.overdueCount > 0 && "text-destructive")}>
                    {smartSummary.overdueCount}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Previsão 7 dias</p>
                  <p className="font-semibold text-emerald-600 dark:text-emerald-400 truncate max-w-[120px]">
                    {formatCurrency(smartSummary.forecast7Days)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary cards */}
      <AccountSummary
        pending={localTotals.pending}
        paid={localTotals.paid}
        overdue={localTotals.overdue}
        total={localTotals.total}
        accountType="receivable"
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="pending">Pendentes</TabsTrigger>
          <TabsTrigger value="overdue">Atrasadas</TabsTrigger>
          <TabsTrigger value="paid">Recebidas</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-3">
          <AccountList
            accounts={filteredAccounts}
            accountType="receivable"
            isLoading={isLoading}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onMarkAsPaid={handleMarkAsPaid}
            onDuplicate={handleDuplicate}
            categoryLabels={categoryLabels}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        account={selectedAccount}
        accountType="receivable"
        onSubmit={handleSubmit}
        isSubmitting={isCreating || isUpdating}
      />

      <AlertDialog open={!!deleteAccount} onOpenChange={() => setDeleteAccount(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta conta a receber? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
