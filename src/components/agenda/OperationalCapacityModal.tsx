import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings2 } from "lucide-react";
import type { OperationalCapacityConfig, OperationalCapacityConfigFormData } from "@/hooks/useOperationalCapacityConfig";

interface OperationalCapacityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: OperationalCapacityConfig | null;
  onSave: (data: OperationalCapacityConfigFormData) => Promise<void>;
  isSaving: boolean;
  mandatory?: boolean;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToTimeStr(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${m > 0 ? `${String(m).padStart(2, "0")}min` : ""}`;
}

export function OperationalCapacityModal({
  open,
  onOpenChange,
  config,
  onSave,
  isSaving,
  mandatory = false,
}: OperationalCapacityModalProps) {
  const [activeTeams, setActiveTeams] = useState(config?.active_teams ?? 1);
  const [scheduleMode, setScheduleMode] = useState<"total_hours" | "start_end">(config?.schedule_mode ?? "total_hours");
  const [startTime, setStartTime] = useState(config?.start_time ?? "08:00");
  const [endTime, setEndTime] = useState(config?.end_time ?? "18:00");
  const [breakMin, setBreakMin] = useState(config?.break_minutes ?? 72);
  const [totalMin, setTotalMin] = useState(config?.total_minutes_per_day ?? 528);
  const [worksSaturday, setWorksSaturday] = useState(config?.works_saturday ?? false);
  const [saturdayMin, setSaturdayMin] = useState(config?.saturday_minutes ?? 0);
  const [travelMin, setTravelMin] = useState(config?.default_travel_minutes ?? 30);

  useEffect(() => {
    if (config) {
      setActiveTeams(config.active_teams);
      setScheduleMode(config.schedule_mode as "total_hours" | "start_end");
      setStartTime(config.start_time ?? "08:00");
      setEndTime(config.end_time ?? "18:00");
      setBreakMin(config.break_minutes ?? 72);
      setTotalMin(config.total_minutes_per_day);
      setWorksSaturday(config.works_saturday);
      setSaturdayMin(config.saturday_minutes ?? 0);
      setTravelMin(config.default_travel_minutes);
    }
  }, [config]);

  const computedMinFromSchedule = useCallback(() => {
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);
    return Math.max(end - start - (breakMin || 0), 0);
  }, [startTime, endTime, breakMin]);

  const effectiveMinPerDay = scheduleMode === "start_end" ? computedMinFromSchedule() : totalMin;
  const dailyCapacity = effectiveMinPerDay * activeTeams;

  const handleSave = async () => {
    await onSave({
      active_teams: activeTeams,
      schedule_mode: scheduleMode,
      start_time: scheduleMode === "start_end" ? startTime : null,
      end_time: scheduleMode === "start_end" ? endTime : null,
      break_minutes: scheduleMode === "start_end" ? breakMin : null,
      total_minutes_per_day: effectiveMinPerDay,
      works_saturday: worksSaturday,
      saturday_minutes: worksSaturday ? saturdayMin : 0,
      default_travel_minutes: travelMin,
    });
    if (!mandatory) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={mandatory ? undefined : onOpenChange}>
      <DialogContent
        className="sm:max-w-lg max-h-[90dvh] flex flex-col"
        onPointerDownOutside={mandatory ? (e) => e.preventDefault() : undefined}
        onEscapeKeyDown={mandatory ? (e) => e.preventDefault() : undefined}
      >
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Estrutura Operacional
          </DialogTitle>
          <DialogDescription>
            Defina a capacidade operacional da sua empresa para que a Agenda calcule a ocupação real.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2 overflow-y-auto flex-1 min-h-0 pr-1">
          {/* Active teams */}
          <div className="space-y-1.5">
            <Label>Equipes ativas na rua</Label>
            <Input
              type="number"
              min={1}
              max={50}
              value={activeTeams}
              onChange={(e) => setActiveTeams(Math.max(1, parseInt(e.target.value) || 1))}
            />
            <p className="text-2xs text-muted-foreground">Quantas equipes trabalham simultaneamente em campo</p>
          </div>

          {/* Schedule mode */}
          <div className="space-y-2">
            <Label>Jornada diária por equipe</Label>
            <Tabs value={scheduleMode} onValueChange={(v) => setScheduleMode(v as "total_hours" | "start_end")}>
              <TabsList className="w-full">
                <TabsTrigger value="total_hours" className="flex-1 text-xs">Total de horas</TabsTrigger>
                <TabsTrigger value="start_end" className="flex-1 text-xs">Início e término</TabsTrigger>
              </TabsList>
            </Tabs>

            {scheduleMode === "total_hours" ? (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Minutos trabalhados por dia</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={60}
                    max={1440}
                    value={totalMin}
                    onChange={(e) => setTotalMin(Math.max(60, parseInt(e.target.value) || 528))}
                    className="w-28"
                  />
                  <span className="text-sm text-muted-foreground">= {minutesToTimeStr(totalMin)}</span>
                </div>
                <p className="text-2xs text-muted-foreground">Ex: 528 min = 8h48 (44h semanais CLT)</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Início</Label>
                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Término</Label>
                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Pausa (min)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={180}
                    value={breakMin}
                    onChange={(e) => setBreakMin(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                </div>
              </div>
            )}

            {scheduleMode === "start_end" && (
              <p className="text-xs text-muted-foreground">
                Jornada líquida: <strong>{minutesToTimeStr(effectiveMinPerDay)}</strong>
              </p>
            )}
          </div>

          {/* Saturday */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Trabalha sábado?</Label>
              <Switch checked={worksSaturday} onCheckedChange={setWorksSaturday} />
            </div>
            {worksSaturday && (
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={0}
                  max={720}
                  value={saturdayMin}
                  onChange={(e) => setSaturdayMin(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-28"
                />
                <span className="text-sm text-muted-foreground">min = {minutesToTimeStr(saturdayMin)}</span>
              </div>
            )}
          </div>

          {/* Travel default */}
          <div className="space-y-1.5">
            <Label>Deslocamento padrão entre serviços (min)</Label>
            <Input
              type="number"
              min={0}
              max={120}
              value={travelMin}
              onChange={(e) => setTravelMin(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-28"
            />
            <p className="text-2xs text-muted-foreground">Usado quando não há integração com mapa</p>
          </div>

          {/* Summary */}
          <div className="rounded-xl bg-muted/40 p-4 space-y-1">
            <p className="text-xs font-medium text-foreground">Resumo da capacidade</p>
            <p className="text-sm text-muted-foreground">
              Jornada por equipe: <strong className="text-foreground">{minutesToTimeStr(effectiveMinPerDay)}</strong>
            </p>
            <p className="text-sm text-muted-foreground">
              Equipes: <strong className="text-foreground">{activeTeams}</strong>
            </p>
            <p className="text-sm text-primary font-semibold">
              Capacidade diária total: {minutesToTimeStr(dailyCapacity)}
            </p>
          </div>
        </div>

        <DialogFooter>
          {!mandatory && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          )}
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Salvando..." : "Salvar Configuração"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
