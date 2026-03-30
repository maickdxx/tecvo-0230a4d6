// Facebook Pixel helper — thin wrapper around the global fbq function.
// The base pixel script is loaded in index.html with PageView already firing.

declare global {
  interface Window {
    fbq: (...args: unknown[]) => void;
  }
}

const PIXEL_ID = "26761775376753591";

/** Track a standard FB event */
export function trackFBEvent(eventName: string, params?: Record<string, unknown>) {
  if (typeof window.fbq !== "function") return;
  window.fbq("track", eventName, params);
}

/** Track a custom FB event */
export function trackFBCustomEvent(eventName: string, params?: Record<string, unknown>) {
  if (typeof window.fbq !== "function") return;
  window.fbq("trackCustom", eventName, params);
}

/** Re-export pixel ID for reference */
export { PIXEL_ID };
