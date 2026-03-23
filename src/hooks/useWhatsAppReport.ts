import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useWhatsAppChannels } from "@/hooks/useWhatsAppChannels";
import { useTeamMembers } from "@/hooks/useTeamMembers";

export type ReportPeriod = "today" | "week" | "month" | "custom";

interface DateRange {
  from: Date | null;
  to: Date | null;
}

export function useWhatsAppReport(
  channelFilter: string | null,
  period: ReportPeriod = "month",
  customRange?: DateRange
) {
  const { organization } = useOrganization();
  const { channels } = useWhatsAppChannels();
  const { members } = useTeamMembers();

  const orgId = organization?.id;

  const dateParams = useMemo(() => {
    const now = new Date();
    let from: string | null = null;
    let to: string | null = null;

    switch (period) {
      case "today": {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        from = start.toISOString();
        to = new Date(start.getTime() + 86400000).toISOString();
        break;
      }
      case "week": {
        const start = new Date(now);
        start.setDate(start.getDate() - start.getDay());
        start.setHours(0, 0, 0, 0);
        from = start.toISOString();
        to = new Date(now.getTime() + 86400000).toISOString();
        break;
      }
      case "month": {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        from = start.toISOString();
        to = new Date(now.getTime() + 86400000).toISOString();
        break;
      }
      case "custom": {
        if (customRange?.from) {
          const start = new Date(customRange.from);
          start.setHours(0, 0, 0, 0);
          from = start.toISOString();
        }
        if (customRange?.to) {
          const end = new Date(customRange.to);
          end.setHours(23, 59, 59, 999);
          to = end.toISOString();
        }
        break;
      }
    }
    return { from, to };
  }, [period, customRange?.from?.getTime(), customRange?.to?.getTime()]);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["wa-report-stats", orgId, channelFilter, dateParams.from, dateParams.to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_whatsapp_report_stats", {
        _org_id: orgId!,
        _channel_id: channelFilter || null,
        _date_from: dateParams.from,
        _date_to: dateParams.to,
      });
      if (error) throw error;
      return data as {
        totalConversations: number;
        convsToday: number;
        convsYesterday: number;
        convsMonth: number;
        resolved: number;
        awaitingResponse: number;
        osCreated: number;
        converted: number;
        attendedOnly: number;
        attendedTotal: number;
        scheduledOnly: number;
        scheduledTotal: number;
        neverResponded: number;
        conversionCommercial: number;
        conversionOperational: number;
        conversionTotal: number;
        avgResponseMinutes: number;
        totalRevenue: number;
        avgTicket: number;
        byChannel: { channel_id: string; count: number }[];
        byAssignee: { user_id: string; count: number; converted: number }[];
        perDay: { date: string; count: number }[];
      };
    },
    enabled: !!orgId,
  });

  const byChannel = useMemo(() => {
    if (!stats?.byChannel) return [];
    return channels.map((ch, i) => {
      const found = stats.byChannel.find((bc) => bc.channel_id === ch.id);
      return {
        id: ch.id,
        name: ch.phone_number || ch.name || `WhatsApp ${i + 1}`,
        count: found?.count || 0,
      };
    });
  }, [stats?.byChannel, channels]);

  const byAssignee = useMemo(() => {
    if (!stats?.byAssignee) return [];
    return stats.byAssignee
      .map((ba) => {
        const member = members.find((m) => m.user_id === ba.user_id);
        return {
          name: member?.full_name || "Sem nome",
          count: ba.count,
          converted: ba.converted || 0,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [stats?.byAssignee, members]);

  return {
    isLoading,
    convsToday: stats?.convsToday ?? 0,
    convsYesterday: stats?.convsYesterday ?? 0,
    convsMonth: stats?.convsMonth ?? 0,
    resolved: stats?.resolved ?? 0,
    awaitingResponse: stats?.awaitingResponse ?? 0,
    byChannel,
    byAssignee,
    avgResponseMinutes: stats?.avgResponseMinutes ?? 0,
    osCreated: stats?.osCreated ?? 0,
    converted: stats?.converted ?? 0,
    attendedOnly: stats?.attendedOnly ?? 0,
    attendedTotal: stats?.attendedTotal ?? 0,
    scheduledOnly: stats?.scheduledOnly ?? 0,
    scheduledTotal: stats?.scheduledTotal ?? 0,
    neverResponded: stats?.neverResponded ?? 0,
    conversionCommercial: stats?.conversionCommercial ?? 0,
    conversionOperational: stats?.conversionOperational ?? 0,
    conversionTotal: stats?.conversionTotal ?? 0,
    totalRevenue: stats?.totalRevenue ?? 0,
    avgTicket: stats?.avgTicket ?? 0,
    perDay: stats?.perDay ?? [],
    totalConversations: stats?.totalConversations ?? 0,
  };
}
