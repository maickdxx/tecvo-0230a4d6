import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { buildTimestamp } from "@/lib/timezone";
import { format } from "date-fns";
export interface ScheduledMessage {
  id: string;
  contact_id: string;
  channel_id: string;
  content: string;
  scheduled_at: string;
  status: string;
  created_by: string;
  created_at: string;
  sent_at: string | null;
  error_message: string | null;
}

export function useScheduledMessages(contactId: string | null) {
  const { organization } = useOrganization();
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!contactId || !organization?.id) { setMessages([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("whatsapp_scheduled_messages")
      .select("*")
      .eq("contact_id", contactId)
      .eq("organization_id", organization.id)
      .in("status", ["scheduled"])
      .order("scheduled_at", { ascending: true });
    setMessages((data as any[]) || []);
    setLoading(false);
  }, [contactId, organization?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = useCallback(async (params: {
    contactId: string;
    channelId: string;
    content: string;
    scheduledAt: Date;
  }) => {
    if (!organization?.id) return null;
    const tz = organization.timezone || "America/Sao_Paulo";

    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;

    // Build timestamp with org timezone offset so UTC is correct
    const dateStr = format(params.scheduledAt, "yyyy-MM-dd");
    const timeStr = format(params.scheduledAt, "HH:mm:ss");
    const scheduledAtWithTz = buildTimestamp(dateStr, timeStr, tz);

    const { data, error } = await supabase
      .from("whatsapp_scheduled_messages")
      .insert({
        organization_id: organization.id,
        contact_id: params.contactId,
        channel_id: params.channelId,
        content: params.content,
        scheduled_at: scheduledAtWithTz,
        created_by: userId || "",
      })
      .select()
      .single();
    if (error) throw error;
    await fetch();
    return data;
  }, [organization?.id, organization?.timezone, fetch]);

  const update = useCallback(async (id: string, params: { content?: string; scheduledAt?: Date }) => {
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (params.content !== undefined) updates.content = params.content;
    if (params.scheduledAt) updates.scheduled_at = params.scheduledAt.toISOString();
    await supabase.from("whatsapp_scheduled_messages").update(updates).eq("id", id);
    await fetch();
  }, [fetch]);

  const cancel = useCallback(async (id: string) => {
    await supabase.from("whatsapp_scheduled_messages").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", id);
    await fetch();
  }, [fetch]);

  const pendingCount = messages.filter(m => m.status === "scheduled").length;

  return { messages, loading, create, update, cancel, refetch: fetch, pendingCount };
}
