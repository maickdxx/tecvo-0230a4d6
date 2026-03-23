import { useState, useEffect, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { UserPlus, Repeat, DollarSign, CalendarDays, Loader2 } from "lucide-react";
import { ConversionStatusSelector } from "./ConversionStatusSelector";

interface ClientSummaryBarProps {
  contact: any;
  onStatusChange?: (newStatus: string) => void;
}

interface ClientSummary {
  isRecurrent: boolean;
  totalServices: number;
  totalValue: number;
  lastServiceDate: string | null;
  lastServiceType: string | null;
}

export const ClientSummaryBar = memo(function ClientSummaryBar({
  contact,
  onStatusChange,
}: ClientSummaryBarProps) {
  const [summary, setSummary] = useState<ClientSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!contact.linked_client_id) {
      setSummary(null);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data: services } = await supabase
        .from("services")
        .select("id, service_type, status, scheduled_date, completed_date, value")
        .eq("client_id", contact.linked_client_id)
        .is("deleted_at", null)
        .order("scheduled_date", { ascending: false })
        .limit(100);

      if (cancelled) return;

      if (services && services.length > 0) {
        const completed = services.filter((s) => s.status === "completed");
        const totalValue = completed.reduce((acc, s) => acc + (s.value || 0), 0);
        const lastService = services[0];

        setSummary({
          isRecurrent: completed.length >= 2,
          totalServices: services.length,
          totalValue,
          lastServiceDate: lastService.scheduled_date || lastService.completed_date,
          lastServiceType: lastService.service_type,
        });
      } else {
        setSummary({
          isRecurrent: false,
          totalServices: 0,
          totalValue: 0,
          lastServiceDate: null,
          lastServiceType: null,
        });
      }
      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [contact.linked_client_id]);

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const formatDate = (d: string | null) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  };

  const serviceTypeLabels: Record<string, string> = {
    cleaning: "Limpeza",
    installation: "Instalação",
    maintenance: "Manutenção",
    repair: "Reparo",
    inspection: "Vistoria",
  };

  return (
    <div className="px-3 py-1.5 border-b border-border/40 bg-muted/20 flex items-center gap-2 overflow-x-auto shrink-0">
      {/* Conversion Status */}
      <ConversionStatusSelector
        contactId={contact.id}
        currentStatus={contact.conversion_status}
        compact
        onStatusChange={onStatusChange}
      />

      <div className="w-px h-4 bg-border/60 shrink-0" />

      {/* Client type badge */}
      {contact.linked_client_id ? (
        loading ? (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        ) : summary ? (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span
              className={cn(
                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold",
                summary.isRecurrent
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-blue-500/10 text-blue-600"
              )}
            >
              {summary.isRecurrent ? (
                <><Repeat className="h-3 w-3" /> Recorrente</>
              ) : (
                <><UserPlus className="h-3 w-3" /> {summary.totalServices === 0 ? "Novo" : "Cliente"}</>
              )}
            </span>

            {summary.totalValue > 0 && (
              <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
                <DollarSign className="h-3 w-3" />
                {formatCurrency(summary.totalValue)}
              </span>
            )}

            {summary.lastServiceDate && (
              <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
                <CalendarDays className="h-3 w-3" />
                {serviceTypeLabels[summary.lastServiceType || ""] || summary.lastServiceType}
                {" · "}
                {formatDate(summary.lastServiceDate)}
              </span>
            )}

            {summary.totalServices > 0 && (
              <span className="whitespace-nowrap">
                {summary.totalServices} serviço{summary.totalServices !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        ) : null
      ) : (
        <span className="text-[10px] text-muted-foreground/60 italic">
          Sem cliente vinculado
        </span>
      )}
    </div>
  );
});
