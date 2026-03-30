import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

export interface OrphanedRecurrenceContact {
  recurrenceEntryId: string;
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  whatsappContactId: string | null;
  channelId: string | null;
  channelName: string | null;
  channelStatus: string | null;
  blockReason: string;
  lastServiceType: string;
  lastServiceDate: string;
  lastServiceValue: number | null;
}

export interface OrphanedGroup {
  channelId: string | null;
  channelName: string;
  channelStatus: string;
  contacts: OrphanedRecurrenceContact[];
}

export function useOrphanedRecurrenceContacts() {
  const { organization } = useOrganization();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["orphaned-recurrence", organization?.id],
    queryFn: async (): Promise<{ groups: OrphanedGroup[]; total: number }> => {
      if (!organization?.id) return { groups: [], total: 0 };

      // 1. Get all active recurrence entries with client info
      const { data: entries, error: entriesErr } = await (supabase as any)
        .from("recurrence_entries")
        .select(`
          id, client_id, source_service_type, source_completed_date, source_value,
          client:clients(id, name, phone, whatsapp)
        `)
        .eq("organization_id", organization.id)
        .eq("is_active", true);

      if (entriesErr) throw entriesErr;
      if (!entries || entries.length === 0) return { groups: [], total: 0 };

      // 2. Get all whatsapp_contacts for this org (linked to clients)
      const clientIds = Array.from(new Set<string>(entries.map((e: any) => String(e.client_id))));
      const { data: waContacts, error: waErr } = await supabase
        .from("whatsapp_contacts")
        .select("id, linked_client_id, channel_id, normalized_phone")
        .eq("organization_id", organization.id)
        .in("linked_client_id", clientIds);

      if (waErr) throw waErr;

      // 2b. Get transition history to recover old channel names for contacts with null channel_id
      const waContactIds = (waContacts || []).map(wc => wc.id);
      let transitionMap = new Map<string, string>(); // contact_id -> previous_channel_id
      if (waContactIds.length > 0) {
        const { data: transitions } = await (supabase as any)
          .from("whatsapp_channel_transitions")
          .select("contact_id, previous_channel_id, created_at")
          .eq("organization_id", organization.id)
          .in("contact_id", waContactIds)
          .order("created_at", { ascending: false });

        if (transitions) {
          for (const t of transitions) {
            // Keep only the most recent transition per contact (already sorted desc)
            if (t.previous_channel_id && !transitionMap.has(t.contact_id)) {
              transitionMap.set(t.contact_id, t.previous_channel_id);
            }
          }
        }
      }

      // 3. Get all channels for this org (including deleted ones for name reference)
      const { data: allChannels, error: chErr } = await supabase
        .from("whatsapp_channels")
        .select("id, name, channel_status, is_connected, phone_number")
        .eq("organization_id", organization.id);

      if (chErr) throw chErr;

      const channelMap = new Map<string, any>();
      for (const ch of allChannels || []) {
        channelMap.set(ch.id, ch);
      }

      // 4. Build a map: clientId -> best whatsapp_contact
      const clientContactMap = new Map<string, any>();
      for (const wc of waContacts || []) {
        if (!wc.linked_client_id) continue;
        const existing = clientContactMap.get(wc.linked_client_id);
        // Prefer the one with a channel_id
        if (!existing || (wc.channel_id && !existing.channel_id)) {
          clientContactMap.set(wc.linked_client_id, wc);
        }
      }

      // 5. Identify orphaned contacts
      const orphaned: OrphanedRecurrenceContact[] = [];

      for (const entry of entries) {
        const client = entry.client;
        if (!client) continue;

        const waContact = clientContactMap.get(client.id);

        let isOrphaned = false;
        let blockReason = "";
        let channelId: string | null = null;
        let channelName: string | null = null;
        let channelStatus: string | null = null;

        if (!waContact || !waContact.channel_id) {
          // No whatsapp contact or no channel linked
          isOrphaned = true;
          blockReason = "Sem canal vinculado";
        } else {
          channelId = waContact.channel_id;
          const channel = channelMap.get(waContact.channel_id);

          if (!channel) {
            isOrphaned = true;
            blockReason = "Canal excluído";
            channelName = "Canal removido";
            channelStatus = "deleted";
          } else {
            channelName = channel.name;
            channelStatus = channel.channel_status;

            if (channel.channel_status === "deleted") {
              isOrphaned = true;
              blockReason = "Canal excluído";
            } else if (!channel.is_connected || channel.channel_status === "disconnected") {
              isOrphaned = true;
              blockReason = "Canal desconectado";
            } else if (channel.channel_status === "error") {
              isOrphaned = true;
              blockReason = "Canal com erro";
            }
          }
        }

        if (isOrphaned) {
          orphaned.push({
            recurrenceEntryId: entry.id,
            clientId: client.id,
            clientName: client.name,
            clientPhone: client.phone || client.whatsapp,
            whatsappContactId: waContact?.id || null,
            channelId,
            channelName,
            channelStatus,
            blockReason,
            lastServiceType: entry.source_service_type,
            lastServiceDate: entry.source_completed_date,
            lastServiceValue: entry.source_value,
          });
        }
      }

      // 6. Group by old channel
      const groupMap = new Map<string, OrphanedGroup>();

      for (const contact of orphaned) {
        const key = contact.channelId || "no-channel";
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            channelId: contact.channelId,
            channelName: contact.channelName || "Sem canal",
            channelStatus: contact.channelStatus || "unknown",
            contacts: [],
          });
        }
        groupMap.get(key)!.contacts.push(contact);
      }

      return {
        groups: Array.from(groupMap.values()).sort((a, b) => b.contacts.length - a.contacts.length),
        total: orphaned.length,
      };
    },
    enabled: !!organization?.id,
    staleTime: 60_000,
  });

  const reassignMutation = useMutation({
    mutationFn: async ({
      contactIds,
      newChannelId,
    }: {
      contactIds: string[];
      newChannelId: string;
    }) => {
      if (!organization?.id) throw new Error("Sem organização");

      // Get old channel info for audit
      const { data: contacts } = await supabase
        .from("whatsapp_contacts")
        .select("id, channel_id")
        .in("id", contactIds);

      // Update channel_id on whatsapp_contacts
      const { error } = await supabase
        .from("whatsapp_contacts")
        .update({ channel_id: newChannelId, updated_at: new Date().toISOString() })
        .in("id", contactIds);

      if (error) throw error;

      // Log audit (best-effort, don't block on failure)
      const oldChannelIds = [...new Set((contacts || []).map(c => c.channel_id).filter(Boolean))];
      try {
        await (supabase as any).from("data_audit_log").insert({
          organization_id: organization.id,
          table_name: "whatsapp_contacts",
          operation: "recurrence_channel_reassign",
          metadata: {
            old_channel_ids: oldChannelIds,
            new_channel_id: newChannelId,
            contact_ids: contactIds,
            count: contactIds.length,
          },
        });
      } catch (auditErr) {
        console.warn("[RECURRENCE] Audit log failed (non-blocking):", auditErr);
      }

      return { count: contactIds.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orphaned-recurrence"] });
      queryClient.invalidateQueries({ queryKey: ["recurrence-stats"] });
      queryClient.invalidateQueries({ queryKey: ["recurrence-paginated"] });
    },
  });

  return {
    groups: query.data?.groups ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    reassign: reassignMutation.mutateAsync,
    isReassigning: reassignMutation.isPending,
  };
}
