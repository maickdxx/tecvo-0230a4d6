import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

export function useWhatsAppMessages(contactId: string | null) {
  const { organization } = useOrganization();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const lastFetchRef = useRef<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!contactId || !organization?.id) {
      setMessages([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("whatsapp_messages")
      .select("*")
      .eq("contact_id", contactId)
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(200);

    const normalizedData = [...(data || [])].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    setMessages(prev => {
      // Merge: keep optimistic messages not yet confirmed
      const realIds = new Set(normalizedData.map((m: any) => m.id));
      const realMessageIds = new Set(normalizedData.map((m: any) => m.message_id).filter(Boolean));
      const pendingOptimistic = prev.filter(m => 
        m._optimistic && 
        !realIds.has(m.id) && 
        !(m.message_id && realMessageIds.has(m.message_id))
      );
      return [...normalizedData, ...pendingOptimistic].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });
    setLoading(false);

    // Track newest known message timestamp for polling fallback
    const latestCreatedAt = normalizedData.length > 0
      ? normalizedData[normalizedData.length - 1].created_at
      : new Date().toISOString();
    lastFetchRef.current = latestCreatedAt;
  }, [contactId, organization?.id]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // Realtime subscription for messages (INSERT, UPDATE, DELETE)
  useEffect(() => {
    if (!contactId || !organization?.id) return;

    const channel = supabase
      .channel(`whatsapp-messages-${contactId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "whatsapp_messages",
        filter: `contact_id=eq.${contactId}`,
      }, (payload) => {
        const newMsg = payload.new as any;
        setMessages(prev => {
          // Replace optimistic message with real one (match by message_id)
          const optimisticIdx = prev.findIndex(m => m._optimistic && m.message_id === newMsg.message_id);
          if (optimisticIdx >= 0) {
            const updated = [...prev];
            updated[optimisticIdx] = newMsg;
            return updated;
          }
          // Skip if already exists (by id or message_id)
          if (prev.some(m => m.id === newMsg.id || (m.message_id && m.message_id === newMsg.message_id))) {
            return prev;
          }
          // Also skip if there's a recently sent optimistic message with similar content (within 10s)
          const now = Date.now();
          if (newMsg.is_from_me && prev.some(m => 
            m._optimistic && 
            m.is_from_me && 
            Math.abs(now - new Date(m.created_at).getTime()) < 10000 &&
            (m.content || "").replace(/\*(.*?)\*/g, '$1') === (newMsg.content || "").replace(/\*(.*?)\*/g, '$1')
          )) {
            return prev.map(m => {
              if (m._optimistic && m.is_from_me && 
                  (m.content || "").replace(/\*(.*?)\*/g, '$1') === (newMsg.content || "").replace(/\*(.*?)\*/g, '$1')) {
                return newMsg;
              }
              return m;
            });
          }
          return [...prev, newMsg];
        });
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "whatsapp_messages",
        filter: `contact_id=eq.${contactId}`,
      }, (payload) => {
        const updated = payload.new as any;
        setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
      })
      .on("postgres_changes", {
        event: "DELETE",
        schema: "public",
        table: "whatsapp_messages",
        filter: `contact_id=eq.${contactId}`,
      }, (payload) => {
        const deleted = payload.old as any;
        // Preserve chat timeline context: convert locally to deleted state instead of removing bubble
        setMessages(prev => prev.map(m =>
          m.id === deleted.id
            ? { ...m, status: "deleted", content: "" }
            : m
        ));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [contactId, organization?.id]);

  // Polling fallback every 8s to catch missed realtime events
  useEffect(() => {
    if (!contactId || !organization?.id) return;

    const poll = async () => {
      if (!lastFetchRef.current) return;
      const { data } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("contact_id", contactId)
        .eq("organization_id", organization.id)
        .gt("created_at", lastFetchRef.current)
        .order("created_at", { ascending: true });
      
      if (data && data.length > 0) {
        setMessages(prev => {
          let updated = [...prev];
          for (const newMsg of data) {
            const existsIdx = updated.findIndex(m => m.id === newMsg.id);
            if (existsIdx >= 0) {
              updated[existsIdx] = newMsg;
              continue;
            }
            // Replace optimistic
            const optIdx = updated.findIndex(m => m._optimistic && m.message_id === newMsg.message_id);
            if (optIdx >= 0) {
              updated[optIdx] = newMsg;
              continue;
            }
            if (!updated.some(m => m.message_id && m.message_id === newMsg.message_id)) {
              updated.push(newMsg);
            }
          }
          return updated.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        });
        lastFetchRef.current = data[data.length - 1].created_at;
      }
    };

    pollIntervalRef.current = setInterval(poll, 8000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [contactId, organization?.id]);

  /** Add an optimistic message to the list (appears instantly) */
  const addOptimisticMessage = useCallback((msg: any) => {
    setMessages(prev => [...prev, { ...msg, _optimistic: true }]);
  }, []);

  /** Update an optimistic message status (e.g. pending → sent or failed) */
  const updateOptimisticMessage = useCallback((messageId: string, updates: Record<string, any>) => {
    setMessages(prev => prev.map(m =>
      m.message_id === messageId ? { ...m, ...updates } : m
    ));
  }, []);

  return { messages, loading, refetch: fetchMessages, addOptimisticMessage, updateOptimisticMessage };
}
