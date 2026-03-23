import { useDemoMode } from "@/hooks/useDemoMode";
import { useDemoTour } from "@/hooks/useDemoTour";
import { Lightbulb } from "lucide-react";

const CONTEXT_TIPS: Record<string, string> = {
  "/financeiro": "💰 Veja como seus números crescem automaticamente.",
  "/meu-dia": "👷 Seu técnico verá apenas o dia dele.",
  "/agenda": "📅 Organize sua semana com poucos cliques.",
};

interface DemoContextTipProps {
  route: string;
}

export function DemoContextTip({ route }: DemoContextTipProps) {
  const { isDemoMode, isLoading } = useDemoMode();
  const { showTour } = useDemoTour();

  if (isLoading || !isDemoMode || showTour) return null;

  const tip = CONTEXT_TIPS[route];
  if (!tip) return null;

  return (
    <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/15 px-4 py-2.5 mb-4">
      <Lightbulb className="h-4 w-4 text-primary flex-shrink-0" />
      <span className="text-sm text-primary font-medium">{tip}</span>
    </div>
  );
}
