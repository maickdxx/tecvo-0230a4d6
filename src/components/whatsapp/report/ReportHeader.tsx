import { ReportPeriod } from "@/hooks/useWhatsAppReport";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Phone, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Props {
  channelFilter: string | null;
  setChannelFilter: (v: string | null) => void;
  channels: any[];
  period: ReportPeriod;
  setPeriod: (v: ReportPeriod) => void;
  customRange: { from: Date | null; to: Date | null };
  setCustomRange: (v: { from: Date | null; to: Date | null }) => void;
}

const PERIOD_OPTIONS: { value: ReportPeriod; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mês" },
  { value: "custom", label: "Personalizado" },
];

export function ReportHeader({
  channelFilter,
  setChannelFilter,
  channels,
  period,
  setPeriod,
  customRange,
  setCustomRange,
}: Props) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Relatório de Atendimento</h1>
        <p className="text-sm text-muted-foreground">Métricas de atendimento via WhatsApp</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {/* Period filter */}
        <Select value={period} onValueChange={(v) => setPeriod(v as ReportPeriod)}>
          <SelectTrigger className="w-[160px]">
            <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Custom range picker */}
        {period === "custom" && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 text-xs">
                <CalendarIcon className="h-3.5 w-3.5" />
                {customRange.from
                  ? `${format(customRange.from, "dd/MM", { locale: ptBR })} - ${customRange.to ? format(customRange.to, "dd/MM", { locale: ptBR }) : "..."}`
                  : "Selecionar datas"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={
                  customRange.from
                    ? { from: customRange.from, to: customRange.to || undefined }
                    : undefined
                }
                onSelect={(range) => {
                  setCustomRange({ from: range?.from || null, to: range?.to || null });
                }}
                locale={ptBR}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        )}

        {/* Channel filter */}
        <Select
          value={channelFilter ?? "all"}
          onValueChange={(v) => setChannelFilter(v === "all" ? null : v)}
        >
          <SelectTrigger className="w-[200px]">
            <Phone className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="Todos os números" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os números</SelectItem>
            {channels.map((ch) => (
              <SelectItem key={ch.id} value={ch.id}>
                {ch.phone_number || ch.name || ch.instance_name || "WhatsApp"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
