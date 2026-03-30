const PREVIEW_HOST_PATTERNS = [
  /(^|\.)lovableproject\.com$/i,
  /^id-preview--/i,
  /^id-preview-/i,
];

const PREVIEW_RELOAD_KEY = "__preview_cache_cleared__";
const APP_VERSION_KEY = "__app_shell_version__";
const APP_VERSION_RELOAD_KEY = "__app_shell_version_reloaded__";
const APP_SHELL_VERSION = "2026-03-30-fb-pixel-fix";

function isPreviewHost(hostname: string) {
  return PREVIEW_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
}

async function clearServiceWorkersAndCaches() {
  let didClear = false;

  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations.length > 0) {
      didClear = true;
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  }

  if ("caches" in window) {
    const cacheNames = await caches.keys();
    if (cacheNames.length > 0) {
      didClear = true;
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    }
  }

  return didClear;
}

export async function setupPwa() {
  const hostname = window.location.hostname;

  if (isPreviewHost(hostname)) {
    const didClear = await clearServiceWorkersAndCaches();

    if (didClear && !sessionStorage.getItem(PREVIEW_RELOAD_KEY)) {
      sessionStorage.setItem(PREVIEW_RELOAD_KEY, "1");
      window.location.reload();
      return;
    }

    sessionStorage.removeItem(PREVIEW_RELOAD_KEY);
    return;
  }

  if (!("serviceWorker" in navigator)) return;

  const storedVersion = localStorage.getItem(APP_VERSION_KEY);
  if (storedVersion !== APP_SHELL_VERSION) {
    const didClear = await clearServiceWorkersAndCaches();
    localStorage.setItem(APP_VERSION_KEY, APP_SHELL_VERSION);

    if (didClear && !sessionStorage.getItem(APP_VERSION_RELOAD_KEY)) {
      sessionStorage.setItem(APP_VERSION_RELOAD_KEY, "1");
      window.location.reload();
      return;
    }
  }

  sessionStorage.removeItem(APP_VERSION_RELOAD_KEY);

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("PWA registration failed", error);
    });
  });
}
