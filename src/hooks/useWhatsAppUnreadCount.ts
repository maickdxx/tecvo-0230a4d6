import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

export function useWhatsAppUnreadCount() {
  const { organization } = useOrganization();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!organization?.id) return;

    const fetchUnread = async () => {
      // Get CUSTOMER_INBOX / WEBCHAT channel IDs
      const { data: channels } = await supabase
        .from("whatsapp_channels")
        .select("id")
        .eq("organization_id", organization.id)
        .in("channel_type", ["CUSTOMER_INBOX", "WEBCHAT"]);

      const channelIds = (channels || []).map((c: any) => c.id);
      if (channelIds.length === 0) { setUnreadCount(0); return; }

      // Count conversations (not messages) with unread_count > 0, excluding finalized
      const { count, error } = await supabase
        .from("whatsapp_contacts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organization.id)
        .in("channel_id", channelIds)
        .eq("is_blocked", false)
        .eq("has_conversation", true)
        .gt("unread_count", 0)
        .neq("conversation_status", "resolvido");

      setUnreadCount(error ? 0 : (count || 0));
    };

    fetchUnread();

    const channel = supabase
      .channel("whatsapp-unread-global")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "whatsapp_contacts",
        filter: `organization_id=eq.${organization.id}`,
      }, () => {
        fetchUnread();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [organization?.id]);

  return unreadCount;
}
