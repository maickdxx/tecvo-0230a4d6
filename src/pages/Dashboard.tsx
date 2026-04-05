import { useState, useMemo, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Loader2, Plus } from "lucide-react";
import { useOrganization } from "@/hooks/useOrganization";
import { AppLayout } from "@/components/layout";
import { useAutoSeedDemo } from "@/hooks/useAutoSeedDemo";
import { useDemoMode } from "@/hooks/useDemoMode";
import { useAuth } from "@/hooks/useAuth";
import {
  ExecutiveHeroBlock,
} from "@/components/dashboard";
import { CurrentSituationBlock } from "@/components/dashboard/CurrentSituationBlock";
import { AlertasInteligentes } from "@/components/dashboard/AlertasInteligentes";
import { ClosedPeriodServices } from "@/components/dashboard/ClosedPeriodServices";
import { DashboardGreeting } from "@/components/dashboard/DashboardGreeting";
import { TrialUrgencyBanner } from "@/components/dashboard/TrialUrgencyBanner";
import { LauraWelcomeModal } from "@/components/dashboard/LauraWelcomeModal";

import { MoneyOnTable } from "@/components/dashboard/MoneyOnTable";
import { TomorrowServices } from "@/components/dashboard/TomorrowServices";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { useUserRole } from "@/hooks/useUserRole";
import {
  type Granularity,
  getPeriodoAtivo,
  getPeriodoAnterior,
  getHojeBRT,
  navegarPeriodo,
  getLabelPeriodo,
} from "@/lib/periodoGlobal";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();
  const { isPreparing } = useAutoSeedDemo();
  const hasTrackedDashboard = useRef(false);

  useEffect(() => {
    if (!hasTrackedDashboard.current) {
      hasTrackedDashboard.current = true;
      import("@/lib/fbPixel").then(({ trackFBCustomEvent }) => {
        trackFBCustomEvent("Dashboard");
      });
    }
  }, []);
  const [granularity, setGranularity] = useState<Granularity>("month");
  const [referenceDate, setReferenceDate] = useState(() => getHojeBRT());

  const periodo = useMemo(() => getPeriodoAtivo(granularity, referenceDate), [granularity, referenceDate]);
  const periodoAnterior = useMemo(() => getPeriodoAnterior(granularity, referenceDate), [granularity, referenceDate]);

  const startDate = periodo.data_inicio;
  const endDate = periodo.data_fim;
  const prevStartDate = periodoAnterior.data_inicio;
  const prevEndDate = periodoAnterior.data_fim;

  const metrics = useDashboardMetrics(startDate, endDate, prevStartDate, prevEndDate);
  const periodLabel = getLabelPeriodo(granularity, referenceDate);
  const { organization } = useOrganization();
  const { hasPermission } = useUserRole();
  const canViewFinance = hasPermission("finance.view");

  if (isPreparing) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 animate-in fade-in duration-300">
          <div className="relative">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
          </div>
          <div className="text-center space-y-2 max-w-sm">
            <h2 className="text-lg font-semibold text-foreground">Preparando sua experiência...</h2>
            <p className="text-sm text-muted-foreground">
              Estamos montando um ambiente completo para você conhecer a Tecvo
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="page-enter">
        <DashboardGreeting />
        <LauraWelcomeModal />
        <TrialUrgencyBanner />

        {/* Money on Table Alert */}
        {canViewFinance && <MoneyOnTable />}

        


        {/* Page Header */}
        <div className="flex items-center justify-between mb-6 mt-8">
          <div>
            <h2 className="text-lg font-semibold text-foreground tracking-tight">Painel Financeiro</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Resumo estratégico do seu negócio</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => navigate("/ordens-servico/nova")} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Nova OS</span>
            </Button>
          </div>
        </div>

        {/* 1. Situação Atual */}
        {canViewFinance && (
          <div data-tour="dashboard-hero">
            <CurrentSituationBlock />
          </div>
        )}

        {/* Period Selector */}
        {canViewFinance && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
            <Tabs
              value={granularity}
              onValueChange={(v) => {
                setGranularity(v as Granularity);
                setReferenceDate(getHojeBRT());
              }}
            >
              <TabsList className="h-8">
                <TabsTrigger value="day" className="text-xs px-3 h-7">Dia</TabsTrigger>
                <TabsTrigger value="week" className="text-xs px-3 h-7">Semana</TabsTrigger>
                <TabsTrigger value="month" className="text-xs px-3 h-7">Mês</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setReferenceDate(navegarPeriodo(granularity, referenceDate, -1))}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-sm font-medium text-foreground capitalize min-w-[140px] text-center period-transition" key={periodLabel}>
                {periodLabel}
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setReferenceDate(navegarPeriodo(granularity, referenceDate, 1))}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 space-y-6">
            {/* 2. Lucro / Receita / Gastos */}
            {canViewFinance && (
              <ExecutiveHeroBlock
                income={metrics.income}
                expense={metrics.expense}
                balance={metrics.balance}
                margin={metrics.margin}
                forecastedRevenue={metrics.forecastedRevenue}
                periodLabel={periodLabel}
                monthlyGoal={organization?.monthly_goal}
                incomeChange={metrics.incomeChange}
                expenseChange={metrics.expenseChange}
                balanceChange={metrics.balanceChange}
                granularity={granularity}
              />
            )}
          </div>
          
          <div className="lg:col-span-4 space-y-6">
            {/* 3. Alertas */}
            <AlertasInteligentes />

            {/* 4. Serviços Fechados */}
            <ClosedPeriodServices />

            {/* 5. Lembretes de Amanhã */}
            <TomorrowServices />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
