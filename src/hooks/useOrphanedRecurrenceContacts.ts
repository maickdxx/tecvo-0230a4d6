import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

export interface OrphanedRecurrenceContact {
  recurrenceEntryId: string;
  selectionId: string;
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  normalizedClientPhone: string | null;
  whatsappContactId: string | null;
  channelId: string | null;
  channelName: string | null;
  channelStatus: string | null;
  blockReason: string;
  lastServiceType: string;
  lastServiceDate: string;
  lastServiceValue: number | null;
  canReassign: boolean;
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

      const clientIds = Array.from(new Set<string>(entries.map((entry: any) => String(entry.client_id))));
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
      ].filter((contact, index, array) => array.findIndex((item) => item.id === contact.id) === index);

      const waContactIds = waContacts.map((contact) => contact.id);
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

      for (const waContact of waContacts) {
        if (waContact.linked_client_id) {
          const existing = clientContactMap.get(waContact.linked_client_id);
          if (!existing || (waContact.channel_id && !existing.channel_id)) {
            clientContactMap.set(waContact.linked_client_id, waContact);
          }
        }

        if (waContact.normalized_phone) {
          const existing = phoneContactMap.get(waContact.normalized_phone);
          if (!existing || (waContact.channel_id && !existing.channel_id)) {
            phoneContactMap.set(waContact.normalized_phone, waContact);
          }
        }
      }

      const orphaned: OrphanedRecurrenceContact[] = [];

      for (const entry of entries) {
        const client = entry.client;
        if (!client) continue;

        const normalizedClientPhone = normalizePhone(client.whatsapp || client.phone);
        const waContact = clientContactMap.get(client.id) || (normalizedClientPhone ? phoneContactMap.get(normalizedClientPhone) : null);

        let isOrphaned = false;
        let blockReason = "";
        let channelId: string | null = null;
        let channelName: string | null = null;
        let channelStatus: string | null = null;

        if (!waContact || !waContact.channel_id) {
          isOrphaned = true;
          blockReason = waContact ? "Sem canal vinculado" : "Sem contato WA vinculado";

          if (waContact?.id) {
            const previousChannelId = transitionMap.get(waContact.id);
            if (previousChannelId) {
              channelId = previousChannelId;
              const previousChannel = channelMap.get(previousChannelId);
              if (previousChannel) {
                channelName = `${previousChannel.name} (removido)`;
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
            selectionId: `recurrence:${entry.id}`,
            clientId: client.id,
            clientName: client.name,
            clientPhone: client.phone || client.whatsapp,
            normalizedClientPhone,
            whatsappContactId: waContact?.id || null,
            channelId,
            channelName,
            channelStatus,
            blockReason,
            lastServiceType: entry.source_service_type,
            lastServiceDate: entry.source_completed_date,
            lastServiceValue: entry.source_value,
            canReassign: Boolean(normalizedClientPhone),
          });
        }
      }

      const groupMap = new Map<string, OrphanedGroup>();

      for (const contact of orphaned) {
        const key = contact.channelId || "unknown-channel";
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            channelId: contact.channelId,
            channelName: contact.channelName || "Canal antigo indisponível",
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
      contacts,
      newChannelId,
    }: {
      contacts: OrphanedRecurrenceContact[];
      newChannelId: string;
    }) => {
      if (!organization?.id) throw new Error("Sem organização");

      const now = new Date().toISOString();
      const contactIdsToUpdate = new Set<string>();
      const oldChannelIds = new Set<string>();

      const existingContactIds = contacts
        .map((contact) => contact.whatsappContactId)
        .filter(Boolean) as string[];

      if (existingContactIds.length > 0) {
        const { data: existingContacts, error: existingError } = await supabase
          .from("whatsapp_contacts")
          .select("id, channel_id")
          .in("id", existingContactIds);

        if (existingError) throw existingError;

        for (const contact of existingContacts || []) {
          contactIdsToUpdate.add(contact.id);
          if (contact.channel_id) oldChannelIds.add(contact.channel_id);
        }
      }

      for (const contact of contacts.filter((item) => !item.whatsappContactId && item.normalizedClientPhone)) {
        const { data: existingMatch, error: matchError } = await supabase
          .from("whatsapp_contacts")
          .select("id, channel_id")
          .eq("organization_id", organization.id)
          .or(`linked_client_id.eq.${contact.clientId},normalized_phone.eq.${contact.normalizedClientPhone}`)
          .limit(1)
          .maybeSingle();

        if (matchError) throw matchError;

        if (existingMatch) {
          contactIdsToUpdate.add(existingMatch.id);
          if (existingMatch.channel_id) oldChannelIds.add(existingMatch.channel_id);

          const { error: linkError } = await supabase
            .from("whatsapp_contacts")
            .update({
              linked_client_id: contact.clientId,
              linked_at: now,
              name: contact.clientName,
              phone: contact.clientPhone || `+${contact.normalizedClientPhone}`,
              normalized_phone: contact.normalizedClientPhone,
              updated_at: now,
            })
            .eq("id", existingMatch.id);

          if (linkError) throw linkError;
          continue;
        }

        const { data: createdContact, error: createError } = await supabase
          .from("whatsapp_contacts")
          .insert({
            organization_id: organization.id,
            linked_client_id: contact.clientId,
            linked_at: now,
            name: contact.clientName,
            phone: contact.clientPhone || `+${contact.normalizedClientPhone}`,
            normalized_phone: contact.normalizedClientPhone,
            whatsapp_id: `${contact.normalizedClientPhone}@s.whatsapp.net`,
            channel_id: newChannelId,
            is_group: false,
            conversation_status: "novo",
            conversion_status: "novo_contato",
            source: "whatsapp",
            has_conversation: false,
          })
          .select("id")
          .single();

        if (createError) throw createError;
        if (createdContact?.id) contactIdsToUpdate.add(createdContact.id);
      }

      const updateIds = Array.from(contactIdsToUpdate);
      if (updateIds.length > 0) {
        const { error: updateError } = await supabase
          .from("whatsapp_contacts")
          .update({ channel_id: newChannelId, updated_at: now })
          .in("id", updateIds);

        if (updateError) throw updateError;
      }

      try {
        await (supabase as any).from("data_audit_log").insert({
          organization_id: organization.id,
          table_name: "whatsapp_contacts",
          operation: "recurrence_channel_reassign",
          metadata: {
            old_channel_ids: Array.from(oldChannelIds),
            new_channel_id: newChannelId,
            contact_ids: updateIds,
            recurrence_entry_ids: contacts.map((contact) => contact.recurrenceEntryId),
            count: contacts.length,
          },
        });
      } catch (auditErr) {
        console.warn("[RECURRENCE] Audit log failed (non-blocking):", auditErr);
      }

      return { count: contacts.length };
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
