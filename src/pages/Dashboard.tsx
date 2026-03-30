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
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground/90 sm:text-4xl">
              Painel de Controle
            </h1>
            <p className="text-sm font-medium text-muted-foreground/60 tracking-tight">
              Visão estratégica e saúde financeira do seu negócio
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => navigate("/ordens-servico/nova")} className="gap-2 shadow-sm rounded-xl px-5 h-11 font-bold transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
              <Plus className="h-4 w-4" />
              <span>Nova Ordem de Serviço</span>
            </Button>
          </div>
        </div>

        {/* 1. Situação Atual */}
        {canViewFinance && (
          <div data-tour="dashboard-hero" className="mb-12">
            <CurrentSituationBlock />
          </div>
        )}

        {/* Period Selector Section */}
        {canViewFinance && (
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between mb-8 pb-6 border-b border-border/40">
            <div className="flex flex-col gap-1.5">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">
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
                <TabsList className="h-10 bg-muted/40 p-1 border border-border/20 rounded-xl">
                  <TabsTrigger value="day" className="text-xs font-bold px-5 h-8 rounded-lg data-[state=active]:shadow-sm">Dia</TabsTrigger>
                  <TabsTrigger value="week" className="text-xs font-bold px-5 h-8 rounded-lg data-[state=active]:shadow-sm">Semana</TabsTrigger>
                  <TabsTrigger value="month" className="text-xs font-bold px-5 h-8 rounded-lg data-[state=active]:shadow-sm">Mês</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-1.5">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">
                Navegação
              </h3>
              <div className="flex items-center gap-2 bg-muted/30 p-1 border border-border/20 rounded-xl">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-background" onClick={() => setReferenceDate(navegarPeriodo(granularity, referenceDate, -1))}>
                  <ChevronLeft className="h-4 w-4 text-muted-foreground/60" />
                </Button>
                <span className="text-sm font-bold text-foreground/70 capitalize min-w-[150px] text-center period-transition tracking-tight" key={periodLabel}>
                  {periodLabel}
                </span>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-background" onClick={() => setReferenceDate(navegarPeriodo(granularity, referenceDate, 1))}>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
                </Button>
              </div>
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
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
