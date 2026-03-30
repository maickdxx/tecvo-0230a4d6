import { useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  CalendarDays, 
  Clock, 
  AlertTriangle, 
  FileText, 
  UserX, 
  TrendingUp, 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  DollarSign, 
  MessageCircle, 
  Timer, 
  Target, 
  Rocket, 
  CheckCircle2, 
  MessageSquare 
} from "lucide-react";
import { useServices } from "@/hooks/useServices";
import { useClients } from "@/hooks/useClients";
import { useTransactions } from "@/hooks/useTransactions";
import { format, subDays, subMonths, differenceInDays, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAdaptivePrioritization } from "@/hooks/useAdaptivePrioritization";
import { useDailyRoutine } from "@/hooks/useDailyRoutine";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

type PriorityLevel = "high" | "medium" | "low";
type ConfidenceLevel = "high" | "medium" | "low";

interface DashboardAction {
  id: string;
  title: string;
  recommendation: string;
  impactValue: number;
  impactText: string;
  timeLabel: string;
  estimatedTime: string;
  icon: any;
  priorityLevel: PriorityLevel;
  confidence: ConfidenceLevel;
  score: number;
  action: () => void;
  directAction?: {
    label: string;
    action: () => void;
    icon?: any;
    description: string;
  };
  color: string;
  bg: string;
  insight?: string;
}

export function TodayActionsBlock({ isLeanView = false }: { isLeanView?: boolean }) {
  const navigate = useNavigate();
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  
  const { services, isLoading: isLoadingServices } = useServices();
  const { clients, isLoading: isLoadingClients } = useClients();
  const { transactions, isLoading: isLoadingTransactions } = useTransactions();
  const { recordInteraction, recordResult, getScoreAdjustment, getAdaptiveInsight, history } = useAdaptivePrioritization();
  const { markAlertAsCompleted, completedAlerts } = useDailyRoutine();

  const counts = useMemo(() => {
    return {
      overdue_services: services.filter((s) => {
        if (!s.scheduled_date || s.status === "completed" || s.status === "cancelled" || s.document_type === "quote") return false;
        return s.scheduled_date.substring(0, 10) < todayStr;
      }),
      overdue_payments: transactions.filter(
        (t) => t.status === "pending" && t.due_date && t.due_date < todayStr && t.type === "income"
      ),
      pending_quotes: services.filter(
        (s) => s.document_type === "quote" && s.status === "scheduled" && s.created_at.substring(0, 10) <= format(subDays(today, 3), "yyyy-MM-dd")
      ),
      inactive_clients: (() => {
        const sixMonthsAgo = format(subMonths(today, 6), "yyyy-MM-dd");
        const lastServiceByClient: Record<string, string> = {};
        services.forEach((s) => {
          if (s.status !== "completed") return;
          const date = s.completed_date || s.scheduled_date || s.created_at;
          if (!lastServiceByClient[s.client_id] || date > lastServiceByClient[s.client_id]) {
            lastServiceByClient[s.client_id] = date;
          }
        });
        return clients.filter((c) => {
          const lastDate = lastServiceByClient[c.id];
          return lastDate ? lastDate < sixMonthsAgo : false;
        });
      })(),
      today_services: services.filter(
        (s) => s.scheduled_date?.startsWith(todayStr) && s.status !== "cancelled" && s.document_type !== "quote"
      )
    };
  }, [services, clients, transactions, todayStr, today]);

  const actions = useMemo(() => {
    const result: DashboardAction[] = [];

    const getConfidence = (id: string): ConfidenceLevel => {
      const data = history[id];
      if (!data) return "low";
      if (data.successFrequency > 0.7 || data.resolutions > 8) return "high";
      if (data.successFrequency > 0.4 || data.resolutions > 4) return "medium";
      return "low";
    };

    // 1. Overdue services
    if (counts.overdue_services.length > 0) {
      const impactValue = counts.overdue_services.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
      const oldestDate = counts.overdue_services.reduce((oldest, s) => s.scheduled_date < oldest ? s.scheduled_date : oldest, counts.overdue_services[0].scheduled_date);
      const daysOverdue = differenceInDays(today, new Date(oldestDate));
      
      const baseScore = 1000 + (impactValue / 100) + (daysOverdue * 50);
      const adjustedScore = baseScore + getScoreAdjustment("overdue-services", baseScore);
      const historyData = history["overdue-services"];

      result.push({
        id: "overdue-services",
        title: `${counts.overdue_services.length} serviço${counts.overdue_services.length > 1 ? "s" : ""} em atraso`,
        recommendation: `Regularize ${counts.overdue_services.length} serviços e recupere ${formatCurrency(impactValue)}`,
        impactValue,
        impactText: historyData?.totalValueGenerated ? `Já evitou perda de ${formatCurrency(historyData.totalValueGenerated)}` : `Recupere ${formatCurrency(impactValue)} agora`,
        timeLabel: `há ${daysOverdue} d`,
        estimatedTime: "15 min",
        icon: AlertTriangle,
        priorityLevel: "high",
        confidence: getConfidence("overdue-services"),
        score: adjustedScore,
        action: () => {
          recordInteraction("overdue-services", "click");
          markAlertAsCompleted("overdue-services");
          navigate("/ordens-servico?status=overdue");
        },
        directAction: {
          label: "Resolver agora",
          icon: Zap,
          description: "Abre a OS em atraso para atualização",
          action: () => {
            const firstId = counts.overdue_services[0].id;
            markAlertAsCompleted("overdue-services");
            recordResult("overdue-services", Number(counts.overdue_services[0].value) || 0, "recovery");
            navigate(`/ordens-servico/${firstId}`);
            toast.success("Ação iniciada", {
              description: "Você está no caminho para resolver um serviço atrasado."
            });
          }
        },
        color: "text-destructive",
        bg: "bg-destructive/10",
        insight: getAdaptiveInsight("overdue-services", "Resolver isso libera o fluxo operacional."),
      });
    }

    // 2. Overdue payments
    if (counts.overdue_payments.length > 0) {
      const total = counts.overdue_payments.reduce((sum, t) => sum + Number(t.amount), 0);
      const oldestDate = counts.overdue_payments.reduce((oldest, t) => t.due_date! < oldest ? t.due_date! : oldest, counts.overdue_payments[0].due_date!);
      const daysOverdue = differenceInDays(today, new Date(oldestDate));

      const baseScore = 1100 + (total / 100) + (daysOverdue * 60);
      const adjustedScore = baseScore + getScoreAdjustment("overdue-payments", baseScore);
      const historyData = history["overdue-payments"];

      result.push({
        id: "overdue-payments",
        title: "Pagamentos vencidos",
        recommendation: `Cobrar ${counts.overdue_payments.length} clientes agora para recuperar ${formatCurrency(total)}`,
        impactValue: total,
        impactText: historyData?.totalValueGenerated ? `Recuperou ${formatCurrency(historyData.totalValueGenerated)} com cobrança` : `Recupere ${formatCurrency(total)} parados`,
        timeLabel: `há ${daysOverdue} d`,
        estimatedTime: "3 min",
        icon: DollarSign,
        priorityLevel: "high",
        confidence: getConfidence("overdue-payments"),
        score: adjustedScore,
        action: () => {
          recordInteraction("overdue-payments", "click");
          markAlertAsCompleted("overdue-payments");
          navigate("/financeiro?tab=receivable&status=overdue");
        },
        directAction: {
          label: "Cobrar agora",
          icon: MessageSquare,
          description: "Gera mensagem de cobrança no WhatsApp",
          action: () => {
            const t = counts.overdue_payments[0];
            const client = clients.find(c => c.id === t.client_id);
            const clientName = client?.name || "Cliente";
            const phone = client?.phone || "";
            const formattedAmount = formatCurrency(Number(t.amount));
            const formattedDate = format(parseISO(t.due_date!), "dd/MM/yyyy");
            
            const message = `Olá ${clientName}, tudo bem? Consta em nosso sistema um pagamento pendente de ${formattedAmount} com vencimento em ${formattedDate}. Segue o link para regularização ou podemos conversar sobre a melhor forma?`;
            
            if (phone) {
              const cleanPhone = phone.replace(/\D/g, "");
              markAlertAsCompleted("overdue-payments");
              recordResult("overdue-payments", Number(t.amount), "recovery");
              window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
              toast.success("Ação de cobrança iniciada", {
                description: `Você acabou de agir sobre ${formattedAmount}.`,
                icon: <CheckCircle2 className="h-4 w-4 text-success" />
              });
            } else {
              toast.error("Erro", {
                description: "Cliente sem telefone cadastrado para WhatsApp."
              });
            }
          }
        },
        color: "text-destructive",
        bg: "bg-destructive/10",
        insight: getAdaptiveInsight("overdue-payments", "Cobrança imediata melhora o caixa hoje."),
      });
    }

    // 3. Pending quotes
    if (counts.pending_quotes.length > 0) {
      const totalValue = counts.pending_quotes.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
      const oldestDate = counts.pending_quotes.reduce((oldest, s) => s.created_at < oldest ? s.created_at : oldest, counts.pending_quotes[0].created_at);
      const daysPending = differenceInDays(today, new Date(oldestDate));

      const baseScore = 800 + (totalValue / 200) + (daysPending * 30);
      const adjustedScore = baseScore + getScoreAdjustment("pending-quotes", baseScore);
      const historyData = history["pending-quotes"];

      result.push({
        id: "pending-quotes",
        title: "Orçamentos parados",
        recommendation: `Fale com esses ${counts.pending_quotes.length} clientes agora e pode fechar ${formatCurrency(totalValue)}`,
        impactValue: totalValue,
        impactText: historyData?.totalValueGenerated ? `Já converteu ${formatCurrency(historyData.totalValueGenerated)}` : `Liberar ${formatCurrency(totalValue)} em caixa`,
        timeLabel: `há ${daysPending} dias`,
        estimatedTime: "2 min",
        icon: Zap,
        priorityLevel: "high",
        confidence: getConfidence("pending-quotes"),
        score: adjustedScore,
        action: () => {
          recordInteraction("pending-quotes", "click");
          markAlertAsCompleted("pending-quotes");
          navigate("/orcamentos");
        },
        directAction: {
          label: "Enviar mensagem",
          icon: MessageCircle,
          description: "WhatsApp com mensagem pré-preenchida",
          action: () => {
            const s = counts.pending_quotes[0];
            const client = clients.find(c => c.id === s.client_id);
            const clientName = client?.name || "Cliente";
            const phone = client?.phone || "";
            const serviceDesc = s.description || "seu serviço";
            
            const message = `Olá ${clientName}, tudo bem? Sou da equipe da Tecvo. Notamos que o orçamento para ${serviceDesc} ainda está pendente. Podemos te ajudar com alguma dúvida para fecharmos?`;
            
            if (phone) {
              const cleanPhone = phone.replace(/\D/g, "");
              markAlertAsCompleted("pending-quotes");
              recordResult("pending-quotes", Number(s.value) || 0, "conversion");
              window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
              toast.success("Ação iniciada", {
                description: `Impacto potencial de ${formatCurrency(Number(s.value) || 0)}.`,
                icon: <CheckCircle2 className="h-4 w-4 text-success" />
              });
            } else {
              toast.error("Erro", {
                description: "Cliente sem telefone cadastrado para WhatsApp."
              });
            }
          }
        },
        color: "text-warning",
        bg: "bg-warning/10",
        insight: getAdaptiveInsight("pending-quotes", "Esse tipo de orçamento costuma fechar rápido se abordado agora."),
      });
    }

    // 4. Inactive clients
    if (counts.inactive_clients.length > 0) {
      const baseScore = 300 + (counts.inactive_clients.length * 10);
      const adjustedScore = baseScore + getScoreAdjustment("inactive-high-value", baseScore);
      const historyData = history["inactive-high-value"];

      result.push({
        id: "inactive-high-value",
        title: "Reativação de clientes",
        recommendation: `Reative ${counts.inactive_clients.length} clientes antigos para novos serviços`,
        impactValue: counts.inactive_clients.length * 250,
        impactText: historyData?.totalValueGenerated ? `Gerou ${formatCurrency(historyData.totalValueGenerated)} em novos serviços` : "Gerar novos serviços recorrentes",
        timeLabel: "inativos +6 m",
        estimatedTime: "2 min",
        icon: UserX,
        priorityLevel: "medium",
        confidence: getConfidence("inactive-high-value"),
        score: adjustedScore,
        action: () => {
          recordInteraction("inactive-high-value", "click");
          markAlertAsCompleted("inactive-high-value");
          navigate("/clientes");
        },
        directAction: {
          label: "Reativar agora",
          icon: MessageSquare,
          description: "Mensagem sugerida de reativação",
          action: () => {
            const c = counts.inactive_clients[0];
            const clientName = c.name || "Cliente";
            const phone = c.phone || "";
            
            const message = `Olá ${clientName}, faz tempo que não realizamos uma manutenção preventiva em seus equipamentos. Gostaria de agendar uma visita para garantirmos a eficiência e evitar problemas futuros?`;
            
            if (phone) {
              const cleanPhone = phone.replace(/\D/g, "");
              markAlertAsCompleted("inactive-high-value");
              recordResult("inactive-high-value", 250, "revenue");
              window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
              toast.success("Reativação iniciada", {
                description: "Agindo sobre a base de clientes inativos.",
                icon: <CheckCircle2 className="h-4 w-4 text-success" />
              });
            } else {
              toast.error("Erro", {
                description: "Cliente sem telefone cadastrado para WhatsApp."
              });
            }
          }
        },
        color: "text-primary",
        bg: "bg-primary/10",
        insight: getAdaptiveInsight("inactive-high-value", "Manutenção preventiva é o melhor lucro."),
      });
    }

    // 5. Services for today
    if (counts.today_services.length > 0) {
      const totalValue = counts.today_services.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
      const baseScore = 500 + (totalValue / 500);
      const adjustedScore = baseScore + getScoreAdjustment("today-services", baseScore);
      const historyData = history["today-services"];

      result.push({
        id: "today-services",
        title: "Serviços do dia",
        recommendation: `Finalize os ${counts.today_services.length} serviços agendados para hoje`,
        impactValue: totalValue,
        impactText: historyData?.totalValueGenerated ? `Já faturou ${formatCurrency(historyData.totalValueGenerated)} hoje` : `Garantir ${formatCurrency(totalValue)} em faturamento`,
        timeLabel: "hoje",
        estimatedTime: "30 min",
        icon: CalendarDays,
        priorityLevel: "medium",
        confidence: getConfidence("today-services"),
        score: adjustedScore,
        action: () => {
          recordInteraction("today-services", "click");
          markAlertAsCompleted("today-services");
          navigate("/agenda");
        },
        color: "text-info",
        bg: "bg-info/10",
        insight: getAdaptiveInsight("today-services", "Check-in antecipado evita atrasos."),
      });
    }

    return result
      .filter(a => !completedAlerts.includes(a.id))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [counts, today, getScoreAdjustment, getAdaptiveInsight, recordInteraction, history, navigate, completedAlerts]);

  useEffect(() => {
    if (!isLoadingServices && !isLoadingClients && !isLoadingTransactions) {
      actions.forEach(action => {
        recordInteraction(action.id, "impression");
      });
    }
  }, [actions.length, isLoadingServices, isLoadingClients, isLoadingTransactions, recordInteraction]);

  const isLoading = isLoadingServices || isLoadingClients || isLoadingTransactions;

  if (isLoading) {
    return (
      <div className="mb-6 h-32 w-full animate-pulse rounded-2xl bg-muted/20" />
    );
  }

  if (actions.length === 0) {
    const hasNoClients = !isLoadingClients && clients.length === 0;
    
    return (
      <div className="mb-8 rounded-[2rem] border border-primary/20 bg-primary/[0.03] p-8 animate-fade-in shadow-sm">
        <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
          <div className="rounded-2xl bg-primary/10 p-5 text-primary shadow-inner">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black text-foreground tracking-tight">
              {hasNoClients ? "Seu dashboard está pronto para crescer" : "Tudo sob controle absoluto"}
            </h2>
            <p className="text-sm text-muted-foreground font-medium max-w-lg">
              {hasNoClients 
                ? "Cadastre seu primeiro cliente para que nossa IA possa gerar recomendações estratégicas e otimizar sua rotina." 
                : "Parabéns! Sua operação está em dia. Nenhuma ação crítica detectada pelo sistema no momento."}
            </p>
            {hasNoClients && (
              <Button 
                variant="default" 
                size="sm" 
                className="mt-4 gap-2 px-6 h-10 rounded-xl font-bold shadow-lg shadow-primary/20"
                onClick={() => navigate("/clientes/novo")}
              >
                Cadastrar Primeiro Cliente
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const priorityAction = actions[0];
  const secondaryActions = actions.slice(1);

  return (
    <div className={cn(isLeanView ? "" : "mb-12", "page-enter")}>
      {!isLeanView && (
        <div className="flex items-center gap-3 mb-6 px-1">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <Target className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-foreground/70">
            Recomendações Estratégicas
          </h2>
          <div className="flex-1 h-px bg-gradient-to-r from-border/60 to-transparent" />
        </div>
      )}

      <div className={cn("grid gap-6", isLeanView ? "grid-cols-1" : "lg:grid-cols-12")}>
        {/* Priority Action (Highlight) */}
        <div className={cn(isLeanView ? "" : "lg:col-span-5")}>
          <button
            onClick={priorityAction.action}
            className={cn(
              "group relative h-full w-full flex flex-col overflow-hidden rounded-[2.5rem] border-none p-10 text-left transition-all duration-500 hover:shadow-2xl active:scale-[0.99] shadow-xl",
              "bg-gradient-to-br from-primary/20 via-card to-card ring-1 ring-primary/20"
            )}
          >
            <div className="absolute -right-16 -top-16 w-64 h-64 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-all duration-700" />
            
            <div className="flex items-center justify-between mb-10 relative z-10">
              <Badge className="font-black px-5 py-2 bg-primary text-[10px] uppercase tracking-widest animate-pulse flex items-center gap-2.5 shadow-xl shadow-primary/20 rounded-full border-none">
                <Rocket className="h-4 w-4" />
                MELHOR AÇÃO AGORA
              </Badge>
              <div className={cn("p-4 rounded-[1.25rem] bg-primary/10 text-primary transition-all duration-500 group-hover:scale-110 group-hover:bg-primary group-hover:text-white shadow-sm border border-primary/20")}>
                <priorityAction.icon className="h-7 w-7" />
              </div>
            </div>

            <div className="space-y-8 relative z-10 flex-1">
              <h3 className="text-3xl font-black text-foreground tracking-tighter leading-[1.1] group-hover:text-primary transition-colors">
                {priorityAction.recommendation}
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5 p-5 rounded-3xl bg-muted/30 border border-border/40 backdrop-blur-sm group-hover:bg-muted/50 transition-colors">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-[0.2em] opacity-60 flex items-center gap-2">
                    <TrendingUp className="h-3.5 w-3.5" /> IMPACTO
                  </span>
                  <span className="text-base font-black text-success tracking-tight">{priorityAction.impactText}</span>
                </div>
                <div className="flex flex-col gap-1.5 p-5 rounded-3xl bg-muted/30 border border-border/40 backdrop-blur-sm group-hover:bg-muted/50 transition-colors">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-[0.2em] opacity-60 flex items-center gap-2">
                    <Timer className="h-3.5 w-3.5" /> TEMPO
                  </span>
                  <span className="text-base font-black text-foreground tracking-tight">{priorityAction.estimatedTime}</span>
                </div>
              </div>

              {priorityAction.insight && (
                <div className="p-6 rounded-3xl border border-primary/10 bg-primary/[0.03] text-sm text-muted-foreground relative overflow-hidden group-hover:bg-primary/[0.06] transition-all">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-primary/30" />
                  <p className="font-medium italic leading-relaxed text-base">
                    <span className="text-primary not-italic font-black mr-2 text-xl">“</span>
                    {priorityAction.insight}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-12 pt-8 border-t border-border/40 flex flex-col sm:flex-row items-center gap-4 relative z-10">
              {priorityAction.directAction ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        onClick={(e) => {
                          e.stopPropagation();
                          priorityAction.directAction?.action();
                        }}
                        className="rounded-2xl px-10 h-14 font-black text-[11px] uppercase tracking-widest gap-3 w-full sm:w-auto shadow-2xl bg-primary hover:bg-primary/90 hover:scale-[1.02] transition-all active:scale-95 border-none"
                      >
                        {priorityAction.directAction.icon && <priorityAction.directAction.icon className="h-5 w-5" />}
                        {priorityAction.directAction.label}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-foreground text-background font-bold rounded-xl p-3 border-none shadow-2xl">
                      <p>{priorityAction.directAction.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <Button 
                  onClick={priorityAction.action}
                  className="rounded-2xl px-10 h-14 font-black text-[11px] uppercase tracking-widest gap-3 w-full sm:w-auto shadow-2xl hover:scale-[1.02] transition-all"
                >
                  Executar Agora
                  <ArrowRight className="h-5 w-5" />
                </Button>
              )}
              
              <Button 
                variant="ghost" 
                onClick={priorityAction.action}
                className="text-xs font-bold text-muted-foreground hover:text-foreground gap-2.5 h-14 px-8 hover:bg-muted/50 rounded-2xl transition-all"
              >
                Analisar Detalhes
                <ArrowRight className="h-4 w-4 opacity-50" />
              </Button>
            </div>
            
            <div className="absolute -right-16 -bottom-16 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-700 -rotate-12 group-hover:rotate-0 group-hover:scale-110">
              <priorityAction.icon size={320} />
            </div>
          </button>
        </div>

        <div className={cn(isLeanView ? "grid gap-6" : "lg:col-span-7 grid gap-6 sm:grid-cols-2")}>
          {secondaryActions.map((item) => (
            <button
              key={item.id}
              onClick={item.action}
              className="group flex flex-col justify-between overflow-hidden rounded-[2rem] border border-border/40 bg-card p-8 text-left transition-all duration-500 hover:border-primary/40 hover:shadow-2xl active:scale-[0.98] relative shadow-lg"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-primary/10 transition-colors" />
              
              <div className="flex items-start justify-between relative z-10 mb-8">
                <div className={cn("rounded-2xl p-4 bg-muted/40 transition-all duration-500 group-hover:scale-110 group-hover:bg-primary/10 shadow-inner")}>
                  <item.icon className={cn("h-6 w-6", item.color)} />
                </div>
                <Badge variant="outline" className={cn(
                  "text-[10px] font-black uppercase tracking-widest px-4 py-1 rounded-full border-2 transition-colors",
                  item.confidence === "high" ? "border-success/30 text-success bg-success/[0.03]" : "border-border/60 text-muted-foreground bg-muted/20"
                )}>
                  {item.confidence === "high" ? "ALTA CHANCE" : "OPORTUNIDADE"}
                </Badge>
              </div>

              <div className="space-y-6 relative z-10 flex-1">
                <h4 className="text-[17px] font-black text-foreground/90 leading-tight group-hover:text-primary transition-colors line-clamp-2 tracking-tighter">
                  {item.recommendation}
                </h4>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <span className="text-[12px] font-black text-success flex items-center gap-2 tabular-nums">
                    <Target className="h-4 w-4 opacity-60" /> {formatCurrency(item.impactValue)}
                  </span>
                  <span className="text-[12px] font-bold text-muted-foreground/70 flex items-center gap-2">
                    <Timer className="h-4 w-4 opacity-60" /> {item.estimatedTime}
                  </span>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-between relative z-10 border-t border-border/40 pt-6">
                {item.directAction ? (
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      item.directAction?.action();
                    }}
                    className="h-12 rounded-2xl px-6 text-[11px] font-black uppercase tracking-widest gap-3 border-primary/20 hover:border-primary/40 hover:bg-primary text-primary hover:text-white transition-all active:scale-95 shadow-sm"
                  >
                    {item.directAction.icon && <item.directAction.icon className="h-4 w-4" />}
                    {item.directAction.label}
                  </Button>
                ) : (
                  <div className="flex items-center gap-3 text-[11px] font-black text-primary uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0">
                    DETALHES <ArrowRight className="h-4 w-4" />
                  </div>
                )}
                
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all delay-100">
                  <div className="h-2 w-2 rounded-full bg-primary/40" />
                  <div className="h-2 w-2 rounded-full bg-primary/20" />
                </div>
              </div>
            </button>
          ))}
          
          {/* Action indicator slot if less than 5 */}
          {actions.length < 5 && (
            <div className="hidden sm:flex flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-border/40 bg-muted/[0.02] p-8 text-center group hover:bg-muted/[0.05] transition-colors shadow-inner">
              <div className="p-5 rounded-[1.25rem] bg-muted/20 mb-4 group-hover:scale-110 transition-transform">
                <Rocket className="h-8 w-8 text-muted-foreground/20" />
              </div>
              <p className="text-[11px] font-black text-muted-foreground/30 uppercase tracking-[0.25em] leading-relaxed max-w-[150px] mx-auto">
                MAIS INSIGHTS EM BREVE
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
