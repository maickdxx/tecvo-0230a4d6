import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTimeClockAdmin } from "@/hooks/useTimeClock";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Calendar, Plus, Trash2, TreePalm, Thermometer, Gift, Umbrella } from "lucide-react";

const EVENT_TYPES = [
  { value: "holiday", label: "Feriado", icon: Calendar, color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  { value: "vacation", label: "Férias", icon: TreePalm, color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  { value: "sick_leave", label: "Atestado", icon: Thermometer, color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  { value: "leave", label: "Afastamento", icon: Umbrella, color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
  { value: "day_off", label: "Folga", icon: Gift, color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  { value: "bonus", label: "Abono", icon: Gift, color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" },
];

export default function PontoCalendario() {
  const { profile } = useAuth();
  const { teamProfiles } = useTimeClockAdmin();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ event_type: "holiday", title: "", start_date: "", end_date: "", user_id: "", notes: "" });

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["time-clock-calendar-events", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_clock_calendar_events")
        .select("*")
        .eq("organization_id", orgId)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("time_clock_calendar_events").insert({
        organization_id: orgId,
        event_type: form.event_type,
        title: form.title,
        start_date: form.start_date,
        end_date: form.end_date || form.start_date,
        user_id: form.user_id || null,
        notes: form.notes || null,
        created_by: profile?.user_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-clock-calendar-events"] });
      toast({ title: "Evento criado!" });
      setDialogOpen(false);
      setForm({ event_type: "holiday", title: "", start_date: "", end_date: "", user_id: "", notes: "" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erro", description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("time_clock_calendar_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-clock-calendar-events"] });
      toast({ title: "Evento removido!" });
    },
  });

  const profileMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of teamProfiles) m.set(p.user_id, p.full_name || "Sem nome");
    return m;
  }, [teamProfiles]);

  const getTypeConfig = (type: string) => EVENT_TYPES.find(t => t.value === type) || EVENT_TYPES[0];

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">Calendário Operacional</h1>
            <p className="text-sm text-muted-foreground">Feriados, férias, atestados e afastamentos</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Evento</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Novo Evento</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select value={form.event_type} onValueChange={v => setForm(f => ({ ...f, event_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Título</Label>
                  <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Natal, Férias João..." />
                </div>
                {form.event_type !== "holiday" && (
                  <div>
                    <Label className="text-xs">Funcionário (opcional para feriados)</Label>
                    <Select value={form.user_id} onValueChange={v => setForm(f => ({ ...f, user_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Todos (empresa)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Todos (empresa)</SelectItem>
                        {teamProfiles.map(p => (
                          <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || "Sem nome"}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Data Início</Label>
                    <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Data Fim</Label>
                    <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Observações</Label>
                  <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Opcional..." className="min-h-[60px]" />
                </div>
                <Button className="w-full" onClick={() => createMutation.mutate()} disabled={!form.title || !form.start_date || createMutation.isPending}>
                  Criar Evento
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <Card><CardContent className="p-6 text-center text-muted-foreground">Carregando...</CardContent></Card>
        ) : events.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-muted-foreground">Nenhum evento cadastrado</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {events.map((event: any) => {
              const cfg = getTypeConfig(event.event_type);
              const TypeIcon = cfg.icon;
              return (
                <Card key={event.id}>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className={`rounded-lg p-2 shrink-0 ${cfg.color.split(" ").filter(c => c.startsWith("bg-") || c.startsWith("dark:bg-")).join(" ")}`}>
                          <TypeIcon className={`h-4 w-4 ${cfg.color.split(" ").filter(c => c.startsWith("text-") && !c.startsWith("dark:")).join(" ")}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{event.title}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            <Badge className={`text-[11px] ${cfg.color}`}>{cfg.label}</Badge>
                            {event.user_id ? (
                              <Badge variant="outline" className="text-[11px]">{profileMap.get(event.user_id) || "—"}</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[11px]">Toda empresa</Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            {format(new Date(event.start_date + "T12:00:00"), "dd/MM/yyyy")}
                            {event.end_date !== event.start_date && ` — ${format(new Date(event.end_date + "T12:00:00"), "dd/MM/yyyy")}`}
                          </p>
                          {event.notes && <p className="text-xs text-muted-foreground mt-1">{event.notes}</p>}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(event.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
