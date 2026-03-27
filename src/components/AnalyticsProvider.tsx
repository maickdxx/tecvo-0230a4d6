import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { analytics } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, profile } = useAuth();

  useEffect(() => {
    // Determine user type (simple logic for now)
    let userType = null;
    if (profile) {
      userType = profile.employee_type || (profile.id ? "admin" : null);
    }

    // Track Page View
    const path = location.pathname;
    const isLandingPage = path === "/" || path === "/home";
    const isGuest = !user;

    if (isLandingPage && isGuest) {
      analytics.track("landing_page_view", null, null, {
        page_path: path,
        page_title: document.title,
        referrer: document.referrer
      });
    }

    analytics.trackPageView(
      user?.id || null,
      profile?.organization_id || null,
      location.pathname + location.search,
      document.title,
      { user_type: userType }
    );
  }, [location.pathname, location.search, user?.id, profile?.organization_id, profile?.employee_type]);

  return <>{children}</>;
}
