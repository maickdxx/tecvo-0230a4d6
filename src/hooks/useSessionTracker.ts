import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { analytics } from "@/lib/analytics";

const HEARTBEAT_INTERVAL = 60_000; // 60 seconds

export function useSessionTracker() {
  const { user, profile } = useAuth();
  const sessionIdRef = useRef<string | null>(null);
  const startedAtRef = useRef<Date | null>(null);

  useEffect(() => {
    if (!user) return;

    const organizationId = profile?.organization_id ?? null;

    // Start session
    const startSession = async () => {
      const utms = analytics.getStoredUTMs();
      
      const { data, error } = await supabase
        .from("user_sessions")
        .insert({
          user_id: user.id,
          organization_id: organizationId,
          ...utms
        })
        .select("id")
        .single();

      if (!error && data) {
        sessionIdRef.current = data.id;
        startedAtRef.current = new Date();
      }
    };

    startSession();

    // Heartbeat: update ended_at + duration
    const heartbeat = setInterval(async () => {
      if (!sessionIdRef.current || !startedAtRef.current) return;
      const duration = Math.floor((Date.now() - startedAtRef.current.getTime()) / 1000);
      await supabase
        .from("user_sessions")
        .update({
          ended_at: new Date().toISOString(),
          duration_seconds: duration,
        })
        .eq("id", sessionIdRef.current);
    }, HEARTBEAT_INTERVAL);

    // On unload: final update
    const handleUnload = () => {
      if (!sessionIdRef.current || !startedAtRef.current) return;
      const duration = Math.floor((Date.now() - startedAtRef.current.getTime()) / 1000);
      // Use sendBeacon for reliability
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_sessions?id=eq.${sessionIdRef.current}`;
      const body = JSON.stringify({
        ended_at: new Date().toISOString(),
        duration_seconds: duration,
      });
      navigator.sendBeacon?.(url, new Blob([body], { type: "application/json" }));
    };

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(heartbeat);
      window.removeEventListener("beforeunload", handleUnload);
      // Final update on cleanup
      if (sessionIdRef.current && startedAtRef.current) {
        const duration = Math.floor((Date.now() - startedAtRef.current.getTime()) / 1000);
        supabase
          .from("user_sessions")
          .update({
            ended_at: new Date().toISOString(),
            duration_seconds: duration,
          })
          .eq("id", sessionIdRef.current)
          .then(() => {});
      }
      sessionIdRef.current = null;
      startedAtRef.current = null;
    };
  }, [user?.id, profile?.organization_id]);
}
