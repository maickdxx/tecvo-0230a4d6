import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";


export const ScrollToTop = () => {
  const { pathname } = useLocation();
  const navType = useNavigationType();
  const hasMounted = useRef(false);

  useEffect(() => {
    if (navType !== "POP") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }

    if (!hasMounted.current) {
      hasMounted.current = true;
    }
  }, [pathname, navType]);

  return null;
};