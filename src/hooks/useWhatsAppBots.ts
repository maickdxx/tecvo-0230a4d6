import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";

export interface WhatsAppBot {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  trigger_type: string;
  trigger_config: Record<string, any>;
  execution_count: number;
  last_executed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BotStep {
  id: string;
  bot_id: string;
  step_type: string;
  label: string | null;
  config: Record<string, any>;
  position_x: number;
  position_y: number;
  created_at: string;
}

export interface BotConnection {
  id: string;
  bot_id: string;
  from_step_id: string;
  to_step_id: string;
  condition_branch: string;
}

export interface BotExecution {
  id: string;
  bot_id: string;
  contact_id: string;
  organization_id: string;
  current_step_id: string | null;
  status: string;
  wait_until: string | null;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}

export const TRIGGER_TYPES = [
  { value: "new_message", label: "Nova mensagem recebida" },
  { value: "new_conversation", label: "Nova conversa iniciada" },
  { value: "tag_added", label: "Etiqueta adicionada" },
  { value: "tag_removed", label: "Etiqueta removida" },
  { value: "resolved", label: "Conversa marcada como resolvida" },
  { value: "no_team_reply", label: "Equipe não respondeu (tempo)" },
  { value: "no_client_reply", label: "Cliente não respondeu (tempo)" },
  { value: "manual", label: "Execução manual" },
] as const;

export const STEP_TYPES = [
  // Messages
  { value: "send_message", label: "Enviar mensagem", category: "message", icon: "MessageSquare" },
  { value: "send_buttons", label: "Pergunta com botões", category: "message", icon: "ListChecks" },
  { value: "send_image", label: "Enviar imagem", category: "message", icon: "Image" },
  { value: "send_video", label: "Enviar vídeo", category: "message", icon: "Video" },
  { value: "send_document", label: "Enviar documento", category: "message", icon: "FileText" },
  { value: "send_audio", label: "Enviar áudio", category: "message", icon: "Mic", disabled: true },
  // Actions
  { value: "add_tag", label: "Adicionar etiqueta", category: "action", icon: "Tag" },
  { value: "remove_tag", label: "Remover etiqueta", category: "action", icon: "TagOff" },
  { value: "resolve", label: "Marcar como resolvido", category: "action", icon: "CheckCircle" },
  { value: "reopen", label: "Reabrir conversa", category: "action", icon: "RotateCcw" },
  { value: "assign", label: "Atribuir atendente", category: "action", icon: "UserCheck" },
  { value: "unassign", label: "Remover atendente", category: "action", icon: "UserX" },
  { value: "transfer_human", label: "Transferir para humano", category: "action", icon: "Headphones" },
  { value: "capture_input", label: "Capturar informação", category: "action", icon: "TextCursorInput" },
  { value: "internal_note", label: "Criar nota interna", category: "action", icon: "StickyNote" },
  // Control
  { value: "delay", label: "Esperar", category: "control", icon: "Clock" },
  { value: "wait_response", label: "Esperar resposta", category: "control", icon: "MessageCircle" },
  { value: "condition", label: "Condição", category: "control", icon: "GitBranch" },
  { value: "end_flow", label: "Finalizar fluxo", category: "control", icon: "CircleStop" },
] as const;

export const CONDITION_TYPES = [
  { value: "client_replied", label: "Cliente respondeu" },
  { value: "client_not_replied", label: "Cliente não respondeu" },
  { value: "has_tag", label: "Conversa possui etiqueta" },
  { value: "not_has_tag", label: "Conversa não possui etiqueta" },
  { value: "is_assigned", label: "Conversa está atribuída" },
  { value: "not_assigned", label: "Conversa sem atendente" },
  { value: "within_business_hours", label: "Dentro do horário comercial" },
  { value: "outside_business_hours", label: "Fora do horário comercial" },
  { value: "is_weekend", label: "É sábado ou domingo" },
  { value: "last_message_from_client", label: "Última mensagem do cliente" },
  { value: "last_message_from_team", label: "Última mensagem da equipe" },
] as const;

export const DELAY_TYPES = [
  { value: "minutes", label: "Minutos" },
  { value: "hours", label: "Horas" },
  { value: "days", label: "Dias" },
  { value: "until_time", label: "Até horário específico" },
  { value: "until_business_hours", label: "Até próximo horário comercial" },
] as const;

export const CAPTURE_FIELDS = [
  { value: "name", label: "Nome" },
  { value: "city", label: "Cidade" },
  { value: "neighborhood", label: "Bairro" },
  { value: "address", label: "Endereço" },
  { value: "email", label: "E-mail" },
  { value: "btus", label: "BTUs do equipamento" },
  { value: "service_type", label: "Tipo de serviço" },
  { value: "custom", label: "Campo personalizado" },
] as const;

export function useWhatsAppBots() {
  const { organization } = useOrganization();
  const [bots, setBots] = useState<WhatsAppBot[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBots = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("whatsapp_bots")
      .select("*")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false });
    setBots((data as any[]) || []);
    setLoading(false);
  }, [organization?.id]);

  useEffect(() => {
    fetchBots();
  }, [fetchBots]);

  const createBot = useCallback(async (name: string, description: string, triggerType: string, triggerConfig: Record<string, any> = {}) => {
    if (!organization?.id) return null;
    const { data, error } = await supabase
      .from("whatsapp_bots")
      .insert({ organization_id: organization.id, name, description, trigger_type: triggerType, trigger_config: triggerConfig })
      .select()
      .single();
    if (error) { toast.error("Erro ao criar bot"); return null; }
    await fetchBots();
    toast.success("Bot criado com sucesso");
    return data as WhatsAppBot;
  }, [organization?.id, fetchBots]);

  const updateBot = useCallback(async (id: string, updates: Partial<WhatsAppBot>) => {
    const { error } = await supabase
      .from("whatsapp_bots")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error("Erro ao atualizar bot"); return; }
    await fetchBots();
  }, [fetchBots]);

  const deleteBot = useCallback(async (id: string) => {
    const { error } = await supabase.from("whatsapp_bots").delete().eq("id", id);
    if (error) { toast.error("Erro ao apagar bot"); return; }
    await fetchBots();
    toast.success("Bot apagado");
  }, [fetchBots]);

  const duplicateBot = useCallback(async (id: string) => {
    if (!organization?.id) return;
    const bot = bots.find(b => b.id === id);
    if (!bot) return;

    const { data: newBot, error } = await supabase
      .from("whatsapp_bots")
      .insert({
        organization_id: organization.id,
        name: `${bot.name} (cópia)`,
        description: bot.description,
        trigger_type: bot.trigger_type,
        trigger_config: bot.trigger_config,
        is_active: false,
      })
      .select()
      .single();
    if (error || !newBot) { toast.error("Erro ao duplicar bot"); return; }

    const { data: steps } = await supabase
      .from("whatsapp_bot_steps")
      .select("*")
      .eq("bot_id", id);

    if (steps && steps.length > 0) {
      const stepIdMap: Record<string, string> = {};
      for (const step of steps) {
        const { data: newStep } = await supabase
          .from("whatsapp_bot_steps")
          .insert({
            bot_id: (newBot as any).id,
            step_type: (step as any).step_type,
            label: (step as any).label,
            config: (step as any).config,
            position_x: (step as any).position_x,
            position_y: (step as any).position_y,
          })
          .select()
          .single();
        if (newStep) stepIdMap[(step as any).id] = (newStep as any).id;
      }

      const { data: connections } = await supabase
        .from("whatsapp_bot_connections")
        .select("*")
        .eq("bot_id", id);

      if (connections) {
        for (const conn of connections) {
          const c = conn as any;
          if (stepIdMap[c.from_step_id] && stepIdMap[c.to_step_id]) {
            await supabase.from("whatsapp_bot_connections").insert({
              bot_id: (newBot as any).id,
              from_step_id: stepIdMap[c.from_step_id],
              to_step_id: stepIdMap[c.to_step_id],
              condition_branch: c.condition_branch,
            });
          }
        }
      }
    }

    await fetchBots();
    toast.success("Bot duplicado com sucesso");
  }, [organization?.id, bots, fetchBots]);

  const toggleBot = useCallback(async (id: string) => {
    const bot = bots.find(b => b.id === id);
    if (!bot) return;
    await updateBot(id, { is_active: !bot.is_active } as any);
    toast.success(bot.is_active ? "Bot desativado" : "Bot ativado");
  }, [bots, updateBot]);

  return { bots, loading, fetchBots, createBot, updateBot, deleteBot, duplicateBot, toggleBot };
}

export function useBotFlow(botId: string | null) {
  const [steps, setSteps] = useState<BotStep[]>([]);
  const [connections, setConnections] = useState<BotConnection[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFlow = useCallback(async () => {
    if (!botId) return;
    setLoading(true);
    const [stepsRes, connsRes] = await Promise.all([
      supabase.from("whatsapp_bot_steps").select("*").eq("bot_id", botId),
      supabase.from("whatsapp_bot_connections").select("*").eq("bot_id", botId),
    ]);
    setSteps((stepsRes.data as any[]) || []);
    setConnections((connsRes.data as any[]) || []);
    setLoading(false);
  }, [botId]);

  useEffect(() => {
    fetchFlow();
  }, [fetchFlow]);

  const addStep = useCallback(async (stepType: string, label: string, config: Record<string, any>, posX: number, posY: number) => {
    if (!botId) return null;
    const { data, error } = await supabase
      .from("whatsapp_bot_steps")
      .insert({ bot_id: botId, step_type: stepType, label, config, position_x: posX, position_y: posY })
      .select()
      .single();
    if (error) { toast.error("Erro ao adicionar etapa"); return null; }
    await fetchFlow();
    return data as BotStep;
  }, [botId, fetchFlow]);

  const updateStep = useCallback(async (id: string, updates: Partial<BotStep>) => {
    const { error } = await supabase.from("whatsapp_bot_steps").update(updates).eq("id", id);
    if (error) toast.error("Erro ao atualizar etapa");
    else await fetchFlow();
  }, [fetchFlow]);

  const deleteStep = useCallback(async (id: string) => {
    await supabase.from("whatsapp_bot_steps").delete().eq("id", id);
    await fetchFlow();
  }, [fetchFlow]);

  const addConnection = useCallback(async (fromStepId: string | null, toStepId: string, branch = "default") => {
    if (!botId) return;
    const { error } = await supabase.from("whatsapp_bot_connections").insert({
      bot_id: botId, from_step_id: fromStepId, to_step_id: toStepId, condition_branch: branch,
    } as any);
    if (error) toast.error("Erro ao conectar etapas");
    else await fetchFlow();
  }, [botId, fetchFlow]);

  const deleteConnection = useCallback(async (id: string) => {
    await supabase.from("whatsapp_bot_connections").delete().eq("id", id);
    await fetchFlow();
  }, [fetchFlow]);

  const savePositions = useCallback(async (positions: { id: string; x: number; y: number }[]) => {
    for (const pos of positions) {
      await supabase.from("whatsapp_bot_steps").update({ position_x: pos.x, position_y: pos.y }).eq("id", pos.id);
    }
  }, []);

  return { steps, connections, loading, fetchFlow, addStep, updateStep, deleteStep, addConnection, deleteConnection, savePositions };
}
