import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ServiceStatus } from "@/hooks/useServices";
import { SERVICE_STATUS_LABELS } from "@/hooks/useServices";

export type EffectiveStatus = ServiceStatus | "overdue";

interface ServiceStatusBadgeProps {
  status: EffectiveStatus;
  className?: string;
}

const statusStyles: Record<EffectiveStatus, string> = {
  scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  in_progress: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

const STATUS_LABELS: Record<EffectiveStatus, string> = {
  ...SERVICE_STATUS_LABELS,
  overdue: "Atrasado",
};

export function ServiceStatusBadge({ status, className }: ServiceStatusBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={cn(statusStyles[status], "font-medium", className)}
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}
