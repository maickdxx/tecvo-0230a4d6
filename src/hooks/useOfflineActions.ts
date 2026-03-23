/**
 * Hook to cache today's services and agenda data for offline access,
 * and provide offline-capable actions (status updates, time clock).
 */
import { useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useOffline } from "@/contexts/OfflineContext";
import { useAuth } from "@/hooks/useAuth";
import { addPendingAction, setCachedData, getCachedData } from "@/lib/offlineStore";
import { toast } from "@/hooks/use-toast";

/**
 * Caches services query data to IndexedDB whenever it updates.
 * Call this from pages that display today's services.
 */
export function useOfflineServiceCache(services: any[], cacheKey: string) {
  const { isOnline } = useOffline();

  useEffect(() => {
    if (isOnline && services && services.length > 0) {
      setCachedData(cacheKey, services, 120).catch(() => {}); // 2h TTL
    }
  }, [services, isOnline, cacheKey]);
}

/**
 * Returns cached services data when offline.
 */
export async function getOfflineCachedServices(cacheKey: string) {
  try {
    const cached = await getCachedData<any[]>(cacheKey);
    return cached;
  } catch {
    return null;
  }
}

/**
 * Queue a time clock entry for offline sync.
 */
export async function queueOfflineTimeClock(params: {
  entryType: string;
  userId: string;
  organizationId: string;
  latitude?: number | null;
  longitude?: number | null;
  refreshPendingCount: () => Promise<void>;
}) {
  const { entryType, userId, organizationId, latitude, longitude, refreshPendingCount } = params;

  const actionId = await addPendingAction({
    type: "time_clock",
    payload: {
      entryType,
      userId,
      organizationId,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      deviceInfo: navigator.userAgent.substring(0, 100),
    },
    timestamp: new Date().toISOString(),
  });

  await refreshPendingCount();

  toast({
    title: "Ponto registrado offline",
    description: "Será sincronizado quando a internet voltar.",
  });

  return actionId;
}

/**
 * Queue a service status update for offline sync.
 */
export async function queueOfflineServiceStatus(params: {
  serviceId: string;
  status: string;
  refreshPendingCount: () => Promise<void>;
}) {
  const { serviceId, status, refreshPendingCount } = params;

  await addPendingAction({
    type: "service_status",
    payload: { serviceId, status },
    timestamp: new Date().toISOString(),
  });

  await refreshPendingCount();

  toast({
    title: "Status atualizado offline",
    description: "Será sincronizado quando a internet voltar.",
  });
}

/**
 * Queue an operational status update for offline sync.
 */
export async function queueOfflineOperationalStatus(params: {
  serviceId: string;
  operationalStatus: string;
  refreshPendingCount: () => Promise<void>;
}) {
  const { serviceId, operationalStatus, refreshPendingCount } = params;

  await addPendingAction({
    type: "operational_status",
    payload: { serviceId, operationalStatus },
    timestamp: new Date().toISOString(),
  });

  await refreshPendingCount();

  toast({
    title: "Status operacional salvo offline",
    description: "Será sincronizado quando a internet voltar.",
  });
}
