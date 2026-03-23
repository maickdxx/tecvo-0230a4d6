import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSubscription } from "@/hooks/useSubscription";

interface UsageBadgeProps {
  className?: string;
  showUpgradeButton?: boolean;
  onUpgradeClick?: () => void;
}

export function UsageBadge({ className, showUpgradeButton, onUpgradeClick }: UsageBadgeProps) {
  const { isFreePlan, servicesUsed, servicesLimit, usagePercentage, isNearLimit, plan } = useSubscription();

  if (plan === "pro") {
    return (
      <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary", className)}>
        <Crown className="h-4 w-4" />
        <span className="text-xs font-medium">EMPRESA</span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Serviços</span>
        <span className={cn("font-medium", isNearLimit && "text-amber-600")}>
          {servicesUsed}/{servicesLimit}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-300",
            usagePercentage >= 100 ? "bg-destructive" : 
            isNearLimit ? "bg-amber-500" : "bg-primary"
          )}
          style={{ width: `${usagePercentage}%` }}
        />
      </div>
      {showUpgradeButton && isNearLimit && (
        <button
          onClick={onUpgradeClick}
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          <Crown className="h-3 w-3" />
          Fazer upgrade
        </button>
      )}
    </div>
  );
}
