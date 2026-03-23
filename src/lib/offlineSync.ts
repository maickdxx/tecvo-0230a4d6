/**
 * Offline Sync Engine — processes pending actions when online.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  getPendingActions,
  markActionSynced,
  markActionError,
  clearSyncedActions,
  type OfflineAction,
} from "./offlineStore";

type SyncResult = {
  synced: number;
  failed: number;
  errors: string[];
};

async function syncTimeClock(action: OfflineAction): Promise<void> {
  const { entryType, userId, organizationId, latitude, longitude, deviceInfo } =
    action.payload as Record<string, any>;

  const { error } = await supabase
    .from("time_clock_entries")
    .insert({
      user_id: userId,
      organization_id: organizationId,
      entry_type: entryType,
      recorded_at: action.timestamp,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      device_info: deviceInfo ?? null,
    });

  if (error) throw new Error(error.message);
}

async function syncServiceStatus(action: OfflineAction): Promise<void> {
  const { serviceId, status } = action.payload as Record<string, any>;

  const { error } = await supabase
    .from("services")
    .update({ status, updated_at: new Date().toISOString() } as any)
    .eq("id", serviceId);

  if (error) throw new Error(error.message);
}

async function syncOperationalStatus(action: OfflineAction): Promise<void> {
  const { serviceId, operationalStatus } = action.payload as Record<string, any>;

  const updateData: Record<string, any> = {
    operational_status: operationalStatus,
  };

  if (operationalStatus === "en_route") {
    updateData.travel_started_at = action.timestamp;
  } else if (operationalStatus === "in_attendance") {
    updateData.attendance_started_at = action.timestamp;
    updateData.status = "in_progress";
  }

  const { error } = await supabase
    .from("services")
    .update(updateData as any)
    .eq("id", serviceId);

  if (error) throw new Error(error.message);
}

const SYNC_HANDLERS: Record<string, (action: OfflineAction) => Promise<void>> = {
  time_clock: syncTimeClock,
  service_status: syncServiceStatus,
  operational_status: syncOperationalStatus,
  service_execution: syncOperationalStatus,
};

export async function syncPendingActions(): Promise<SyncResult> {
  const pending = await getPendingActions();
  const result: SyncResult = { synced: 0, failed: 0, errors: [] };

  if (pending.length === 0) return result;

  for (const action of pending) {
    const handler = SYNC_HANDLERS[action.type];
    if (!handler) {
      await markActionError(action.id, `Unknown action type: ${action.type}`);
      result.failed++;
      continue;
    }

    try {
      await handler(action);
      await markActionSynced(action.id);
      result.synced++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      await markActionError(action.id, msg);
      result.failed++;
      result.errors.push(`${action.type}: ${msg}`);
    }
  }

  // Cleanup synced
  await clearSyncedActions();

  return result;
}
