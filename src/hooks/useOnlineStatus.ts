import { useState, useEffect, useCallback, useRef } from "react";

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const reconnectCallbacksRef = useRef<Set<() => void>>(new Set());

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Fire reconnect callbacks
      reconnectCallbacksRef.current.forEach((cb) => {
        try { cb(); } catch { /* ignore */ }
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const onReconnect = useCallback((callback: () => void) => {
    reconnectCallbacksRef.current.add(callback);
    return () => {
      reconnectCallbacksRef.current.delete(callback);
    };
  }, []);

  const clearWasOffline = useCallback(() => setWasOffline(false), []);

  return { isOnline, wasOffline, clearWasOffline, onReconnect };
}
