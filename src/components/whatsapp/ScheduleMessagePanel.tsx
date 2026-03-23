import { useState } from "react";
import { format, addHours, addDays, set as dateSet } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useScheduledMessages, ScheduledMessage } from "@/hooks/useScheduledMessages";
import { cn } from "@/lib/utils";
import {
  X, CalendarIcon, Clock, Send, Trash2, Pencil, Loader2,
} from "lucide-react";

interface Props {
  contact: any;
  channelId: string | null;
  onClose: () => void;
}

const QUICK_OPTIONS = [
  { label: "Em 1 hora", fn: () => addHours(new Date(), 1) },
  { label: "Amanhã 10h", fn: () => dateSet(addDays(new Date(), 1), { hours: 10, minutes: 0, seconds: 0 }) },
  { label: "Em 2 dias", fn: () => dateSet(addDays(new Date(), 2), { hours: 10, minutes: 0, seconds: 0 }) },
  { label: "Em 7 dias", fn: () => dateSet(addDays(new Date(), 7), { hours: 10, minutes: 0, seconds: 0 }) },
];

const TEMPLATES = [
  "Olá! Estou entrando em contato para dar continuidade ao nosso atendimento. Posso te ajudar com algo?",
  "Oi! Conseguiu pensar sobre o orçamento que enviamos? Estamos à disposição!",
  "Olá! Passando para lembrar sobre o serviço que conversamos. Podemos agendar?",
];

export function ScheduleMessagePanel({ contact, channelId, onClose }: Props) {
  const { messages, create, update, cancel, loading } = useScheduledMessages(contact.id);
  const [content, setContent] = useState("");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState("10:00");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleQuickSelect = (fn: () => Date) => {
    const d = fn();
    setDate(d);
    setTime(format(d, "HH:mm"));
  };

  const getScheduledDate = (): Date | null => {
    if (!date) return null;
    const [h, m] = time.split(":").map(Number);
    return dateSet(date, { hours: h, minutes: m, seconds: 0 });
  };

  const handleSave = async () => {
    if (!content.trim()) { toast.error("Digite a mensagem"); return; }
    const scheduledAt = getScheduledDate();
    if (!scheduledAt || scheduledAt <= new Date()) { toast.error("Escolha uma data/hora futura"); return; }
    if (!channelId) { toast.error("Canal não disponível"); return; }
    setSaving(true);
    try {
      if (editingId) {
        await update(editingId, { content: content.trim(), scheduledAt });
        toast.success("Mensagem reagendada");
        setEditingId(null);
      } else {
        await create({ contactId: contact.id, channelId, content: content.trim(), scheduledAt });
        toast.success("Mensagem agendada ✓");
      }
      setContent("");
      setDate(undefined);
      setTime("10:00");
    } catch {
      toast.error("Erro ao agendar mensagem");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (msg: ScheduledMessage) => {
    setEditingId(msg.id);
    setContent(msg.content);
    const d = new Date(msg.scheduled_at);
    setDate(d);
    setTime(format(d, "HH:mm"));
  };

  const handleCancel = async (id: string) => {
    await cancel(id);
    toast.success("Agendamento cancelado");
    if (editingId === id) {
      setEditingId(null);
      setContent("");
      setDate(undefined);
    }
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div>
          <h3 className="text-sm font-bold text-foreground">Agendar mensagem</h3>
          <p className="text-xs text-muted-foreground">{contact.name || contact.phone}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Quick options */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-2 block">Atalhos rápidos</Label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_OPTIONS.map((opt) => (
                <Button key={opt.label} variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleQuickSelect(opt.fn)}>
                  <Clock className="h-3 w-3 mr-1" />
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left text-xs h-9", !date && "text-muted-foreground")}>
                    <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                    {date ? format(date, "dd/MM/yyyy") : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    disabled={(d) => d < new Date(new Date().setHours(0,0,0,0))}
                    locale={ptBR}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Horário</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-9 text-xs" />
            </div>
          </div>

          {/* Message */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Mensagem</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Digite a mensagem de follow-up..."
              className="min-h-[80px] text-sm resize-none"
            />
          </div>

          {/* Templates */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Templates rápidos</Label>
            <div className="space-y-1.5">
              {TEMPLATES.map((tpl, i) => (
                <button
                  key={i}
                  onClick={() => setContent(tpl)}
                  className="w-full text-left px-3 py-2 rounded-md border border-border/60 hover:bg-accent/50 text-xs text-foreground/80 transition-colors"
                >
                  {tpl.length > 80 ? tpl.slice(0, 80) + "..." : tpl}
                </button>
              ))}
            </div>
          </div>

          {/* Save button */}
          <Button onClick={handleSave} disabled={saving || !content.trim() || !date} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            {editingId ? "Reagendar" : "Agendar mensagem"}
          </Button>

          {/* Pending scheduled messages */}
          {messages.length > 0 && (
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-2 block">
                Mensagens agendadas ({messages.length})
              </Label>
              <div className="space-y-2">
                {messages.map((msg) => (
                  <div key={msg.id} className="border border-border/60 rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-foreground/80 flex-1 line-clamp-2">{msg.content}</p>
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        {msg.status === "scheduled" ? "Agendada" : msg.status === "sent" ? "Enviada" : msg.status === "cancelled" ? "Cancelada" : msg.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {format(new Date(msg.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                      {msg.status === "scheduled" && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(msg)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleCancel(msg.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
