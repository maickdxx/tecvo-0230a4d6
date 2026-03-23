import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";

export type ChannelStatus =
  | "provisioning"
  | "qr_pending"
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "deleting"
  | "deleted"
  | "error";

export interface WhatsAppChannelInfo {
  id: string;
  instance_name: string | null;
  name: string;
  phone_number: string | null;
  is_connected: boolean;
  created_at: string;
  channel_type: string;
  last_connected_at: string | null;
  channel_status: ChannelStatus;
  disconnected_reason: string | null;
}

export function useWhatsAppChannels() {
  const { organization } = useOrganization();
  const { maxWhatsAppChannels } = useSubscription();
  const queryClient = useQueryClient();
  const [connectingChannelId, setConnectingChannelId] = useState<string | null>(null);
  const [deletingChannelId, setDeletingChannelId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);

  const { data: channels = [], isLoading, refetch } = useQuery({
    queryKey: ["whatsapp-channels", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_channels")
        .select("id, instance_name, name, phone_number, is_connected, created_at, channel_type, last_connected_at, channel_status, disconnected_reason")
        .eq("organization_id", organization!.id)
        .eq("channel_type", "CUSTOMER_INBOX")
        .neq("channel_status", "deleted")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as WhatsAppChannelInfo[];
    },
    enabled: !!organization?.id,
  });

  const activeChannels = channels.filter((c) => !["deleted", "provisioning"].includes(c.channel_status));
  const canAddMore = activeChannels.length < maxWhatsAppChannels;

  const createChannelMutation = useMutation({
    mutationFn: async () => {
      if (!organization?.id) throw new Error("No organization");

      const suffix = organization.id.replace(/-/g, "").substring(0, 12);
      const existingNames = channels.map((c) => c.instance_name);
      let instanceName = `org-${suffix}`;
      let counter = 2;
      while (existingNames.includes(instanceName)) {
        instanceName = `org-${suffix}-${counter}`;
        counter++;
      }

      const { data, error } = await supabase.functions.invoke("whatsapp-instance", {
        body: { action: "create", instance_name: instanceName },
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Falha ao criar instância");

      await refetch();

      const channelId = data.channel_id;
      if (channelId) {
        setConnectingChannelId(channelId);
        if (data.qrcode) {
          setQrCode(data.qrcode);
        }
      }

      return data;
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao criar canal");
    },
  });

  const fetchQRCode = useCallback(async (channelId: string) => {
    setConnectingChannelId(channelId);
    const { data } = await supabase.functions.invoke("whatsapp-instance", {
      body: { action: "qrcode", channel_id: channelId },
    });
    if (data?.qrcode) setQrCode(data.qrcode);
    if (data?.status === "open") {
      await refetch();
      setConnectingChannelId(null);
      setQrCode(null);
    }
    return data;
  }, [refetch]);

  const checkChannelStatus = useCallback(async (channelId: string) => {
    const { data } = await supabase.functions.invoke("whatsapp-instance", {
      body: { action: "status", channel_id: channelId },
    });
    if (data?.connected) {
      await refetch();
      setConnectingChannelId(null);
      setQrCode(null);
    }
    return data;
  }, [refetch]);

  const disconnectMutation = useMutation({
    mutationFn: async (channel: WhatsAppChannelInfo) => {
      const { data, error } = await supabase.functions.invoke("whatsapp-instance", {
        body: { action: "disconnect", channel_id: channel.id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-channels"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-channel"] });
      refetch();
      toast.success("Canal desconectado com sucesso");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao desconectar canal");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (channel: WhatsAppChannelInfo) => {
      setDeletingChannelId(channel.id);

      const { data, error } = await supabase.functions.invoke("whatsapp-instance", {
        body: { action: "delete", channel_id: channel.id },
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Erro ao excluir canal");
      if (data?.channel_id && data.channel_id !== channel.id) {
        throw new Error("A exclusão retornou um canal diferente do solicitado");
      }
      if (data?.evolution_error) {
        console.warn("Evolution API error during delete:", data.evolution_error);
      }

      return { data, channel };
    },
    onSuccess: async ({ data, channel }) => {
      queryClient.setQueryData<WhatsAppChannelInfo[]>(
        ["whatsapp-channels", organization?.id],
        (current = []) => current.filter((item) => item.id !== channel.id)
      );
      queryClient.invalidateQueries({ queryKey: ["whatsapp-channels"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-channel"] });
      await refetch();
      if (data?.evolution_error) {
        toast.success("Canal excluído da Tecvo. A sessão remota pode precisar de limpeza manual.");
      } else {
        toast.success("Canal excluído com sucesso");
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao excluir canal");
    },
    onSettled: () => {
      setDeletingChannelId(null);
    },
  });

  const reconnectMutation = useMutation({
    mutationFn: async (channel: WhatsAppChannelInfo) => {
      const suffix = organization?.id?.replace(/-/g, "").substring(0, 12) || "unknown";
      const instanceName = `org-${suffix}-${Date.now() % 10000}`;

      const { data, error } = await supabase.functions.invoke("whatsapp-instance", {
        body: { action: "reconnect", channel_id: channel.id, instance_name: instanceName },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error("Falha ao reconectar");

      setConnectingChannelId(channel.id);
      if (data.qrcode) setQrCode(data.qrcode);

      await refetch();
      return data;
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao reconectar canal");
    },
  });

  return {
    channels,
    isLoading,
    canAddMore,
    connectingChannelId,
    deletingChannelId,
    qrCode,
    setQrCode,
    setConnectingChannelId,
    createChannel: createChannelMutation.mutate,
    isCreating: createChannelMutation.isPending,
    disconnect: disconnectMutation.mutate,
    isDisconnecting: disconnectMutation.isPending,
    deleteChannel: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    reconnect: reconnectMutation.mutate,
    isReconnecting: reconnectMutation.isPending,
    fetchQRCode,
    checkChannelStatus,
    refetch,
  };
}
