import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type ColorTheme = "blue" | "purple" | "orange" | "green";

const STORAGE_KEY = "tecvo-color-theme";
const VALID_THEMES: ColorTheme[] = ["blue", "purple", "orange", "green"];

export function useColorTheme() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const [colorTheme, setColorThemeState] = useState<ColorTheme>(() => {
    try {
      return (localStorage.getItem(STORAGE_KEY) as ColorTheme) || "blue";
    } catch {
      return "blue";
    }
  });

  const [synced, setSynced] = useState(false);

  // Sync from organization DB on mount
  useEffect(() => {
    if (!profile?.organization_id || synced) return;

    supabase
      .from("organizations")
      .select("primary_color")
      .eq("id", profile.organization_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.primary_color) {
          const dbTheme = data.primary_color as ColorTheme;
          if (VALID_THEMES.includes(dbTheme)) {
            setColorThemeState(dbTheme);
            try { localStorage.setItem(STORAGE_KEY, dbTheme); } catch {}
          }
        }
        setSynced(true);
      });
  }, [profile?.organization_id, synced]);

  const setColorTheme = useCallback((theme: ColorTheme) => {
    setColorThemeState(theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch {}

    // Persist to organization DB
    if (profile?.organization_id) {
      supabase
        .from("organizations")
        .update({ primary_color: theme } as any)
        .eq("id", profile.organization_id)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["organization"] });
        });
    }
  }, [profile?.organization_id, queryClient]);

  // Apply to DOM
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
