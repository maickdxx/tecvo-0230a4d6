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

const normalizePhone = (raw?: string | null) => {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55")) return digits;
  if (digits.length <= 11) return `55${digits}`;
  return digits;
};

export function useOrphanedRecurrenceContacts() {
  const { organization } = useOrganization();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["orphaned-recurrence", organization?.id],
    queryFn: async (): Promise<{ groups: OrphanedGroup[]; total: number }> => {
      if (!organization?.id) return { groups: [], total: 0 };

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

      const clientIds = Array.from(new Set<string>(entries.map((e: any) => String(e.client_id))));
      const normalizedClientPhones = Array.from(
        new Set(
          entries
            .map((entry: any) => normalizePhone(entry.client?.whatsapp || entry.client?.phone))
            .filter(Boolean) as string[]
        )
      );

      const [linkedContactsResult, phoneMatchedContactsResult, channelsResult] = await Promise.all([
        supabase
          .from("whatsapp_contacts")
          .select("id, linked_client_id, channel_id, normalized_phone")
          .eq("organization_id", organization.id)
          .in("linked_client_id", clientIds),
        normalizedClientPhones.length > 0
          ? supabase
              .from("whatsapp_contacts")
              .select("id, linked_client_id, channel_id, normalized_phone")
              .eq("organization_id", organization.id)
              .in("normalized_phone", normalizedClientPhones)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("whatsapp_channels")
          .select("id, name, channel_status, is_connected, phone_number")
          .eq("organization_id", organization.id),
      ]);

      if (linkedContactsResult.error) throw linkedContactsResult.error;
      if (phoneMatchedContactsResult.error) throw phoneMatchedContactsResult.error;
      if (channelsResult.error) throw channelsResult.error;

      const waContacts = [
        ...(linkedContactsResult.data || []),
        ...(phoneMatchedContactsResult.data || []),
      ].filter(
        (contact, index, arr) => arr.findIndex((item) => item.id === contact.id) === index
      );

      const waContactIds = waContacts.map((wc) => wc.id);
      const transitionMap = new Map<string, string>();
      if (waContactIds.length > 0) {
        const { data: transitions } = await (supabase as any)
          .from("whatsapp_channel_transitions")
          .select("contact_id, previous_channel_id, created_at")
          .eq("organization_id", organization.id)
          .in("contact_id", waContactIds)
          .order("created_at", { ascending: false });

        if (transitions) {
          for (const transition of transitions) {
            if (transition.previous_channel_id && !transitionMap.has(transition.contact_id)) {
              transitionMap.set(transition.contact_id, transition.previous_channel_id);
            }
          }
        }
      }

      const channelMap = new Map<string, any>();
      for (const channel of channelsResult.data || []) {
        channelMap.set(channel.id, channel);
      }

      const clientContactMap = new Map<string, any>();
      const phoneContactMap = new Map<string, any>();

      for (const wc of waContacts) {
        if (wc.linked_client_id) {
          const existing = clientContactMap.get(wc.linked_client_id);
          if (!existing || (wc.channel_id && !existing.channel_id)) {
            clientContactMap.set(wc.linked_client_id, wc);
          }
        }

        if (wc.normalized_phone) {
          const existing = phoneContactMap.get(wc.normalized_phone);
          if (!existing || (wc.channel_id && !existing.channel_id)) {
            phoneContactMap.set(wc.normalized_phone, wc);
          }
        }
      }

      const orphaned: OrphanedRecurrenceContact[] = [];

      for (const entry of entries) {
        const client = entry.client;
        if (!client) continue;

        const normalizedClientPhone = normalizePhone(client.whatsapp || client.phone);
        const waContact =
          clientContactMap.get(client.id) ||
          (normalizedClientPhone ? phoneContactMap.get(normalizedClientPhone) : null);

        let isOrphaned = false;
        let blockReason = "";
        let channelId: string | null = null;
        let channelName: string | null = null;
        let channelStatus: string | null = null;

        if (!waContact || !waContact.channel_id) {
          isOrphaned = true;
          blockReason = "Sem canal vinculado";

          if (waContact?.id) {
            const prevChannelId = transitionMap.get(waContact.id);
            if (prevChannelId) {
              channelId = prevChannelId;
              const prevChannel = channelMap.get(prevChannelId);
              if (prevChannel) {
                channelName = `${prevChannel.name} (removido)`;
                channelStatus = "deleted";
              } else {
                channelName = "Canal removido (histórico)";
                channelStatus = "deleted";
              }
              blockReason = "Canal excluído";
            }
          }
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

      const { data: contacts } = await supabase
        .from("whatsapp_contacts")
        .select("id, channel_id")
        .in("id", contactIds);

      const { error } = await supabase
        .from("whatsapp_contacts")
        .update({ channel_id: newChannelId, updated_at: new Date().toISOString() })
        .in("id", contactIds);

      if (error) throw error;

      const oldChannelIds = [...new Set((contacts || []).map((c) => c.channel_id).filter(Boolean))];
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
