import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useWhatsAppBots, WhatsAppBot } from "@/hooks/useWhatsAppBots";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Bot, Play, Square, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface BotExecutionPanelProps {
  contactId: string;
  onBotStatusChange?: (running: boolean) => void;
}

export function BotExecutionPanel({ contactId, onBotStatusChange }: BotExecutionPanelProps) {
  const { organization } = useOrganization();
  const { bots } = useWhatsAppBots();
  const [executions, setExecutions] = useState<any[]>([]);
  const [starting, setStarting] = useState<string | null>(null);
  const [recentResult, setRecentResult] = useState<{ botName: string; status: "completed" | "error" } | null>(null);
  const [confirmBot, setConfirmBot] = useState<WhatsAppBot | null>(null);

  const fetchExecutions = useCallback(async () => {
    if (!contactId) return;
    const { data } = await supabase
      .from("whatsapp_bot_executions")
      .select("*, whatsapp_bots(name)")
      .eq("contact_id", contactId)
      .in("status", ["running", "waiting"])
      .order("started_at", { ascending: false });
    const execs = (data as any[]) || [];
    setExecutions(execs);
    onBotStatusChange?.(execs.length > 0);
  }, [contactId, onBotStatusChange]);

  const checkRecentResults = useCallback(async () => {
    if (!contactId) return;
    const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
    const { data } = await supabase
      .from("whatsapp_bot_executions")
      .select("status, error_message, completed_at, whatsapp_bots(name)")
      .eq("contact_id", contactId)
      .in("status", ["completed", "error"])
      .gte("completed_at", thirtySecondsAgo)
      .order("completed_at", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const result = data[0] as any;
      setRecentResult({
        botName: result.whatsapp_bots?.name || "Bot",
        status: result.status,
      });
      setTimeout(() => setRecentResult(null), 5000);
    }
  }, [contactId]);

  useEffect(() => {
    fetchExecutions();
    const interval = setInterval(() => {
      fetchExecutions();
      checkRecentResults();
    }, executions.length > 0 ? 3000 : 10000);
    return () => clearInterval(interval);
  }, [contactId, executions.length, fetchExecutions, checkRecentResults]);

  const handleStart = async (bot: WhatsAppBot) => {
    if (!organization?.id) return;
    setStarting(bot.id);
    try {
      const { data, error } = await supabase.functions.invoke("bot-engine", {
        body: { action: "start", bot_id: bot.id, contact_id: contactId, organization_id: organization.id },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      toast.success(`Bot "${bot.name}" iniciado! Acompanhe o progresso no chat.`);
      await fetchExecutions();
    } catch (err: any) {
      toast.error("Erro ao iniciar bot");
    } finally {
      setStarting(null);
    }
  };

  const handleStop = async (executionId: string) => {
    try {
      await supabase.functions.invoke("bot-engine", {
        body: { action: "stop", execution_id: executionId },
      });
      toast.success("Bot parado");
      await fetchExecutions();
    } catch {
      toast.error("Erro ao parar bot");
    }
  };

  const activeBots = bots.filter(b => b.is_active);
  const hasActiveExecutions = executions.length > 0;

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`h-7 w-7 relative ${hasActiveExecutions ? "text-primary" : "text-muted-foreground"}`}
          >
            <Bot className="h-3.5 w-3.5" />
            {hasActiveExecutions && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary animate-pulse" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="end">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-xs font-semibold text-foreground">Chatbots</p>
          </div>

          {/* Active executions */}
          {executions.length > 0 && (
            <div className="px-3 py-2 border-b border-border space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground">Em execução</p>
              {executions.map((exec: any) => (
                <div key={exec.id} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{exec.whatsapp_bots?.name || "Bot"}</p>
                    <Badge variant="outline" className="text-[9px] h-4">
                      {exec.status === "waiting" ? "⏳ Aguardando" : "⚡ Executando"}
                    </Badge>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleStop(exec.id)}>
                    <Square className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Available bots */}
          <div className="px-3 py-2 space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground">Executar bot</p>
            {activeBots.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Nenhum bot ativo disponível</p>
            ) : (
              activeBots.map(bot => (
                <button
                  key={bot.id}
                  onClick={() => setConfirmBot(bot)}
                  disabled={starting === bot.id}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted/60 transition-colors text-left"
                >
                  {starting === bot.id ? (
                    <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                  ) : (
                    <Play className="h-3 w-3 text-primary shrink-0" />
                  )}
                  <span className="flex-1 truncate">{bot.name}</span>
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Confirmation dialog */}
      <AlertDialog open={!!confirmBot} onOpenChange={(open) => !open && setConfirmBot(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Executar bot?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja iniciar o bot <strong>"{confirmBot?.name}"</strong> para este contato? As mensagens serão enviadas automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmBot) {
                  handleStart(confirmBot);
                  setConfirmBot(null);
                }
              }}
            >
              Iniciar bot
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ─── Inline Bot Status Banner ─── */
export function BotStatusBanner({ contactId }: { contactId: string }) {
  const [executions, setExecutions] = useState<any[]>([]);
  const [recentResult, setRecentResult] = useState<{ botName: string; status: string; message?: string } | null>(null);

  const fetchExecutions = useCallback(async () => {
    if (!contactId) return;
    const { data } = await supabase
      .from("whatsapp_bot_executions")
      .select("id, status, current_step_id, whatsapp_bots(name), started_at")
      .eq("contact_id", contactId)
      .in("status", ["running", "waiting"])
      .order("started_at", { ascending: false });
    
    const prev = executions;
    const current = (data as any[]) || [];
    setExecutions(current);

    // Detect transition from running → done
    if (prev.length > 0 && current.length === 0) {
      // Check what happened
      const { data: finished } = await supabase
        .from("whatsapp_bot_executions")
        .select("status, error_message, whatsapp_bots(name)")
        .eq("contact_id", contactId)
        .in("status", ["completed", "error"])
        .order("completed_at", { ascending: false })
        .limit(1);

      if (finished && finished.length > 0) {
        const r = finished[0] as any;
        setRecentResult({
          botName: r.whatsapp_bots?.name || "Bot",
          status: r.status,
          message: r.error_message,
        });
        setTimeout(() => setRecentResult(null), 6000);
      }
    }
  }, [contactId, executions.length]);

  useEffect(() => {
    fetchExecutions();
    const interval = setInterval(fetchExecutions, executions.length > 0 ? 2000 : 8000);
    return () => clearInterval(interval);
  }, [contactId, executions.length]);

  if (executions.length === 0 && !recentResult) return null;

  return (
    <div className="px-3 py-1.5">
      {executions.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2 animate-in slide-in-from-top-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-primary">
              Bot "{(executions[0] as any).whatsapp_bots?.name}" em execução...
            </p>
            <p className="text-[10px] text-muted-foreground">
              {(executions[0] as any).status === "waiting" ? "Aguardando delay" : "Enviando mensagens"}
            </p>
          </div>
          <Bot className="h-4 w-4 text-primary/60 shrink-0" />
        </div>
      )}

      {recentResult && executions.length === 0 && (
        <div className={`flex items-center gap-2 rounded-lg px-3 py-2 animate-in slide-in-from-top-2 ${
          recentResult.status === "completed"
            ? "bg-green-500/10 border border-green-500/20"
            : "bg-destructive/10 border border-destructive/20"
        }`}>
          {recentResult.status === "completed" ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
          )}
          <p className="text-xs font-medium">
            {recentResult.status === "completed"
              ? `Bot "${recentResult.botName}" finalizado com sucesso ✓`
              : `Bot "${recentResult.botName}" teve um erro: ${recentResult.message || "erro desconhecido"}`
            }
          </p>
        </div>
      )}
    </div>
  );
}
