import { useState } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  UserPlus,
  MessageSquare,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";

export interface ConversionStep {
  key: string;
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

export const CONVERSION_STEPS: ConversionStep[] = [
  { key: "lead_novo", label: "Novo lead", icon: UserPlus, color: "text-blue-600", bgColor: "bg-blue-500/10" },
  { key: "em_atendimento", label: "Em atendimento", icon: MessageSquare, color: "text-amber-600", bgColor: "bg-amber-500/10" },
  { key: "agendado", label: "Agendado", icon: CalendarCheck, color: "text-emerald-600", bgColor: "bg-emerald-500/10" },
  { key: "concluido", label: "Concluído", icon: CheckCircle2, color: "text-green-600", bgColor: "bg-green-500/10" },
];

export function getConversionStep(status: string | null): ConversionStep {
  // Map legacy statuses
  if (status === "finalizado" || status === "nao_convertido") return CONVERSION_STEPS[3];
  if (status === "aguardando_cliente" || status === "orcamento_enviado") return CONVERSION_STEPS[1];
  if (status === "recorrencia") return CONVERSION_STEPS[3];
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
          {current.label}
          <ChevronDown className={cn(compact ? "h-2.5 w-2.5" : "h-3 w-3", "opacity-60")} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {CONVERSION_STEPS.map((step) => {
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
              {step.label}
              {step.key === current.key && (
                <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-primary" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
