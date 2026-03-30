import { useState, useMemo, type ReactNode, lazy, Suspense } from "react";
import { BarChart3, ChevronLeft, ChevronRight, Loader2, Plus, BookOpen, Clock, TrendingUp, LayoutDashboard, Wallet, Target } from "lucide-react";
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
const CashFlowChart = lazy(() => import("@/components/dashboard/CashFlowChart").then(m => ({ default: m.CashFlowChart })));
const TimePerformanceDashboard = lazy(() => import("@/components/dashboard/TimePerformanceDashboard").then(m => ({ default: m.TimePerformanceDashboard })));

import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  CompanyHealthCard,
  DashboardSection,
} from "@/components/dashboard";
import { CurrentSituationBlock } from "@/components/dashboard/CurrentSituationBlock";
import { ClosedPeriodServices } from "@/components/dashboard/ClosedPeriodServices";
import { DashboardCustomizeDialog } from "@/components/dashboard/DashboardCustomizeDialog";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { useUserRole } from "@/hooks/useUserRole";
import { FocoDoDia } from "@/components/dashboard/FocoDoDia";
import { CrescimentoBlock } from "@/components/dashboard/CrescimentoBlock";
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

        {/* 1. FOCO DO DIA (TOPO) */}
        <div className="mb-12">
          <FocoDoDia />
        </div>

        {/* 2. CAIXA (SEGURANÇA) */}
        {canViewFinance && !isActivationPhase && (
          <div className="mb-12 space-y-4">
            <div className="flex items-center gap-2 mb-4 px-1">
              <Wallet className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold text-foreground uppercase tracking-tight">Caixa & Segurança</h2>
            </div>
            <div data-tour="dashboard-hero">
              <CurrentSituationBlock />
            </div>
          </div>
        )}

        {/* 3. CRESCIMENTO */}
        <div className="mb-12">
          <CrescimentoBlock 
            income={metrics.income} 
            monthlyGoal={organization?.monthly_goal}
            periodLabel={periodLabel}
          />
        </div>

        {/* 4. PERFORMANCE — Análise do Período */}
        <div className="space-y-6 mb-12">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-info" />
              <h2 className="text-xl font-bold text-foreground uppercase tracking-tight">Análise do Período</h2>
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
                  <TabsList className="h-9">
                    <TabsTrigger value="day" className="text-xs px-3 h-8">Dia</TabsTrigger>
                    <TabsTrigger value="week" className="text-xs px-3 h-8">Semana</TabsTrigger>
                    <TabsTrigger value="month" className="text-xs px-3 h-8">Mês</TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setReferenceDate(navegarPeriodo(granularity, referenceDate, -1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setReferenceDate(navegarPeriodo(granularity, referenceDate, 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-6">
            <ClosedPeriodServices />
            {canViewFinance && !isActivationPhase && (
              <CompanyHealthCard />
            )}
          </div>
        </div>

        {/* 5. GRÁFICOS DETALHADOS — Final */}
        {canViewFinance && (
          <div className="mt-16 space-y-6 border-t pt-12">
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-bold text-foreground uppercase tracking-tight">Relatórios & Histórico</h2>
            </div>
            
            <div className="grid gap-8">
              <Suspense fallback={<div className="h-[350px] w-full animate-pulse bg-muted rounded-2xl" />}>
                <RevenueEvolutionChart granularity={granularity} chartStartDate={chartStart} chartEndDate={chartEnd} />
              </Suspense>
              
              <Suspense fallback={<div className="h-[350px] w-full animate-pulse bg-muted rounded-2xl" />}>
                <CashFlowChart granularity={granularity} chartStartDate={chartStart} chartEndDate={chartEnd} />
              </Suspense>
            </div>

            <Suspense fallback={<div className="h-[400px] w-full animate-pulse bg-muted rounded-2xl" />}>
              <TimePerformanceDashboard startDate={startDate} endDate={endDate} />
            </Suspense>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
