import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export type ColorTheme = "blue" | "purple" | "orange" | "green";

const STORAGE_KEY = "tecvo-color-theme";

export function useColorTheme() {
  const { user, profile } = useAuth();
  
  const [colorTheme, setColorThemeState] = useState<ColorTheme>(() => {
    try {
      return (localStorage.getItem(STORAGE_KEY) as ColorTheme) || "blue";
    } catch {
      return "blue";
    }
  });

  // Sync with profile on load but only if we don't have a value yet or it changes from another session
  useEffect(() => {
    if (profile?.color_theme && profile.color_theme !== colorTheme) {
      const theme = profile.color_theme as ColorTheme;
      setColorThemeState(theme);
      localStorage.setItem(STORAGE_KEY, theme);
    }
  }, [profile?.color_theme, colorTheme]);

  const setColorTheme = useCallback(async (theme: ColorTheme) => {
    setColorThemeState(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
      
      if (user) {
        await supabase
          .from("profiles")
          .update({ color_theme: theme })
          .eq("user_id", user.id);
      }
    } catch (err) {
      console.error("Error saving color theme:", err);
    }
  }, [user]);

  useEffect(() => {
    const root = document.documentElement;
    if (colorTheme === "blue") {
      root.removeAttribute("data-color-theme");
    } else {
      root.setAttribute("data-color-theme", colorTheme);
    }
  }, [colorTheme]);

  return { colorTheme, setColorTheme };
}
