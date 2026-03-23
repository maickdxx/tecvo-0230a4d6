import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Car,
  Wrench,
  Clock,
  Package,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import type { OperationalStatus } from "@/hooks/useServiceExecution";
import { OPERATIONAL_STATUS_LABELS } from "@/hooks/useServiceExecution";

const statusConfig: Record<
  OperationalStatus,
  { bg: string; icon: React.ElementType }
> = {
  en_route: { bg: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300", icon: Car },
  in_attendance: { bg: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300", icon: Wrench },
  waiting_client: { bg: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300", icon: Clock },
  waiting_part: { bg: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300", icon: Package },
  warranty_return: { bg: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300", icon: RotateCcw },
  completed: { bg: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300", icon: CheckCircle },
  problem: { bg: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300", icon: AlertTriangle },
};

interface Props {
  status: OperationalStatus | null | undefined;
  className?: string;
}

export function OperationalStatusBadge({ status, className }: Props) {
  if (!status) return null;
  const config = statusConfig[status];
  if (!config) return null;
  const Icon = config.icon;

  return (
    <Badge
      variant="secondary"
      className={cn(config.bg, "font-medium gap-1", className)}
    >
      <Icon className="h-3 w-3" />
      {OPERATIONAL_STATUS_LABELS[status]}
    </Badge>
  );
}
