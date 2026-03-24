import { AlertTriangle, XCircle, Info, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AdminAlert } from "@/hooks/useAdminDashboard";

interface AdminSmartAlertsProps {
  alerts: AdminAlert[];
  onNavigate: (tab: string) => void;
}

export function AdminSmartAlerts({ alerts, onNavigate }: AdminSmartAlertsProps) {
  if (alerts.length === 0) return null;

  const getAlertStyles = (type: AdminAlert["type"]) => {
    switch (type) {
      case "danger":
        return {
          bg: "bg-destructive/10 border-destructive/30",
          icon: <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />,
          text: "text-destructive",
        };
      case "warning":
        return {
          bg: "bg-amber-500/10 border-amber-500/30",
          icon: <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />,
          text: "text-amber-700 dark:text-amber-400",
        };
      case "info":
        return {
          bg: "bg-blue-500/10 border-blue-500/30",
          icon: <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />,
          text: "text-blue-700 dark:text-blue-400",
        };
    }
  };

  return (
    <div className="space-y-2">
      {alerts.map((alert) => {
        const styles = getAlertStyles(alert.type);
        return (
          <div
            key={alert.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${styles.bg}`}
          >
            {styles.icon}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${styles.text}`}>{alert.title}</p>
              <p className="text-xs text-muted-foreground">{alert.description}</p>
            </div>
            {alert.action && (
              <Button
                variant="ghost"
                size="sm"
                className="flex-shrink-0 gap-1 text-xs h-7"
                onClick={() => onNavigate(alert.action!.tab)}
              >
                {alert.action.label}
                <ArrowRight className="h-3 w-3" />
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
