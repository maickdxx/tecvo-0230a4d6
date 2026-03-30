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
  AlertCircle,
  MessageCircle,
  TrendingDown,
  Timer,
  Target,
  Rocket,
  CheckCircle2,
  ExternalLink,
  MessageSquare
} from "lucide-react";
import { useServices } from "@/hooks/useServices";
import { useClients } from "@/hooks/useClients";
import { useTransactions } from "@/hooks/useTransactions";
import { format, subDays, subMonths, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
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

export function TodayActionsBlock() {
  const navigate = useNavigate();
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  
  const { services, isLoading: isLoadingServices } = useServices();
  const { clients, isLoading: isLoadingClients } = useClients();
  const { transactions, isLoading: isLoadingTransactions } = useTransactions();
  const { role, isOwner, isAdmin } = useUserRole();
  const { recordInteraction, recordResult, getScoreAdjustment, getAdaptiveInsight, history } = useAdaptivePrioritization();

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
      const adjustedScore = baseScore + getScoreAdjustment("overdue_services", baseScore);
      const historyData = history["overdue_services"];

      result.push({
        id: "overdue_services",
        title: `${counts.overdue_services.length} serviço${counts.overdue_services.length > 1 ? "s" : ""} em atraso`,
        recommendation: `Regularize ${counts.overdue_services.length} serviços e recupere ${formatCurrency(impactValue)}`,
        impactValue,
        impactText: historyData?.totalValueGenerated ? `Já evitou perda de ${formatCurrency(historyData.totalValueGenerated)}` : `Recupere ${formatCurrency(impactValue)} agora`,
        timeLabel: `há ${daysOverdue} d`,
        estimatedTime: "15 min",
        icon: AlertTriangle,
        priorityLevel: "high",
        confidence: getConfidence("overdue_services"),
        score: adjustedScore,
        action: () => {
          recordInteraction("overdue_services", "click");
          navigate("/ordens-servico?status=overdue");
        },
        directAction: {
          label: "Resolver agora",
          icon: ExternalLink,
          description: "Abre a OS em atraso para atualização",
          action: () => {
            const firstId = counts.overdue_services[0].id;
            navigate(`/ordens-servico/${firstId}`);
            toast.success("Ação iniciada", {
              description: "Você está no caminho para resolver um serviço atrasado."
            });
          }
        },
        color: "text-destructive",
        bg: "bg-destructive/10",
        insight: getAdaptiveInsight("overdue_services", "Resolver isso libera o fluxo operacional."),
      });
    }

    // 2. Overdue payments
    if (counts.overdue_payments.length > 0) {
      const total = counts.overdue_payments.reduce((sum, t) => sum + Number(t.amount), 0);
      const oldestDate = counts.overdue_payments.reduce((oldest, t) => t.due_date! < oldest ? t.due_date! : oldest, counts.overdue_payments[0].due_date!);
      const daysOverdue = differenceInDays(today, new Date(oldestDate));

      const baseScore = 1100 + (total / 100) + (daysOverdue * 60);
      const adjustedScore = baseScore + getScoreAdjustment("overdue_payments", baseScore);
      const historyData = history["overdue_payments"];

      result.push({
        id: "overdue_payments",
        title: "Pagamentos vencidos",
        recommendation: `Cobrar ${counts.overdue_payments.length} clientes agora para recuperar ${formatCurrency(total)}`,
        impactValue: total,
        impactText: historyData?.totalValueGenerated ? `Recuperou ${formatCurrency(historyData.totalValueGenerated)} com cobrança` : `Recupere ${formatCurrency(total)} parados`,
        timeLabel: `há ${daysOverdue} d`,
        estimatedTime: "3 min",
        icon: DollarSign,
        priorityLevel: "high",
        confidence: getConfidence("overdue_payments"),
        score: adjustedScore,
        action: () => {
          recordInteraction("overdue_payments", "click");
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
        insight: getAdaptiveInsight("overdue_payments", "Cobrança imediata melhora o caixa hoje."),
      });
    }

    // 3. Pending quotes
    if (counts.pending_quotes.length > 0) {
      const totalValue = counts.pending_quotes.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
      const oldestDate = counts.pending_quotes.reduce((oldest, s) => s.created_at < oldest ? s.created_at : oldest, counts.pending_quotes[0].created_at);
      const daysPending = differenceInDays(today, new Date(oldestDate));

      const baseScore = 800 + (totalValue / 200) + (daysPending * 30);
      const adjustedScore = baseScore + getScoreAdjustment("pending_quotes", baseScore);
      const historyData = history["pending_quotes"];

      result.push({
        id: "pending_quotes",
        title: "Orçamentos parados",
        recommendation: `Fale com esses ${counts.pending_quotes.length} clientes agora e pode fechar ${formatCurrency(totalValue)}`,
        impactValue: totalValue,
        impactText: historyData?.totalValueGenerated ? `Já converteu ${formatCurrency(historyData.totalValueGenerated)}` : `Liberar ${formatCurrency(totalValue)} em caixa`,
        timeLabel: `há ${daysPending} dias`,
        estimatedTime: "2 min",
        icon: Zap,
        priorityLevel: "high",
        confidence: getConfidence("pending_quotes"),
        score: adjustedScore,
        action: () => {
          recordInteraction("pending_quotes", "click");
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
        insight: getAdaptiveInsight("pending_quotes", "Esse tipo de orçamento costuma fechar rápido se abordado agora."),
      });
    }

    // 4. Inactive clients
    if (counts.inactive_clients.length > 0) {
      const baseScore = 300 + (counts.inactive_clients.length * 10);
      const adjustedScore = baseScore + getScoreAdjustment("inactive_clients", baseScore);
      const historyData = history["inactive_clients"];

      result.push({
        id: "inactive_clients",
        title: "Reativação de clientes",
        recommendation: `Reative ${counts.inactive_clients.length} clientes antigos para novos serviços`,
        impactValue: counts.inactive_clients.length * 250, // Impacto estimado por cliente
        impactText: historyData?.totalValueGenerated ? `Gerou ${formatCurrency(historyData.totalValueGenerated)} em novos serviços` : "Gerar novos serviços recorrentes",
        timeLabel: "inativos +6 m",
        estimatedTime: "2 min",
        icon: UserX,
        priorityLevel: "medium",
        confidence: getConfidence("inactive_clients"),
        score: adjustedScore,
        action: () => {
          recordInteraction("inactive_clients", "click");
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
        insight: getAdaptiveInsight("inactive_clients", "Manutenção preventiva é o melhor lucro."),
      });
    }

    // 5. Services for today
    if (counts.today_services.length > 0) {
      const totalValue = counts.today_services.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
      const baseScore = 500 + (totalValue / 500);
      const adjustedScore = baseScore + getScoreAdjustment("today_services", baseScore);
      const historyData = history["today_services"];

      result.push({
        id: "today_services",
        title: "Serviços do dia",
        recommendation: `Finalize os ${counts.today_services.length} serviços agendados para hoje`,
        impactValue: totalValue,
        impactText: historyData?.totalValueGenerated ? `Já faturou ${formatCurrency(historyData.totalValueGenerated)} hoje` : `Garantir ${formatCurrency(totalValue)} em faturamento`,
        timeLabel: "hoje",
        estimatedTime: "30 min",
        icon: CalendarDays,
        priorityLevel: "medium",
        confidence: getConfidence("today_services"),
        score: adjustedScore,
        action: () => {
          recordInteraction("today_services", "click");
          navigate("/agenda");
        },
        color: "text-info",
        bg: "bg-info/10",
        insight: getAdaptiveInsight("today_services", "Check-in antecipado evita atrasos."),
      });
    }

    return result.sort((a, b) => b.score - a.score).slice(0, 5);
  }, [counts, today, getScoreAdjustment, getAdaptiveInsight, recordInteraction, history, navigate]);

  // Track impressions and resolutions
  const prevCounts = useMemo(() => {
    return {
      overdue_services: counts.overdue_services.length,
      overdue_payments: counts.overdue_payments.length,
      pending_quotes: counts.pending_quotes.length,
      inactive_clients: counts.inactive_clients.length,
      today_services: counts.today_services.filter(s => s.status === 'completed').length
    };
  }, [counts]);

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
      <div className="mb-6 h-32 w-full animate-pulse rounded-xl bg-muted/50" />
    );
  }

  if (actions.length === 0) {
    return (
      <div className="mb-8 rounded-2xl border border-success/20 bg-success/5 p-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <div className="rounded-full bg-success/10 p-3 text-success">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Tudo sob controle hoje</h2>
            <p className="text-sm text-muted-foreground">Nenhuma ação crítica necessária. Sua operação está em dia!</p>
          </div>
        </div>
      </div>
    );
  }

  const priorityAction = actions[0];
  const secondaryActions = actions.slice(1);

  return (
    <div className="mb-8 page-enter">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/70">
          🎯 Recomendações da Tecvo
        </h2>
        <div className="flex-1 h-px bg-border/40" />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Priority Action (Highlight) - "Melhor ação agora" */}
        <div className="lg:col-span-5">
          <button
            onClick={priorityAction.action}
            className={cn(
              "group relative h-full w-full flex flex-col overflow-hidden rounded-3xl border-2 p-6 text-left transition-all duration-300 hover:shadow-xl active:scale-[0.99]",
              "border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card ring-1 ring-primary/20 shadow-lg shadow-primary/5"
            )}
          >
            <div className="flex items-center justify-between mb-6">
              <Badge className="font-bold px-3 py-1 bg-primary text-primary-foreground animate-pulse flex items-center gap-1.5 shadow-sm">
                <Rocket className="h-3.5 w-3.5" />
                MELHOR AÇÃO AGORA
              </Badge>
              <div className={cn("p-3 rounded-2xl bg-primary/10 transition-transform group-hover:scale-110")}>
                <priorityAction.icon className={cn("h-6 w-6 text-primary")} />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-2xl font-black text-foreground tracking-tight leading-tight group-hover:text-primary transition-colors">
                {priorityAction.recommendation}
              </h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1 p-3 rounded-2xl bg-muted/50 border border-border/40">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-1">
                    <Target className="h-3 w-3" /> Impacto
                  </span>
                  <span className="text-sm font-bold text-success">{priorityAction.impactText}</span>
                </div>
                <div className="flex flex-col gap-1 p-3 rounded-2xl bg-muted/50 border border-border/40">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-1">
                    <Timer className="h-3 w-3" /> Tempo
                  </span>
                  <span className="text-sm font-bold text-foreground">{priorityAction.estimatedTime}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Confiança:</span>
                <Badge variant="outline" className={cn(
                  "font-bold text-[10px] px-2",
                  priorityAction.confidence === "high" ? "bg-success/10 text-success border-success/20" :
                  priorityAction.confidence === "medium" ? "bg-warning/10 text-warning border-warning/20" :
                  "bg-muted text-muted-foreground"
                )}>
                  {priorityAction.confidence === "high" ? "Alta Chance" : 
                   priorityAction.confidence === "medium" ? "Média Chance" : "Baixa Chance"}
                </Badge>
              </div>
            </div>

            {priorityAction.insight && (
              <div className="mt-6 p-4 rounded-2xl border border-primary/10 bg-primary/5 italic text-sm text-muted-foreground relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary/30" />
                "💡 {priorityAction.insight}"
              </div>
            )}

            <div className="mt-auto pt-6 flex flex-col sm:flex-row items-center gap-3">
              {priorityAction.directAction ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        onClick={(e) => {
                          e.stopPropagation();
                          priorityAction.directAction?.action();
                        }}
                        className="rounded-xl px-6 font-bold gap-2 w-full sm:w-auto shadow-md bg-primary hover:bg-primary/90"
                      >
                        {priorityAction.directAction.icon && <priorityAction.directAction.icon className="h-4 w-4" />}
                        {priorityAction.directAction.label}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{priorityAction.directAction.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <Button 
                  onClick={priorityAction.action}
                  className="rounded-xl px-6 font-bold gap-2 w-full sm:w-auto shadow-md"
                >
                  Executar recomendação
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
              
              {priorityAction.directAction && (
                <Button 
                  variant="ghost" 
                  onClick={priorityAction.action}
                  className="text-xs font-bold text-muted-foreground hover:text-foreground gap-1.5"
                >
                  Ver detalhes
                  <ArrowRight className="h-3 w-3" />
                </Button>
              )}
            </div>
            
            <div className="absolute -right-8 -bottom-8 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
              <priorityAction.icon size={200} />
            </div>
          </button>
        </div>

        <div className="lg:col-span-7 grid gap-3 sm:grid-cols-2">
          {secondaryActions.map((item) => (
            <button
              key={item.id}
              onClick={item.action}
              className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-border/60 bg-card p-4 text-left transition-all duration-300 hover:border-primary/30 hover:shadow-lg active:scale-[0.98]"
            >
              <div className="flex items-start justify-between">
                <div className={cn("rounded-xl p-2 bg-muted/50 transition-transform group-hover:scale-110")}>
                  <item.icon className={cn("h-4 w-4", item.color)} />
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className={cn(
                    "text-[8px] font-bold uppercase tracking-tighter px-1.5",
                    item.confidence === "high" ? "border-success/30 text-success bg-success/5" : "border-muted text-muted-foreground"
                  )}>
                    {item.confidence === "high" ? "Alta chance" : "Recomendado"}
                  </Badge>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <h4 className="text-[14px] font-bold text-foreground leading-tight group-hover:text-primary transition-colors line-clamp-2">
                  {item.recommendation}
                </h4>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-[10px] font-bold text-success flex items-center gap-1">
                    <Target className="h-3 w-3" /> {formatCurrency(item.impactValue)}
                  </span>
                  <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                    <Timer className="h-3 w-3" /> {item.estimatedTime}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                {item.directAction ? (
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      item.directAction?.action();
                    }}
                    className="h-9 rounded-lg px-4 text-[12px] font-bold gap-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5 text-primary transition-all active:scale-95"
                  >
                    {item.directAction.icon && <item.directAction.icon className="h-3.5 w-3.5" />}
                    {item.directAction.label}
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 text-[10px] font-bold text-primary uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-all">
                    Ver detalhes <ArrowRight className="h-3 w-3" />
                  </div>
                )}
                
                {item.directAction && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
              </div>
            </button>
          ))}
          
          {/* Action indicator slot if less than 5 */}
          {actions.length < 5 && (
            <div className="hidden sm:flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/5 p-4 text-center">
              <Rocket className="h-5 w-5 text-muted-foreground/30 mb-2" />
              <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest leading-relaxed">
                Mais recomendações em breve
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
