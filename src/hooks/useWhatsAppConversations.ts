import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

const PAGE_SIZE = 50;

export function useWhatsAppConversations() {
  const { organization } = useOrganization();
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const offsetRef = useRef(0);

  // Fetch contacts by organization_id only — completely independent of channel state.
  // Conversations persist regardless of channel being connected, disconnected, deleted, or recreated.
  const fetchPage = useCallback(async (offset: number, append: boolean) => {
    if (!organization?.id) {
      if (!append) { setContacts([]); setLoading(false); }
      return;
    }

    const { data } = await supabase
      .from("whatsapp_contacts")
      .select("*, linked_client:linked_client_id(name), channel:channel_id(id, name, phone_number, is_connected, channel_status)")
      .eq("organization_id", organization.id)
      .eq("is_blocked", false)
      .eq("has_conversation", true)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .range(offset, offset + PAGE_SIZE - 1);

    const rows = data || [];
    if (append) {
      setContacts(prev => {
        const existingIds = new Set(prev.map(c => c.id));
        const newRows = rows.filter(r => !existingIds.has(r.id));
        return [...prev, ...newRows];
      });
    } else {
      setContacts(rows);
    }
    setHasMore(rows.length === PAGE_SIZE);
    offsetRef.current = offset + rows.length;
  }, [organization?.id]);

  // Initial fetch
  const fetchContacts = useCallback(async () => {
    setLoading(true);
    offsetRef.current = 0;
    await fetchPage(0, false);
    setLoading(false);
  }, [fetchPage]);

  // Load more (infinite scroll)
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await fetchPage(offsetRef.current, true);
    setLoadingMore(false);
  }, [loadingMore, hasMore, fetchPage]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  // Helper: apply contact update + immediate sort
  const applyContactUpdate = useCallback((contactId: string, fields: Record<string, any>) => {
    setContacts(prev => {
      const idx = prev.findIndex(c => c.id === contactId);
      if (idx < 0) return prev;
      const merged = { ...prev[idx], ...fields };
      if (prev[idx].last_message_at === merged.last_message_at &&
          prev[idx].is_unread === merged.is_unread &&
          prev[idx].unread_count === merged.unread_count &&
          prev[idx].conversation_status === merged.conversation_status &&
          prev[idx].conversion_status === merged.conversion_status &&
          prev[idx].assigned_to === merged.assigned_to &&
          prev[idx].is_private === merged.is_private &&
          prev[idx].last_message_content === merged.last_message_content) {
        return prev;
      }
      const newList = [...prev];
      newList[idx] = merged;
      // Don't re-sort here to preserve scroll position
      return newList;
    });
  }, []);

  // Realtime subscription
  useEffect(() => {
    if (!organization?.id) return;

    const channel = supabase
      .channel("whatsapp-contacts-realtime")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "whatsapp_contacts",
        filter: `organization_id=eq.${organization.id}`,
      }, (payload) => {
        const newContact = payload.new as any;
        if (newContact.is_blocked || !newContact.has_conversation) return;
        setContacts(prev => {
          if (prev.some(c => c.id === newContact.id)) return prev;
          return [newContact, ...prev];
        });
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "whatsapp_contacts",
        filter: `organization_id=eq.${organization.id}`,
      }, (payload) => {
        const updated = payload.new as any;
        if (updated.has_conversation && !updated.is_blocked) {
          setContacts(prev => {
            if (prev.some(c => c.id === updated.id)) {
              // Use applyContactUpdate logic inline to avoid unnecessary re-renders
              const idx = prev.findIndex(c => c.id === updated.id);
              const current = prev[idx];
              // Only update if something meaningful changed
              if (current.last_message_at === updated.last_message_at &&
                  current.is_unread === updated.is_unread &&
                  current.unread_count === updated.unread_count &&
                  current.conversation_status === updated.conversation_status &&
                  current.conversion_status === updated.conversion_status &&
                  current.assigned_to === updated.assigned_to &&
                  current.is_private === updated.is_private &&
                  current.last_message_content === updated.last_message_content &&
                  current.name === updated.name &&
                  current.tags === updated.tags) {
                return prev; // No change — preserve array reference & scroll
              }
              const newList = [...prev];
              // Preserve joined fields not present in realtime payload
              newList[idx] = { ...current, ...updated, linked_client: current.linked_client, channel: current.channel };
              return newList;
            }
            // New conversation, add to top
            return [updated, ...prev];
          });
        } else {
          // Contact was blocked or no longer has conversation — remove from list
          setContacts(prev => prev.filter(c => c.id !== updated.id));
        }
      })
      .on("postgres_changes", {
        event: "DELETE",
        schema: "public",
        table: "whatsapp_contacts",
        filter: `organization_id=eq.${organization.id}`,
      }, (payload) => {
        const deleted = payload.old as any;
        setContacts(prev => prev.filter(c => c.id !== deleted.id));
      })
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "whatsapp_messages",
        filter: `organization_id=eq.${organization.id}`,
      }, (payload) => {
        const msg = payload.new as any;
        if (!msg.contact_id) return;
        const msgTs = msg.timestamp || msg.created_at;
        const previewContent = msg.content
          ? msg.content.substring(0, 200)
          : msg.media_type
            ? `[${msg.media_type === "image" ? "Imagem" : msg.media_type === "video" ? "Vídeo" : msg.media_type === "audio" ? "Áudio" : "Documento"}]`
            : "";
        setContacts(prev => {
          const idx = prev.findIndex(c => c.id === msg.contact_id);
          if (idx < 0) return prev;
          const current = prev[idx];
          const currentTs = current.last_message_at ? new Date(current.last_message_at).getTime() : 0;
          const newTs = msgTs ? new Date(msgTs).getTime() : 0;
          if (currentTs > newTs) return prev;
          const merged = {
            ...current,
            last_message_at: msgTs,
            last_message_content: previewContent,
            last_message_is_from_me: msg.is_from_me ?? false,
            ...(msg.is_from_me ? {} : { is_unread: true, unread_count: ((current.unread_count as number) || 0) + 1 }),
          };
          const newList = [...prev];
          newList.splice(idx, 1);
          // Move conversation to top so latest activity is always visible
          newList.unshift(merged);
          return newList;
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [organization?.id, applyContactUpdate]);

  // Local filtering
  const [dbSearchResults, setDbSearchResults] = useState<string[] | null>(null);
  const [searching, setSearching] = useState(false);

  const normalizeDigits = (s: string) => (s || "").replace(/\D/g, "");

  const contactMatchesTerm = useCallback((c: any, term: string) => {
    const termDigits = normalizeDigits(term);
    const nameMatch = (c.name || "").toLowerCase().includes(term);
    const linkedNameMatch = (c.linked_client?.name || "").toLowerCase().includes(term);
    const contentMatch = (c.last_message_content || "").toLowerCase().includes(term);
    const phoneMatch = termDigits.length >= 3 && normalizeDigits(c.phone).includes(termDigits);
    return nameMatch || linkedNameMatch || contentMatch || phoneMatch;
  }, []);

  useEffect(() => {
    const term = searchTerm.trim().toLowerCase();
    if (term.length < 3) {
      setDbSearchResults(null);
      return;
    }
    const localHasMatches = contacts.some(c => contactMatchesTerm(c, term));
    if (localHasMatches) {
      setDbSearchResults(null);
      return;
    }
    setSearching(true);
    const searchMessages = async () => {
      const { data } = await supabase
        .from("whatsapp_messages")
        .select("contact_id")
        .eq("organization_id", organization?.id || "")
        .ilike("content", `%${term}%`)
        .limit(50);
      setDbSearchResults(data ? [...new Set(data.map(m => m.contact_id))] : null);
      setSearching(false);
    };
    const debounce = setTimeout(searchMessages, 400);
    return () => clearTimeout(debounce);
  }, [searchTerm, contacts, organization?.id, contactMatchesTerm]);

  const filteredContacts = useMemo(() => {
    if (!searchTerm.trim()) return contacts;
    const term = searchTerm.toLowerCase();
    const localMatches = contacts.filter(c => contactMatchesTerm(c, term));
    if (localMatches.length > 0) return localMatches;
    if (dbSearchResults) {
      const dbMatches = contacts.filter(c => dbSearchResults.includes(c.id));
      return dbMatches.length > 0 ? dbMatches : localMatches;
    }
    return localMatches;
  }, [searchTerm, contacts, dbSearchResults, contactMatchesTerm]);

  const markAsRead = useCallback(async (contactId: string) => {
    setContacts(prev => prev.map(c => {
      if (c.id !== contactId) return c;
      return { ...c, is_unread: false, unread_count: 0 };
    }));
    
    await supabase
      .from("whatsapp_contacts")
      .update({ is_unread: false, unread_count: 0 })
      .eq("id", contactId);
  }, []);

  const promoteToAtendendo = useCallback(async (contactId: string) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;
    
    const currentConvStatus = contact.conversation_status || "novo";
    const currentPipelineStatus = contact.conversion_status || "lead_novo";
    
    // Only promote if still in initial state
    if (currentConvStatus !== "novo" && currentPipelineStatus !== "lead_novo") return;
    
    const updates: Record<string, any> = {};
    const optimisticFields: Record<string, any> = {};
    
    if (currentConvStatus === "novo") {
      updates.conversation_status = "atendendo";
      optimisticFields.conversation_status = "atendendo";
    }
    if (currentPipelineStatus === "lead_novo") {
      updates.conversion_status = "em_atendimento";
      optimisticFields.conversion_status = "em_atendimento";
    }
    
    if (Object.keys(updates).length === 0) return;
    
    setContacts(prev => prev.map(c =>
      c.id === contactId ? { ...c, ...optimisticFields } : c
    ));
    await supabase
      .from("whatsapp_contacts")
      .update(updates)
      .eq("id", contactId);
  }, [contacts]);

  const markAsUnread = useCallback(async (contactId: string) => {
    setContacts(prev => prev.map(c =>
      c.id === contactId ? { ...c, is_unread: true, unread_count: Math.max(c.unread_count || 0, 1) } : c
    ));
    await supabase
      .from("whatsapp_contacts")
      .update({ is_unread: true, unread_count: 1 })
      .eq("id", contactId);
  }, []);

  const finalizeConversation = useCallback(async (contactId: string) => {
    setContacts(prev => prev.map(c =>
      c.id === contactId ? { ...c, conversation_status: "resolvido" } : c
    ));
    await supabase
      .from("whatsapp_contacts")
      .update({ conversation_status: "resolvido" })
      .eq("id", contactId);
  }, []);

  const deleteConversation = useCallback(async (contactId: string) => {
    if (!organization?.id) return;
    setContacts(prev => prev.filter(c => c.id !== contactId));
    await supabase
      .from("whatsapp_messages")
      .delete()
      .eq("contact_id", contactId)
      .eq("organization_id", organization.id);
    await supabase
      .from("whatsapp_contacts")
      .delete()
      .eq("id", contactId)
      .eq("organization_id", organization.id);
  }, [organization?.id]);

  const moveContactToTop = useCallback((contactId: string, lastMessageContent?: string) => {
    setContacts(prev => {
      const idx = prev.findIndex(c => c.id === contactId);
      if (idx <= 0) return prev; // already at top or not found
      const newList = [...prev];
      const [contact] = newList.splice(idx, 1);
      const updated = {
        ...contact,
        last_message_at: new Date().toISOString(),
        last_message_is_from_me: true,
        ...(lastMessageContent ? { last_message_content: lastMessageContent.substring(0, 200) } : {}),
      };
      newList.unshift(updated);
      return newList;
    });
  }, []);

  return {
    contacts: filteredContacts,
    loading: loading || searching,
    loadingMore,
    hasMore,
    loadMore,
    searchTerm,
    setSearchTerm,
    markAsRead,
    markAsUnread,
    finalizeConversation,
    deleteConversation,
    moveContactToTop,
    promoteToAtendendo,
    refetch: fetchContacts,
  };
}
