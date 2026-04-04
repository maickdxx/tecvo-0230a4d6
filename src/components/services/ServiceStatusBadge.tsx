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
  scheduled: "bg-blue-200 text-blue-900 dark:bg-blue-800 dark:text-blue-100",
  in_progress: "bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100",
  completed: "bg-green-200 text-green-900 dark:bg-green-800 dark:text-green-100",
  cancelled: "bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100",
  overdue: "bg-red-200 text-red-900 dark:bg-red-800 dark:text-red-100",
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
