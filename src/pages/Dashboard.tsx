import { useState, useMemo, type ReactNode } from "react";
import { BarChart3, ChevronLeft, ChevronRight, Loader2, Plus, BookOpen } from "lucide-react";
import { useOrganization } from "@/hooks/useOrganization";
import { AppLayout } from "@/components/layout";
import { GuidedOnboardingCard, PageTutorialBanner } from "@/components/onboarding";
import { DemoConversionBanner } from "@/components/demo/DemoConversionBanner";
import { ValueMilestoneBanner } from "@/components/dashboard/ValueMilestoneBanner";
import { useAutoSeedDemo } from "@/hooks/useAutoSeedDemo";
import { useGuidedOnboarding } from "@/hooks/useGuidedOnboarding";
import { useDemoMode } from "@/hooks/useDemoMode";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  CashFlowChart,
  PaymentMethodChart,
  RevenueEvolutionChart,
  CompanyHealthCard,
  DashboardSection,
} from "@/components/dashboard";
import { TimePerformanceDashboard } from "@/components/dashboard/TimePerformanceDashboard";
import { CurrentSituationBlock } from "@/components/dashboard/CurrentSituationBlock";
import { ExecutiveHeroBlock } from "@/components/dashboard/ExecutiveHeroBlock";
import { RevenueEngineBlock } from "@/components/dashboard/RevenueEngineBlock";
import { WeatherForecast } from "@/components/dashboard/WeatherForecast";
import { TodayBlock } from "@/components/dashboard/TodayBlock";
import { WhatsAppPromptCard } from "@/components/dashboard/WhatsAppPromptCard";
import { AgendaResumo } from "@/components/dashboard/AgendaResumo";
import { AlertasInteligentes } from "@/components/dashboard/AlertasInteligentes";
import { ClosedPeriodServices } from "@/components/dashboard/ClosedPeriodServices";
import { PaymentFeeReport } from "@/components/finance/PaymentFeeReport";
import { DashboardCustomizeDialog } from "@/components/dashboard/DashboardCustomizeDialog";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { usePermissions } from "@/hooks/usePermissions";
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
  const { hasPermission } = usePermissions();
  const canViewFinance = hasPermission("finance.view");
  const { layout, isVisible } = useDashboardLayout();

  // Build widget map
  const widgetMap: Record<string, ReactNode> = {
    bloco_hoje: isVisible("bloco_hoje") ? <TodayBlock startDate={startDate} endDate={endDate} periodLabel={periodLabel} /> : null,

    resultado_periodo: canViewFinance && isVisible("resultado_periodo") ? (
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
    ) : null,

    agenda_resumida: null, // Removed — times were unreliable and block was not useful

    alertas_inteligentes: isVisible("alertas_inteligentes") ? <AlertasInteligentes /> : null,

    eficiencia_operacional: isVisible("eficiencia_operacional") ? (
      <div className="min-w-0 overflow-hidden">
        <ClosedPeriodServices />
        <div className="mt-5">
          <WeatherForecast />
        </div>
      </div>
    ) : null,

    motor_receita: canViewFinance && isVisible("motor_receita") ? (
      <RevenueEngineBlock
        revenueByType={metrics.revenueByType}
        countByType={metrics.countByType}
        averageTicket={metrics.averageTicket}
      />
    ) : null,

    saude_empresa: canViewFinance && isVisible("saude_empresa") && !isActivationPhase ? (
      <div className="mb-5">
        <CompanyHealthCard />
      </div>
    ) : null,

    graficos_detalhados: canViewFinance && isVisible("graficos_detalhados") ? (
      <DashboardSection title="Gráficos Detalhados" icon={BarChart3}>
        <div className="grid gap-4 lg:grid-cols-2">
          <RevenueEvolutionChart granularity={granularity} chartStartDate={chartStart} chartEndDate={chartEnd} />
          <PaymentMethodChart startDate={startDate} endDate={endDate} />
        </div>
        <CashFlowChart granularity={granularity} chartStartDate={chartStart} chartEndDate={chartEnd} />
        <PaymentFeeReport startDate={startDate} endDate={endDate} />
      </DashboardSection>
    ) : null,

    performance_tempo: canViewFinance && isVisible("performance_tempo") ? (
      <TimePerformanceDashboard startDate={startDate} endDate={endDate} />
    ) : null,
  };

  // Pair motor_receita + eficiencia_operacional when adjacent
  const orderedWidgets = (() => {
    const result: ReactNode[] = [];
    const ids = layout.map((w) => w.id);

    let i = 0;
    while (i < ids.length) {
      const id = ids[i];
      const nextId = ids[i + 1];

      const isPair =
        (id === "motor_receita" && nextId === "eficiencia_operacional") ||
        (id === "eficiencia_operacional" && nextId === "motor_receita");

      if (isPair) {
        const firstNode = widgetMap[id];
        const secondNode = widgetMap[nextId!];
        if (firstNode || secondNode) {
          const bothVisible = !!firstNode && !!secondNode;
          result.push(
            <div key={`pair-${id}-${nextId}`} className={`grid gap-5 mb-5 overflow-hidden ${bothVisible ? "lg:grid-cols-2" : "lg:grid-cols-1"}`}>
              <div className="min-w-0">{firstNode}</div>
              <div className="min-w-0">{secondNode}</div>
            </div>
          );
        }
        i += 2;
      } else {
        const node = widgetMap[id];
        if (node) {
          result.push(<div key={id}>{node}</div>);
        }
        i += 1;
      }
    }

    return result;
  })();

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
        <DemoConversionBanner />
        <GuidedOnboardingCard />
        {!isActivationPhase && (
          <>
            <WhatsAppPromptCard />
            <ValueMilestoneBanner />
            <PageTutorialBanner pageKey="dashboard" title="Visão Geral" message="Este é o painel da sua empresa. Aqui você vê o que realmente entrou de dinheiro e o que ainda vai entrar." />
          </>
        )}

        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Painel de Controle</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Resumo do desempenho da empresa</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 hidden md:flex"
              onClick={handleOpenTutorial}
              disabled={resetOnboardingMutation.isPending}
            >
              <BookOpen className="h-4 w-4" />
              Ver tutorial
            </Button>
            <DashboardCustomizeDialog />
            <Button size="sm" onClick={() => navigate("/ordens-servico/nova")} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Nova OS</span>
            </Button>
          </div>
        </div>

        {/* Situação Atual — hidden during activation phase to avoid confusing new users */}
        {canViewFinance && !isActivationPhase && (
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

        {/* Dynamic widget rendering based on saved layout order */}
        {orderedWidgets}
      </div>
    </AppLayout>
  );
}
