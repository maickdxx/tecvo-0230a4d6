import { useState, useMemo, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, Plus } from "lucide-react";
import { useOrganization } from "@/hooks/useOrganization";
import { AppLayout } from "@/components/layout";
import { useAutoSeedDemo } from "@/hooks/useAutoSeedDemo";
import { useDemoMode } from "@/hooks/useDemoMode";
import { useAuth } from "@/hooks/useAuth";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import {
  ExecutiveHeroBlock,
} from "@/components/dashboard";
import { CurrentSituationBlock } from "@/components/dashboard/CurrentSituationBlock";
import { AlertasInteligentes } from "@/components/dashboard/AlertasInteligentes";
import { ClosedPeriodServices } from "@/components/dashboard/ClosedPeriodServices";
import { DashboardGreeting } from "@/components/dashboard/DashboardGreeting";
import { TrialUrgencyBanner } from "@/components/dashboard/TrialUrgencyBanner";


import { MoneyOnTable } from "@/components/dashboard/MoneyOnTable";
import { TomorrowServices } from "@/components/dashboard/TomorrowServices";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { useUserRole } from "@/hooks/useUserRole";
import {
  type Granularity,
  getPeriodoAtivo,
  getPeriodoAnterior,
  navegarPeriodo,
  getLabelPeriodo,
} from "@/lib/periodoGlobal";
import { getTodayInTz } from "@/lib/timezone";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

function parseDateOnly(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isPreparing } = useAutoSeedDemo();
  const { organizationId } = useAuth();
  const tz = useOrgTimezone();
  const hasTrackedDashboard = useRef(false);
  const todayInOrgTimezone = useMemo(() => parseDateOnly(getTodayInTz(tz)), [tz]);

  useEffect(() => {
    if (!hasTrackedDashboard.current) {
      hasTrackedDashboard.current = true;
      import("@/lib/fbPixel").then(({ trackFBCustomEvent }) => {
        trackFBCustomEvent("Dashboard");
      });
    }
  }, []);

  useEffect(() => {
    setReferenceDate(todayInOrgTimezone);
  }, [todayInOrgTimezone]);

  useEffect(() => {
    if (!organizationId) return;

    [
      ["dashboard-metrics"],
      ["money-on-table"],
      ["closed-period-services"],
      ["tomorrow-services"],
      ["transactions"],
      ["financial-accounts"],
      ["services"],
      ["clients"],
    ].forEach((queryKey) => {
      queryClient.invalidateQueries({ queryKey });
    });
  }, [organizationId, queryClient]);

  const [granularity, setGranularity] = useState<Granularity>("month");
  const [referenceDate, setReferenceDate] = useState(() => todayInOrgTimezone);

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
      <div className="page-enter space-y-8 pb-10">
        <DashboardGreeting />
        
        <TrialUrgencyBanner />

        {/* Alerts & Critical Info — Always at top if relevant */}
        <div className="space-y-6">
          {canViewFinance && <MoneyOnTable />}
          <AlertasInteligentes />
        </div>

        {/* Financial Section — Only for admins/owners */}
        {canViewFinance && (
          <div className="space-y-6 animate-in fade-in duration-500 delay-150">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground tracking-tight">Painel Financeiro</h2>
                <p className="text-sm text-muted-foreground">Resumo estratégico do seu negócio</p>
              </div>
              <Button size="sm" onClick={() => navigate("/ordens-servico/nova")} className="gap-1.5 shadow-sm active:scale-95 transition-transform">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Nova OS</span>
              </Button>
            </div>

            <div data-tour="dashboard-hero">
              <CurrentSituationBlock />
            </div>

            {/* Period Selector & Hero Block */}
            <div className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-card/40 border border-border/40 p-3 rounded-xl">
                <Tabs
                  value={granularity}
                  onValueChange={(v) => {
                    setGranularity(v as Granularity);
                    setReferenceDate(todayInOrgTimezone);
                  }}
                  className="w-full sm:w-auto"
                >
                  <TabsList className="h-8 w-full sm:w-auto grid grid-cols-3 sm:flex">
                    <TabsTrigger value="day" className="text-xs px-4 h-7">Dia</TabsTrigger>
                    <TabsTrigger value="week" className="text-xs px-4 h-7">Semana</TabsTrigger>
                    <TabsTrigger value="month" className="text-xs px-4 h-7">Mês</TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="flex items-center justify-between sm:justify-end gap-1.5 w-full sm:w-auto">
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" onClick={() => setReferenceDate(navegarPeriodo(granularity, referenceDate, -1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-semibold text-foreground capitalize min-w-[140px] text-center period-transition py-1 px-2 bg-muted/50 rounded-lg" key={periodLabel}>
                    {periodLabel}
                  </span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" onClick={() => setReferenceDate(navegarPeriodo(granularity, referenceDate, 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

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
            </div>
          </div>
        )}

        {/* Secondary Info Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div className="space-y-6">
            <TomorrowServices />
          </div>
          <div className="space-y-6">
            <ClosedPeriodServices />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
