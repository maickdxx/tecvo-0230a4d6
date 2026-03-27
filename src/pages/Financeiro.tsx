import { useState, useEffect, useRef } from "react";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppLayout } from "@/components/layout";
import { PageTutorialBanner } from "@/components/onboarding";
import { DemoContextTip } from "@/components/demo/DemoContextTip";
import { ChevronLeft, ChevronRight, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TransactionList,
  FinanceSummary,
  CategoryChart,
  CashFlowChart,
} from "@/components/finance";
import { PaymentFeeReport } from "@/components/finance/PaymentFeeReport";
import { useTransactions } from "@/hooks/useTransactions";
import { useFinancialAccounts } from "@/hooks/useFinancialAccounts";
import { generateFinanceReportPDF } from "@/lib/generateFinanceReportPDF";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActivityTracker } from "@/hooks/useActivityTracker";

export default function Financeiro() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeTab, setActiveTab] = useState("transactions");
  const { trackEvent } = useActivityTracker();
  const trackedRef = useRef(false);
  useEffect(() => { if (!trackedRef.current) { trackedRef.current = true; trackEvent("finance_viewed"); } }, []);

  const startDate = format(startOfMonth(currentMonth), "yyyy-MM-dd");
  const endDate = format(endOfMonth(currentMonth), "yyyy-MM-dd");

  const { transactions, totals, isLoading } = useTransactions({ startDate, endDate });
  const { organizationId } = useAuth();
  const { activeAccounts } = useFinancialAccounts();

  const { data: organization } = useQuery({
    queryKey: ["organization", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const { data, error } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", organizationId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const handleExportPDF = () => {
    generateFinanceReportPDF({
      transactions,
      month: currentMonth,
      totals,
      organizationName: organization?.name || "Minha Empresa",
    });
  };

  return (
    <AppLayout>
      <PageTutorialBanner pageKey="financeiro" title="Financeiro" message="Controle financeiro real. Veja receitas, despesas e o lucro da sua operação em tempo real." />
      <DemoContextTip route="/financeiro" />
      <div data-tour="financeiro-header" className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
        <p className="text-muted-foreground">Espelho financeiro — somente visualização</p>
      </div>

      {/* Month selector */}
      <div className="mb-6 flex items-center justify-center gap-4">
        <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="text-lg font-semibold min-w-[150px] text-center capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
        </span>
        <Button variant="ghost" size="icon" onClick={handleNextMonth}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Summary cards */}
      <FinanceSummary
        income={totals.income}
        expense={totals.expense}
        balance={totals.balance}
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="transactions">Transações</TabsTrigger>
          <TabsTrigger value="reports">Relatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="mt-4">
          <TransactionList
            transactions={transactions}
            isLoading={isLoading}
            accounts={activeAccounts}
          />
        </TabsContent>

        <TabsContent value="reports" className="mt-4">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" className="gap-2" onClick={handleExportPDF}>
                <FileDown className="h-4 w-4" />
                Exportar PDF
              </Button>
            </div>
            <CashFlowChart transactions={transactions} month={currentMonth} />
            <div className="grid gap-4 md:grid-cols-2">
              <CategoryChart transactions={transactions} type="income" />
              <CategoryChart transactions={transactions} type="expense" />
            </div>
            <PaymentFeeReport startDate={startDate} endDate={endDate} />
          </div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
