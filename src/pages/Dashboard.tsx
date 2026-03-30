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
      <div className="page-enter pb-20 md:pb-12 max-w-7xl mx-auto">
        <DashboardBanners />

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 px-1">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Visão Geral</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base font-medium opacity-80">
              Sua central de controle estratégica
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 hidden md:flex h-10 border-border/60 hover:bg-muted/50 transition-all"
              onClick={handleOpenTutorial}
              disabled={resetOnboardingMutation.isPending}
            >
              <BookOpen className="h-4 w-4" />
              Tutorial
            </Button>
            <DashboardCustomizeDialog />
            <Button size="sm" onClick={() => navigate("/ordens-servico/nova")} className="gap-2 h-10 shadow-sm shadow-primary/20">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nova OS</span>
            </Button>
          </div>
        </div>

        {/* 1. FOCO DO DIA (TOPO) */}
        <section className="mb-14">
          <FocoDoDia />
        </section>

        {/* 2. CAIXA (SEGURANÇA) */}
        {canViewFinance && !isActivationPhase && (
          <section className="mb-14 space-y-6">
            <div className="flex items-center gap-2.5 px-1">
              <div className="p-2 rounded-lg bg-primary/10">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-foreground tracking-tight uppercase opacity-90">Caixa & Segurança</h2>
            </div>
            <div data-tour="dashboard-hero">
              <CurrentSituationBlock />
            </div>
          </section>
        )}

        {/* 3. CRESCIMENTO */}
        <section className="mb-14">
          <CrescimentoBlock 
            income={metrics.income} 
            monthlyGoal={organization?.monthly_goal}
            periodLabel={periodLabel}
          />
        </section>

        {/* 4. PERFORMANCE — Análise do Período */}
        <section className="space-y-8 mb-14">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 px-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-info/10">
                <Clock className="h-5 w-5 text-info" />
              </div>
              <h2 className="text-lg font-bold text-foreground tracking-tight uppercase opacity-90">Análise do Período</h2>
            </div>

            {canViewFinance && (
              <div className="flex items-center gap-4 bg-muted/30 p-1 rounded-xl border border-border/40">
                <Tabs
                  value={granularity}
                  onValueChange={(v) => {
                    setGranularity(v as Granularity);
                    setReferenceDate(getHojeBRT());
                  }}
                  className="w-full sm:w-auto"
                >
                  <TabsList className="h-9 bg-transparent p-0">
                    <TabsTrigger value="day" className="text-xs px-4 h-8 data-[state=active]:bg-card data-[state=active]:shadow-sm">Dia</TabsTrigger>
                    <TabsTrigger value="week" className="text-xs px-4 h-8 data-[state=active]:bg-card data-[state=active]:shadow-sm">Semana</TabsTrigger>
                    <TabsTrigger value="month" className="text-xs px-4 h-8 data-[state=active]:bg-card data-[state=active]:shadow-sm">Mês</TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="flex items-center gap-1 border-l border-border/60 pl-3">
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-card" onClick={() => setReferenceDate(navegarPeriodo(granularity, referenceDate, -1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-card" onClick={() => setReferenceDate(navegarPeriodo(granularity, referenceDate, 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-8">
            <ClosedPeriodServices />
            {canViewFinance && !isActivationPhase && (
              <CompanyHealthCard />
            )}
          </div>
        </section>

        {/* 5. GRÁFICOS DETALHADOS — Final */}
        {canViewFinance && (
          <section className="mt-20 space-y-10 border-t border-border/40 pt-16">
            <div className="flex items-center gap-2.5 mb-8">
              <div className="p-2 rounded-lg bg-muted/10">
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-bold text-foreground tracking-tight uppercase opacity-90">Relatórios & Histórico</h2>
            </div>
            
            <div className="grid gap-12 lg:grid-cols-2">
              <Suspense fallback={<div className="h-[350px] w-full animate-pulse bg-muted/20 rounded-3xl" />}>
                <RevenueEvolutionChart granularity={granularity} chartStartDate={chartStart} chartEndDate={chartEnd} />
              </Suspense>
              
              <Suspense fallback={<div className="h-[350px] w-full animate-pulse bg-muted/20 rounded-3xl" />}>
                <CashFlowChart granularity={granularity} chartStartDate={chartStart} chartEndDate={chartEnd} />
              </Suspense>
            </div>

            <Suspense fallback={<div className="h-[400px] w-full animate-pulse bg-muted/20 rounded-3xl" />}>
              <TimePerformanceDashboard startDate={startDate} endDate={endDate} />
            </Suspense>
          </section>
        )}

      </div>
    </AppLayout>
  );
}
