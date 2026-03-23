import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Trophy, ChevronDown, Medal } from "lucide-react";
import { useWeeklyRanking, type RankingEntry } from "@/hooks/useWeeklyRanking";
import { useState } from "react";
import { cn } from "@/lib/utils";

const medals = ["🥇", "🥈", "🥉"];

export function WeeklyRanking() {
  const { data: ranking = [], isLoading } = useWeeklyRanking();
  const [open, setOpen] = useState(false);

  if (isLoading || ranking.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                Ranking da Semana
              </span>
              <ChevronDown className={cn("h-4 w-4 transition-transform text-muted-foreground", open && "rotate-180")} />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-2">
            {ranking.map((entry, i) => (
              <div
                key={entry.userId}
                className={cn(
                  "flex items-center justify-between p-2.5 rounded-lg transition-colors",
                  i < 3 ? "bg-amber-500/5" : "bg-muted/30"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg w-7 text-center">
                    {i < 3 ? medals[i] : `${i + 1}º`}
                  </span>
                  <div>
                    <p className="font-medium text-sm text-foreground">{entry.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.completedCount} serviços
                    </p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(entry.revenue)}
                </p>
              </div>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
