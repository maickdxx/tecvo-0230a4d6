import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Zap, Play, History, Loader2, AlertCircle, ChevronDown, Mail, MessageSquare, Filter } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Automation {
  id: string;
  name: string;
  description: string;
  trigger_type: string;
  enabled: boolean;
  delay_minutes: number;
  message_template: string;
  email_template: string | null;
  created_at: string;
}

interface AutomationLog {
  id: string;
  automation_id: string;
  user_id: string | null;
  email: string | null;
  status: string;
  sent_at: string;
  error_message: string | null;
  metadata: any;
  automation: { name: string } | null;
}

interface CategoryDef {
  key: string;
  title: string;
  description: string;
  icon: string;
  match: (trigger: string) => boolean;
}

const CATEGORIES: CategoryDef[] = [
  {
    key: "trial",
    title: "🚀 Trial (Ativação)",
    description: "Automações durante o período de teste — foco em engajamento e ativação",
    icon: "🚀",
    match: (t) => /^trial_d\d+$/.test(t) || t === "signup" || t === "welcome",
  },
  {
    key: "trial_ending",
    title: "⏳ Fim de Trial (Conversão)",
    description: "Automações de encerramento de trial — foco em converter para pagamento",
    icon: "⏳",
    match: (t) => t.startsWith("trial_ending"),
  },
  {
    key: "post_trial",
    title: "🔄 Pós-Trial (Recuperação)",
    description: "Automações após expiração do trial — foco em recuperar usuários perdidos",
    icon: "🔄",
    match: (t) => t.startsWith("trial_expired"),
  },
  {
    key: "other",
    title: "⚙️ Outras Automações",
    description: "Automações gerais do sistema — clima, dicas, reativação e outros",
    icon: "⚙️",
    match: () => true, // fallback
  },
];

function categorizeAutomations(automations: Automation[]) {
  const groups: Record<string, Automation[]> = {};
  CATEGORIES.forEach((c) => (groups[c.key] = []));

  const sorted = [...automations].sort((a, b) => (a.delay_minutes ?? 0) - (b.delay_minutes ?? 0));

  for (const auto of sorted) {
    let placed = false;
    for (const cat of CATEGORIES) {
      if (cat.key === "other") continue;
      if (cat.match(auto.trigger_type)) {
        groups[cat.key].push(auto);
        placed = true;
        break;
      }
    }
    if (!placed) groups["other"].push(auto);
  }
  return groups;
}

function hasEmailTemplate(a: Automation) {
  return !!a.email_template && a.email_template.trim().length > 0;
}

function getChannels(a: Automation) {
  const channels: string[] = [];
  if (a.message_template) channels.push("whatsapp");
  if (hasEmailTemplate(a)) channels.push("email");
  return channels.length ? channels : ["whatsapp"];
}

function formatDelay(minutes: number) {
  if (minutes >= 1440) return `${Math.round(minutes / 1440)}d`;
  if (minutes >= 60) return `${Math.round(minutes / 60)}h`;
  return `${minutes}min`;
}

function AutomationCard({
  automation,
  onToggle,
}: {
  automation: Automation;
  onToggle: (id: string, enabled: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const channels = getChannels(automation);

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <Card className={cn("transition-opacity", !automation.enabled && "opacity-60")}>
        <CardHeader className="pb-2 px-3 sm:px-6">
          <div className="flex items-start justify-between gap-2">
            <CollapsibleTrigger className="flex-1 text-left cursor-pointer group">
              <div className="flex items-center gap-2">
                <Zap className={cn("h-4 w-4 shrink-0", automation.enabled ? "text-amber-500" : "text-muted-foreground")} />
                <span className="font-semibold text-sm sm:text-base">{automation.name}</span>
                <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", expanded && "rotate-180")} />
              </div>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{automation.description}</p>
            </CollapsibleTrigger>
            <Switch
              checked={automation.enabled}
              onCheckedChange={(checked) => onToggle(automation.id, checked)}
              className="shrink-0"
            />
          </div>

          <div className="flex flex-wrap gap-1.5 mt-2">
            <Badge variant="outline" className="text-[10px] capitalize">
              {automation.trigger_type.replace(/_/g, " ")}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {formatDelay(automation.delay_minutes)}
            </Badge>
            {channels.map((ch) => (
              <Badge key={ch} variant={ch === "whatsapp" ? "default" : "outline"} className="text-[10px] gap-1">
                {ch === "whatsapp" ? <MessageSquare className="h-2.5 w-2.5" /> : <Mail className="h-2.5 w-2.5" />}
                {ch === "whatsapp" ? "WhatsApp" : "Email"}
              </Badge>
            ))}
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-2 px-3 sm:px-6 space-y-3">
            <div className="p-3 bg-muted rounded-md">
              <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1 flex items-center gap-1">
                <MessageSquare className="h-3 w-3" /> WhatsApp
              </p>
              <p className="text-xs text-foreground whitespace-pre-wrap">
                {automation.message_template || "—"}
              </p>
            </div>
            {hasEmailTemplate(automation) && (
              <div className="p-3 bg-muted rounded-md">
                <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1 flex items-center gap-1">
                  <Mail className="h-3 w-3" /> Email
                </p>
                <p className="text-xs text-foreground whitespace-pre-wrap">
                  {automation.email_template}
                </p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export function AdminAutomations() {
  const queryClient = useQueryClient();
  const [isRunningManual, setIsRunningManual] = useState(false);
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: automations, isLoading } = useQuery({
    queryKey: ["analytics-automations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analytics_automations")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Automation[];
    },
  });

  const { data: logs } = useQuery({
    queryKey: ["analytics-automation-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analytics_automation_logs")
        .select("*, automation:analytics_automations(name)")
        .order("sent_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as (AutomationLog & { automation: { name: string } })[];
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
      const { error } = await supabase.functions.invoke("analytics-automation-engine", {
        body: { mode: "manual" },
      });
      if (error) throw error;
    },
    onMutate: () => setIsRunningManual(true),
    onSuccess: () => {
      toast.success("Processamento manual concluído");
      queryClient.invalidateQueries({ queryKey: ["analytics-automation-logs"] });
    },
    onError: (err: any) => {
      toast.error("Erro ao processar manual: " + err.message);
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

  const filtered = (automations ?? []).filter((a) => {
    if (statusFilter === "active" && !a.enabled) return false;
    if (statusFilter === "inactive" && a.enabled) return false;
    if (channelFilter === "whatsapp" && !a.message_template) return false;
    if (channelFilter === "email" && !hasEmailTemplate(a)) return false;
    return true;
  });

  const groups = categorizeAutomations(filtered);
  const totalCount = automations?.length ?? 0;
  const activeCount = automations?.filter((a) => a.enabled).length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Motor de Automações</h2>
          <p className="text-sm text-muted-foreground">
            {totalCount} automações · {activeCount} ativas
          </p>
        </div>
        <Button
          onClick={() => runManualMutation.mutate()}
          disabled={isRunningManual}
          className="gap-2 w-full sm:w-auto"
        >
          {isRunningManual ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Processar Agora
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={channelFilter} onValueChange={setChannelFilter}>
            <SelectTrigger className="w-full sm:w-[150px] h-8 text-xs">
              <SelectValue placeholder="Canal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os canais</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="email">Email</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[150px] h-8 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="active">Ativas</SelectItem>
            <SelectItem value="inactive">Inativas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Categories */}
      {CATEGORIES.map((cat) => {
        const items = groups[cat.key];
        if (!items || items.length === 0) return null;

        return (
          <div key={cat.key} className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {cat.title}
              </h3>
              <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">{cat.description}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((a) => (
                <AutomationCard
                  key={a.id}
                  automation={a}
                  onToggle={(id, enabled) => toggleMutation.mutate({ id, enabled })}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Logs */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-5 w-5" />
              Logs de Execução
            </CardTitle>
            <CardDescription>Últimas automações disparadas pelo sistema</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Automação</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!logs || logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Nenhuma execução registrada
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium text-xs sm:text-sm">{log.automation?.name || "Desconhecida"}</TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {log.email || (log.user_id ? "Usuário Registrado" : "Desconhecido")}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">
                      {format(new Date(log.sent_at), "dd/MM HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.status === "sent" ? "default" : "destructive"} className="gap-1 text-[10px]">
                        {log.status === "sent" ? "Enviado" : (
                          <>
                            <AlertCircle className="h-3 w-3" />
                            Erro
                          </>
                        )}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
