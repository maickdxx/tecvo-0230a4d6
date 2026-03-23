import { useState } from "react";
import { ChevronDown, ChevronUp, Info, Clock, AlertTriangle, Edit } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface DayExplanation {
  // Schedule
  expectedClockIn: string | null;
  expectedClockOut: string | null;
  expectedBreakMin: number;
  expectedWorkMin: number;
  toleranceMin: number;

  // Actual effective times
  effectiveClockIn: string | null;
  effectiveBreakStart: string | null;
  effectiveBreakEnd: string | null;
  effectiveClockOut: string | null;

  // Adjustments applied
  adjustments: {
    entryType: string;
    originalTime: string;
    newTime: string;
    adjustedBy: string | null;
    reason: string | null;
  }[];

  // Calculated values
  workedMinutes: number;
  breakMinutes: number;
  overtimeMinutes: number;

  // Lateness
  lateMinutes: number;
  earlyDepartureMinutes: number;

  // Flags
  isNonWorkDay: boolean;
  isIncomplete: boolean;
}

function fmtMin(m: number): string {
  if (m <= 0) return "0min";
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${min}min`;
  return `${h}h${String(min).padStart(2, "0")}`;
}

const ENTRY_LABELS: Record<string, string> = {
  clock_in: "Entrada",
  break_start: "Início Pausa",
  break_end: "Retorno Pausa",
  clock_out: "Saída",
};

interface Props {
  explanation: DayExplanation;
}

export function DayCalculationDetail({ explanation }: Props) {
  const [open, setOpen] = useState(false);
  const ex = explanation;

  const hasAdjustments = ex.adjustments.length > 0;
  const hasOvertime = ex.overtimeMinutes > 0;
  const hasLate = ex.lateMinutes > 0;
  const hasEarlyDeparture = ex.earlyDepartureMinutes > 0;
  const hasIssues = hasLate || hasEarlyDeparture || ex.isIncomplete;

  if (ex.isNonWorkDay && ex.workedMinutes === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors text-xs">
          <Info className="h-3 w-3" />
          {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2 text-xs bg-muted/30 rounded-md p-3 border">
        {/* Worked hours breakdown */}
        <div className="space-y-1">
          <p className="font-medium text-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> Cálculo das horas
          </p>
          <div className="text-muted-foreground space-y-0.5 pl-4">
            {ex.effectiveClockIn && ex.effectiveClockOut ? (
              <>
                <p>Entrada: <span className="font-mono text-foreground">{ex.effectiveClockIn}</span></p>
                <p>Saída: <span className="font-mono text-foreground">{ex.effectiveClockOut}</span></p>
                {ex.breakMinutes > 0 && (
                  <p>Intervalo descontado: <span className="font-mono text-foreground">{fmtMin(ex.breakMinutes)}</span>
                    {ex.effectiveBreakStart && ex.effectiveBreakEnd && (
                      <span className="text-muted-foreground"> ({ex.effectiveBreakStart} → {ex.effectiveBreakEnd})</span>
                    )}
                  </p>
                )}
                <p className="pt-1 border-t border-border/50">
                  Total trabalhado: <span className="font-semibold text-foreground">{fmtMin(ex.workedMinutes)}</span>
                </p>
              </>
            ) : ex.effectiveClockIn ? (
              <p className="text-amber-600 dark:text-amber-400">Entrada registrada às {ex.effectiveClockIn}, mas sem saída.</p>
            ) : (
              <p>Nenhuma marcação neste dia.</p>
            )}
          </div>
        </div>

        {/* Overtime explanation */}
        {ex.workedMinutes > 0 && !ex.isIncomplete && (
          <div className="space-y-1">
            <p className="font-medium text-foreground">Horas extras</p>
            <div className="text-muted-foreground space-y-0.5 pl-4">
              <p>Jornada esperada: <span className="font-mono text-foreground">{fmtMin(ex.expectedWorkMin)}</span>
                {ex.expectedClockIn && ex.expectedClockOut && (
                  <span className="text-muted-foreground"> ({ex.expectedClockIn} – {ex.expectedClockOut})</span>
                )}
              </p>
              <p>Tolerância CLT: <span className="font-mono text-foreground">±{ex.toleranceMin}min</span></p>
              {hasOvertime ? (
                <p className="text-green-600 dark:text-green-400">
                  Excedeu em {fmtMin(ex.workedMinutes - ex.expectedWorkMin)} → <span className="font-semibold">+{fmtMin(ex.overtimeMinutes)} extra</span>
                </p>
              ) : (
                <p>
                  {ex.workedMinutes >= ex.expectedWorkMin
                    ? `Diferença de ${fmtMin(ex.workedMinutes - ex.expectedWorkMin)} está dentro da tolerância. Sem hora extra.`
                    : `Trabalhou ${fmtMin(ex.expectedWorkMin - ex.workedMinutes)} a menos que o esperado.`
                  }
                </p>
              )}
            </div>
          </div>
        )}

        {/* Lateness */}
        {(hasLate || hasEarlyDeparture) && (
          <div className="space-y-1">
            <p className="font-medium text-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-amber-500" /> Ocorrências
            </p>
            <div className="text-muted-foreground space-y-0.5 pl-4">
              {hasLate && (
                <p>
                  Atraso: esperado às <span className="font-mono">{ex.expectedClockIn}</span>, registrou às <span className="font-mono">{ex.effectiveClockIn}</span> → <span className="text-amber-600 dark:text-amber-400 font-semibold">{fmtMin(ex.lateMinutes)} de atraso</span>
                </p>
              )}
              {hasEarlyDeparture && (
                <p>
                  Saída antecipada: esperado às <span className="font-mono">{ex.expectedClockOut}</span>, saiu às <span className="font-mono">{ex.effectiveClockOut}</span> → <span className="text-amber-600 dark:text-amber-400 font-semibold">{fmtMin(ex.earlyDepartureMinutes)} antes</span>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Adjustments */}
        {hasAdjustments && (
          <div className="space-y-1">
            <p className="font-medium text-foreground flex items-center gap-1">
              <Edit className="h-3 w-3 text-blue-500" /> Ajustes aplicados
            </p>
            <div className="space-y-1 pl-4">
              {ex.adjustments.map((adj, i) => (
                <div key={i} className="text-muted-foreground border-l-2 border-blue-500/30 pl-2">
                  <p>
                    <span className="font-medium">{ENTRY_LABELS[adj.entryType] || adj.entryType}</span>:
                    <span className="font-mono line-through ml-1">{adj.originalTime}</span>
                    <span className="mx-1">→</span>
                    <span className="font-mono text-foreground">{adj.newTime}</span>
                  </p>
                  {adj.adjustedBy && <p className="text-[10px]">Por: {adj.adjustedBy}</p>}
                  {adj.reason && <p className="text-[10px]">Motivo: {adj.reason}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Compact tooltip for the summary cards */
export function SummaryTooltip({ children, content }: { children: React.ReactNode; content: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs">
          <p>{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
