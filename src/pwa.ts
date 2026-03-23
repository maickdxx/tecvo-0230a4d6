const PREVIEW_HOST_PATTERNS = [
  /(^|\.)lovableproject\.com$/i,
  /^id-preview--/i,
  /^id-preview-/i,
];

const PREVIEW_RELOAD_KEY = "__preview_cache_cleared__";

function isPreviewHost(hostname: string) {
  return PREVIEW_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
}

async function clearPreviewServiceWorkers() {
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
    const didClear = await clearPreviewServiceWorkers();

    if (didClear && !sessionStorage.getItem(PREVIEW_RELOAD_KEY)) {
      sessionStorage.setItem(PREVIEW_RELOAD_KEY, "1");
      window.location.reload();
      return;
    }

    sessionStorage.removeItem(PREVIEW_RELOAD_KEY);
    return;
  }

  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("PWA registration failed", error);
    });
  });
}
