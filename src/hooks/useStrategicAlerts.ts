import { useMemo } from "react";
import { useServices } from "./useServices";
import { useTransactions } from "./useTransactions";
import { useClients } from "./useClients";
import { useOrganization } from "./useOrganization";
import { useOperationalCapacityConfig } from "./useOperationalCapacityConfig";
import { getTodayInTz, formatDateObjInTz, DEFAULT_TIMEZONE } from "@/lib/timezone";

export interface StrategicAlert {
  id: string;
  level: "critical" | "opportunity" | "trend";
  title: string;
  description: string;
  financialImpact: string;
  consequence: string;
  actionLabel: string;
  actionRoute: string;
  /** numeric impact for sorting (higher = more relevant) */
  _impactValue: number;
}

export function useStrategicAlerts() {
  const { services, isLoading: sLoading } = useServices();
  const { transactions, isLoading: tLoading } = useTransactions();
  const { clients, isLoading: cLoading } = useClients();
  const { organization, isLoading: oLoading } = useOrganization();
  const { config, isLoading: capLoading } = useOperationalCapacityConfig();

  const isLoading = sLoading || tLoading || cLoading || oLoading || capLoading;

  const alerts = useMemo(() => {
    if (isLoading) return [];

    const now = new Date();
    const all: StrategicAlert[] = [];

    // ──────── CRITICAL ALERTS ────────

    // 1. Completed services with value = 0 or null (lost revenue)
    const zeroValueCompleted = (services || []).filter(
      (s) => s.status === "completed" && (!s.value || s.value === 0)
    );
    if (zeroValueCompleted.length > 0) {
      // Calculate average ticket from billable completed services
      const billable = (services || []).filter(
        (s) => s.status === "completed" && s.value && s.value > 0
      );
      const avgTicket =
        billable.length > 0
          ? billable.reduce((sum, s) => sum + (s.value || 0), 0) / billable.length
          : 0;
      const potentialLoss = avgTicket * zeroValueCompleted.length;

      if (avgTicket > 0) {
        all.push({
          id: "zero-value-services",
          level: "critical",
          title: `${zeroValueCompleted.length} serviço(s) sem valor definido`,
          description: `Serviços concluídos sem valor representam receita perdida.`,
          financialImpact: `R$ ${potentialLoss.toFixed(0)} em receita potencial`,
          consequence: "Receita não contabilizada no faturamento",
          actionLabel: "Revisar serviços",
          actionRoute: "/servicos",
          _impactValue: potentialLoss,
        });
      }
    }

    // 2. Overdue payments
    const overduePayments = (transactions || []).filter(
      (t) =>
        t.type === "income" &&
        t.status === "pending" &&
        t.due_date &&
        new Date(t.due_date) < now
    );
    if (overduePayments.length > 0) {
      const overdueTotal = overduePayments.reduce((s, t) => s + t.amount, 0);
      all.push({
        id: "overdue-payments",
        level: "critical",
        title: `${overduePayments.length} pagamento(s) vencido(s)`,
        description: `Valores pendentes com data de vencimento ultrapassada.`,
        financialImpact: `R$ ${overdueTotal.toFixed(0)} em risco`,
        consequence: "Pode comprometer o fluxo de caixa",
        actionLabel: "Resolver agora",
        actionRoute: "/ia/pagamentos-vencidos",
        _impactValue: overdueTotal,
      });
    }

    // 3. Revenue projection below monthly goal
    const monthlyGoal = organization?.monthly_goal;
    if (monthlyGoal && monthlyGoal > 0) {
      const todayStr = getTodayInTz(DEFAULT_TIMEZONE);
      const limite30 = new Date();
      limite30.setDate(now.getDate() + 30);
      const limite30Str = formatDateObjInTz(limite30, DEFAULT_TIMEZONE);

      const projectedRevenue = (services || [])
        .filter(
          (s) =>
            (s.status === "scheduled" || s.status === "in_progress") &&
            s.scheduled_date &&
            s.scheduled_date.substring(0, 10) >= todayStr &&
            s.scheduled_date.substring(0, 10) <= limite30Str &&
            Number(s.value) > 0
        )
        .reduce((sum, s) => sum + (Number(s.value) || 0), 0);

      // Add already received this month
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const receivedThisMonth = (transactions || [])
        .filter(
          (t) =>
            t.type === "income" &&
            t.status === "paid" &&
            t.payment_date &&
            new Date(t.payment_date) >= monthStart
        )
        .reduce((sum, t) => sum + t.amount, 0);

      const totalProjected = receivedThisMonth + projectedRevenue;
      const gap = monthlyGoal - totalProjected;

      if (gap > 0 && gap > monthlyGoal * 0.2) {
        all.push({
          id: "goal-at-risk",
          level: "critical",
          title: "Meta mensal em risco",
          description: `Projeção de R$ ${totalProjected.toFixed(0)} está abaixo da meta de R$ ${monthlyGoal.toFixed(0)}.`,
          financialImpact: `R$ ${gap.toFixed(0)} faltando para a meta`,
          consequence: "Pode não atingir o objetivo do mês",
          actionLabel: "Ver projeção",
          actionRoute: "/ia/receita-prevista",
          _impactValue: gap,
        });
      }
    }

    // 4. Completed OS with overdue payment
    const paidServiceIds = new Set(
      (transactions || [])
        .filter((t) => t.type === "income" && t.service_id && t.status === "paid")
        .map((t) => t.service_id)
    );
    const unpaidCompleted = (services || []).filter(
      (s) =>
        s.status === "completed" &&
        s.value &&
        s.value > 0 &&
        s.payment_due_date &&
        new Date(s.payment_due_date) < now &&
        !paidServiceIds.has(s.id)
    );
    if (unpaidCompleted.length > 0) {
      const unpaidTotal = unpaidCompleted.reduce((sum, s) => sum + (s.value || 0), 0);
      all.push({
        id: "unpaid-completed-os",
        level: "critical",
        title: `${unpaidCompleted.length} OS concluída(s) sem pagamento`,
        description: `Serviços finalizados com pagamento em atraso.`,
        financialImpact: `R$ ${unpaidTotal.toFixed(0)} a receber`,
        consequence: "Receita realizada mas não recebida",
        actionLabel: "Cobrar agora",
        actionRoute: "/ia/pagamentos-vencidos",
        _impactValue: unpaidTotal,
      });
    }

    // ──────── OPPORTUNITY ALERTS ────────

    // 5. Idle hours convertible to revenue
    if (config) {
      const todayStr = getTodayInTz(DEFAULT_TIMEZONE);
      const next7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const next7Str = formatDateObjInTz(next7, DEFAULT_TIMEZONE);

      const scheduledNext7 = (services || []).filter(
        (s) =>
          s.status === "scheduled" &&
          s.scheduled_date &&
          s.scheduled_date.substring(0, 10) >= todayStr &&
          s.scheduled_date.substring(0, 10) <= next7Str
      );

      // Estimate: average 90 min per service
      const avgServiceMin = 90;
      const occupiedMin = scheduledNext7.length * avgServiceMin;
      const weekdaysNext7 = 5; // rough estimate
      const dailyCapacity = config.total_minutes_per_day * config.active_teams;
      const weeklyCapacity = dailyCapacity * weekdaysNext7;
      const idleMin = Math.max(0, weeklyCapacity - occupiedMin);

      if (idleMin > weeklyCapacity * 0.4 && weeklyCapacity > 0) {
        // Calculate potential revenue from idle hours
        const billable = (services || []).filter(
          (s) => s.status === "completed" && s.value && s.value > 0
        );
        const avgTicket =
          billable.length > 0
            ? billable.reduce((sum, s) => sum + (s.value || 0), 0) / billable.length
            : 0;
        const potentialServices = Math.floor(idleMin / avgServiceMin);
        const potentialRevenue = potentialServices * avgTicket;

        if (potentialRevenue > 0) {
          all.push({
            id: "idle-capacity",
            level: "opportunity",
            title: "Capacidade ociosa convertível",
            description: `${Math.floor(idleMin / 60)}h disponíveis nos próximos 7 dias.`,
            financialImpact: `R$ ${potentialRevenue.toFixed(0)} em receita potencial`,
            consequence: `Até ${potentialServices} serviços podem ser agendados`,
            actionLabel: "Ver agenda",
            actionRoute: "/agenda",
            _impactValue: potentialRevenue,
          });
        }
      }
    }

    // 6. Inactive clients with high ticket history
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const clientLastService: Record<string, { date: Date; totalValue: number; count: number }> = {};
    (services || []).forEach((s) => {
      if (s.status !== "completed") return;
      const d = s.completed_date || s.scheduled_date || s.created_at;
      if (d) {
        const date = new Date(d);
        if (!clientLastService[s.client_id]) {
          clientLastService[s.client_id] = { date, totalValue: 0, count: 0 };
        }
        if (date > clientLastService[s.client_id].date) {
          clientLastService[s.client_id].date = date;
        }
        clientLastService[s.client_id].totalValue += Number(s.value) || 0;
        clientLastService[s.client_id].count += 1;
      }
    });

    const inactiveHighValue = (clients || []).filter((c) => {
      const info = clientLastService[c.id];
      if (!info) return false;
      const avgClientTicket = info.count > 0 ? info.totalValue / info.count : 0;
      return info.date < sixMonthsAgo && avgClientTicket > 200;
    });

    if (inactiveHighValue.length > 0) {
      const totalPotential = inactiveHighValue.reduce((sum, c) => {
        const info = clientLastService[c.id];
        return sum + (info ? info.totalValue / info.count : 0);
      }, 0);

      all.push({
        id: "inactive-high-value",
        level: "opportunity",
        title: `${inactiveHighValue.length} cliente(s) de alto valor inativo(s)`,
        description: `Clientes com ticket médio alto sem serviço há 6+ meses.`,
        financialImpact: `R$ ${totalPotential.toFixed(0)} em receita recorrente potencial`,
        consequence: "Oportunidade de reativação com alto retorno",
        actionLabel: "Ver clientes",
        actionRoute: "/ia/clientes-inativos",
        _impactValue: totalPotential,
      });
    }

    // ──────── TREND ALERTS ────────

    // 7. Weekly revenue deceleration (compare last 2 complete weeks)
    const getWeekStart = (weeksAgo: number) => {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay() - weeksAgo * 7);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const week1Start = getWeekStart(2);
    const week1End = getWeekStart(1);
    const week2Start = getWeekStart(1);
    const week2End = getWeekStart(0);

    const weekRevenue = (start: Date, end: Date) =>
      (transactions || [])
        .filter(
          (t) =>
            t.type === "income" &&
            t.status === "paid" &&
            t.payment_date &&
            new Date(t.payment_date) >= start &&
            new Date(t.payment_date) < end
        )
        .reduce((sum, t) => sum + t.amount, 0);

    const rev1 = weekRevenue(week1Start, week1End);
    const rev2 = weekRevenue(week2Start, week2End);

    if (rev1 > 0 && rev2 < rev1 * 0.7) {
      const drop = rev1 - rev2;
      all.push({
        id: "revenue-deceleration",
        level: "trend",
        title: "Receita em desaceleração",
        description: `Receita caiu ${((1 - rev2 / rev1) * 100).toFixed(0)}% na última semana.`,
        financialImpact: `Queda de R$ ${drop.toFixed(0)}`,
        consequence: "Tendência de queda pode impactar o mês",
        actionLabel: "Analisar",
        actionRoute: "/ia/receita-prevista",
        _impactValue: drop,
      });
    }

    // 8. Increasing cancellations
    const recentCancelled = (services || []).filter(
      (s) =>
        s.status === "cancelled" &&
        new Date(s.updated_at) >= new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    );
    const olderCancelled = (services || []).filter(
      (s) =>
        s.status === "cancelled" &&
        new Date(s.updated_at) >= new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000) &&
        new Date(s.updated_at) < new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    );

    if (recentCancelled.length > 2 && recentCancelled.length > olderCancelled.length * 1.5) {
      const lostRevenue = recentCancelled.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
      all.push({
        id: "rising-cancellations",
        level: "trend",
        title: "Cancelamentos em alta",
        description: `${recentCancelled.length} cancelamentos nas últimas 2 semanas vs ${olderCancelled.length} antes.`,
        financialImpact: `R$ ${lostRevenue.toFixed(0)} em receita perdida`,
        consequence: "Tendência de aumento nos cancelamentos",
        actionLabel: "Investigar",
        actionRoute: "/servicos",
        _impactValue: lostRevenue,
      });
    }

    // ──── SORT & LIMIT ────
    const levelOrder = { critical: 0, opportunity: 1, trend: 2 };
    all.sort((a, b) => {
      const levelDiff = levelOrder[a.level] - levelOrder[b.level];
      if (levelDiff !== 0) return levelDiff;
      return b._impactValue - a._impactValue;
    });

    return all.slice(0, 3);
  }, [services, transactions, clients, organization, config, isLoading]);

  return { alerts, isLoading };
}
