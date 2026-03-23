import { useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";

export function NotificationPromptBanner() {
  const { isSupported, permissionStatus, isSubscribed, loading, requestPermission } = useNotifications();
  const [dismissed, setDismissed] = useState(false);

  // Don't show if not supported, already subscribed, denied, or dismissed
  if (!isSupported || isSubscribed || permissionStatus === "denied" || dismissed) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/10 border-b border-primary/20 shrink-0">
      <Bell className="h-4 w-4 text-primary shrink-0" />
      <p className="text-xs text-foreground flex-1">
        Ative as notificações para ser avisado quando seus clientes enviarem mensagens.
      </p>
      <Button
        size="sm"
        variant="default"
        className="text-xs h-7 px-3 shrink-0"
        onClick={requestPermission}
        disabled={loading}
      >
        {loading ? "Ativando..." : "Ativar"}
      </Button>
      <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground shrink-0">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
