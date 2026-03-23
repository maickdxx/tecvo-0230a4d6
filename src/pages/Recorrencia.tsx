import { useState, useRef, useCallback } from "react";
import {
  RefreshCw, MessageCircle, DollarSign, Calendar,
  Clock, TrendingUp, CheckCircle2, XCircle, Bell, ArrowDown,
  Sparkles, AlertTriangle, Zap, ChevronRight, Lock, BotMessageSquare,
  Check, Send, Eye, Loader2
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppLayout } from "@/components/layout";
import { PageTutorialBanner } from "@/components/onboarding";
import { usePaginatedRecurrence, useRecurrenceStats, useRecurrenceConfig, RecurrenceClient, RecurrenceVisualStage, RecurrenceStage } from "@/hooks/useRecurrence";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(value);
}

function formatPhone(phone: string) {
  return phone.replace(/\D/g, "");
}

const stageConfig: Record<RecurrenceVisualStage, { label: string; color: string; bgColor: string; icon: React.ElementType; borderColor: string }> = {
  pronto: { label: "Pronto", color: "text-destructive", bgColor: "bg-destructive/10", icon: AlertTriangle, borderColor: "border-l-destructive" },
  proximo: { label: "Próximo", color: "text-warning", bgColor: "bg-warning/10", icon: Clock, borderColor: "border-l-warning" },
  futuro: { label: "Futuro", color: "text-info", bgColor: "bg-info/10", icon: Calendar, borderColor: "border-l-info" },
};

const dbStageLabels: Record<RecurrenceStage, { label: string; color: string }> = {
  aguardando: { label: "Aguardando", color: "text-muted-foreground" },
  "2m_enviado": { label: "2 meses enviado", color: "text-primary" },
  "4m_enviado": { label: "4 meses enviado", color: "text-primary" },
  "6m_enviado": { label: "6 meses enviado", color: "text-warning" },
  "8m_enviado": { label: "8 meses enviado", color: "text-warning" },
  "10m_enviado": { label: "10 meses enviado", color: "text-destructive" },
  "12m_enviado": { label: "12 meses enviado", color: "text-destructive" },
  pronto: { label: "Pronto", color: "text-destructive" },
  msg_enviada: { label: "Mensagem enviada", color: "text-warning" },
  respondeu: { label: "Respondeu", color: "text-success" },
  agendado: { label: "Agendado", color: "text-success" },
  ignorado: { label: "Ignorado", color: "text-muted-foreground" },
  concluido: { label: "Concluído", color: "text-success" },
  reiniciado: { label: "Reiniciado", color: "text-info" },
};

/* ─── Empty State ─── */
function EmptyState() {
  return (
    <Card className="border-dashed border-primary/20">
      <CardContent className="py-16 flex flex-col items-center text-center gap-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <div className="max-w-md space-y-2">
          <h3 className="text-xl font-semibold text-foreground">Você ainda não tem recorrências ativas</h3>
          <p className="text-sm text-muted-foreground">
            Assim que concluir serviços de <strong>limpeza</strong> ou <strong>instalação</strong>, o sistema criará a jornada de reativação automaticamente.
          </p>
        </div>
        <Card className="w-full max-w-lg border-dashed bg-muted/30">
          <CardContent className="p-5 space-y-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Como funciona</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { icon: CheckCircle2, text: "Serviço concluído", bg: "bg-primary/10", iconColor: "text-primary" },
                { icon: Send, text: "+2/4 meses: aquecimento", bg: "bg-info/10", iconColor: "text-info" },
                { icon: DollarSign, text: "+6 meses: conversão", bg: "bg-success/10", iconColor: "text-success" },
                { icon: RefreshCw, text: "+8/10/12m: reengajamento", bg: "bg-warning/10", iconColor: "text-warning" },
              ].map((step, i) => (
                <div key={i} className="flex flex-col items-center gap-2 text-center">
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", step.bg)}>
                    <step.icon className={cn("h-5 w-5", step.iconColor)} />
                  </div>
                  <p className="text-xs text-muted-foreground">{step.text}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}

/* ─── Revenue Hero ─── */
function RevenueHero({ stats, onAction }: { stats: { revenue60Days: number; totalActive: number; totalPronto: number }; onAction: () => void }) {
  return (
    <Card className="bg-gradient-to-br from-primary/5 via-card to-success/5 border-primary/20">
      <CardContent className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-success" />
              <span className="text-sm font-medium text-muted-foreground">Oportunidades nos próximos 60 dias</span>
            </div>
            <p className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
              {formatCurrency(stats.revenue60Days)}
            </p>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{stats.totalActive}</span> clientes prontos para retornar
            </p>
          </div>
          {stats.totalActive > 0 && (
            <Button onClick={onAction} size="lg" className="gap-2 shrink-0">
              <Zap className="h-4 w-4" />
              Ver oportunidades
              <ArrowDown className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Automation Toggle ─── */
function AutomationToggle() {
  const { config, isLoading, toggleAutomation } = useRecurrenceConfig();
  const enabled = config?.automationEnabled ?? false;

  const handleToggle = (checked: boolean) => {
    toggleAutomation.mutate(checked, {
      onSuccess: () => toast.success(checked ? "Automação ativada" : "Automação desativada"),
      onError: () => toast.error("Erro ao alterar automação"),
    });
  };

  if (isLoading) return <Skeleton className="h-20 w-full rounded-xl" />;

  return (
    <Card className={cn("transition-all", enabled ? "border-success/30 bg-success/5" : "border-dashed border-primary/20 bg-primary/[0.02]")}>
      <CardContent className="p-4 flex items-center gap-4">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", enabled ? "bg-success/10" : "bg-primary/10")}>
          <BotMessageSquare className={cn("h-5 w-5", enabled ? "text-success" : "text-primary")} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground">
              {enabled ? "Automação ativa" : "Automação desativada"}
            </p>
            {enabled && (
              <Badge variant="secondary" className="text-[10px] bg-success/10 text-success gap-1">
                <Check className="h-2.5 w-2.5" /> Ativo
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {enabled
              ? `Mensagens automáticas em 2, 4, 6, 8, 10 e 12 meses • Limite: ${config?.dailyLimit || 20}/dia • Horário: ${config?.businessHoursStart || "08:00"}-${config?.businessHoursEnd || "18:00"}`
              : "Ative para enviar mensagens de aquecimento e conversão automaticamente no momento ideal — até 12 meses de acompanhamento."
            }
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={handleToggle} disabled={toggleAutomation.isPending} />
      </CardContent>
    </Card>
  );
}

/* ─── Smart Alert ─── */
function SmartAlert({ totalPronto, revenuePronto }: { totalPronto: number; revenuePronto: number }) {
  if (totalPronto === 0) return null;
  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
          <AlertTriangle className="h-5 w-5 text-destructive" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            {totalPronto} {totalPronto === 1 ? "cliente no momento ideal" : "clientes no momento ideal"} para reativação
          </p>
          <p className="text-xs text-muted-foreground">
            Você pode recuperar {formatCurrency(revenuePronto)} imediatamente — contato liberado
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </CardContent>
    </Card>
  );
}

/* ─── Stats Bar ─── */
function StatsBar({ stats }: { stats: { totalPronto: number; totalProximo: number; totalFuture: number; potentialRevenue: number } }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card className="border-l-4 border-l-destructive">
        <CardContent className="p-4">
          <p className="text-2xl font-bold text-foreground">{stats.totalPronto}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-destructive" /> Prontos
          </p>
        </CardContent>
      </Card>
      <Card className="border-l-4 border-l-warning">
        <CardContent className="p-4">
          <p className="text-2xl font-bold text-foreground">{stats.totalProximo}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3 text-warning" /> Próximos (30d)
          </p>
        </CardContent>
      </Card>
      <Card className="border-l-4 border-l-info">
        <CardContent className="p-4">
          <p className="text-2xl font-bold text-foreground">{stats.totalFuture}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3 text-info" /> Futuras
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.potentialRevenue)}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <DollarSign className="h-3 w-3 text-success" /> Potencial ativo
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Timeline ─── */
function ClientTimeline({ client }: { client: RecurrenceClient }) {
  const steps = [
    { label: "Serviço realizado", done: true, icon: CheckCircle2, color: "text-success" },
    { label: "2 meses (filtro)", done: !!client.msg2mSentAt, icon: Send, color: "text-info" },
    { label: "4 meses (reforço)", done: !!client.msg4mSentAt, icon: Send, color: "text-info" },
    { label: "6 meses (limpeza)", done: !!client.msg6mSentAt, icon: Send, color: "text-warning" },
    { label: "8 meses (reengajamento)", done: !!client.msg8mSentAt, icon: Send, color: "text-warning" },
    { label: "10 meses (reengajamento)", done: !!client.msg10mSentAt, icon: Send, color: "text-destructive" },
    { label: "12 meses (última tentativa)", done: !!client.msg12mSentAt, icon: Send, color: "text-destructive" },
  ];

  return (
    <div className="flex items-center gap-0.5 mt-2 flex-wrap">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-0.5">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full transition-all",
                  step.done ? "bg-success/20" : "bg-muted"
                )}>
                  <step.icon className={cn("h-2.5 w-2.5", step.done ? "text-success" : "text-muted-foreground")} />
                </div>
              </TooltipTrigger>
              <TooltipContent><p className="text-xs">{step.label}</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {i < steps.length - 1 && (
            <div className={cn("h-0.5 w-2.5 rounded-full", step.done ? "bg-success/30" : "bg-muted")} />
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Client Card ─── */
function ClientCard({ client, onWhatsApp }: { client: RecurrenceClient; onWhatsApp: (c: RecurrenceClient) => void }) {
  const stage = stageConfig[client.stage];
  const StageIcon = stage.icon;
  const isFuturo = client.stage === "futuro";
  const isProximo = client.stage === "proximo";
  const isPronto = client.stage === "pronto";
  const hasContact = !!(client.whatsapp || client.phone);
  const dbLabel = dbStageLabels[client.dbStage];

  const stageMessages: Record<RecurrenceVisualStage, string> = {
    pronto: "Cliente no momento ideal para reativação. Contato liberado.",
    proximo: "Entrando no momento ideal para novo serviço. Contato antecipado liberado.",
    futuro: "Ainda é cedo para abordar este cliente. A plataforma vai liberar o contato quando chegar a hora.",
  };

  return (
    <Card className={cn(
      "transition-all border-l-4",
      stage.borderColor,
      isPronto && "ring-1 ring-destructive/20 hover:shadow-md",
      isProximo && "hover:shadow-md",
      isFuturo && "opacity-75"
    )}>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={cn("font-semibold truncate", isFuturo ? "text-muted-foreground" : "text-foreground")}>{client.clientName}</h3>
              <Badge variant="secondary" className={cn("text-[10px] gap-1", stage.bgColor, stage.color)}>
                <StageIcon className="h-3 w-3" />
                {stage.label}
              </Badge>
              {dbLabel && client.dbStage !== "aguardando" && (
                <Badge variant="outline" className={cn("text-[10px]", dbLabel.color)}>
                  {dbLabel.label}
                </Badge>
              )}
              {isPronto && (
                <Badge variant="secondary" className="text-[10px] bg-destructive/10 text-destructive">
                  {Math.abs(client.daysUntilRecurrence)}d atrasado
                </Badge>
              )}
              {isProximo && (
                <Badge variant="secondary" className="text-[10px] bg-warning/10 text-warning">
                  {client.daysUntilRecurrence}d restantes
                </Badge>
              )}
              {isFuturo && (
                <Badge variant="secondary" className="text-[10px] bg-muted text-muted-foreground gap-1">
                  <Lock className="h-2.5 w-2.5" />
                  {client.daysUntilRecurrence}d para liberar
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <RefreshCw className="h-3 w-3" />
                {client.lastServiceTypeFriendly}
              </span>
              <span>Último: {format(new Date(client.lastServiceDate), "dd/MM/yyyy", { locale: ptBR })}</span>
              <span>Próximo: {format(client.recurrenceDate, "dd/MM/yyyy", { locale: ptBR })}</span>
              {client.lastServiceValue != null && client.lastServiceValue > 0 && (
                <span className={cn("font-medium", isFuturo ? "text-muted-foreground" : "text-foreground")}>
                  {formatCurrency(client.lastServiceValue)}
                </span>
              )}
            </div>
            <p className={cn("text-xs mt-1", isFuturo ? "text-muted-foreground/70" : "text-muted-foreground")}>
              {stageMessages[client.stage]}
            </p>
            <ClientTimeline client={client} />
          </div>

          {isFuturo ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-2 shrink-0 opacity-50 cursor-not-allowed" disabled>
                    <Lock className="h-4 w-4" />
                    Disponível em {client.daysUntilRecurrence}d
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-[220px]">
                  <p className="text-xs">Entrar em contato agora pode reduzir a chance de conversão. A Tecvo libera o contato no momento ideal.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <Button
              size="sm"
              variant={isPronto ? "default" : "outline"}
              className="gap-2 shrink-0"
              onClick={() => onWhatsApp(client)}
              disabled={!hasContact}
            >
              <MessageCircle className="h-4 w-4" />
              {isPronto ? "Chamar no WhatsApp" : "Antecipar contato"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Main Page ─── */
export default function Recorrencia() {
  const [filter, setFilter] = useState<"all" | "pronto" | "proximo" | "futuro">("all");
  const listRef = useRef<HTMLDivElement>(null);

  const { data: statsData, isLoading: statsLoading } = useRecurrenceStats();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = usePaginatedRecurrence(filter);

  const stats = statsData ?? { totalFuture: 0, totalProximo: 0, totalPronto: 0, totalActive: 0, potentialRevenue: 0, revenue60Days: 0, convertedThisMonth: 0 };
  const clients = data?.pages.flatMap(p => p.clients) ?? [];
  const hasData = stats.totalPronto + stats.totalProximo + stats.totalFuture > 0;
  const isPageLoading = statsLoading || isLoading;

  const revenuePronto = clients
    .filter(c => c.stage === "pronto")
    .reduce((sum, c) => sum + (c.lastServiceValue || 0), 0);

  const handleWhatsApp = (client: RecurrenceClient) => {
    if (client.stage === "futuro") return;
    const number = formatPhone(client.whatsapp || client.phone || "");
    if (!number) return;
    const fullNumber = number.startsWith("55") ? number : `55${number}`;
    const message = encodeURIComponent(
      `Olá${client.clientName ? ` ${client.clientName.split(" ")[0]}` : ""}! Já faz cerca de 6 meses do último serviço 😊\nEstá na hora da próxima manutenção preventiva. Quer agendar?`
    );
    window.open(`https://wa.me/${fullNumber}?text=${message}`, "_blank");
  };

  const scrollToList = () => {
    setFilter("pronto");
    listRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <AppLayout>
      <PageTutorialBanner
        pageKey="recorrencia"
        title="Recorrência Inteligente"
        message="O sistema acompanha o cliente por até 12 meses com mensagens inteligentes — aquecimento, conversão e reengajamento. Se fechar novo serviço, o ciclo reinicia automaticamente."
      />
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <RefreshCw className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Recorrência</h1>
            <p className="text-sm text-muted-foreground">
              Jornada automática de reativação — limpeza de ar-condicionado
            </p>
          </div>
        </div>

        {isPageLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
          </div>
        )}

        {!isPageLoading && !hasData && <EmptyState />}

        {!isPageLoading && hasData && (
          <>
            <RevenueHero stats={stats} onAction={scrollToList} />
            <SmartAlert totalPronto={stats.totalPronto} revenuePronto={revenuePronto} />
            <AutomationToggle />
            <StatsBar stats={stats} />

            <div ref={listRef} className="space-y-3">
              <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
                <TabsList>
                  <TabsTrigger value="all">Todos ({stats.totalPronto + stats.totalProximo + stats.totalFuture})</TabsTrigger>
                  <TabsTrigger value="pronto" className="gap-1">
                    <AlertTriangle className="h-3 w-3" /> Prontos ({stats.totalPronto})
                  </TabsTrigger>
                  <TabsTrigger value="proximo" className="gap-1">
                    <Clock className="h-3 w-3" /> Próximos ({stats.totalProximo})
                  </TabsTrigger>
                  <TabsTrigger value="futuro" className="gap-1">
                    <Calendar className="h-3 w-3" /> Futuras ({stats.totalFuture})
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {clients.length === 0 && !isLoading && (
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center">
                    <p className="text-sm text-muted-foreground">Nenhum cliente nesta categoria.</p>
                  </CardContent>
                </Card>
              )}
              {clients.map((client) => (
                <ClientCard key={client.entryId} client={client} onWhatsApp={handleWhatsApp} />
              ))}

              {hasNextPage && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="gap-2"
                  >
                    {isFetchingNextPage ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</>
                    ) : (
                      <>Carregar mais clientes</>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Automation always visible */}
        {!isPageLoading && !hasData && <AutomationToggle />}
      </div>
    </AppLayout>
  );
}
