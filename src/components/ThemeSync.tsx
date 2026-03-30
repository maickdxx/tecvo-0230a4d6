import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "next-themes";
import { useColorTheme, type ColorTheme } from "@/hooks/useColorTheme";

export function ThemeSync() {
  const { profile, isLoading } = useAuth();
  const { setTheme, theme: currentMode } = useTheme();
  const { setColorTheme, colorTheme: currentColorTheme } = useColorTheme();
  const hasSyncedRef = useRef(false);

  // Initial sync when profile loads
  useEffect(() => {
    if (!isLoading && profile && !hasSyncedRef.current) {
      if (profile.theme_mode && profile.theme_mode !== currentMode) {
        setTheme(profile.theme_mode);
      }
      if (profile.color_theme && profile.color_theme !== currentColorTheme) {
        setColorTheme(profile.color_theme as ColorTheme);
      }
      hasSyncedRef.current = true;
    }
  }, [profile, isLoading, setTheme, setColorTheme, currentMode, currentColorTheme]);

  return null;
}
