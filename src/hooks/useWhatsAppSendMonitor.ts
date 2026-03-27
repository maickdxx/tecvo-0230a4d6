import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { getLocalDayBoundsUTC, getTodayInTz } from "@/lib/timezone";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";

export interface SendLogEntry {
  id: string;
  contact_id: string | null;
  source: string;
  status: string;
  blocked_reason: string | null;
  message_preview: string | null;
  created_at: string;
}

export interface HourlyBucket {
  hour: string;
  bot: number;
  manual: number;
  ai: number;
  cron: number;
  other: number;
}

export function useWhatsAppSendMonitor() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;
  const { organization, update: updateOrg } = useOrganization();
  const tz = useOrgTimezone();
  const queryClient = useQueryClient();

  // ── Today's stats (using org timezone) ──
  const todayStr = getTodayInTz(tz);
  const { start: todayISO } = getLocalDayBoundsUTC(todayStr, tz);

  const statsQuery = useQuery({
    queryKey: ["send-monitor-stats", orgId],
    queryFn: async () => {
      if (!orgId) return null;

      const { data, error } = await supabase
        .from("whatsapp_message_log")
        .select("status, source, blocked_reason, created_at, contact_id")
        .eq("organization_id", orgId)
        .gte("created_at", todayISO)
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) throw error;
      const rows = data || [];

      const sent = rows.filter(r => r.status === "sent").length;
      const blocked = rows.filter(r => r.status === "blocked").length;
      const errors = rows.filter(r => r.status === "error").length;
      const total = sent + blocked + errors;
      const blockRate = total > 0 ? Math.round((blocked / total) * 100) : 0;

      // Hourly buckets (last 24h)
      const now = Date.now();
      const hourlyMap = new Map<string, HourlyBucket>();
      for (let i = 23; i >= 0; i--) {
        const d = new Date(now - i * 3600_000);
        const key = `${d.getHours().toString().padStart(2, "0")}:00`;
        hourlyMap.set(key, { hour: key, bot: 0, manual: 0, ai: 0, cron: 0, other: 0 });
      }

      for (const r of rows) {
        if (r.status !== "sent") continue;
        const d = new Date(r.created_at);
        const key = `${d.getHours().toString().padStart(2, "0")}:00`;
        const bucket = hourlyMap.get(key);
        if (!bucket) continue;
        const src = r.source || "other";
        if (src === "bot") bucket.bot++;
        else if (src === "manual") bucket.manual++;
        else if (src === "ai") bucket.ai++;
        else if (["cron", "scheduled", "auto_notify", "tips", "welcome"].includes(src)) bucket.cron++;
        else bucket.other++;
      }

      // Block reasons
      const blockReasons: Record<string, number> = {};
      for (const r of rows) {
        if (r.status === "blocked" && r.blocked_reason) {
          blockReasons[r.blocked_reason] = (blockReasons[r.blocked_reason] || 0) + 1;
        }
      }

      // Top contacts
      const contactCounts: Record<string, number> = {};
      for (const r of rows) {
        if (r.contact_id && r.status === "sent") {
          contactCounts[r.contact_id] = (contactCounts[r.contact_id] || 0) + 1;
        }
      }
      const topContacts = Object.entries(contactCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([id, count]) => ({ contact_id: id, count }));

      // Degraded mode detection
      const hasDegraded = rows.some(r =>
        r.blocked_reason?.includes("guard_degraded") ||
        r.blocked_reason?.includes("guard_rpc_error") ||
        r.blocked_reason?.includes("guard_exception")
      );

      return {
        sent,
        blocked,
        errors,
        total,
        blockRate,
        hourly: Array.from(hourlyMap.values()),
        blockReasons,
        topContacts,
        hasDegraded,
        isPaused: organization?.messaging_paused ?? false,
      };
    },
    enabled: !!orgId,
    refetchInterval: 60_000,
  });

  // ── Recent blocks ──
  const blocksQuery = useQuery({
    queryKey: ["send-monitor-blocks", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase
        .from("whatsapp_message_log")
        .select("*")
        .eq("organization_id", orgId)
        .eq("status", "blocked")
        .order("created_at", { ascending: false })
        .limit(20);
      return (data || []) as SendLogEntry[];
    },
    enabled: !!orgId,
    refetchInterval: 60_000,
  });

  // ── Full log (paginated) ──
  const logsQuery = useQuery({
    queryKey: ["send-monitor-logs", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase
        .from("whatsapp_message_log")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data || []) as SendLogEntry[];
    },
    enabled: !!orgId,
    refetchInterval: 60_000,
  });

  // ── Pause / Resume ──
  const togglePause = useMutation({
    mutationFn: async (pause: boolean) => {
      updateOrg({
        messaging_paused: pause,
        messaging_paused_at: pause ? new Date().toISOString() : null,
        messaging_paused_reason: pause ? "manual_pause" : null,
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["send-monitor-stats"] });
      queryClient.invalidateQueries({ queryKey: ["organization"] });
    },
  });

  return {
    stats: statsQuery.data,
    isLoadingStats: statsQuery.isLoading,
    blocks: blocksQuery.data || [],
    logs: logsQuery.data || [],
    togglePause,
    isPaused: organization?.messaging_paused ?? false,
  };
}
