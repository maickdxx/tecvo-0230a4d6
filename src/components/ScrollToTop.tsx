import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { trackFBEvent } from "@/lib/fbPixel";

export const ScrollToTop = () => {
  const { pathname } = useLocation();
  const navType = useNavigationType();

  useEffect(() => {
    if (navType !== "POP") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
    // Track PageView on every SPA navigation
    trackFBEvent("PageView");
  }, [pathname, navType]);

  return null;
};