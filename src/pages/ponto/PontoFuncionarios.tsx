import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout";
import { useTimeClockAdmin } from "@/hooks/useTimeClock";
import { useWorkSchedules } from "@/hooks/useWorkSchedule";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { getTodayInTz, formatTimeInTz } from "@/lib/timezone";
import { resolveHourlyRateWithSource, type HourlyRateSource } from "@/lib/timeClockUtils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { MapPin, Clock, AlertTriangle, TrendingUp, CalendarOff, DollarSign, Pencil, Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const EMPLOYEE_TYPE_LABELS: Record<string, string> = {
  tecnico: "Técnico",
  ajudante: "Ajudante",
  atendente: "Atendente",
};

type EmployeeStatus = "Presente" | "Atrasado" | "Em Pausa" | "Em Jornada" | "Encerrado" | "Ausente" | "Inconsistente" | "Folga";

const STATUS_CONFIG: Record<EmployeeStatus, { color: string; dotColor: string }> = {
  "Presente": { color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", dotColor: "bg-green-500" },
  "Atrasado": { color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400", dotColor: "bg-orange-500" },
  "Em Pausa": { color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400", dotColor: "bg-amber-500" },
  "Em Jornada": { color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", dotColor: "bg-blue-500" },
  "Encerrado": { color: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400", dotColor: "bg-slate-500" },
  "Ausente": { color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", dotColor: "bg-red-500" },
  "Inconsistente": { color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400", dotColor: "bg-purple-500" },
  "Folga": { color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", dotColor: "bg-blue-400" },
};

export default function PontoFuncionarios() {
  const { effectiveEntries, teamProfiles, settings, isLoading } = useTimeClockAdmin();
  const { isTodayWorkDay, getScheduleForEmployee, getNonWorkDayReason } = useWorkSchedules();
  const tz = useOrgTimezone();
  const queryClient = useQueryClient();

  const todayStr = getTodayInTz(tz);

  // Hourly rate edit dialog
  const [editingEmployee, setEditingEmployee] = useState<{ userId: string; name: string; currentRate: string } | null>(null);
  const [editRate, setEditRate] = useState("");
  const [rateError, setRateError] = useState("");
  const [isSavingRate, setIsSavingRate] = useState(false);

  const defaultHourlyRate = (settings as any)?.default_hourly_rate ?? null;

  const employees = useMemo(() => {
    return teamProfiles.map(p => {
      const employeeType = (p as any).employee_type || "tecnico";
      const isWorkDayToday = isTodayWorkDay(p.user_id, employeeType, tz);
      const schedule = getScheduleForEmployee(p.user_id, employeeType);
      const toleranceMin = settings?.late_tolerance_minutes ?? 10;
      const profileRate = (p as any).hourly_rate ?? null;
      const resolved = resolveHourlyRateWithSource(profileRate, schedule.hourly_rate, defaultHourlyRate);
      const effectiveRate = resolved.value;
      const rateSource = resolved.source;

      const todayEntries = effectiveEntries
        .filter(e => e.user_id === p.user_id && e.recorded_at.startsWith(todayStr))
        .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));

      const lastEntry = todayEntries[todayEntries.length - 1];
      const firstEntry = todayEntries[0];
      let status: EmployeeStatus = isWorkDayToday ? "Ausente" : "Folga";
      let isLate = false;
      let isInconsistent = false;
      let nonWorkReason: string | null = null;

      if (!isWorkDayToday) {
        nonWorkReason = getNonWorkDayReason(todayStr, p.user_id, employeeType);
      }

      if (firstEntry && firstEntry.entry_type === "clock_in" && schedule.expected_clock_in) {
        const entryTime = new Date(firstEntry.recorded_at);
        const [h, m] = schedule.expected_clock_in.split(":").map(Number);
        const expected = new Date(entryTime);
        expected.setHours(h, m + toleranceMin, 0, 0);
        if (entryTime > expected) isLate = true;
      }

      const types = todayEntries.map(e => e.entry_type);
      const hasMultipleClockIn = types.filter(t => t === "clock_in").length > 1;
      const hasBreakStartNoEnd = types.includes("break_start") && !types.includes("break_end") && lastEntry?.entry_type !== "break_start";
      if (hasMultipleClockIn || hasBreakStartNoEnd) isInconsistent = true;

      if (lastEntry) {
        if (isInconsistent) status = "Inconsistente";
        else if (lastEntry.entry_type === "clock_out") status = "Encerrado";
        else if (lastEntry.entry_type === "break_start") status = "Em Pausa";
        else if (isLate) status = "Atrasado";
        else if (lastEntry.entry_type === "clock_in" || lastEntry.entry_type === "break_end") {
          status = todayEntries.length === 1 ? "Presente" : "Em Jornada";
        }
      }

      let workedMin = 0;
      let clockIn: Date | null = null;
      for (const e of todayEntries) {
        const t = new Date(e.recorded_at);
        switch (e.entry_type) {
          case "clock_in": clockIn = t; break;
          case "break_start": if (clockIn) { workedMin += (t.getTime() - clockIn.getTime()) / 60000; clockIn = null; } break;
          case "break_end": clockIn = t; break;
          case "clock_out": if (clockIn) { workedMin += (t.getTime() - clockIn.getTime()) / 60000; clockIn = null; } break;
        }
      }
      if (clockIn && lastEntry?.entry_type !== "clock_out" && lastEntry?.entry_type !== "break_start") {
        workedMin += (Date.now() - clockIn.getTime()) / 60000;
      }

      const entryTime = firstEntry ? formatTimeInTz(firstEntry.recorded_at, tz) : null;

      return {
        userId: p.user_id,
        name: p.full_name || "Sem nome",
        type: employeeType,
        fieldWorker: !!(p as any).field_worker,
        status,
        isLate,
        isWorkDayToday,
        nonWorkReason,
        todayRecords: todayEntries.length,
        workedMinutes: Math.floor(workedMin),
        entryTime,
        profileRate,
        effectiveRate,
        rateSource,
      };
    }).sort((a, b) => {
      if (a.isWorkDayToday !== b.isWorkDayToday) return a.isWorkDayToday ? -1 : 1;
      const order: Record<EmployeeStatus, number> = { "Inconsistente": 0, "Atrasado": 1, "Em Pausa": 2, "Em Jornada": 3, "Presente": 4, "Ausente": 5, "Encerrado": 6, "Folga": 7 };
      return (order[a.status] ?? 9) - (order[b.status] ?? 9);
    });
  }, [teamProfiles, effectiveEntries, todayStr, isTodayWorkDay, getScheduleForEmployee, getNonWorkDayReason, settings, defaultHourlyRate]);

  const formatRateDisplay = (value: number | null) => {
    if (value == null) return "";
    return value.toFixed(2).replace(".", ",");
  };

  const openRateDialog = (emp: typeof employees[0]) => {
    setEditingEmployee({ userId: emp.userId, name: emp.name, currentRate: emp.profileRate ? String(emp.profileRate) : "" });
    setEditRate(emp.profileRate ? formatRateDisplay(emp.profileRate) : "");
    setRateError("");
  };

  const handleRateChange = (raw: string) => {
    // Allow only digits, comma, and dot
    const sanitized = raw.replace(/[^0-9.,]/g, "");
    setEditRate(sanitized);
    setRateError("");
  };

  const parseRate = (input: string): number | null => {
    const trimmed = input.trim();
    if (!trimmed) return null; // empty = null (fallback)
    const normalized = trimmed.replace(",", ".");
    const num = Number(normalized);
    if (isNaN(num) || !isFinite(num)) return undefined as any; // invalid
    if (num <= 0) return null; // treat <= 0 as null
    return Math.round(num * 100) / 100;
  };

  const saveRate = async () => {
    if (!editingEmployee) return;
    const parsed = parseRate(editRate);
    if (parsed === (undefined as any)) {
      setRateError("Informe um valor válido maior que zero");
      return;
    }
    // If user typed something but it parsed to null (<=0), show error
    if (editRate.trim() && parsed === null) {
      setRateError("Informe um valor válido maior que zero");
      return;
    }
    setIsSavingRate(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ hourly_rate: parsed } as any)
        .eq("user_id", editingEmployee.userId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["time-clock-team-profiles"] });
      toast({ title: "Valor da hora atualizado" });
      setEditingEmployee(null);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro", description: err.message });
    } finally {
      setIsSavingRate(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Funcionários</h1>
          <p className="text-sm text-muted-foreground">Status em tempo real da equipe</p>
        </div>

        {isLoading ? (
          <Card><CardContent className="p-6 text-center text-muted-foreground">Carregando...</CardContent></Card>
        ) : employees.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-muted-foreground">Nenhum funcionário encontrado</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {employees.map(emp => {
              const cfg = STATUS_CONFIG[emp.status];
              const wH = Math.floor(emp.workedMinutes / 60);
              const wM = emp.workedMinutes % 60;
              return (
                <Card key={emp.userId} className={!emp.isWorkDayToday ? "opacity-60" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dotColor}`} />
                          <p className="font-semibold text-sm truncate">{emp.name}</p>
                        </div>
                        <div className="flex gap-1.5 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-[11px]">{EMPLOYEE_TYPE_LABELS[emp.type]}</Badge>
                          {emp.isLate && <Badge variant="destructive" className="text-[11px]">Atrasado</Badge>}
                        </div>
                      </div>
                      <Badge className={`${cfg.color} text-[11px] shrink-0`}>{emp.status}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {emp.entryTime && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          <span>Entrada: {emp.entryTime}</span>
                        </div>
                      )}
                      {emp.workedMinutes > 0 && (
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-3.5 w-3.5" />
                          <span>{wH}h{wM.toString().padStart(2, "0")}</span>
                        </div>
                      )}
                      {emp.fieldWorker && (
                        <div className="flex items-center gap-1 text-blue-600">
                          <MapPin className="h-3.5 w-3.5" />
                          <span>Campo</span>
                        </div>
                      )}
                    </div>
                    {/* Hourly rate indicator */}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <DollarSign className="h-3 w-3" />
                        {emp.effectiveRate ? (
                          <span>
                            R$ {Number(emp.effectiveRate).toFixed(2).replace(".", ",")}/h
                            <span className="text-[10px] opacity-60 ml-1">
                              ({emp.rateSource === "profile" ? "funcionário" : emp.rateSource === "schedule" ? "escala" : "empresa"})
                            </span>
                          </span>
                        ) : (
                          <span className="italic">Sem valor/hora</span>
                        )}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3 w-3 opacity-40 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[200px] text-xs">
                              Prioridade: funcionário → escala → empresa
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => openRateDialog(emp)}>
                        <Pencil className="h-3 w-3 mr-1" /> Editar
                      </Button>
                    </div>
                    {emp.status === "Inconsistente" && (
                      <div className="flex items-center gap-1.5 mt-2 text-[11px] text-purple-600">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>Registros inconsistentes detectados</span>
                      </div>
                    )}
                    {!emp.isWorkDayToday && emp.nonWorkReason && (
                      <div className="flex items-center gap-1.5 mt-2 text-[11px] text-blue-600">
                        <CalendarOff className="h-3.5 w-3.5" />
                        <span>{emp.nonWorkReason}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit hourly rate dialog */}
      <Dialog open={!!editingEmployee} onOpenChange={() => setEditingEmployee(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Valor da Hora — {editingEmployee?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Valor da hora (R$)</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="Ex: 25,00"
                value={editRate}
                onChange={e => handleRateChange(e.target.value)}
                className={rateError ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {rateError && (
                <p className="text-xs text-destructive">{rateError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Se preenchido, este valor terá prioridade no cálculo estimado de horas extras. Deixe vazio para usar o valor da escala ou padrão da empresa.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingEmployee(null)}>Cancelar</Button>
            <Button onClick={saveRate} disabled={isSavingRate}>
              {isSavingRate ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
