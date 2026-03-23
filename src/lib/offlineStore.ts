/**
 * Offline Store — IndexedDB-based storage for offline actions and cached data.
 * Uses a simple wrapper to avoid heavy dependencies.
 */

const DB_NAME = "tecvo_offline";
const DB_VERSION = 1;

// Store names
const ACTIONS_STORE = "pending_actions";
const CACHE_STORE = "data_cache";

export interface OfflineAction {
  id: string;
  type: "time_clock" | "service_status" | "operational_status" | "service_execution";
  payload: Record<string, unknown>;
  status: "pending" | "synced" | "error";
  timestamp: string;
  retryCount: number;
  errorMessage?: string;
}

export interface CachedData {
  key: string;
  data: unknown;
  cachedAt: string;
  expiresAt: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ACTIONS_STORE)) {
        const store = db.createObjectStore(ACTIONS_STORE, { keyPath: "id" });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("type", "type", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ========================
// Pending Actions
// ========================

export async function addPendingAction(action: Omit<OfflineAction, "id" | "status" | "retryCount">): Promise<string> {
  const db = await openDB();
  const id = crypto.randomUUID();
  const record: OfflineAction = {
    ...action,
    id,
    status: "pending",
    retryCount: 0,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(ACTIONS_STORE, "readwrite");
    tx.objectStore(ACTIONS_STORE).add(record);
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingActions(): Promise<OfflineAction[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ACTIONS_STORE, "readonly");
    const index = tx.objectStore(ACTIONS_STORE).index("status");
    const request = index.getAll("pending");
    request.onsuccess = () => {
      const results = (request.result as OfflineAction[]).sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function markActionSynced(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ACTIONS_STORE, "readwrite");
    const store = tx.objectStore(ACTIONS_STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const record = getReq.result as OfflineAction | undefined;
      if (record) {
        record.status = "synced";
        store.put(record);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function markActionError(id: string, errorMessage: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ACTIONS_STORE, "readwrite");
    const store = tx.objectStore(ACTIONS_STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const record = getReq.result as OfflineAction | undefined;
      if (record) {
        record.retryCount += 1;
        record.errorMessage = errorMessage;
        // After 5 retries, mark as error permanently
        if (record.retryCount >= 5) {
          record.status = "error";
        }
        store.put(record);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearSyncedActions(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ACTIONS_STORE, "readwrite");
    const store = tx.objectStore(ACTIONS_STORE);
    const index = store.index("status");
    const request = index.openCursor("synced");
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingCount(): Promise<number> {
  const actions = await getPendingActions();
  return actions.length;
}

// ========================
// Data Cache
// ========================

export async function setCachedData(key: string, data: unknown, ttlMinutes = 60): Promise<void> {
  const db = await openDB();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60_000);

  const record: CachedData = {
    key,
    data,
    cachedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE, "readwrite");
    tx.objectStore(CACHE_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedData<T = unknown>(key: string): Promise<{ data: T; cachedAt: string } | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE, "readonly");
    const request = tx.objectStore(CACHE_STORE).get(key);
    request.onsuccess = () => {
      const record = request.result as CachedData | undefined;
      if (!record) return resolve(null);

      // Check expiry
      if (new Date(record.expiresAt) < new Date()) {
        // Expired but still return for offline fallback
        resolve({ data: record.data as T, cachedAt: record.cachedAt });
        return;
      }

      resolve({ data: record.data as T, cachedAt: record.cachedAt });
    };
    request.onerror = () => reject(request.error);
  });
}

export async function clearExpiredCache(): Promise<void> {
  const db = await openDB();
  const now = new Date().toISOString();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE, "readwrite");
    const store = tx.objectStore(CACHE_STORE);
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        const record = cursor.value as CachedData;
        if (record.expiresAt < now) {
          cursor.delete();
        }
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllCache(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE, "readwrite");
    tx.objectStore(CACHE_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
