import { Lightbulb, X } from "lucide-react";
import { usePageTutorial } from "@/hooks/usePageTutorial";
import { Button } from "@/components/ui/button";
import { useDemoTour } from "@/hooks/useDemoTour";
import { useDemoMode } from "@/hooks/useDemoMode";

interface PageTutorialBannerProps {
  pageKey: string;
  title: string;
  message: string;
}

export function PageTutorialBanner({ pageKey, title, message }: PageTutorialBannerProps) {
  const { showTutorial, dismissTutorial } = usePageTutorial(pageKey);
  const { showTour } = useDemoTour();
  const { isDemoMode } = useDemoMode();

  if (showTour || isDemoMode || !showTutorial) return null;

  return (
    <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-500 rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Lightbulb className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3 text-xs"
            onClick={dismissTutorial}
          >
            Entendi ✓
          </Button>
        </div>
        <button
          onClick={dismissTutorial}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
