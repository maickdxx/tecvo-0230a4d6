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
  // has_conversation=false is ONLY used for explicit user "delete conversation" action.
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
      .not("last_message_at", "is", null)
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
        if (newContact.is_blocked) return;
        // Only add to list if it has message history
        if (!newContact.last_message_at) return;
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
        if (updated.is_blocked) {
          // Contact was blocked — remove from list
          setContacts(prev => prev.filter(c => c.id !== updated.id));
          return;
        }
        setContacts(prev => {
          if (prev.some(c => c.id === updated.id)) {
            const idx = prev.findIndex(c => c.id === updated.id);
            const current = prev[idx];
            if (current.last_message_at === updated.last_message_at &&
                current.is_unread === updated.is_unread &&
                current.unread_count === updated.unread_count &&
                current.conversation_status === updated.conversation_status &&
                current.conversion_status === updated.conversion_status &&
                current.assigned_to === updated.assigned_to &&
                current.is_private === updated.is_private &&
                current.last_message_content === updated.last_message_content &&
                current.name === updated.name &&
                current.tags === updated.tags &&
                current.channel_id === updated.channel_id) {
              return prev;
            }
            const newList = [...prev];
            const channelChanged = current.channel_id !== updated.channel_id;
            newList[idx] = {
              ...current,
              ...updated,
              linked_client: current.linked_client,
              channel: channelChanged ? null : current.channel,
            };
            if (channelChanged) {
              setTimeout(() => fetchContacts(), 500);
            }
            return newList;
          }
          // New conversation with messages, add to top
          if (updated.last_message_at) {
            return [updated, ...prev];
          }
          return prev;
        });
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
          if (idx < 0) {
            // Contact not in list yet — trigger refetch to bring it in
            setTimeout(() => fetchContacts(), 300);
            return prev;
          }
          const current = prev[idx];
          const currentTs = current.last_message_at ? new Date(current.last_message_at).getTime() : 0;
          const newTs = msgTs ? new Date(msgTs).getTime() : 0;
          if (currentTs > newTs) return prev;
          const merged = {
            ...current,
            last_message_at: msgTs,
            last_message_content: previewContent,
            last_message_is_from_me: msg.is_from_me ?? false,
            ...(msg.is_from_me
              ? { is_unread: false, unread_count: 0 }
              : { is_unread: true, unread_count: ((current.unread_count as number) || 0) + 1 }),
          };
          const newList = [...prev];
          newList.splice(idx, 1);
          newList.unshift(merged);
          return newList;
        });
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "whatsapp_channels",
      }, (payload) => {
        const updated = payload.new as any;
        setContacts(prev => {
          let changed = false;
          const newList = prev.map(c => {
            if (c.channel_id === updated.id && c.channel) {
              const newChannel = {
                ...c.channel,
                is_connected: updated.is_connected,
                channel_status: updated.channel_status,
                phone_number: updated.phone_number || c.channel.phone_number,
              };
              if (c.channel.is_connected !== newChannel.is_connected ||
                  c.channel.channel_status !== newChannel.channel_status) {
                changed = true;
                return { ...c, channel: newChannel };
              }
            }
            return c;
          });
          return changed ? newList : prev;
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [organization?.id, applyContactUpdate]);

  // Search: local + DB fallback for contacts AND messages
  const [dbSearchResults, setDbSearchResults] = useState<any[] | null>(null);
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
    const searchDb = async () => {
      const termDigits = normalizeDigits(term);
      
      // Search contacts directly in DB (all contacts with message history, regardless of status)
      const contactSearchPromise = supabase
        .from("whatsapp_contacts")
        .select("*, linked_client:linked_client_id(name), channel:channel_id(id, name, phone_number, is_connected, channel_status)")
        .eq("organization_id", organization?.id || "")
        .eq("is_blocked", false)
        .not("last_message_at", "is", null)
        .or(`name.ilike.%${term}%,phone.ilike.%${term}%`)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(50);

      // Also search messages for content matches
      const messageSearchPromise = supabase
        .from("whatsapp_messages")
        .select("contact_id")
        .eq("organization_id", organization?.id || "")
        .ilike("content", `%${term}%`)
        .limit(50);

      const [contactRes, messageRes] = await Promise.all([contactSearchPromise, messageSearchPromise]);
      
      const dbContacts = contactRes.data || [];
      const messageContactIds = messageRes.data ? [...new Set(messageRes.data.map(m => m.contact_id))] : [];
      
      // For message matches not already in dbContacts, fetch those contacts too
      const dbContactIds = new Set(dbContacts.map(c => c.id));
      const missingIds = messageContactIds.filter(id => !dbContactIds.has(id));
      
      let allResults = [...dbContacts];
      
      if (missingIds.length > 0) {
        const { data: msgContacts } = await supabase
          .from("whatsapp_contacts")
          .select("*, linked_client:linked_client_id(name), channel:channel_id(id, name, phone_number, is_connected, channel_status)")
          .in("id", missingIds)
          .eq("is_blocked", false);
        if (msgContacts) {
          allResults = [...allResults, ...msgContacts];
        }
      }
      
      setDbSearchResults(allResults);
      setSearching(false);
    };
    const debounce = setTimeout(searchDb, 400);
    return () => clearTimeout(debounce);
  }, [searchTerm, contacts, organization?.id, contactMatchesTerm]);

  const filteredContacts = useMemo(() => {
    if (!searchTerm.trim()) return contacts;
    const term = searchTerm.toLowerCase();
    const localMatches = contacts.filter(c => contactMatchesTerm(c, term));
    if (localMatches.length > 0) return localMatches;
    // Use full DB search results (already include joined data)
    if (dbSearchResults && dbSearchResults.length > 0) {
      // Merge: prefer in-memory version, add DB-only results
      const inMemoryIds = new Set(contacts.map(c => c.id));
      const dbOnly = dbSearchResults.filter(c => !inMemoryIds.has(c.id));
      const inMemoryMatches = contacts.filter(c => dbSearchResults.some(d => d.id === c.id));
      return [...inMemoryMatches, ...dbOnly];
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
    const currentPipelineStatus = contact.conversion_status || "novo_contato";
    
    // Skip if already "atendendo" and pipeline is past initial stage
    if (currentConvStatus === "atendendo" && currentPipelineStatus !== "novo_contato") return;
    
    const updates: Record<string, any> = {};
    const optimisticFields: Record<string, any> = {};
    
    // Reopen resolved/finalized conversations — only change conversation_status, preserve pipeline
    if (currentConvStatus === "novo" || currentConvStatus === "resolvido" || currentConvStatus === "resolved") {
      updates.conversation_status = "atendendo";
      optimisticFields.conversation_status = "atendendo";
    }
    
    // Only promote pipeline if it's at the very first stage (novo_contato)
    if (currentPipelineStatus === "novo_contato") {
      updates.conversion_status = "qualificacao";
      optimisticFields.conversion_status = "qualificacao";
    }
    // When reopening from resolvido, do NOT reset pipeline — preserve the existing stage
    
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

  // Finalize: only change status, NEVER hide the conversation
  const finalizeConversation = useCallback(async (contactId: string) => {
    setContacts(prev => prev.map(c =>
      c.id === contactId ? { ...c, conversation_status: "resolvido" } : c
    ));
    await supabase
      .from("whatsapp_contacts")
      .update({ conversation_status: "resolvido" })
      .eq("id", contactId);
  }, []);

  // Delete: explicit user action to hide conversation from list (soft delete)
  const deleteConversation = useCallback(async (contactId: string) => {
    if (!organization?.id) return;
    setContacts(prev => prev.filter(c => c.id !== contactId));
    await supabase
      .from("whatsapp_contacts")
      .update({ has_conversation: false, conversation_status: "resolvido" })
      .eq("id", contactId)
      .eq("organization_id", organization.id);
  }, [organization?.id]);

  const moveContactToTop = useCallback((contactId: string, lastMessageContent?: string) => {
    setContacts(prev => {
      const idx = prev.findIndex(c => c.id === contactId);
      if (idx < 0) return prev;
      
      const newList = [...prev];
      const contact = newList[idx];
      const updated = {
        ...contact,
        last_message_at: new Date().toISOString(),
        last_message_is_from_me: true,
        is_unread: false,
        unread_count: 0,
        ...(lastMessageContent ? { last_message_content: lastMessageContent.substring(0, 200) } : {}),
      };
      
      // If it's already at the top and content didn't change, return the same array to prevent re-render
      if (idx === 0 && 
          prev[0].last_message_content === updated.last_message_content && 
          prev[0].last_message_is_from_me === updated.last_message_is_from_me) {
        return prev;
      }

      newList.splice(idx, 1);
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
