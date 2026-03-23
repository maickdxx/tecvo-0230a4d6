import { Wifi, WifiOff, Loader2, Cloud } from "lucide-react";
import { useOffline } from "@/contexts/OfflineContext";

export function OfflineIndicator() {
  const { isOnline, pendingCount, isSyncing } = useOffline();

  // Don't show anything when online and no pending actions
  if (isOnline && pendingCount === 0 && !isSyncing) return null;

  return (
    <div
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
        transition-all duration-300 animate-fade-in
        ${
          !isOnline
            ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20"
            : isSyncing
              ? "bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/20"
              : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
        }
      `}
    >
      {!isOnline ? (
        <>
          <WifiOff className="h-3.5 w-3.5" />
          <span>Offline</span>
          {pendingCount > 0 && (
            <span className="bg-amber-500/20 px-1.5 py-0.5 rounded-full text-[10px]">
              {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
            </span>
          )}
        </>
      ) : isSyncing ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Sincronizando...</span>
        </>
      ) : pendingCount > 0 ? (
        <>
          <Cloud className="h-3.5 w-3.5" />
          <span>{pendingCount} pendente{pendingCount > 1 ? "s" : ""}</span>
        </>
      ) : null}
    </div>
  );
}
