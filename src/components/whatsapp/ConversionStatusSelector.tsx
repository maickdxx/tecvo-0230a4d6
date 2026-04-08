import { useState } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  UserPlus,
  MessageSquare,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  Search,
  FileText,
  Clock,
  Wrench,
  Star,
  XCircle,
} from "lucide-react";

export interface ConversionStep {
  key: string;
  label: string;
  shortLabel?: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  group: "lead" | "negociacao" | "execucao" | "final";
}

export const CONVERSION_STEPS: ConversionStep[] = [
  // Lead
  { key: "novo_contato", label: "Novo lead", shortLabel: "Novo", icon: UserPlus, color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-500/10", group: "lead" },
  { key: "qualificacao", label: "Qualificação", shortLabel: "Qualif.", icon: Search, color: "text-indigo-600 dark:text-indigo-400", bgColor: "bg-indigo-500/10", group: "lead" },
  // Negociação
  { key: "orcamento", label: "Orçamento", shortLabel: "Orçam.", icon: FileText, color: "text-violet-600 dark:text-violet-400", bgColor: "bg-violet-500/10", group: "negociacao" },
  { key: "aguardando_cliente", label: "Aguardando cliente", shortLabel: "Aguard.", icon: Clock, color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-500/10", group: "negociacao" },
  { key: "aguardando_aprovacao", label: "Aguardando aprovação", shortLabel: "Aprov.", icon: Clock, color: "text-orange-600 dark:text-orange-400", bgColor: "bg-orange-500/10", group: "negociacao" },
  { key: "aguardando_pagamento", label: "Aguardando pagamento", shortLabel: "Pgto.", icon: Clock, color: "text-yellow-600 dark:text-yellow-400", bgColor: "bg-yellow-500/10", group: "negociacao" },
  // Execução
  { key: "agendado", label: "Agendado", icon: CalendarCheck, color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-500/10", group: "execucao" },
  { key: "em_execucao", label: "Em execução", shortLabel: "Exec.", icon: Wrench, color: "text-cyan-600 dark:text-cyan-400", bgColor: "bg-cyan-500/10", group: "execucao" },
  { key: "pos_atendimento", label: "Pós-atendimento", shortLabel: "Pós", icon: Star, color: "text-pink-600 dark:text-pink-400", bgColor: "bg-pink-500/10", group: "execucao" },
  // Final
  { key: "concluido", label: "Concluído", icon: CheckCircle2, color: "text-green-600 dark:text-green-400", bgColor: "bg-green-500/10", group: "final" },
  { key: "nao_convertido", label: "Não convertido", shortLabel: "N/Conv.", icon: XCircle, color: "text-red-500 dark:text-red-400", bgColor: "bg-red-500/10", group: "final" },
];

const GROUP_LABELS: Record<string, string> = {
  lead: "Lead",
  negociacao: "Negociação",
  execucao: "Execução",
  final: "Finalização",
};

export function getConversionStep(status: string | null): ConversionStep {
  // Map legacy statuses
  if (status === "finalizado") return CONVERSION_STEPS.find(s => s.key === "concluido")!;
  if (status === "orcamento_enviado") return CONVERSION_STEPS.find(s => s.key === "orcamento")!;
  if (status === "recorrencia") return CONVERSION_STEPS.find(s => s.key === "concluido")!;
  if (status === "lead_novo" || status === "pending") return CONVERSION_STEPS[0];
  if (status === "em_atendimento") return CONVERSION_STEPS.find(s => s.key === "qualificacao")!;
  if (status === "lead_qualificado" || status === "em_negociacao") return CONVERSION_STEPS.find(s => s.key === "qualificacao")!;
  return CONVERSION_STEPS.find((s) => s.key === status) || CONVERSION_STEPS[0];
}

interface ConversionStatusSelectorProps {
  contactId: string;
  currentStatus: string | null;
  compact?: boolean;
  onStatusChange?: (newStatus: string) => void;
}

export function ConversionStatusSelector({
  contactId,
  currentStatus,
  compact = false,
  onStatusChange,
}: ConversionStatusSelectorProps) {
  const [updating, setUpdating] = useState(false);
  const current = getConversionStep(currentStatus);
  const Icon = current.icon;

  const handleChange = async (newStatus: string) => {
    if (newStatus === currentStatus) return;
    setUpdating(true);
    const { error } = await supabase
      .from("whatsapp_contacts")
      .update({ conversion_status: newStatus })
      .eq("id", contactId);
    setUpdating(false);
    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }
    onStatusChange?.(newStatus);
    toast.success("Status atualizado");
  };

  const groups = ["lead", "negociacao", "execucao", "final"] as const;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={updating}
          className={cn(
            "gap-1 font-medium transition-colors",
            compact ? "h-6 text-[10px] px-1.5" : "h-7 text-[11px] px-2",
            current.bgColor,
            current.color,
            "hover:opacity-80"
          )}
        >
          <Icon className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
          {compact ? (current.shortLabel || current.label) : current.label}
          <ChevronDown className={cn(compact ? "h-2.5 w-2.5" : "h-3 w-3", "opacity-60")} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {groups.map((group, gi) => (
          <div key={group}>
            {gi > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {GROUP_LABELS[group]}
            </DropdownMenuLabel>
            {CONVERSION_STEPS.filter(s => s.group === group).map((step) => {
              const StepIcon = step.icon;
              return (
                <DropdownMenuItem
                  key={step.key}
                  onClick={() => handleChange(step.key)}
                  className={cn(
                    "gap-2",
                    step.key === current.key && "bg-muted font-semibold"
                  )}
                >
                  <StepIcon className={cn("h-4 w-4", step.color)} />
                  <span className={cn("text-xs flex-1")}>{step.label}</span>
                  {step.key === current.key && (
                    <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-primary" />
                  )}
                </DropdownMenuItem>
              );
            })}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
