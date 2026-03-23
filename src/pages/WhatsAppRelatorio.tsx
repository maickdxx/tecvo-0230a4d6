import { useState } from "react";
import { AppLayout } from "@/components/layout";
import { useWhatsAppReport, ReportPeriod } from "@/hooks/useWhatsAppReport";
import { useWhatsAppChannels } from "@/hooks/useWhatsAppChannels";
import { ReportHeader } from "@/components/whatsapp/report/ReportHeader";
import { ReportStatCards } from "@/components/whatsapp/report/ReportStatCards";
import { ReportConversionBlock } from "@/components/whatsapp/report/ReportConversionBlock";
import { ReportCharts } from "@/components/whatsapp/report/ReportCharts";

export default function WhatsAppRelatorio() {
  const [channelFilter, setChannelFilter] = useState<string | null>(null);
  const [period, setPeriod] = useState<ReportPeriod>("month");
  const [customRange, setCustomRange] = useState<{ from: Date | null; to: Date | null }>({
    from: null,
    to: null,
  });
  const { channels } = useWhatsAppChannels();
  const report = useWhatsAppReport(channelFilter, period, customRange);

  return (
    <AppLayout>
      <div className="space-y-6 p-4 md:p-6">
        <ReportHeader
          channelFilter={channelFilter}
          setChannelFilter={setChannelFilter}
          channels={channels}
          period={period}
          setPeriod={setPeriod}
          customRange={customRange}
          setCustomRange={setCustomRange}
        />
        <ReportStatCards report={report} />
        <ReportConversionBlock report={report} />
        <ReportCharts report={report} />
      </div>
    </AppLayout>
  );
}
