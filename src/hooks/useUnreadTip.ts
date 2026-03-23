import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";

export function useUnreadTip() {
  const { organizationId } = useAuth();
  const key = `tecvo_unread_tip_${organizationId}`;
  const [hasUnreadTip, setHasUnreadTip] = useState(() => localStorage.getItem(key) === "true");

  useEffect(() => {
    const handler = () => setHasUnreadTip(localStorage.getItem(key) === "true");
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [key]);

  const clearUnreadTip = useCallback(() => {
    localStorage.removeItem(key);
    setHasUnreadTip(false);
  }, [key]);

  return { hasUnreadTip, clearUnreadTip };
}
