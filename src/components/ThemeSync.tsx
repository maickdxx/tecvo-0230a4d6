import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "next-themes";

export function ThemeSync() {
  const { profile, isLoading } = useAuth();
  const { setTheme, theme: currentMode } = useTheme();
  const hasSyncedRef = useRef(false);

  // Initial sync when profile loads
  useEffect(() => {
    if (!isLoading && profile && !hasSyncedRef.current) {
      if (profile.theme_mode && profile.theme_mode !== currentMode) {
        setTheme(profile.theme_mode);
      }
      hasSyncedRef.current = true;
    }
  }, [profile, isLoading, setTheme, currentMode]);

  return null;
}
