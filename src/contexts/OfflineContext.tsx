import { createContext, useContext, useEffect, useCallback, useState, ReactNode, useRef } from "react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { syncPendingActions } from "@/lib/offlineSync";
import { getPendingCount, clearExpiredCache } from "@/lib/offlineStore";
import { toast } from "@/hooks/use-toast";

interface OfflineContextValue {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncAt: string | null;
  triggerSync: () => Promise<void>;
  refreshPendingCount: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextValue>({
  isOnline: true,
  pendingCount: 0,
  isSyncing: false,
  lastSyncAt: null,
  triggerSync: async () => {},
  refreshPendingCount: async () => {},
});

export function useOffline() {
  return useContext(OfflineContext);
}

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { isOnline, wasOffline, clearWasOffline, onReconnect } = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const syncingRef = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch {
      // IndexedDB might not be available
    }
  }, []);

  const triggerSync = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    syncingRef.current = true;
    setIsSyncing(true);

    try {
      const result = await syncPendingActions();

      if (result.synced > 0) {
        toast({
          title: "Dados sincronizados ✓",
          description: `${result.synced} ação${result.synced > 1 ? "ões" : ""} sincronizada${result.synced > 1 ? "s" : ""} com sucesso.`,
        });
        setLastSyncAt(new Date().toISOString());
      }

      if (result.failed > 0) {
        toast({
          variant: "destructive",
          title: "Falha na sincronização",
          description: `${result.failed} ação${result.failed > 1 ? "ões" : ""} não ${result.failed > 1 ? "puderam" : "pôde"} ser sincronizada${result.failed > 1 ? "s" : ""}.`,
        });
      }

      await refreshPendingCount();
    } catch {
      // Sync failed silently
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [refreshPendingCount]);

  // On reconnect, sync pending actions
  useEffect(() => {
    const unsubscribe = onReconnect(() => {
      triggerSync();
    });
    return unsubscribe;
  }, [onReconnect, triggerSync]);

  // Show toast when going offline
  useEffect(() => {
    if (!isOnline) {
      toast({
        title: "Sem internet",
        description: "Ações serão salvas localmente e sincronizadas quando a conexão voltar.",
      });
    }
  }, [isOnline]);

  // Show toast when reconnecting after being offline
  useEffect(() => {
    if (isOnline && wasOffline) {
      toast({
        title: "Conexão restaurada",
        description: "Sincronizando dados...",
      });
      clearWasOffline();
    }
  }, [isOnline, wasOffline, clearWasOffline]);

  // Periodic sync and cleanup
  useEffect(() => {
    refreshPendingCount();
    clearExpiredCache().catch(() => {});

    const interval = setInterval(() => {
      if (navigator.onLine) {
        triggerSync();
      }
      refreshPendingCount();
    }, 30_000); // Every 30s

    return () => clearInterval(interval);
  }, [triggerSync, refreshPendingCount]);

  return (
    <OfflineContext.Provider
      value={{ isOnline, pendingCount, isSyncing, lastSyncAt, triggerSync, refreshPendingCount }}
    >
      {children}
    </OfflineContext.Provider>
  );
}
