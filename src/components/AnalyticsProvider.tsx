import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { analytics } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, profile } = useAuth();

  useEffect(() => {
    // Track Page View
    analytics.trackPageView(
      user?.id || null,
      profile?.organization_id || null,
      location.pathname + location.search,
      document.title
    );

    // Update metadata with user type if available
    if (profile?.employee_type) {
      // This is a bit tricky since trackPageView already happened.
      // But we can include it in the next events or update the client state.
    }
  }, [location.pathname, location.search, user?.id, profile?.organization_id, profile?.employee_type]);

  return <>{children}</>;
}
