import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

export function useWhatsAppChannel() {
  const { organization } = useOrganization();
  const [channel, setChannel] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  const fetchChannel = useCallback(async () => {
    if (!organization?.id) {
      setChannel(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data } = await supabase
      .from("whatsapp_channels")
      .select("*")
      .eq("organization_id", organization.id)
      .eq("channel_type", "CUSTOMER_INBOX")
      .neq("channel_status", "deleted")
      .order("last_connected_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setChannel(data);
    setLoading(false);
  }, [organization?.id]);

  useEffect(() => { fetchChannel(); }, [fetchChannel]);

  const fetchQRCode = useCallback(async () => {
    if (!channel?.id) return;
    setQrLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-instance", {
        body: { action: "qrcode", channel_id: channel.id },
      });
      if (data?.qrcode) setQrCode(data.qrcode);
      if (data?.status === "open") {
        setChannel((prev: any) => prev ? { ...prev, is_connected: true, channel_status: "connected" } : prev);
      }
    } finally {
      setQrLoading(false);
    }
  }, [channel?.id]);

  const checkStatus = useCallback(async () => {
    if (!channel?.id) return;
    const { data } = await supabase.functions.invoke("whatsapp-instance", {
      body: { action: "status", channel_id: channel.id },
    });
    if (data) {
      setChannel((prev: any) => prev ? {
        ...prev,
        is_connected: data.connected,
        channel_status: data.channel_status || (data.connected ? "connected" : "disconnected"),
        phone_number: data.phone_number || prev.phone_number,
        last_connected_at: data.last_connected_at || prev.last_connected_at,
      } : prev);
    }
    return data;
  }, [channel?.id]);

  const createInstance = useCallback(async (instanceName: string) => {
    const { data, error } = await supabase.functions.invoke("whatsapp-instance", {
      body: { action: "create", instance_name: instanceName },
    });
    if (data?.ok) {
      if (data.qrcode) setQrCode(data.qrcode);
      await fetchChannel();
    }
    return data;
  }, [fetchChannel]);

  return { channel, loading, qrCode, qrLoading, fetchQRCode, checkStatus, createInstance, refetch: fetchChannel };
}
