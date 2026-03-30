import { useState, useMemo } from "react";
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
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12 gap-8">
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground/90 sm:text-5xl lg:text-6xl bg-gradient-to-br from-foreground to-foreground/50 bg-clip-text text-transparent">
              Painel de Controle
            </h1>
            <p className="text-base font-medium text-muted-foreground/60 tracking-tight max-w-xl">
              Visão estratégica e saúde financeira do seu negócio com inteligência e precisão.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              onClick={() => navigate("/ordens-servico/nova")} 
              className="gap-2 shadow-[0_8px_20px_-4px_rgba(var(--primary),0.3)] rounded-2xl px-6 h-12 font-bold transition-all duration-300 hover:shadow-[0_12px_24px_-4px_rgba(var(--primary),0.4)] hover:-translate-y-1 active:scale-95 bg-primary text-primary-foreground border-none"
            >
              <Plus className="h-5 w-5" />
              <span>Nova Ordem de Serviço</span>
            </Button>
          </div>
        </div>

        {/* 1. Situação Atual */}
        {canViewFinance && (
          <div data-tour="dashboard-hero" className="mb-16">
            <CurrentSituationBlock />
          </div>
        )}

        {/* Period Selector Section */}
        {canViewFinance && (
          <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between mb-12 pb-8 border-b border-border/40">
            <div className="flex flex-col gap-2.5">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.25em] text-muted-foreground/40">
                Visualização por período
              </h3>
              <Tabs
                value={granularity}
                onValueChange={(v) => {
                  setGranularity(v as Granularity);
                  setReferenceDate(getHojeBRT());
                }}
                className="w-fit"
              >
                <TabsList className="h-11 bg-muted/30 p-1.5 border border-border/20 rounded-2xl">
                  <TabsTrigger value="day" className="text-xs font-bold px-6 h-8 rounded-xl data-[state=active]:shadow-md transition-all duration-300">Dia</TabsTrigger>
                  <TabsTrigger value="week" className="text-xs font-bold px-6 h-8 rounded-xl data-[state=active]:shadow-md transition-all duration-300">Semana</TabsTrigger>
                  <TabsTrigger value="month" className="text-xs font-bold px-6 h-8 rounded-xl data-[state=active]:shadow-md transition-all duration-300">Mês</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-2.5">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.25em] text-muted-foreground/40">
                Navegação temporal
              </h3>
              <div className="flex items-center gap-3 bg-muted/20 p-1.5 border border-border/20 rounded-2xl">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-background shadow-sm transition-all duration-200" onClick={() => setReferenceDate(navegarPeriodo(granularity, referenceDate, -1))}>
                  <ChevronLeft className="h-4 w-4 text-muted-foreground/60" />
                </Button>
                <span className="text-sm font-bold text-foreground/80 capitalize min-w-[160px] text-center period-transition tracking-tight" key={periodLabel}>
                  {periodLabel}
                </span>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-background shadow-sm transition-all duration-200" onClick={() => setReferenceDate(navegarPeriodo(granularity, referenceDate, 1))}>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-8 space-y-10">
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
          
          <div className="lg:col-span-4 space-y-10">
            {/* 3. Alertas */}
            <AlertasInteligentes />

            {/* 4. Serviços Fechados */}
            <ClosedPeriodServices />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
