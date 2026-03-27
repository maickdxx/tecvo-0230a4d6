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
  }, [location.pathname, location.search, user?.id, profile?.organization_id]);

  return <>{children}</>;
}
