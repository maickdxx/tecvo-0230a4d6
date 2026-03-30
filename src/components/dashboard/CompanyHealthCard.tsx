import { Activity, Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCompanyHealth } from "@/hooks/useCompanyHealth";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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
    <Card className="animate-fade-in border-none shadow-lg ring-1 ring-border/40 overflow-hidden">
      <CardHeader className="pb-6 px-6 pt-6 border-b border-border/40 bg-muted/20">
        <CardTitle className="flex items-center gap-2.5 text-base font-bold">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <span className="opacity-90">Saúde da Empresa</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-8 px-6 pb-8 pt-8">
        {/* Score + Badge */}
        <div className="flex items-end gap-5">
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Score Geral</p>
            <span className="text-5xl font-black tracking-tighter text-foreground tabular-nums leading-none">
              {score}<span className="text-2xl font-medium text-muted-foreground">%</span>
            </span>
          </div>
          <Badge variant="outline" className={cn("font-bold px-3 py-1 text-[10px] uppercase tracking-wider h-fit mb-1.5 border-2", config.className)}>
            Nível {config.label}
          </Badge>
        </div>

        {/* Main progress */}
        <div className="relative h-4 w-full overflow-hidden rounded-full bg-muted shadow-inner p-0.5">
          <div
            className={cn(
              "h-full rounded-full bg-gradient-to-r transition-all duration-1000 ease-out relative overflow-hidden shadow-[0_0_12px_rgba(var(--primary-rgb),0.2)]",
              getProgressGradient(level)
            )}
            style={{ width: `${score}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
          </div>
        </div>

        {/* Pillar mini bars */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pillarScores.map((pillar) => {
            const pct = pillar.maxScore > 0 ? (pillar.score / pillar.maxScore) * 100 : 0;
            return (
              <div key={pillar.name} className="flex flex-col gap-2 p-4 rounded-2xl bg-muted/20 border border-border/40 group hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-70 group-hover:opacity-100 transition-opacity truncate pr-2">{pillar.name}</span>
                  <span className="text-[11px] font-black text-foreground tabular-nums tracking-tight">
                    {pillar.score}/{pillar.maxScore}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted/60 overflow-hidden shadow-inner">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out shadow-sm"
                    style={{ width: `${pct}%`, backgroundColor: pillar.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="rounded-2xl border border-primary/10 bg-primary/[0.03] p-6 space-y-4 group hover:bg-primary/[0.05] transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Lightbulb className="h-4 w-4 text-primary" />
              </div>
              <p className="text-xs font-bold text-primary uppercase tracking-widest">
                Recomendações Inteligentes
              </p>
            </div>
            <div className="space-y-3">
              {suggestions.map((s, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/40 mt-1 shrink-0" />
                  <p className="text-xs text-muted-foreground font-medium leading-relaxed">{s}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
