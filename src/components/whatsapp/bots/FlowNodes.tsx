import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  MessageSquare, Image, Video, FileText, Mic, Tag, CheckCircle,
  RotateCcw, UserCheck, UserX, StickyNote, Clock, GitBranch, Zap,
  Play, Headphones, TextCursorInput, ListChecks, MessageCircle, CircleStop,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, any> = {
  MessageSquare, Image, Video, FileText, Mic, Tag, CheckCircle,
  RotateCcw, UserCheck, UserX, StickyNote, Clock, GitBranch, Zap,
  TagOff: Tag, Play, Headphones, TextCursorInput, ListChecks,
  MessageCircle, CircleStop,
};

const CATEGORY_STYLES: Record<string, { bg: string; border: string; icon: string; ring: string }> = {
  message:  { bg: "bg-blue-50 dark:bg-blue-950/40",    border: "border-blue-300 dark:border-blue-700",    icon: "text-blue-600 dark:text-blue-400",    ring: "ring-blue-400" },
  action:   { bg: "bg-violet-50 dark:bg-violet-950/40", border: "border-violet-300 dark:border-violet-700", icon: "text-violet-600 dark:text-violet-400", ring: "ring-violet-400" },
  control:  { bg: "bg-amber-50 dark:bg-amber-950/40",   border: "border-amber-300 dark:border-amber-700",   icon: "text-amber-600 dark:text-amber-400",   ring: "ring-amber-400" },
  trigger:  { bg: "bg-emerald-50 dark:bg-emerald-950/40", border: "border-emerald-400 dark:border-emerald-600", icon: "text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-400" },
};

const CATEGORY_LABELS: Record<string, string> = {
  message: "MENSAGEM",
  action: "AÇÃO",
  control: "CONTROLE",
  trigger: "GATILHO",
};

interface FlowNodeData {
  label: string;
  stepType: string;
  category: string;
  iconName: string;
  config: Record<string, any>;
  [key: string]: unknown;
}

export const FlowNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as FlowNodeData;
  const { label, stepType, category, iconName, config } = nodeData;
  const style = CATEGORY_STYLES[category] || CATEGORY_STYLES.action;
  const Icon = ICON_MAP[iconName] || Zap;
  const isCondition = stepType === "condition";
  const isEndFlow = stepType === "end_flow";
  const catLabel = CATEGORY_LABELS[category] || "";

  return (
    <div
      className={cn(
        "rounded-xl border-2 shadow-md min-w-[200px] max-w-[240px] transition-all",
        style.bg, style.border,
        selected && `ring-2 ${style.ring} ring-offset-2 ring-offset-background`
      )}
    >
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-muted-foreground/50 !border-2 !border-background !-top-1.5" />

      <div className={cn("px-3 pt-2 pb-0")}>
        <span className={cn("text-[9px] font-bold tracking-wider uppercase", style.icon)}>{catLabel}</span>
      </div>

      <div className="px-3 py-2">
        <div className="flex items-center gap-2">
          <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm", style.icon, "bg-white/80 dark:bg-white/10")}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-bold text-foreground truncate">{label}</span>
        </div>

        {/* Config previews */}
        {stepType === "send_message" && config?.message && (
          <p className="text-[10px] text-muted-foreground mt-2 line-clamp-2 bg-background/50 rounded px-2 py-1">{config.message}</p>
        )}
        {stepType === "send_buttons" && config?.question && (
          <div className="mt-2 bg-background/50 rounded px-2 py-1 space-y-0.5">
            <p className="text-[10px] text-muted-foreground line-clamp-1">{config.question}</p>
            {(config.buttons || []).slice(0, 3).map((btn: string, i: number) => (
              <span key={i} className="inline-block text-[9px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded px-1.5 py-0.5 mr-1">{btn}</span>
            ))}
          </div>
        )}
        {stepType === "capture_input" && config?.field_label && (
          <p className="text-[10px] text-muted-foreground mt-2 bg-background/50 rounded px-2 py-1">📝 {config.field_label}</p>
        )}
        {stepType === "wait_response" && config?.timeout_minutes && (
          <p className="text-[10px] text-muted-foreground mt-2 bg-background/50 rounded px-2 py-1">⏳ {config.timeout_minutes} min</p>
        )}
        {stepType === "transfer_human" && config?.message && (
          <p className="text-[10px] text-muted-foreground mt-2 line-clamp-2 bg-background/50 rounded px-2 py-1">{config.message}</p>
        )}
        {stepType === "delay" && config?.delay_value && (
          <p className="text-[10px] text-muted-foreground mt-2 bg-background/50 rounded px-2 py-1">
            ⏱ Esperar {config.delay_value} {config.delay_type === "minutes" ? "min" : config.delay_type === "hours" ? "h" : config.delay_type === "days" ? "dias" : config.delay_type}
          </p>
        )}
        {(stepType === "add_tag" || stepType === "remove_tag") && config?.tag_name && (
          <p className="text-[10px] text-muted-foreground mt-2 bg-background/50 rounded px-2 py-1">🏷 {config.tag_name}</p>
        )}
        {stepType === "condition" && config?.condition_type && (
          <p className="text-[10px] text-muted-foreground mt-2 bg-background/50 rounded px-2 py-1">{config.condition_label || config.condition_type}</p>
        )}
        {stepType === "end_flow" && (
          <p className="text-[10px] text-muted-foreground mt-2 bg-background/50 rounded px-2 py-1">🛑 Encerra a automação</p>
        )}
      </div>

      {isCondition ? (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="true"
            className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-background !-bottom-1.5"
            style={{ left: "30%" }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            className="!w-3 !h-3 !bg-rose-500 !border-2 !border-background !-bottom-1.5"
            style={{ left: "70%" }}
          />
          <div className="flex justify-between px-3 pb-1.5 text-[9px] font-medium">
            <span className="text-emerald-600 dark:text-emerald-400">Sim</span>
            <span className="text-rose-600 dark:text-rose-400">Não</span>
          </div>
        </>
      ) : stepType === "wait_response" ? (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="responded"
            className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-background !-bottom-1.5"
            style={{ left: "30%" }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="timeout"
            className="!w-3 !h-3 !bg-rose-500 !border-2 !border-background !-bottom-1.5"
            style={{ left: "70%" }}
          />
          <div className="flex justify-between px-3 pb-1.5 text-[9px] font-medium">
            <span className="text-emerald-600 dark:text-emerald-400">Respondeu</span>
            <span className="text-rose-600 dark:text-rose-400">Timeout</span>
          </div>
        </>
      ) : !isEndFlow ? (
        <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-muted-foreground/50 !border-2 !border-background !-bottom-1.5" />
      ) : null}
    </div>
  );
});

FlowNode.displayName = "FlowNode";

interface TriggerNodeData {
  label: string;
  triggerLabel?: string;
  channelLabel?: string;
  [key: string]: unknown;
}

export const TriggerNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as TriggerNodeData;
  const style = CATEGORY_STYLES.trigger;

  return (
    <div
      className={cn(
        "rounded-xl border-2 shadow-lg min-w-[220px] max-w-[260px] transition-all cursor-pointer",
        style.bg, style.border,
        selected && `ring-2 ${style.ring} ring-offset-2 ring-offset-background`
      )}
    >
      <div className="px-3 pt-2">
        <span className={cn("text-[9px] font-bold tracking-wider uppercase", style.icon)}>INÍCIO DO FLUXO</span>
      </div>
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm", style.icon, "bg-white/80 dark:bg-white/10")}>
            <Play className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground truncate">{nodeData.label}</p>
            {nodeData.triggerLabel && (
              <p className="text-[10px] text-muted-foreground truncate">{nodeData.triggerLabel}</p>
            )}
            {nodeData.channelLabel && (
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 truncate">📱 {nodeData.channelLabel}</p>
            )}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-background !-bottom-1.5" />
    </div>
  );
});

TriggerNode.displayName = "TriggerNode";

export const nodeTypes = {
  flowNode: FlowNode,
  triggerNode: TriggerNode,
};
