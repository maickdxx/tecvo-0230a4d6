import { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const STORAGE_KEY = "tecvo_install_cta";
const DISMISS_DAYS = 14;
const MIN_SESSION_MS = 120_000; // 2 minutes

interface StoredState {
  dismissed_at?: number;
  installed?: boolean;
}

function getStored(): StoredState {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function setStored(patch: Partial<StoredState>) {
  const current = getStored();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...patch }));
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      setStored({ installed: true });
    }

    const installedHandler = () => {
      setIsInstalled(true);
      setStored({ installed: true });
    };
    window.addEventListener("appinstalled", installedHandler);

    // Session timer — only show banner after MIN_SESSION_MS
    const timer = setTimeout(() => setSessionReady(true), MIN_SESSION_MS);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
      clearTimeout(timer);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
      setStored({ installed: true });
    }
    setDeferredPrompt(null);
    return outcome === "accepted";
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    setStored({ dismissed_at: Date.now() });
  }, []);

  const isInstallable = !!deferredPrompt && !isInstalled;

  // Check if banner should show (respects dismiss cooldown)
  const stored = getStored();
  const wasDismissed = stored.dismissed_at
    ? Date.now() - stored.dismissed_at < DISMISS_DAYS * 86_400_000
    : false;

  const showBanner = isInstallable && sessionReady && !wasDismissed;

  return { isInstallable, isInstalled, showBanner, promptInstall, dismiss };
}
