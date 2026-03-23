import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  BackgroundVariant,
  Panel,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useBotFlow, STEP_TYPES, type BotStep, type BotConnection, TRIGGER_TYPES } from "@/hooks/useWhatsAppBots";
import { useWhatsAppBots } from "@/hooks/useWhatsAppBots";
import { useWhatsAppChannels } from "@/hooks/useWhatsAppChannels";
import { nodeTypes } from "./FlowNodes";
import { StepConfigPanel } from "./StepConfigPanel";
import { TriggerConfigPanel } from "./TriggerConfigPanel";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MessageSquare, Zap, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BotFlowBuilderProps {
  botId: string;
  onDirtyChange?: (dirty: boolean) => void;
  saveRef?: React.MutableRefObject<(() => Promise<void>) | null>;
  cancelRef?: React.MutableRefObject<(() => void) | null>;
}

export function BotFlowBuilder({ botId, onDirtyChange, saveRef, cancelRef }: BotFlowBuilderProps) {
  const { steps: dbSteps, connections: dbConnections, loading, fetchFlow } = useBotFlow(botId);
  const { bots, updateBot } = useWhatsAppBots();
  const { channels } = useWhatsAppChannels();
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [showTriggerConfig, setShowTriggerConfig] = useState(false);

  const bot = bots.find(b => b.id === botId);

  // Local draft state
  const [draftSteps, setDraftSteps] = useState<BotStep[]>([]);
  const [draftConnections, setDraftConnections] = useState<BotConnection[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const snapshotRef = useRef<{ steps: BotStep[]; connections: BotConnection[] }>({ steps: [], connections: [] });

  // Sync DB → local when DB data changes (and not dirty)
  useEffect(() => {
    if (!isDirty) {
      setDraftSteps(dbSteps);
      setDraftConnections(dbConnections);
      snapshotRef.current = { steps: dbSteps, connections: dbConnections };
    }
  }, [dbSteps, dbConnections]); // eslint-disable-line react-hooks/exhaustive-deps

  const markDirty = useCallback(() => {
    setIsDirty(true);
    onDirtyChange?.(true);
  }, [onDirtyChange]);

  const markClean = useCallback(() => {
    setIsDirty(false);
    onDirtyChange?.(false);
  }, [onDirtyChange]);

  // ─── Save: persist draft to DB ───
  const handleSaveAll = useCallback(async () => {
    try {
      await supabase.from("whatsapp_bot_connections").delete().eq("bot_id", botId);
      await supabase.from("whatsapp_bot_steps").delete().eq("bot_id", botId);

      if (draftSteps.length > 0) {
        const { error: stepsErr } = await supabase.from("whatsapp_bot_steps").insert(
          draftSteps.map(s => ({
            id: s.id,
            bot_id: botId,
            step_type: s.step_type,
            label: s.label,
            config: s.config,
            position_x: s.position_x,
            position_y: s.position_y,
          }))
        );
        if (stepsErr) throw stepsErr;
      }

      if (draftConnections.length > 0) {
        const { error: connsErr } = await supabase.from("whatsapp_bot_connections").insert(
          draftConnections.map(c => ({
            id: c.id,
            bot_id: botId,
            from_step_id: c.from_step_id || null,
            to_step_id: c.to_step_id,
            condition_branch: c.condition_branch,
          } as any))
        );
        if (connsErr) throw connsErr;
      }

      snapshotRef.current = { steps: [...draftSteps], connections: [...draftConnections] };
      markClean();
      toast.success("Fluxo salvo com sucesso");
      await fetchFlow();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar fluxo");
    }
  }, [botId, draftSteps, draftConnections, markClean, fetchFlow]);

  // ─── Cancel: revert to last saved snapshot ───
  const handleCancelAll = useCallback(() => {
    setDraftSteps(snapshotRef.current.steps);
    setDraftConnections(snapshotRef.current.connections);
    setSelectedStepId(null);
    setShowTriggerConfig(false);
    markClean();
  }, [markClean]);

  // Expose save/cancel to parent via refs
  useEffect(() => {
    if (saveRef) saveRef.current = handleSaveAll;
    if (cancelRef) cancelRef.current = handleCancelAll;
  }, [saveRef, cancelRef, handleSaveAll, handleCancelAll]);

  // ─── Local mutations (no DB) ───
  const localAddStep = useCallback((stepType: string, label: string, config: Record<string, any>, posX: number, posY: number) => {
    const newStep: BotStep = {
      id: crypto.randomUUID(),
      bot_id: botId,
      step_type: stepType,
      label,
      config,
      position_x: posX,
      position_y: posY,
      created_at: new Date().toISOString(),
    };
    setDraftSteps(prev => [...prev, newStep]);
    markDirty();
    return newStep;
  }, [botId, markDirty]);

  const localUpdateStep = useCallback((id: string, updates: Partial<BotStep>) => {
    setDraftSteps(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    markDirty();
  }, [markDirty]);

  const localDeleteStep = useCallback((id: string) => {
    setDraftSteps(prev => prev.filter(s => s.id !== id));
    setDraftConnections(prev => prev.filter(c => c.from_step_id !== id && c.to_step_id !== id));
    markDirty();
  }, [markDirty]);

  const localAddConnection = useCallback((fromStepId: string | null, toStepId: string, branch = "default") => {
    if (fromStepId && fromStepId === toStepId) {
      toast.error("Não é possível conectar uma etapa nela mesma");
      return;
    }

    setDraftConnections(prev => {
      const alreadyExists = prev.some(
        c => (c.from_step_id || null) === fromStepId && c.to_step_id === toStepId && c.condition_branch === branch
      );

      if (alreadyExists) return prev;

      const newConn: BotConnection = {
        id: crypto.randomUUID(),
        bot_id: botId,
        from_step_id: fromStepId as string,
        to_step_id: toStepId,
        condition_branch: branch,
      };

      markDirty();
      return [...prev, newConn];
    });
  }, [botId, markDirty]);

  const localDeleteConnection = useCallback((id: string) => {
    setDraftConnections(prev => prev.filter(c => c.id !== id));
    markDirty();
  }, [markDirty]);

  const localMoveStep = useCallback((id: string, x: number, y: number) => {
    setDraftSteps(prev => prev.map(s => s.id === id ? { ...s, position_x: x, position_y: y } : s));
    markDirty();
  }, [markDirty]);

  // ─── Trigger config helpers ───
  const triggerLabel = useMemo(() => {
    if (!bot) return "";
    return TRIGGER_TYPES.find(t => t.value === bot.trigger_type)?.label || bot.trigger_type;
  }, [bot]);

  const channelLabel = useMemo(() => {
    if (!bot) return "";
    const channelIds: string[] = bot.trigger_config?.channel_ids || [];
    if (channelIds.length === 0) return "Todos os canais";
    const names = channelIds
      .map(id => channels.find(c => c.id === id)?.name)
      .filter(Boolean);
    return names.length > 0 ? names.join(", ") : "";
  }, [bot, channels]);

  // ─── ReactFlow nodes/edges from draft ───
  const flowNodes: Node[] = useMemo(() => {
    const triggerNode: Node = {
      id: "trigger",
      type: "triggerNode",
      position: { x: 250, y: 20 },
      data: {
        label: "Início do fluxo",
        triggerLabel,
        channelLabel: (bot?.trigger_type === "new_message" || bot?.trigger_type === "new_conversation") ? channelLabel : undefined,
        category: "trigger",
        iconName: "Play",
      },
      deletable: false,
    };

    const stepNodes: Node[] = draftSteps.map((step) => {
      const stepDef = STEP_TYPES.find(s => s.value === step.step_type);
      return {
        id: step.id,
        type: "flowNode",
        position: { x: step.position_x || 250, y: step.position_y || 150 },
        data: {
          label: step.label || stepDef?.label || step.step_type,
          stepType: step.step_type,
          category: stepDef?.category || "action",
          iconName: stepDef?.icon || "Zap",
          config: step.config || {},
        },
      };
    });

    return [triggerNode, ...stepNodes];
  }, [draftSteps, triggerLabel, channelLabel, bot?.trigger_type]);

  const flowEdges: Edge[] = useMemo(() => {
    return draftConnections.map((conn) => ({
      id: conn.id,
      source: conn.from_step_id ? conn.from_step_id : "trigger",
      target: conn.to_step_id,
      sourceHandle: conn.condition_branch !== "default" ? conn.condition_branch : undefined,
      animated: true,
      style: {
        stroke: conn.condition_branch === "true" ? "#22c55e" : conn.condition_branch === "false" ? "#ef4444" : "hsl(var(--muted-foreground))",
        strokeWidth: 2,
      },
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    }));
  }, [draftConnections]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  useEffect(() => {
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [flowNodes, flowEdges, setNodes, setEdges]);

  const onConnect = useCallback((params: Connection) => {
    if (!params.source || !params.target) return;
    const branch = params.sourceHandle || "default";
    const fromId = params.source === "trigger" ? null : params.source;
    localAddConnection(fromId, params.target, branch);
  }, [localAddConnection]);

  const onEdgeDelete = useCallback((edgesToDelete: Edge[]) => {
    for (const edge of edgesToDelete) {
      localDeleteConnection(edge.id);
    }
  }, [localDeleteConnection]);

  const onNodeDragStop = useCallback((_: any, node: Node) => {
    if (node.id === "trigger") return;
    localMoveStep(node.id, node.position.x, node.position.y);
  }, [localMoveStep]);

  const handleAddStep = (stepType: string) => {
    const stepDef = STEP_TYPES.find(s => s.value === stepType);
    if (!stepDef) return;
    const maxY = Math.max(...nodes.map(n => n.position.y), 0);
    const newStep = localAddStep(stepType, stepDef.label, {}, 250, maxY + 120);
    setSelectedStepId(newStep.id);
    setShowTriggerConfig(false);
  };

  const onNodeClick = useCallback((_: any, node: Node) => {
    if (node.id === "trigger") {
      setShowTriggerConfig(true);
      setSelectedStepId(null);
      return;
    }
    setSelectedStepId(node.id);
    setShowTriggerConfig(false);
  }, []);

  const selectedStep = draftSteps.find(s => s.id === selectedStepId);

  const handleSaveStep = (label: string, config: Record<string, any>) => {
    if (!selectedStepId) return;
    localUpdateStep(selectedStepId, { label, config } as any);
  };

  const handleDeleteStep = () => {
    if (!selectedStepId) return;
    localDeleteStep(selectedStepId);
    setSelectedStepId(null);
  };

  const handleSaveTrigger = async (triggerType: string, triggerConfig: Record<string, any>) => {
    if (!bot) return;
    await updateBot(bot.id, { trigger_type: triggerType, trigger_config: triggerConfig } as any);
    toast.success("Gatilho atualizado");
    setShowTriggerConfig(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Carregando fluxo...</div>;
  }

  const categories = [
    { key: "message", label: "Mensagens", icon: MessageSquare },
    { key: "action", label: "Ações", icon: Settings2 },
    { key: "control", label: "Controle", icon: Zap },
  ];

  return (
    <div className="flex h-full">
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgesDelete={onEdgeDelete}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          deleteKeyCode="Delete"
          panOnDrag
          zoomOnScroll
          zoomOnPinch
          panOnScroll={false}
          minZoom={0.3}
          maxZoom={2}
          className="bg-muted/[0.04]"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} className="opacity-30" />
          <Controls showInteractive={false} className="!shadow-sm !border-border !rounded-lg" />
          <MiniMap
            nodeStrokeWidth={3}
            zoomable
            pannable
            className="!bg-card !border-border !rounded-lg !shadow-sm"
            maskColor="hsl(var(--muted) / 0.5)"
          />

          <Panel position="top-left" className="!m-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="h-8 gap-1.5 shadow-sm">
                  <Plus className="h-3.5 w-3.5" /> Adicionar etapa
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {categories.map((cat) => (
                  <DropdownMenuSub key={cat.key}>
                    <DropdownMenuSubTrigger>
                      <cat.icon className="h-4 w-4 mr-2" />
                      {cat.label}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-48">
                      {STEP_TYPES
                        .filter(s => s.category === cat.key)
                        .map(s => (
                          <DropdownMenuItem
                            key={s.value}
                            onClick={() => handleAddStep(s.value)}
                            disabled={'disabled' in s && s.disabled}
                          >
                            {s.label}
                            {'disabled' in s && s.disabled && (
                              <span className="ml-auto text-[10px] text-muted-foreground">Em breve</span>
                            )}
                          </DropdownMenuItem>
                        ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </Panel>

          <Panel position="top-right" className="!m-3">
            <div className="bg-card/80 backdrop-blur border border-border rounded-lg px-3 py-2 text-[10px] text-muted-foreground space-y-0.5">
              <p>• Arraste o fundo para mover o canvas</p>
              <p>• Scroll do mouse para zoom</p>
              <p>• Clique no início para configurar gatilho</p>
              <p>• Conecte os pontos para criar fluxo</p>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {showTriggerConfig && bot && (
        <TriggerConfigPanel
          triggerType={bot.trigger_type}
          triggerConfig={bot.trigger_config || {}}
          onSave={handleSaveTrigger}
          onClose={() => setShowTriggerConfig(false)}
        />
      )}

      {selectedStep && !showTriggerConfig && (
        <StepConfigPanel
          stepId={selectedStep.id}
          stepType={selectedStep.step_type}
          label={selectedStep.label || ""}
          config={(selectedStep.config as Record<string, any>) || {}}
          onSave={handleSaveStep}
          onDelete={handleDeleteStep}
          onClose={() => setSelectedStepId(null)}
        />
      )}
    </div>
  );
}
