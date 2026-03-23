import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTimeClockAdmin } from "@/hooks/useTimeClock";
import { AppLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Clock, Users, AlertTriangle } from "lucide-react";

const SCHEDULE_TYPES = [
  { value: "5x2", label: "5x2 (Seg-Sex)" },
  { value: "6x1", label: "6x1 (Seg-Sáb)" },
  { value: "custom", label: "Personalizada" },
];

const WEEK_DAYS = [
  { value: "seg", label: "Seg" },
  { value: "ter", label: "Ter" },
  { value: "qua", label: "Qua" },
  { value: "qui", label: "Qui" },
  { value: "sex", label: "Sex" },
  { value: "sab", label: "Sáb" },
  { value: "dom", label: "Dom" },
];

/** Calculate work hours from clock in/out times and break minutes */
function calcWorkHours(clockIn: string, clockOut: string, breakMin: string): { hours: string; error: string | null } {
  if (!clockIn || !clockOut) return { hours: "", error: null };
  const [hIn, mIn] = clockIn.split(":").map(Number);
  const [hOut, mOut] = clockOut.split(":").map(Number);
  if (isNaN(hIn) || isNaN(mIn) || isNaN(hOut) || isNaN(mOut)) return { hours: "", error: null };

  const totalIn = hIn * 60 + mIn;
  const totalOut = hOut * 60 + mOut;
  if (totalOut <= totalIn) return { hours: "", error: "Horário de saída deve ser maior que o de entrada" };

  const breakMinutes = parseInt(breakMin) || 0;
  if (breakMinutes < 0) return { hours: "", error: "Intervalo não pode ser negativo" };

  const diff = totalOut - totalIn;
  if (breakMinutes >= diff) return { hours: "", error: "Intervalo maior ou igual ao período de trabalho" };

  const netMinutes = diff - breakMinutes;
  return { hours: (netMinutes / 60).toFixed(1), error: null };
}

export default function PontoEscalas() {
  const { profile } = useAuth();
  const { teamProfiles } = useTimeClockAdmin();
  const queryClient = useQueryClient();
  const orgId = (profile as any)?.organization_id;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    schedule_name: "",
    schedule_type: "5x2",
    user_id: "",
    employee_type: "",
    expected_clock_in: "08:00",
    expected_clock_out: "17:48",
    work_hours_per_day: "8.8",
    break_minutes: "60",
    work_days: ["seg", "ter", "qua", "qui", "sex"],
    is_default: false,
    hourly_rate: "",
  });

  // Auto-calculate work_hours_per_day
  const { hours: calculatedHours, error: hoursError } = useMemo(
    () => calcWorkHours(form.expected_clock_in, form.expected_clock_out, form.break_minutes),
    [form.expected_clock_in, form.expected_clock_out, form.break_minutes]
  );

  // Keep form in sync with calculated value
  const updateTimeField = useCallback((field: string, value: string) => {
    setForm(f => {
      const next = { ...f, [field]: value };
      const { hours } = calcWorkHours(
        field === "expected_clock_in" ? value : next.expected_clock_in,
        field === "expected_clock_out" ? value : next.expected_clock_out,
        field === "break_minutes" ? value : next.break_minutes,
      );
      return { ...next, work_hours_per_day: hours };
    });
  }, []);

  const canSave = !!form.schedule_name && !!calculatedHours && !hoursError;

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ["time-clock-work-schedules", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_clock_work_schedules")
        .select("*")
        .eq("organization_id", orgId)
        .order("is_default", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  const defaultForm = {
    schedule_name: "", schedule_type: "5x2", user_id: "", employee_type: "",
    expected_clock_in: "08:00", expected_clock_out: "17:48", work_hours_per_day: "8.8",
    break_minutes: "60", work_days: ["seg", "ter", "qua", "qui", "sex"], is_default: false,
    hourly_rate: "",
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!canSave) throw new Error("Preencha todos os campos corretamente");
      const { error } = await supabase.from("time_clock_work_schedules").insert({
        organization_id: orgId,
        schedule_name: form.schedule_name || "Nova Escala",
        schedule_type: form.schedule_type,
        user_id: form.user_id || null,
        employee_type: form.employee_type || null,
        expected_clock_in: form.expected_clock_in,
        expected_clock_out: form.expected_clock_out,
        work_hours_per_day: parseFloat(calculatedHours),
        break_minutes: parseInt(form.break_minutes),
        work_days: form.work_days,
        is_default: form.is_default,
        hourly_rate: form.hourly_rate ? parseFloat(form.hourly_rate) : null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-clock-work-schedules"] });
      toast({ title: "Escala criada!" });
      setDialogOpen(false);
      setForm(defaultForm);
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erro", description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("time_clock_work_schedules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-clock-work-schedules"] });
      toast({ title: "Escala removida!" });
    },
  });

  const profileMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of teamProfiles) m.set(p.user_id, p.full_name || "Sem nome");
    return m;
  }, [teamProfiles]);

  const handleScheduleTypeChange = (type: string) => {
    let days = form.work_days;
    if (type === "5x2") days = ["seg", "ter", "qua", "qui", "sex"];
    else if (type === "6x1") days = ["seg", "ter", "qua", "qui", "sex", "sab"];
    setForm(f => ({ ...f, schedule_type: type, work_days: days }));
  };

  const toggleDay = (day: string) => {
    setForm(f => ({
      ...f,
      work_days: f.work_days.includes(day) ? f.work_days.filter(d => d !== day) : [...f.work_days, day],
    }));
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">Escalas de Trabalho</h1>
            <p className="text-sm text-muted-foreground">Configure jornadas por empresa, cargo ou funcionário</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Escala</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Nova Escala</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Nome da Escala</Label>
                  <Input value={form.schedule_name} onChange={e => setForm(f => ({ ...f, schedule_name: e.target.value }))} placeholder="Ex: Jornada Padrão" />
                </div>
                <div>
                  <Label className="text-xs">Tipo de Escala</Label>
                  <Select value={form.schedule_type} onValueChange={handleScheduleTypeChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SCHEDULE_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Aplicar a (cargo)</Label>
                  <Select value={form.employee_type || "__all__"} onValueChange={v => setForm(f => ({ ...f, employee_type: v === "__all__" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Todos os cargos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todos os cargos</SelectItem>
                      <SelectItem value="tecnico">Técnico</SelectItem>
                      <SelectItem value="ajudante">Ajudante</SelectItem>
                      <SelectItem value="atendente">Atendente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Aplicar a (funcionário)</Label>
                  <Select value={form.user_id || "__all__"} onValueChange={v => setForm(f => ({ ...f, user_id: v === "__all__" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todos</SelectItem>
                      {teamProfiles.map(p => (
                        <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || "Sem nome"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Entrada</Label>
                    <Input type="time" value={form.expected_clock_in} onChange={e => updateTimeField("expected_clock_in", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Saída</Label>
                    <Input type="time" value={form.expected_clock_out} onChange={e => updateTimeField("expected_clock_out", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Horas/dia</Label>
                    <Input
                      type="text"
                      value={calculatedHours ? `${calculatedHours}h` : "—"}
                      readOnly
                      disabled
                      className="bg-muted text-muted-foreground"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Intervalo (min)</Label>
                    <Input type="number" value={form.break_minutes} onChange={e => updateTimeField("break_minutes", e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Valor da hora (R$) <span className="text-muted-foreground font-normal">— usado apenas se o funcionário não tiver valor próprio</span></Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Ex: 25.00"
                    value={form.hourly_rate}
                    onChange={e => setForm(f => ({ ...f, hourly_rate: e.target.value }))}
                  />
                </div>
                {hoursError && (
                  <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    {hoursError}
                  </div>
                )}
                {form.schedule_type === "custom" && (
                  <div>
                    <Label className="text-xs mb-2 block">Dias de trabalho</Label>
                    <div className="flex flex-wrap gap-2">
                      {WEEK_DAYS.map(d => (
                        <Button
                          key={d.value}
                          type="button"
                          size="sm"
                          variant={form.work_days.includes(d.value) ? "default" : "outline"}
                          onClick={() => toggleDay(d.value)}
                          className="h-8 px-3 text-xs"
                        >
                          {d.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_default} onCheckedChange={c => setForm(f => ({ ...f, is_default: c }))} />
                  <Label className="text-xs">Escala padrão da empresa</Label>
                </div>
                <Button className="w-full" onClick={() => createMutation.mutate()} disabled={!canSave || createMutation.isPending}>
                  Criar Escala
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <Card><CardContent className="p-6 text-center text-muted-foreground">Carregando...</CardContent></Card>
        ) : schedules.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-muted-foreground">Nenhuma escala configurada. Use as configurações gerais como padrão.</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {schedules.map((schedule: any) => {
              const days = Array.isArray(schedule.work_days) ? schedule.work_days : JSON.parse(schedule.work_days || "[]");
              return (
                <Card key={schedule.id}>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{schedule.schedule_name}</p>
                          {schedule.is_default && <Badge variant="default" className="text-[10px]">Padrão</Badge>}
                          <Badge variant="outline" className="text-[11px]">
                            {SCHEDULE_TYPES.find(t => t.value === schedule.schedule_type)?.label || schedule.schedule_type}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {schedule.user_id && (
                            <Badge variant="secondary" className="text-[11px]">
                              <Users className="h-3 w-3 mr-1" />
                              {profileMap.get(schedule.user_id) || "—"}
                            </Badge>
                          )}
                          {schedule.employee_type && (
                            <Badge variant="secondary" className="text-[11px]">
                              {schedule.employee_type === "tecnico" ? "Técnico" : schedule.employee_type === "ajudante" ? "Ajudante" : "Atendente"}
                            </Badge>
                          )}
                          {!schedule.user_id && !schedule.employee_type && (
                            <Badge variant="secondary" className="text-[11px]">Toda empresa</Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {schedule.expected_clock_in} — {schedule.expected_clock_out}
                          </span>
                          <span>{schedule.work_hours_per_day}h/dia</span>
                          <span>{schedule.break_minutes}min intervalo</span>
                          {schedule.hourly_rate && <span>R$ {Number(schedule.hourly_rate).toFixed(2)}/h</span>}
                        </div>
                        <div className="flex gap-1 mt-2">
                          {WEEK_DAYS.map(d => (
                            <span
                              key={d.value}
                              className={`text-[10px] px-1.5 py-0.5 rounded ${
                                days.includes(d.value)
                                  ? "bg-primary/10 text-primary font-medium"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {d.label}
                            </span>
                          ))}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(schedule.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
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