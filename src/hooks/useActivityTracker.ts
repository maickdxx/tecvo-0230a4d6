import { useCallback } from "react";
import { useAuth } from "./useAuth";
import { analytics, EventType, EventMetadata } from "@/lib/analytics";

export function useActivityTracker() {
  const { user, organizationId } = useAuth();

  const trackEvent = useCallback(
    async (eventType: EventType, metadata: EventMetadata = {}) => {
      if (!user) return;
      analytics.track(eventType, user.id, organizationId, metadata);
    },
    [user?.id, organizationId]
  );

  return { trackEvent };
}
