import { Rocket, CheckCircle2, Circle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useCompanyHealth } from "@/hooks/useCompanyHealth";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";

export function EvolutionChecklist() {
  const { checklist, checklistProgress, allChecklistDone, isLoading } = useCompanyHealth();
  const { organization } = useOrganization();
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Check if dismissed via page_tutorials_seen JSON
  const tutorialsSeen = (organization as any)?.page_tutorials_seen as Record<string, boolean> | null;
  const isDismissed = tutorialsSeen?.evolution_checklist_dismissed === true;

  const handleDismiss = async () => {
    if (!profile?.organization_id) return;
    const current = (tutorialsSeen || {}) as Record<string, boolean>;
    await supabase
      .from("organizations")
      .update({ page_tutorials_seen: { ...current, evolution_checklist_dismissed: true } })
      .eq("id", profile.organization_id);
    queryClient.invalidateQueries({ queryKey: ["organization"] });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-44" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Once completed AND dismissed, never show again
  if (isDismissed && allChecklistDone) return null;

  // If all done but not yet dismissed, auto-dismiss (vanish immediately)
  if (allChecklistDone) {
    handleDismiss();
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Rocket className="h-4 w-4 text-primary" />
            Checklist de Evolução
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {checklistProgress}/9
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <Progress value={(checklistProgress / 9) * 100} className="h-2" />

        {/* Phases */}
        <div className="space-y-3">
          {checklist.map((phase) => (
            <div key={phase.phase}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                {phase.phase}
              </p>
              <div className="space-y-1">
                {phase.items.map((item) => (
                  <div key={item.label} className={`flex items-center gap-2 ${item.completed ? "opacity-50" : ""}`}>
                    {item.completed ? (
                      <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                    )}
                    <span
                      className={`text-sm ${
                        item.completed
                          ? "text-muted-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
