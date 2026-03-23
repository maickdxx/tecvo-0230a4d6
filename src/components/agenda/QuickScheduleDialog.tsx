import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Clock, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ClientCombobox } from "@/components/services/ClientCombobox";
import type { Client } from "@/hooks/useClients";
import type { ServiceFormData } from "@/hooks/useServices";
import { buildTimestamp } from "@/lib/timezone";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";

interface QuickScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  onSubmit: (data: ServiceFormData) => Promise<void>;
  isSubmitting?: boolean;
  defaultDate?: Date | null;
}

export function QuickScheduleDialog({
  open,
  onOpenChange,
  clients,
  onSubmit,
  isSubmitting,
  defaultDate,
}: QuickScheduleDialogProps) {
  const tz = useOrgTimezone();
  const [clientId, setClientId] = useState("");
  const [date, setDate] = useState<Date | undefined>(defaultDate ?? new Date());
  const [time, setTime] = useState("09:00");
  const [description, setDescription] = useState("");
  const [value, setValue] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [error, setError] = useState("");

  const resetForm = () => {
    setClientId("");
    setDate(defaultDate ?? new Date());
    setTime("09:00");
    setDescription("");
    setValue("");
    setError("");
  };

  const handleSubmit = async () => {
    if (!clientId) {
      setError("Selecione um cliente");
      return;
    }
    if (!date) {
      setError("Selecione uma data");
      return;
    }
    setError("");

    const dateStr = format(date, "yyyy-MM-dd");
    const timeStr = `${time}:00`;
    const scheduled_date = buildTimestamp(dateStr, timeStr, tz);

    const data: ServiceFormData = {
      client_id: clientId,
      scheduled_date,
      description: description || undefined,
      value: value ? parseFloat(value) : undefined,
      service_type: "outros",
      status: "scheduled",
    };

    await onSubmit(data);
    resetForm();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle>Agendamento Rápido</SheetTitle>
          <p className="text-sm text-muted-foreground">
            Agende um serviço de forma rápida, sem preencher todos os campos da OS.
          </p>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Client */}
          <div className="space-y-2">
            <Label>Cliente *</Label>
            <ClientCombobox
              clients={clients}
              value={clientId}
              onChange={setClientId}
            />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label>Data *</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "d 'de' MMMM, yyyy", { locale: ptBR }) : "Selecionar data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => { setDate(d); setCalendarOpen(false); }}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time */}
          <div className="space-y-2">
            <Label>Horário</Label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Value */}
          <div className="space-y-2">
            <Label>Valor (R$)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              placeholder="Breve descrição do serviço..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => { resetForm(); onOpenChange(false); }}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
              ) : (
                "Agendar"
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
