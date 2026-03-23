import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Flame, Star, Wrench } from "lucide-react";
import type { ServicePriority } from "@/hooks/useServiceExecution";

const priorityConfig: Record<
  ServicePriority,
  { bg: string; icon: React.ElementType; label: string }
> = {
  urgent: {
    bg: "bg-red-500/15 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800",
    icon: Flame,
    label: "Urgente",
  },
  premium_client: {
    bg: "bg-amber-500/15 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    icon: Star,
    label: "Premium",
  },
  warranty: {
    bg: "bg-indigo-500/15 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
    icon: Wrench,
    label: "Garantia",
  },
};

interface Props {
  priority: ServicePriority | string | null | undefined;
  className?: string;
}

export function PriorityBadge({ priority, className }: Props) {
  if (!priority) return null;
  const config = priorityConfig[priority as ServicePriority];
  if (!config) return null;
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={cn(config.bg, "gap-1 text-[10px]", className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
