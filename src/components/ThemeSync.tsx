import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "next-themes";
import { useColorTheme, type ColorTheme } from "@/hooks/useColorTheme";

export function ThemeSync() {
  const { profile } = useAuth();
  const { setTheme, theme: currentMode } = useTheme();
  const { setColorTheme, colorTheme: currentColorTheme } = useColorTheme();

  useEffect(() => {
    if (profile?.theme_mode && profile.theme_mode !== currentMode) {
      setTheme(profile.theme_mode);
    }
    if (profile?.color_theme && profile.color_theme !== currentColorTheme) {
      setColorTheme(profile.color_theme as ColorTheme);
    }
  }, [profile, setTheme, setColorTheme, currentMode, currentColorTheme]);

  return null;
}
