import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type ActivityEventType =
  | "service_created"
  | "agenda_viewed"
  | "finance_viewed"
  | "weather_art_generated"
  | "page_viewed";

export function useActivityTracker() {
  const { user, organizationId } = useAuth();

  const trackEvent = useCallback(
    async (eventType: ActivityEventType) => {
      if (!user) return;
      try {
        await supabase.from("user_activity_events").insert({
          user_id: user.id,
          organization_id: organizationId,
          event_type: eventType,
        });
      } catch {
        // Silent fail — tracking should never block UX
      }
    },
    [user?.id, organizationId]
  );

  return { trackEvent };
}
