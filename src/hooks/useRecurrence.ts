import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "./useOrganization";
import { addMonths, differenceInDays } from "date-fns";

export type RecurrenceStage =
  | "aguardando"
  | "2m_enviado" | "4m_enviado" | "6m_enviado"
  | "8m_enviado" | "10m_enviado" | "12m_enviado"
  | "pronto" | "msg_enviada"
  | "respondeu" | "agendado" | "ignorado" | "concluido" | "reiniciado";

export type RecurrenceVisualStage = "pronto" | "proximo" | "futuro";

export interface RecurrenceClient {
  entryId: string;
  clientId: string;
  clientName: string;
  phone: string | null;
  whatsapp: string | null;
  lastServiceType: string;
  lastServiceTypeFriendly: string;
  lastServiceDate: string;
  lastServiceValue: number | null;
  daysSinceLastService: number;
  recurrenceDate: Date;
  daysUntilRecurrence: number;
  stage: RecurrenceVisualStage;
  dbStage: RecurrenceStage;
  msg2mSentAt: string | null;
  msg4mSentAt: string | null;
  msg6mSentAt: string | null;
  msg8mSentAt: string | null;
  msg10mSentAt: string | null;
  msg12mSentAt: string | null;
  closedReason: string | null;
}

export interface RecurrenceStats {
  totalFuture: number;
  totalProximo: number;
  totalPronto: number;
  totalActive: number;
  potentialRevenue: number;
  revenue60Days: number;
  convertedThisMonth: number;
}

export interface RecurrenceConfig {
  automationEnabled: boolean;
  dailyLimit: number;
  businessHoursStart: string;
  businessHoursEnd: string;
  message2Months: string;
  message4Months: string;
  message6Months: string;
  message8Months: string;
  message10Months: string;
  message12Months: string;
}

// Removed hardcoded SERVICE_TYPE_LABELS - labels are now managed in service_types table

function getVisualStage(daysUntil: number): RecurrenceVisualStage {
  if (daysUntil <= 0) return "pronto";
  if (daysUntil <= 30) return "proximo";
  return "futuro";
}

const PAGE_SIZE = 50;

function mapEntry(entry: any): RecurrenceClient | null {
  const client = entry.client;
  if (!client) return null;
  const now = new Date();
  const completedDate = new Date(entry.source_completed_date);
  const recurrenceDate = addMonths(completedDate, 6);
  const daysSince = differenceInDays(now, completedDate);
  const daysUntil = differenceInDays(recurrenceDate, now);
  const visualStage = getVisualStage(daysUntil);

  return {
    entryId: entry.id,
    clientId: client.id,
    clientName: client.name,
    phone: client.phone,
    whatsapp: client.whatsapp,
    lastServiceType: entry.source_service_type,
    lastServiceTypeFriendly: entry.source_service_type, // Fallback to slug, UI should map using useServiceTypes
    lastServiceDate: entry.source_completed_date,
    lastServiceValue: entry.source_value,
    daysSinceLastService: daysSince,
    recurrenceDate,
    daysUntilRecurrence: daysUntil,
    stage: visualStage,
    dbStage: entry.stage as RecurrenceStage,
    msg2mSentAt: entry.msg_2m_sent_at,
    msg4mSentAt: entry.msg_4m_sent_at,
    msg6mSentAt: entry.msg_6m_sent_at,
    msg8mSentAt: entry.msg_8m_sent_at,
    msg10mSentAt: entry.msg_10m_sent_at,
    msg12mSentAt: entry.msg_12m_sent_at,
    closedReason: entry.closed_reason,
  };
}

/**
 * Fetches recurrence stats (counts) using a lightweight query.
 */
export function useRecurrenceStats() {
  const { organization } = useOrganization();

  return useQuery({
    queryKey: ["recurrence-stats", organization?.id],
    queryFn: async (): Promise<RecurrenceStats> => {
      if (!organization?.id) {
        return { totalFuture: 0, totalProximo: 0, totalPronto: 0, totalActive: 0, potentialRevenue: 0, revenue60Days: 0, convertedThisMonth: 0 };
      }

      const { data, error } = await (supabase as any)
        .from("recurrence_entries")
        .select("source_completed_date, source_value")
        .eq("organization_id", organization.id)
        .eq("is_active", true);

      if (error) throw error;

      const now = new Date();
      let totalFuture = 0, totalProximo = 0, totalPronto = 0, potentialRevenue = 0, revenue60Days = 0;

      for (const entry of data || []) {
        const completedDate = new Date(entry.source_completed_date);
        const recurrenceDate = addMonths(completedDate, 6);
        const daysUntil = differenceInDays(recurrenceDate, now);

        if (daysUntil > 30) {
          totalFuture++;
        } else {
          if (daysUntil <= 0) totalPronto++;
          else totalProximo++;
          potentialRevenue += entry.source_value || 0;
        }
        if (daysUntil <= 60) revenue60Days += entry.source_value || 0;
      }

      return {
        totalFuture, totalProximo, totalPronto,
        totalActive: totalPronto + totalProximo,
        potentialRevenue, revenue60Days, convertedThisMonth: 0,
      };
    },
    enabled: !!organization?.id,
  });
}

/**
 * Paginated infinite query for recurrence clients.
 */
export function usePaginatedRecurrence(filter: "all" | "pronto" | "proximo" | "futuro" = "all") {
  const { organization } = useOrganization();

  return useInfiniteQuery({
    queryKey: ["recurrence-paginated", organization?.id, filter],
    queryFn: async ({ pageParam = 0 }): Promise<{ clients: RecurrenceClient[]; nextPage: number | null }> => {
      if (!organization?.id) return { clients: [], nextPage: null };

      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await (supabase as any)
        .from("recurrence_entries")
        .select(`
          id, client_id, source_service_type, source_completed_date, source_value, stage,
          msg_2m_sent_at, msg_4m_sent_at, msg_6m_sent_at,
          msg_8m_sent_at, msg_10m_sent_at, msg_12m_sent_at,
          next_action_date, closed_reason,
          client:clients(id, name, phone, whatsapp)
        `)
        .eq("organization_id", organization.id)
        .eq("is_active", true)
        .order("source_completed_date", { ascending: true })
        .range(from, to);

      if (error) throw error;

      const now = new Date();
      const clients: RecurrenceClient[] = [];

      for (const entry of data || []) {
        const mapped = mapEntry(entry);
        if (!mapped) continue;

        // Apply client-side filter
        if (filter !== "all" && mapped.stage !== filter) continue;
        clients.push(mapped);
      }

      // Sort: pronto first, then proximo, then futuro
      clients.sort((a, b) => {
        const order: Record<RecurrenceVisualStage, number> = { pronto: 0, proximo: 1, futuro: 2 };
        const diff = order[a.stage] - order[b.stage];
        return diff !== 0 ? diff : a.daysUntilRecurrence - b.daysUntilRecurrence;
      });

      const hasMore = (data?.length || 0) === PAGE_SIZE;
      return { clients, nextPage: hasMore ? pageParam + 1 : null };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: !!organization?.id,
  });
}

/**
 * Legacy hook for backward compatibility - now uses paginated approach internally
 * but returns first batch for stats computation.
 */
export function useRecurrence() {
  const { organization } = useOrganization();

  return useQuery({
    queryKey: ["recurrence-v4", organization?.id],
    queryFn: async (): Promise<{ clients: RecurrenceClient[]; stats: RecurrenceStats }> => {
      if (!organization?.id) {
        return { clients: [], stats: { totalFuture: 0, totalProximo: 0, totalPronto: 0, totalActive: 0, potentialRevenue: 0, revenue60Days: 0, convertedThisMonth: 0 } };
      }

      // Fetch stats from ALL active entries (lightweight - only 2 columns)
      const { data: statsData, error: statsError } = await (supabase as any)
        .from("recurrence_entries")
        .select("source_completed_date, source_value")
        .eq("organization_id", organization.id)
        .eq("is_active", true);

      if (statsError) throw statsError;

      const now = new Date();
      let totalFuture = 0, totalProximo = 0, totalPronto = 0, potentialRevenue = 0, revenue60Days = 0;
      for (const entry of statsData || []) {
        const completedDate = new Date(entry.source_completed_date);
        const recurrenceDate = addMonths(completedDate, 6);
        const daysUntil = differenceInDays(recurrenceDate, now);
        if (daysUntil > 30) totalFuture++;
        else { if (daysUntil <= 0) totalPronto++; else totalProximo++; potentialRevenue += entry.source_value || 0; }
        if (daysUntil <= 60) revenue60Days += entry.source_value || 0;
      }

      // Fetch first page of detailed entries
      const { data, error } = await (supabase as any)
        .from("recurrence_entries")
        .select(`
          id, client_id, source_service_type, source_completed_date, source_value, stage,
          msg_2m_sent_at, msg_4m_sent_at, msg_6m_sent_at,
          msg_8m_sent_at, msg_10m_sent_at, msg_12m_sent_at,
          next_action_date, closed_reason,
          client:clients(id, name, phone, whatsapp)
        `)
        .eq("organization_id", organization.id)
        .eq("is_active", true)
        .order("source_completed_date", { ascending: true })
        .range(0, PAGE_SIZE - 1);

      if (error) throw error;

      const results: RecurrenceClient[] = [];
      for (const entry of data || []) {
        const mapped = mapEntry(entry);
        if (mapped) results.push(mapped);
      }

      results.sort((a, b) => {
        const order: Record<RecurrenceVisualStage, number> = { pronto: 0, proximo: 1, futuro: 2 };
        const diff = order[a.stage] - order[b.stage];
        return diff !== 0 ? diff : a.daysUntilRecurrence - b.daysUntilRecurrence;
      });

      return {
        clients: results,
        stats: { totalFuture, totalProximo, totalPronto, totalActive: totalPronto + totalProximo, potentialRevenue, revenue60Days, convertedThisMonth: 0 },
      };
    },
    enabled: !!organization?.id,
  });
}

export function useRecurrenceConfig() {
  const { organization } = useOrganization();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["recurrence-config", organization?.id],
    queryFn: async (): Promise<RecurrenceConfig | null> => {
      if (!organization?.id) return null;

      const { data, error } = await (supabase as any)
        .from("recurrence_config")
        .select("*")
        .eq("organization_id", organization.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        automationEnabled: data.automation_enabled,
        dailyLimit: data.daily_limit,
        businessHoursStart: data.business_hours_start,
        businessHoursEnd: data.business_hours_end,
        message2Months: data.message_2_months || "",
        message4Months: data.message_4_months || "",
        message6Months: data.message_6_months || "",
        message8Months: data.message_8_months || "",
        message10Months: data.message_10_months || "",
        message12Months: data.message_12_months || "",
      };
    },
    enabled: !!organization?.id,
  });

  const toggleAutomation = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!organization?.id) throw new Error("No org");

      const { data: existing } = await (supabase as any)
        .from("recurrence_config")
        .select("id")
        .eq("organization_id", organization.id)
        .maybeSingle();

      if (existing) {
        await (supabase as any)
          .from("recurrence_config")
          .update({ automation_enabled: enabled, updated_at: new Date().toISOString() })
          .eq("organization_id", organization.id);
      } else {
        await (supabase as any)
          .from("recurrence_config")
          .insert({ organization_id: organization.id, automation_enabled: enabled });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurrence-config"] });
    },
  });

  return { config: query.data, isLoading: query.isLoading, toggleAutomation };
}
