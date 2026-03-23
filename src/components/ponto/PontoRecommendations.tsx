import { useMemo, useRef } from "react";
import type { TimeClockEntryType } from "@/hooks/useTimeClock";
import { useUserRole } from "@/hooks/useUserRole";
import {
  AlertTriangle,
  Clock,
  Coffee,
  TrendingUp,
  UserX,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PontoRecommendation {
  id: string;
  type: "lateness" | "absence" | "incomplete" | "short_break" | "overtime";
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  actions: { label: string; onClick?: () => void }[];
}

interface PontoRecommendationsProps {
  entries: { id: string; entry_type: TimeClockEntryType; recorded_at: string }[];
  expectedClockIn?: string;
  expectedClockOut?: string;
  expectedMinutes?: number;
  workedMinutes?: number;
  breakMinutes?: number;
  minBreakMinutes?: number;
  toleranceMinutes?: number;
  isWorkDay?: boolean;
  onRequestAdjust?: () => void;
  onJustifyLateness?: () => void;
  onRegisterManually?: () => void;
  onConfirmAbsence?: () => void;
  onSendToBank?: () => void;
}

const SEVERITY_ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2 };

// Context suppression: if a higher-severity issue exists, suppress lower ones
const SUPPRESSION_MAP: Record<string, string[]> = {
  absence: ["lateness", "incomplete", "short_break", "overtime"],
  incomplete: ["lateness"],
};

// Display limits per severity
const MAX_PER_SEVERITY: Record<string, number> = { critical: 1, warning: 2, info: 1 };

const SEVERITY_STYLES: Record<string, string> = {
  info: "border-border/50 bg-muted/30",
  warning: "border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/30",
  critical: "border-red-300 bg-red-50/80 dark:border-red-700 dark:bg-red-950/40 shadow-sm",
};

const SEVERITY_ICON_STYLES: Record<string, string> = {
  info: "text-muted-foreground",
  warning: "text-amber-500",
  critical: "text-red-500",
};

const SEVERITY_TITLE_STYLES: Record<string, string> = {
  info: "text-muted-foreground text-xs font-normal",
  warning: "text-foreground text-sm font-medium",
  critical: "text-foreground text-sm font-semibold",
};

const ICONS: Record<string, typeof Clock> = {
  lateness: Clock,
  absence: UserX,
  incomplete: LogOut,
  short_break: Coffee,
  overtime: TrendingUp,
};

/**
 * Filters, prioritises, groups and renders smart recommendations.
 * Rules:
 *  - Context suppression (absence hides lateness, etc.)
 *  - Max per severity (1 critical, 2 warning, 1 info)
 *  - Stable per-day: only re-renders when the fingerprint changes
 */
export function PontoRecommendations({
  entries,
  expectedClockIn = "08:00",
  expectedClockOut,
  expectedMinutes = 480,
  workedMinutes = 0,
  breakMinutes,
  minBreakMinutes = 60,
  toleranceMinutes = 10,
  isWorkDay = true,
  onRequestAdjust,
  onJustifyLateness,
  onRegisterManually,
  onConfirmAbsence,
  onSendToBank,
}: PontoRecommendationsProps) {
  const { isAdmin, isOwner } = useUserRole();
  const isManager = isAdmin || isOwner;

  // Fingerprint to avoid re-rendering when nothing meaningful changed
  const fingerprint = useMemo(
    () =>
      `${entries.map((e) => `${e.entry_type}:${e.recorded_at}`).join("|")}|${workedMinutes}|${isWorkDay}`,
    [entries, workedMinutes, isWorkDay]
  );
  const lastFingerprint = useRef("");

  const allRecommendations = useMemo(() => {
    const recs: PontoRecommendation[] = [];

    const clockIn = entries.find((e) => e.entry_type === "clock_in");
    const clockOut = entries.find((e) => e.entry_type === "clock_out");
    const breakStart = entries.find((e) => e.entry_type === "break_start");
    const breakEnd = entries.find((e) => e.entry_type === "break_end");

    // 1) ABSENCE
    if (isWorkDay && entries.length === 0) {
      recs.push({
        id: "absence",
        type: "absence",
        severity: "critical",
        title: "Falta detectada",
        description: "Nenhuma marcação registrada para este dia útil.",
        actions: [
          ...(isManager && onRegisterManually
            ? [{ label: "Registrar manualmente", onClick: onRegisterManually }]
            : []),
          ...(onConfirmAbsence
            ? [{ label: "Confirmar ausência", onClick: onConfirmAbsence }]
            : []),
        ],
      });
    }

    // 2) LATENESS
    if (clockIn && expectedClockIn) {
      const [eh, em] = expectedClockIn.split(":").map(Number);
      const entryDate = new Date(clockIn.recorded_at);
      const actualMinutes = entryDate.getHours() * 60 + entryDate.getMinutes();
      const expectedMin = eh * 60 + em;
      const diff = actualMinutes - expectedMin;
      if (diff > toleranceMinutes) {
        recs.push({
          id: "lateness",
          type: "lateness",
          severity: "warning",
          title: `Atraso de ${diff} min detectado`,
          description: `Entrada esperada: ${expectedClockIn}. Entrada real: ${String(entryDate.getHours()).padStart(2, "0")}:${String(entryDate.getMinutes()).padStart(2, "0")}.`,
          actions: [
            ...(onJustifyLateness
              ? [{ label: "Justificar atraso", onClick: onJustifyLateness }]
              : []),
            ...(isManager && onRequestAdjust
              ? [{ label: "Ajustar horário", onClick: onRequestAdjust }]
              : []),
          ],
        });
      }
    }

    // 3) INCOMPLETE
    if (clockIn && !clockOut) {
      const clockInTime = new Date(clockIn.recorded_at).getTime();
      const elapsed = (Date.now() - clockInTime) / 60000;
      if (elapsed > expectedMinutes) {
        recs.push({
          id: "incomplete",
          type: "incomplete",
          severity: "warning",
          title: "Saída não registrada",
          description: `Jornada de ${Math.floor(expectedMinutes / 60)}h já ultrapassada sem registro de saída.`,
          actions: [
            ...(onRequestAdjust
              ? [{ label: "Completar jornada com ajuste", onClick: onRequestAdjust }]
              : []),
          ],
        });
      }
    }

    // 4) SHORT BREAK
    if (breakStart && breakEnd) {
      const bStart = new Date(breakStart.recorded_at).getTime();
      const bEnd = new Date(breakEnd.recorded_at).getTime();
      const actualBreak = Math.floor((bEnd - bStart) / 60000);
      if (actualBreak < minBreakMinutes) {
        recs.push({
          id: "short_break",
          type: "short_break",
          severity: "warning",
          title: "Intervalo abaixo do mínimo legal",
          description: `Intervalo: ${actualBreak}min. Mínimo: ${minBreakMinutes}min (CLT Art. 71).`,
          actions: [
            ...(onRequestAdjust
              ? [{ label: "Ajustar ou revisar", onClick: onRequestAdjust }]
              : []),
          ],
        });
      }
    }

    // 5) OVERTIME
    if (clockOut && workedMinutes > expectedMinutes + toleranceMinutes) {
      const extra = workedMinutes - expectedMinutes;
      const extraH = Math.floor(extra / 60);
      const extraM = extra % 60;
      recs.push({
        id: "overtime",
        type: "overtime",
        severity: "info",
        title: `Horas extras: +${extraH}h${String(extraM).padStart(2, "0")}`,
        description: `Jornada esperada: ${Math.floor(expectedMinutes / 60)}h. Trabalhado: ${Math.floor(workedMinutes / 60)}h${String(workedMinutes % 60).padStart(2, "0")}.`,
        actions: [
          ...(isManager && onSendToBank
            ? [{ label: "Enviar para banco de horas", onClick: onSendToBank }]
            : []),
        ],
      });
    }

    return recs;
  }, [
    entries, expectedClockIn, expectedMinutes, workedMinutes,
    minBreakMinutes, toleranceMinutes, isWorkDay, isManager,
    onRequestAdjust, onJustifyLateness, onRegisterManually,
    onConfirmAbsence, onSendToBank,
  ]);

  // Apply context suppression + priority limits
  const visibleRecommendations = useMemo(() => {
    if (allRecommendations.length === 0) return [];

    // 1. Context suppression
    const activeTypes = new Set(allRecommendations.map((r) => r.type));
    const suppressedTypes = new Set<string>();
    for (const type of activeTypes) {
      const toSuppress = SUPPRESSION_MAP[type];
      if (toSuppress) toSuppress.forEach((t) => suppressedTypes.add(t));
    }
    const filtered = allRecommendations.filter((r) => !suppressedTypes.has(r.type));

    // 2. Sort by severity
    filtered.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

    // 3. Apply per-severity limits
    const counts: Record<string, number> = { critical: 0, warning: 0, info: 0 };
    const result: PontoRecommendation[] = [];
    for (const rec of filtered) {
      const max = MAX_PER_SEVERITY[rec.severity] ?? 1;
      if (counts[rec.severity] < max) {
        result.push(rec);
        counts[rec.severity]++;
      }
    }

    return result;
  }, [allRecommendations]);

  // Frequency control: skip re-render if fingerprint hasn't changed
  const shouldRender = fingerprint !== lastFingerprint.current;
  if (shouldRender) lastFingerprint.current = fingerprint;

  if (visibleRecommendations.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {visibleRecommendations.map((rec) => {
        const Icon = ICONS[rec.type] || AlertTriangle;
        const isCritical = rec.severity === "critical";
        const isInfo = rec.severity === "info";

        return (
          <Alert
            key={rec.id}
            className={cn(
              "transition-colors",
              isCritical ? "py-3 px-4" : isInfo ? "py-2 px-3" : "py-2.5 px-3",
              SEVERITY_STYLES[rec.severity]
            )}
          >
            <div className="flex items-start gap-2.5">
              <Icon
                className={cn(
                  "mt-0.5 flex-shrink-0",
                  isCritical ? "h-4 w-4" : "h-3.5 w-3.5",
                  SEVERITY_ICON_STYLES[rec.severity]
                )}
              />
              <div className="flex-1 min-w-0">
                <p className={SEVERITY_TITLE_STYLES[rec.severity]}>{rec.title}</p>
                {!isInfo && (
                  <AlertDescription className="text-xs text-muted-foreground mt-0.5">
                    {rec.description}
                  </AlertDescription>
                )}
                {rec.actions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {rec.actions.map((action) => (
                      <Button
                        key={action.label}
                        variant={isCritical ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          "gap-1",
                          isCritical
                            ? "h-7 text-xs"
                            : "h-6 text-[11px] text-muted-foreground"
                        )}
                        onClick={action.onClick}
                      >
                        {action.label}
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Alert>
        );
      })}
    </div>
  );
}
