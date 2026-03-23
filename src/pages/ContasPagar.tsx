import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { isPast, isToday, differenceInCalendarDays } from "date-fns";
import { AppLayout } from "@/components/layout";
import { PageTutorialBanner } from "@/components/onboarding";
import { Plus, ChevronLeft, ChevronRight, CalendarClock, AlertTriangle, TrendingUp, ListChecks } from "lucide-react";
import { type Granularity, getPeriodoAtivo, navegarPeriodo, getLabelPeriodo, getHojeBRT } from "@/lib/periodoGlobal";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { getTodayInTz } from "@/lib/timezone";
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
  if (account.status === "pending" && account.due_date) {
    const todayStr = getTodayInTz(tz);
    const dueDate = new Date(account.due_date + "T12:00:00");
    const todayDate = new Date(todayStr + "T12:00:00");
    if (dueDate < todayDate) return "overdue";
  }
  return account.status;
}

function sortAccountsByPriority(accounts: Account[], tz: string): Account[] {
  const todayStr = getTodayInTz(tz);
  const today = new Date(todayStr + "T12:00:00");

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
    const distA = Math.abs(differenceInCalendarDays(new Date(dA + "T12:00:00"), today));
    const distB = Math.abs(differenceInCalendarDays(new Date(dB + "T12:00:00"), today));
    if (distA !== distB) return distA - distB;

    return dA.localeCompare(dB);
  });
}

export default function ContasPagar() {
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

  const statusFilter = activeTab === "all" ? undefined : activeTab as "pending" | "paid" | "overdue";

  const { 
    accounts, 
    totals, 
    isLoading, 
    create, 
    update, 
    markAsPaid,
    remove, 
    isCreating, 
    isUpdating 
  } = useAccounts({ 
    accountType: "payable",
    status: statusFilter,
    startDate,
    endDate,
  });

  const { categoryLabels } = useTransactionCategories("expense");

  // Smart summary calculations
  const smartSummary = useMemo(() => {
    const todayStr = getTodayInTz(tz);

    let pendingCount = 0;
    let dueTodayCount = 0;
    const categoryTotals: Record<string, number> = {};

    for (const acc of accounts) {
      const status = getEffectiveStatus(acc, tz);
      if (status === "pending" || status === "overdue") {
        pendingCount++;
      }
      if (status === "pending" && acc.due_date && acc.due_date.substring(0, 10) === todayStr) {
        dueTodayCount++;
      }
      const cat = acc.category || "outros";
      categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(acc.amount);
    }

    let topCategory = "-";
    let topAmount = 0;
    for (const [slug, total] of Object.entries(categoryTotals)) {
      if (total > topAmount) {
        topAmount = total;
        topCategory = categoryLabels[slug] || slug;
      }
    }

    return {
      total: accounts.length,
      pendingCount,
      dueTodayCount,
      topCategory,
    };
  }, [accounts, categoryLabels]);

  const sortedAccounts = useMemo(() => sortAccountsByPriority(accounts, tz), [accounts, tz]);

  const handlePrev = () => setReferenceDate(navegarPeriodo(granularity, referenceDate, -1));
  const handleNext = () => setReferenceDate(navegarPeriodo(granularity, referenceDate, 1));

  const handleNew = () => {
    navigate("/contas-pagar/nova");
  };

  const handleEdit = (account: Account) => {
    navigate(`/contas-pagar/editar/${account.id}`);
  };

  const handleDelete = (account: Account) => {
    setDeleteAccount(account);
  };

  const handleMarkAsPaid = async (account: Account, financialAccountId: string, compensationDate: string) => {
    await markAsPaid({ id: account.id, financial_account_id: financialAccountId, compensation_date: compensationDate });
  };

  const handleDuplicate = (account: Account) => {
    // Pre-fill dialog with account data (no ID = new account)
    setSelectedAccount({
      ...account,
      id: "", // forces create mode
      status: "pending",
      payment_date: null,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (data: AccountFormData) => {
    if (selectedAccount && selectedAccount.id) {
      await update({ id: selectedAccount.id, data });
    } else {
      await create({ ...data, type: "expense" });
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
      <PageTutorialBanner pageKey="contas-pagar" title="Contas a Pagar" message="Registre suas despesas para ter uma visão completa do lucro real da sua empresa." />
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contas a Pagar</h1>
          <p className="text-muted-foreground">Gerencie suas despesas e pagamentos</p>
        </div>
        <Button className="gap-2 h-9" onClick={handleNew}>
          <Plus className="h-4 w-4" />
          <span className="sm:hidden">Adicionar</span>
          <span className="hidden sm:inline">Adicionar Conta a Pagar</span>
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
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
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Maior categoria</p>
                  <p className="font-semibold truncate max-w-[120px]">{smartSummary.topCategory}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary cards */}
      <AccountSummary
        pending={totals.pending}
        paid={totals.paid}
        overdue={totals.overdue}
        total={totals.total}
        accountType="payable"
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="pending">Pendentes</TabsTrigger>
          <TabsTrigger value="overdue">Atrasadas</TabsTrigger>
          <TabsTrigger value="paid">Pagas</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-3">
          <AccountList
            accounts={sortedAccounts}
            accountType="payable"
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
        accountType="payable"
        onSubmit={handleSubmit}
        isSubmitting={isCreating || isUpdating}
      />

      <AlertDialog open={!!deleteAccount} onOpenChange={() => setDeleteAccount(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta conta a pagar? Esta ação não pode ser desfeita.
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
