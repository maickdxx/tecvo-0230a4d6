import { supabase } from "@/integrations/supabase/client";

export type EventType = 
  | "page_view"
  | "landing_page_view"
  | "interaction"
  | "create_account_click"
  | "login"
  | "logout"
  | "signup_started"
  | "signup_completed"
  | "payment_initiated"
  | "payment_completed"
  | "service_created"
  | "agenda_viewed"
  | "finance_viewed"
  | "weather_art_generated";

export interface EventMetadata {
  page_path?: string;
  page_title?: string;
  referrer?: string;
  duration_ms?: number;
  user_agent?: string;
  [key: string]: any;
}

interface UTMData {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referrer?: string;
  landing_page?: string;
}

class AnalyticsClient {
  private queue: any[] = [];
  private flushTimeout: any = null;
  private readonly FLUSH_INTERVAL = 5000; // 5 seconds
  private lastPath: string | null = null;
  private lastPathStartTime: number = Date.now();
  private anonymousId: string | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.captureUTMs();
      this.anonymousId = this.getAnonymousId();
      window.addEventListener("beforeunload", () => this.flush(true));
    }
  }

  public getAnonymousId() {
    if (typeof window === "undefined") return null;
    let id = localStorage.getItem("tecvo_anon_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("tecvo_anon_id", id);
    }
    return id;
  }

  private captureUTMs() {
    if (typeof window === "undefined") return;

    const urlParams = new URLSearchParams(window.location.search);
    const utms: UTMData = {
      utm_source: urlParams.get("utm_source") || undefined,
      utm_medium: urlParams.get("utm_medium") || undefined,
      utm_campaign: urlParams.get("utm_campaign") || undefined,
      referrer: document.referrer || undefined,
      landing_page: window.location.pathname,
    };

    // Only store if we have at least some data
    if (Object.values(utms).some(v => v !== undefined)) {
      const existing = this.getStoredUTMs();
      const merged = { ...existing, ...utms };
      sessionStorage.setItem("tecvo_utm_data", JSON.stringify(merged));
    }
  }

  public getStoredUTMs(): UTMData {
    if (typeof window === "undefined") return {};
    const stored = sessionStorage.getItem("tecvo_utm_data");
    return stored ? JSON.parse(stored) : {};
  }

  public async track(
    eventType: EventType,
    userId: string | null,
    organizationId: string | null,
    metadata: EventMetadata = {}
  ) {
    const utms = this.getStoredUTMs();
    
    // Get all stored AB Test variants
    const abTests: Record<string, string> = {};
    if (typeof window !== "undefined") {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith("ab_test_")) {
          const testName = key.replace("ab_test_", "");
          try {
            const variant = JSON.parse(localStorage.getItem(key) || "{}");
            abTests[`ab_test_${testName}`] = variant.name;
            abTests[`ab_variant_id_${testName}`] = variant.id;
          } catch (e) {
            console.warn("Error parsing AB test variant", e);
          }
        }
      });
    }

    const event = {
      user_id: userId,
      organization_id: organizationId,
      event_type: eventType,
      metadata: {
        ...utms,
        ...abTests,
        ...metadata,
        anonymous_id: this.anonymousId,
        timestamp: new Date().toISOString(),
        url: typeof window !== "undefined" ? window.location.href : undefined,
      },
      created_at: new Date().toISOString(),
    };

    this.queue.push(event);

    if (this.queue.length >= 10) {
      this.flush();
    } else if (!this.flushTimeout) {
      this.flushTimeout = setTimeout(() => this.flush(), this.FLUSH_INTERVAL);
    }
  }

  public async trackPageView(
    userId: string | null,
    organizationId: string | null,
    path: string,
    title: string,
    extraMetadata: EventMetadata = {}
  ) {
    const now = Date.now();
    let durationOnLastPage = 0;

    if (this.lastPath) {
      durationOnLastPage = Math.floor((now - this.lastPathStartTime) / 1000);
    }

    const metadata: EventMetadata = {
      page_path: path,
      page_title: title,
      referrer: document.referrer,
      previous_page: this.lastPath,
      duration_on_previous_page: durationOnLastPage,
      ...extraMetadata
    };

    this.track("page_view", userId, organizationId, metadata);

    this.lastPath = path;
    this.lastPathStartTime = now;
  }

  public async flush(isUnload = false) {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }

    if (this.queue.length === 0) return;

    const eventsToFlush = [...this.queue];
    this.queue = [];

    if (isUnload && navigator.sendBeacon) {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_activity_events`;
      const headers = {
        "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      };
      
      fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(eventsToFlush),
        keepalive: true
      });
    } else {
      try {
        await supabase.from("user_activity_events").insert(eventsToFlush);
      } catch (error) {
        console.error("Failed to flush analytics events:", error);
      }
    }
  }
}

export const analytics = new AnalyticsClient();

