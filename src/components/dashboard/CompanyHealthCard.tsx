import { Activity, Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCompanyHealth } from "@/hooks/useCompanyHealth";
import { Skeleton } from "@/components/ui/skeleton";

const LEVEL_CONFIG = {
  inicio: { label: "Início", className: "bg-destructive/10 text-destructive border-destructive/20" },
  evoluindo: { label: "Evoluindo", className: "bg-warning/10 text-warning border-warning/20" },
  saudavel: { label: "Saudável", className: "bg-success/10 text-success border-success/20" },
};

function getProgressGradient(level: string) {
  if (level === "inicio") return "from-destructive to-destructive/70";
  if (level === "evoluindo") return "from-warning to-warning/70";
  return "from-success to-success/70";
}

export function CompanyHealthCard() {
  const { score, level, pillarScores, suggestions, isLoading } = useCompanyHealth();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const config = LEVEL_CONFIG[level];

  return (
    <Card className="animate-fade-in">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Activity className="h-4 w-4 text-primary" />
          Saúde da Empresa
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score + Badge */}
        <div className="flex items-end gap-3">
          <span className="text-4xl number-display text-foreground">{score}%</span>
          <Badge variant="outline" className={config.className}>
            {config.label}
          </Badge>
        </div>

        {/* Main progress */}
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${getProgressGradient(level)} transition-all duration-700 ease-out relative overflow-hidden after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-white/20 after:to-transparent after:animate-shimmer after:bg-[length:200%_100%]`}
            style={{ width: `${score}%` }}
          />
        </div>

        {/* Pillar mini bars */}
        <div className="space-y-2.5">
          {pillarScores.map((pillar) => {
            const pct = pillar.maxScore > 0 ? (pillar.score / pillar.maxScore) * 100 : 0;
            return (
              <div key={pillar.name} className="flex items-center gap-2">
                <span className="w-24 text-xs text-muted-foreground truncate">{pillar.name}</span>
                <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${pct}%`, backgroundColor: pillar.color }}
                  />
                </div>
                <span className="text-[11px] text-muted-foreground w-12 text-right tabular-nums">
                  {pillar.score}/{pillar.maxScore}
                </span>
              </div>
            );
          })}
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="rounded-xl border border-primary/10 bg-primary/5 p-3.5 space-y-1.5">
            <p className="text-xs font-medium text-primary flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5" />
              Recomendações inteligentes
            </p>
            {suggestions.map((s, i) => (
              <p key={i} className="text-xs text-muted-foreground">• {s}</p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
