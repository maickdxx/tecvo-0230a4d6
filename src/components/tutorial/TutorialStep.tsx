import { Lightbulb, AlertTriangle } from "lucide-react";

interface TutorialStepProps {
  stepNumber: number;
  title: string;
  description: string;
  tips?: string[];
  warning?: string;
}

export function TutorialStep({ stepNumber, title, description, tips, warning }: TutorialStepProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
          {stepNumber}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-foreground">{title}</h4>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{description}</p>
        </div>
      </div>

      {tips && tips.length > 0 && (
        <div className="ml-10 space-y-2">
          {tips.map((tip, index) => (
            <div key={index} className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-2.5">
              <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <span>{tip}</span>
            </div>
          ))}
        </div>
      )}

      {warning && (
        <div className="ml-10 flex items-start gap-2 text-sm bg-destructive/10 text-destructive rounded-lg p-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{warning}</span>
        </div>
      )}
    </div>
  );
}
