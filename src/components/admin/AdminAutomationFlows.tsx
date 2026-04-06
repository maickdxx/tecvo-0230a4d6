import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Zap, Play, Loader2, UserPlus, CreditCard, RefreshCcw, AlertTriangle,
  ArrowDown, Clock, Mail, MessageSquare, ChevronDown, ChevronUp, Eye,
  Shield, Send, Rocket, Heart, Target, Timer
} from "lucide-react";

// ── Types ──

interface Automation {
  id: string;
  name: string;
  description: string;
  trigger_type: string;
  enabled: boolean;
  delay_minutes: number;
  cooldown_hours: number | null;
  message_template: string;
  email_template: string | null;
}

// ── Funnel Stage Definitions ──

interface FunnelStage {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  triggerTypes: string[];
}

const FUNNEL_STAGES: FunnelStage[] = [
  {
    id: "onboarding",
    label: "Onboarding (Laura)",
    description: "Conduzido pela Laura via chat e WhatsApp",
    icon: <Rocket className="h-5 w-5" />,
    color: "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300",
    triggerTypes: ["trial_d0", "trial_d1", "new_user_activation", "signup_recovery", "activation_d0", "activation_d1"],
  },
  {
    id: "retention",
    label: "Retenção (Laura)",
    description: "Reengajamento conduzido pela Laura",
    icon: <Heart className="h-5 w-5" />,
    color: "bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-300",
    triggerTypes: ["inactive_3d", "inactive_7d", "inactive_15d", "churn_recovery"],
  },
  {
    id: "operational",
    label: "Operacional",
    description: "Notificações automáticas de serviço",
    icon: <Target className="h-5 w-5" />,
    color: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300",
    triggerTypes: [],
  },
];

// ── System Flows (hardcoded, non-editable) ──

interface SystemFlow {
  name: string;
  trigger: string;
  channel: "whatsapp" | "email" | "both";
  description: string;
  stage: string;
}

const SYSTEM_FLOWS: SystemFlow[] = [
  {
    name: "Laura — Onboarding e Boas-vindas",
    trigger: "Primeiro acesso após cadastro",
    channel: "whatsapp",
    description: "A Laura conduz o onboarding completo via chat e WhatsApp, incluindo boas-vindas, ativação e conversão. Centralizado, sem automações paralelas.",
    stage: "onboarding",
  },
  {
    name: "Laura — Reativação de Usuários",
    trigger: "Inatividade detectada",
    channel: "whatsapp",
    description: "A Laura identifica usuários inativos e conduz reengajamento com base em comportamento real, sem mensagens genéricas.",
    stage: "retention",
  },
  {
    name: "Notificação de Status de OS",
    trigger: "Mudança de status operacional (en_route, in_attendance, completed)",
    channel: "whatsapp",
    description: "Notificação automática ao cliente quando o técnico muda o status da OS. Controlada pela flag auto_notify_client_completion.",
    stage: "operational",
  },
];

// ── Helpers ──

function formatDelay(minutes: number): string {
  if (minutes === 0) return "Imediato";
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `D+${Math.round(minutes / 1440)}`;
}

function getChannels(auto: Automation): string[] {
  const channels: string[] = [];
  if (auto.message_template) channels.push("WhatsApp");
  if (auto.email_template) channels.push("Email");
  if (channels.length === 0) channels.push("WhatsApp");
  return channels;
}

// ── Main Component ──

export function AdminAutomationFlows() {
  const queryClient = useQueryClient();
  const [activeStage, setActiveStage] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isRunningManual, setIsRunningManual] = useState(false);

  const { data: automations, isLoading } = useQuery({
    queryKey: ["analytics-automations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analytics_automations")
        .select("*")
        .order("delay_minutes", { ascending: true });
      if (error) throw error;
      return data as Automation[];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("analytics_automations")
        .update({ enabled })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics-automations"] });
      toast.success("Automação atualizada");
    },
  });

  const runManualMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("laura-lifecycle-cron", {
        body: { mode: "manual" },
      });
      if (error) throw error;
    },
    onMutate: () => setIsRunningManual(true),
    onSuccess: () => {
      toast.success("Processamento manual concluído");
    },
    onError: (err: any) => {
      toast.error("Erro ao processar: " + err.message);
    },
    onSettled: () => setIsRunningManual(false),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const getStageAutomations = (stageId: string) => {
    const stage = FUNNEL_STAGES.find((s) => s.id === stageId);
    if (!stage) return [];
    return (automations || []).filter((a) => stage.triggerTypes.includes(a.trigger_type));
  };

  const getStageSystemFlows = (stageId: string) => {
    return SYSTEM_FLOWS.filter((f) => f.stage === stageId);
  };

  const allStages = activeStage === "all" ? FUNNEL_STAGES : FUNNEL_STAGES.filter((s) => s.id === activeStage);

  // Stats
  const totalActive = automations?.filter((a) => a.enabled).length || 0;
  const totalAutomations = automations?.length || 0;
  const totalFlows = totalAutomations + SYSTEM_FLOWS.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Central de Fluxos de Comunicação</h2>
          <p className="text-muted-foreground">
            Visualize toda a estratégia de comunicação automática da Tecvo com seus usuários
          </p>
        </div>
        <Button
          onClick={() => runManualMutation.mutate()}
          disabled={isRunningManual}
          className="gap-2"
          size="sm"
        >
          {isRunningManual ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Processar Agora
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-2xl font-bold">{totalFlows}</span>
            </div>
            <p className="text-xs text-muted-foreground">Fluxos totais</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-emerald-500" />
              <span className="text-2xl font-bold">{totalActive}</span>
            </div>
            <p className="text-xs text-muted-foreground">Automações ativas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-2xl font-bold">{totalAutomations - totalActive}</span>
            </div>
            <p className="text-xs text-muted-foreground">Desativadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-500" />
              <span className="text-2xl font-bold">{SYSTEM_FLOWS.length}</span>
            </div>
            <p className="text-xs text-muted-foreground">Fluxos de sistema</p>
          </CardContent>
        </Card>
      </div>

      {/* Stage Filter */}
      <Tabs value={activeStage} onValueChange={setActiveStage}>
        <TabsList className="flex w-full overflow-x-auto flex-nowrap justify-start h-auto p-1 bg-muted/50">
          <TabsTrigger value="all" className="whitespace-nowrap gap-1.5">
            <Eye className="h-3.5 w-3.5" />
            Todos
          </TabsTrigger>
          {FUNNEL_STAGES.map((stage) => (
            <TabsTrigger key={stage.id} value={stage.id} className="whitespace-nowrap gap-1.5">
              {stage.icon}
              {stage.label}
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                {getStageAutomations(stage.id).length + getStageSystemFlows(stage.id).length}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Flow Stages */}
      <div className="space-y-8">
        {allStages.map((stage) => {
          const stageAutomations = getStageAutomations(stage.id);
          const stageSystemFlows = getStageSystemFlows(stage.id);
          const items = [...stageSystemFlows.map((f, i) => ({ type: "system" as const, data: f, sortKey: -1 })), ...stageAutomations.map((a) => ({ type: "automation" as const, data: a, sortKey: a.delay_minutes }))].sort((a, b) => a.sortKey - b.sortKey);

          if (items.length === 0) return null;

          return (
            <div key={stage.id}>
              {/* Stage Header */}
              <div className={`flex items-center gap-3 mb-4 p-3 rounded-lg border ${stage.color}`}>
                {stage.icon}
                <div>
                  <h3 className="font-semibold text-sm">{stage.label}</h3>
                  <p className="text-xs opacity-80">{stage.description}</p>
                </div>
                <Badge variant="outline" className="ml-auto">
                  {items.length} fluxo{items.length !== 1 ? "s" : ""}
                </Badge>
              </div>

              {/* Flow Items */}
              <div className="relative ml-6 space-y-0">
                {items.map((item, idx) => {
                  const isLast = idx === items.length - 1;

                  if (item.type === "system") {
                    const flow = item.data as SystemFlow;
                    return (
                      <div key={`sys-${idx}`} className="relative pb-4">
                        {/* Timeline connector */}
                        {!isLast && (
                          <div className="absolute left-3 top-8 bottom-0 w-px bg-border" />
                        )}
                        <div className="flex gap-3">
                          <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted border border-border mt-1">
                            <Shield className="h-3 w-3 text-muted-foreground" />
                          </div>
                          <Card className="flex-1 border-dashed opacity-90">
                            <CardContent className="p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-sm">{flow.name}</span>
                                    <Badge variant="outline" className="text-[10px] px-1.5">Sistema</Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground mb-2">
                                    <span className="font-medium">Gatilho:</span> {flow.trigger}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{flow.description}</p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <ChannelBadge channel={flow.channel === "whatsapp" ? "WhatsApp" : flow.channel === "email" ? "Email" : "Ambos"} />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    );
                  }

                  const auto = item.data as Automation;
                  const isExpanded = expandedId === auto.id;
                  const channels = getChannels(auto);

                  return (
                    <div key={auto.id} className="relative pb-4">
                      {/* Timeline connector */}
                      {!isLast && (
                        <div className="absolute left-3 top-8 bottom-0 w-px bg-border" />
                      )}
                      <div className="flex gap-3">
                        {/* Timeline dot */}
                        <div className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border mt-1 ${auto.enabled ? "bg-primary/10 border-primary" : "bg-muted border-border"}`}>
                          <Zap className={`h-3 w-3 ${auto.enabled ? "text-primary" : "text-muted-foreground"}`} />
                        </div>

                        {/* Card */}
                        <Card className={`flex-1 transition-opacity ${!auto.enabled ? "opacity-60" : ""}`}>
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="font-medium text-sm">{auto.name}</span>
                                  <Badge variant={auto.enabled ? "default" : "secondary"} className="text-[10px] px-1.5">
                                    {auto.enabled ? "Ativo" : "Inativo"}
                                  </Badge>
                                  <Badge variant="outline" className="text-[10px] px-1.5 gap-1">
                                    <Timer className="h-2.5 w-2.5" />
                                    {formatDelay(auto.delay_minutes)}
                                  </Badge>
                                </div>

                                <p className="text-xs text-muted-foreground mb-2">{auto.description}</p>

                                {/* Trigger → Action flow */}
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="px-2 py-0.5 rounded bg-muted font-mono text-[10px]">{auto.trigger_type}</span>
                                  <ArrowDown className="h-3 w-3 text-muted-foreground rotate-[-90deg]" />
                                  <div className="flex gap-1">
                                    {channels.map((ch) => (
                                      <ChannelBadge key={ch} channel={ch} />
                                    ))}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <Switch
                                  checked={auto.enabled}
                                  onCheckedChange={(checked) => toggleMutation.mutate({ id: auto.id, enabled: checked })}
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => setExpandedId(isExpanded ? null : auto.id)}
                                >
                                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </Button>
                              </div>
                            </div>

                            {/* Expanded: message preview */}
                            {isExpanded && (
                              <div className="mt-3 space-y-2">
                                <Separator />
                                {auto.message_template && (
                                  <div className="p-3 bg-muted/50 rounded-md">
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                      <MessageSquare className="h-3 w-3 text-emerald-500" />
                                      <span className="text-[10px] font-bold uppercase text-muted-foreground">WhatsApp</span>
                                    </div>
                                    <p className="text-xs text-foreground whitespace-pre-wrap">{auto.message_template}</p>
                                  </div>
                                )}
                                {auto.email_template && (
                                  <div className="p-3 bg-muted/50 rounded-md">
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                      <Mail className="h-3 w-3 text-blue-500" />
                                      <span className="text-[10px] font-bold uppercase text-muted-foreground">Email</span>
                                    </div>
                                    <p className="text-xs text-foreground whitespace-pre-wrap">{auto.email_template}</p>
                                  </div>
                                )}
                                <div className="flex gap-4 text-[10px] text-muted-foreground pt-1">
                                  <span>Cooldown: {auto.cooldown_hours || 24}h</span>
                                  <span>Delay: {auto.delay_minutes} min</span>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Channel Badge ──

function ChannelBadge({ channel }: { channel: string }) {
  if (channel === "WhatsApp") {
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 gap-1 text-emerald-600 border-emerald-300 dark:text-emerald-400 dark:border-emerald-700">
        <MessageSquare className="h-2.5 w-2.5" />
        WhatsApp
      </Badge>
    );
  }
  if (channel === "Email") {
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 gap-1 text-blue-600 border-blue-300 dark:text-blue-400 dark:border-blue-700">
        <Mail className="h-2.5 w-2.5" />
        Email
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] px-1.5 gap-1">
      <Send className="h-2.5 w-2.5" />
      {channel}
    </Badge>
  );
}
