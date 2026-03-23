import { useState, useEffect, useCallback } from "react";

export type ColorTheme = "blue" | "purple" | "orange" | "green";

const STORAGE_KEY = "tecvo-color-theme";

export function useColorTheme() {
  const [colorTheme, setColorThemeState] = useState<ColorTheme>(() => {
    try {
      return (localStorage.getItem(STORAGE_KEY) as ColorTheme) || "blue";
    } catch {
      return "blue";
    }
  });

  const setColorTheme = useCallback((theme: ColorTheme) => {
    setColorThemeState(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {}
  }, []);

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
