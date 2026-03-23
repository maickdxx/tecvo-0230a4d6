import { Badge } from "@/components/ui/badge";
import { Bug, Sparkles, TrendingUp } from "lucide-react";

export type ChangeType = "novidade" | "correcao" | "melhoria";

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: {
    type: ChangeType;
    description: string;
  }[];
}

const typeConfig: Record<ChangeType, { label: string; className: string; icon: typeof Bug }> = {
  novidade: { label: "Novidade", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20", icon: Sparkles },
  correcao: { label: "Correção", className: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20", icon: Bug },
  melhoria: { label: "Melhoria", className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20", icon: TrendingUp },
};

interface ChangelogTimelineProps {
  entries: ChangelogEntry[];
}

export function ChangelogTimeline({ entries }: ChangelogTimelineProps) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Nenhuma atualização encontrada para este filtro.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {entries.map((entry) => (
        <div key={entry.version} className="relative pl-6 border-l-2 border-border">
          <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-primary border-2 border-background" />
          <div className="mb-3">
            <h3 className="text-base font-semibold text-foreground">{entry.version}</h3>
            <p className="text-xs text-muted-foreground">{entry.date}</p>
          </div>
          <div className="space-y-2">
            {entry.changes.map((change, idx) => {
              const config = typeConfig[change.type];
              const Icon = config.icon;
              return (
                <div key={idx} className="flex items-start gap-2">
                  <Badge variant="outline" className={`${config.className} text-xs shrink-0 gap-1`}>
                    <Icon className="h-3 w-3" />
                    {config.label}
                  </Badge>
                  <span className="text-sm text-foreground/80">{change.description}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
