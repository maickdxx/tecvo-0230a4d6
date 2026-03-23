import { useMemo } from "react";
import { Clock, AlertTriangle, Lightbulb, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Service } from "@/hooks/useServices";
import { getHourInTz, getMinutesInTz } from "@/lib/timezone";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";

interface AgendaSmartAlertsProps {
  services: Service[];
  totalDistanceKm?: number;
}

interface SmartAlert {
  id: string;
  icon: React.ReactNode;
  message: string;
  level: "warning" | "critical" | "suggestion";
}

const LEVEL_STYLES: Record<string, string> = {
  warning: "border-l-warning bg-warning/5 text-warning",
  critical: "border-l-destructive bg-destructive/5 text-destructive animate-glow-pulse",
  suggestion: "border-l-info bg-info/5 text-info",
};

export function AgendaSmartAlerts({ services, totalDistanceKm }: AgendaSmartAlertsProps) {
  const tz = useOrgTimezone();

  const alerts = useMemo<SmartAlert[]>(() => {
    const result: SmartAlert[] = [];

    // 1. Idle gaps > 90 min
    const sorted = services
      .filter(s => s.entry_date && s.exit_date)
      .sort((a, b) => {
        const aM = getHourInTz(a.entry_date!, tz) * 60 + getMinutesInTz(a.entry_date!, tz);
        const bM = getHourInTz(b.entry_date!, tz) * 60 + getMinutesInTz(b.entry_date!, tz);
        return aM - bM;
      });

    const gaps: { start: number; end: number }[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const exitMin = getHourInTz(sorted[i].exit_date!, tz) * 60 + getMinutesInTz(sorted[i].exit_date!, tz);
      const nextEntryMin = getHourInTz(sorted[i + 1].entry_date!, tz) * 60 + getMinutesInTz(sorted[i + 1].entry_date!, tz);
      const gap = nextEntryMin - exitMin;
      if (gap > 90) {
        gaps.push({ start: exitMin, end: nextEntryMin });
        const startH = String(Math.floor(exitMin / 60)).padStart(2, "0");
        const startM = String(exitMin % 60).padStart(2, "0");
        const endH = String(Math.floor(nextEntryMin / 60)).padStart(2, "0");
        const endM = String(nextEntryMin % 60).padStart(2, "0");
        result.push({
          id: `idle-${i}`,
          icon: <Clock className="h-4 w-4" />,
          message: `Horário ocioso: ${startH}:${startM} - ${endH}:${endM}`,
          level: "warning",
        });
      }
    }

    // 2. Overload per technician
    const byTech: Record<string, { count: number; name: string }> = {};
    services.forEach(s => {
      if (s.assigned_to) {
        if (!byTech[s.assigned_to]) {
          byTech[s.assigned_to] = { count: 0, name: s.assigned_profile?.full_name || "Técnico" };
        }
        byTech[s.assigned_to].count++;
      }
    });
    Object.entries(byTech).forEach(([id, { count, name }]) => {
      if (count > 6) {
        result.push({
          id: `overload-${id}`,
          icon: <AlertTriangle className="h-4 w-4" />,
          message: `${name} com ${count} OS (sobrecarga)`,
          level: "critical",
        });
      }
    });

    // 3. Suggest best time from biggest idle gap
    if (gaps.length > 0) {
      const biggest = gaps.reduce((a, b) => (b.end - b.start > a.end - a.start ? b : a));
      const midMin = Math.round((biggest.start + biggest.end) / 2);
      const h = String(Math.floor(midMin / 60)).padStart(2, "0");
      const m = String(midMin % 60).padStart(2, "0");
      result.push({
        id: "suggest-time",
        icon: <Lightbulb className="h-4 w-4" />,
        message: `Sugestão: agendar próximo serviço às ${h}:${m}`,
        level: "suggestion",
      });
    }

    // 4. Route optimization
    if (totalDistanceKm && totalDistanceKm > 50) {
      result.push({
        id: "route",
        icon: <MapPin className="h-4 w-4" />,
        message: `Rota total: ${totalDistanceKm.toFixed(1)} km — considere reorganizar`,
        level: "warning",
      });
    }

    return result;
  }, [services, totalDistanceKm, tz]);

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Alertas Inteligentes</h3>
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={cn(
            "flex items-center gap-3 rounded-xl border-l-4 px-4 py-2.5 text-sm animate-blur-in",
            LEVEL_STYLES[alert.level]
          )}
        >
          {alert.icon}
          <span className="text-foreground">{alert.message}</span>
        </div>
      ))}
    </div>
  );
}
