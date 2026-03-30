import { useState, useMemo, type ReactNode, lazy, Suspense } from "react";
import { BarChart3, ChevronLeft, ChevronRight, Loader2, Plus, BookOpen, Clock, TrendingUp } from "lucide-react";
import { useOrganization } from "@/hooks/useOrganization";
import { AppLayout } from "@/components/layout";
import { DashboardBanners } from "@/components/dashboard/DashboardBanners";
import { useAutoSeedDemo } from "@/hooks/useAutoSeedDemo";
import { useGuidedOnboarding } from "@/hooks/useGuidedOnboarding";
import { useDemoMode } from "@/hooks/useDemoMode";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Lazy-load heavier charts and reports
const RevenueEvolutionChart = lazy(() => import("@/components/dashboard/RevenueEvolutionChart").then(m => ({ default: m.RevenueEvolutionChart })));
const PaymentMethodChart = lazy(() => import("@/components/dashboard/PaymentMethodChart").then(m => ({ default: m.PaymentMethodChart })));
const CashFlowChart = lazy(() => import("@/components/dashboard/CashFlowChart").then(m => ({ default: m.CashFlowChart })));
const PaymentFeeReport = lazy(() => import("@/components/finance/PaymentFeeReport").then(m => ({ default: m.PaymentFeeReport })));
const TimePerformanceDashboard = lazy(() => import("@/components/dashboard/TimePerformanceDashboard").then(m => ({ default: m.TimePerformanceDashboard })));

import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  CashFlowChart,
  PaymentMethodChart,
  RevenueEvolutionChart,
  CompanyHealthCard,
  DashboardSection,
  TodayActionsBlock,
  RevenueOpportunitiesBlock,
} from "@/components/dashboard";
import { TimePerformanceDashboard } from "@/components/dashboard/TimePerformanceDashboard";
import { CurrentSituationBlock } from "@/components/dashboard/CurrentSituationBlock";
import { ExecutiveHeroBlock } from "@/components/dashboard/ExecutiveHeroBlock";
import { RevenueEngineBlock } from "@/components/dashboard/RevenueEngineBlock";

import { AlertasInteligentes } from "@/components/dashboard/AlertasInteligentes";
import { ClosedPeriodServices } from "@/components/dashboard/ClosedPeriodServices";
import { PaymentFeeReport } from "@/components/finance/PaymentFeeReport";
import { DashboardCustomizeDialog } from "@/components/dashboard/DashboardCustomizeDialog";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { useUserRole } from "@/hooks/useUserRole";
import { DailyRoutineSummary } from "@/components/secretaria/DailyRoutineSummary";
import {
  type Granularity,
  getPeriodoAtivo,
  getPeriodoAnterior,
  getPeriodoGrafico,
  navegarPeriodo,
  getLabelPeriodo,
  getHojeBRT,
} from "@/lib/periodoGlobal";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { isPreparing } = useAutoSeedDemo();
  const { isDemoMode } = useDemoMode();
  const { showGuide, allCompleted: checklistDone } = useGuidedOnboarding();
  // Hide competing elements when checklist is the priority (real mode, not yet completed)
  const isActivationPhase = !isDemoMode && showGuide && !checklistDone;
  const [granularity, setGranularity] = useState<Granularity>("month");
  const [referenceDate, setReferenceDate] = useState(() => getHojeBRT());

  const resetOnboardingMutation = useMutation({
    mutationFn: async () => {
      if (!session?.user?.id) return;
      const { error } = await supabase
        .from("profiles")
        .update({ onboarding_completed: false })
        .eq("user_id", session.user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-onboarding", session?.user?.id] });
      toast.success("Modo tutorial reativado");
      navigate("/tutorial");
    },
    onError: () => {
      toast.error("Erro ao reativar modo tutorial");
    }
  });

  const handleOpenTutorial = () => {
    resetOnboardingMutation.mutate();
  };

  const periodo = useMemo(() => getPeriodoAtivo(granularity, referenceDate), [granularity, referenceDate]);
  const periodoAnterior = useMemo(() => getPeriodoAnterior(granularity, referenceDate), [granularity, referenceDate]);
  const periodoGrafico = useMemo(() => getPeriodoGrafico(granularity, referenceDate), [granularity, referenceDate]);

  const startDate = periodo.data_inicio;
  const endDate = periodo.data_fim;
  const prevStartDate = periodoAnterior.data_inicio;
  const prevEndDate = periodoAnterior.data_fim;
  const chartStart = periodoGrafico.data_inicio;
  const chartEnd = periodoGrafico.data_fim;

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
      <div className="page-enter pb-20 md:pb-8">
        <DashboardBanners />

        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Visão Geral</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Central de comando estratégica</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 hidden md:flex h-9"
              onClick={handleOpenTutorial}
              disabled={resetOnboardingMutation.isPending}
            >
              <BookOpen className="h-4 w-4" />
              Tutorial
            </Button>
            <DashboardCustomizeDialog />
            <Button size="sm" onClick={() => navigate("/ordens-servico/nova")} className="gap-1.5 h-9">
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Nova OS</span>
            </Button>
          </div>
        </div>

        {/* 1. AGORA — Ações e Situação em Tempo Real */}
        <div className="space-y-6 mb-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-primary">AGORA · Operação & Caixa</h2>
          </div>
          
          <div className="grid gap-6">
            <DailyRoutineSummary />
            <TodayActionsBlock />
          </div>
          
          <AlertasInteligentes />

          {canViewFinance && !isActivationPhase && (
            <div data-tour="dashboard-hero">
              <CurrentSituationBlock />
            </div>
          )}
        </div>

        {/* 2. OPORTUNIDADES — Dinheiro Potencial */}
        <div className="space-y-2 mb-10">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-3.5 w-3.5 text-success" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-success">FUTURO · Oportunidades</h2>
          </div>
          
          <RevenueOpportunitiesBlock />
        </div>

        {/* 3. PERFORMANCE — Análise do Período */}
        <div className="space-y-6 mb-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-info" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-info">PERÍODO · Análise de Desempenho</h2>
            </div>

            {canViewFinance && (
              <div className="flex items-center gap-3">
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

                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setReferenceDate(navegarPeriodo(granularity, referenceDate, -1))}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setReferenceDate(navegarPeriodo(granularity, referenceDate, 1))}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>

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

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              <ClosedPeriodServices />
            </div>
            
            {canViewFinance && (
              <RevenueEngineBlock
                revenueByType={metrics.revenueByType}
                countByType={metrics.countByType}
                averageTicket={metrics.averageTicket}
              />
            )}
          </div>

          {canViewFinance && !isActivationPhase && (
            <CompanyHealthCard />
          )}
        </div>

        {/* 4. GRÁFICOS DETALHADOS — Rodapé da página */}
        {canViewFinance && (
          <div className="mt-12 space-y-6 border-t pt-10">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Relatórios & Tendências</h2>
            </div>
            
            <div className="grid gap-6 lg:grid-cols-2">
              <RevenueEvolutionChart granularity={granularity} chartStartDate={chartStart} chartEndDate={chartEnd} />
              <PaymentMethodChart startDate={startDate} endDate={endDate} />
            </div>
            
            <div className="grid gap-6">
              <CashFlowChart granularity={granularity} chartStartDate={chartStart} chartEndDate={chartEnd} />
              <PaymentFeeReport startDate={startDate} endDate={endDate} />
            </div>

            <TimePerformanceDashboard startDate={startDate} endDate={endDate} />
          </div>
        )}

      </div>
    </AppLayout>
  );
}
