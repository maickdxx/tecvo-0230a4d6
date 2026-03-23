import { useState, useEffect } from "react";
import { ArrowLeft, Clock, MapPin, Timer, AlertTriangle, Camera, Wallet, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrganization } from "@/hooks/useOrganization";
import { useTimeClockAdmin } from "@/hooks/useTimeClock";
import { useWorkSchedules } from "@/hooks/useWorkSchedule";

interface TimeClockSettingsProps {
  onBack: () => void;
}

const WORK_DAYS = [
  { id: "seg", label: "Seg" },
  { id: "ter", label: "Ter" },
  { id: "qua", label: "Qua" },
  { id: "qui", label: "Qui" },
  { id: "sex", label: "Sex" },
  { id: "sab", label: "Sáb" },
  { id: "dom", label: "Dom" },
];

export function TimeClockSettings({ onBack }: TimeClockSettingsProps) {
  const { organization } = useOrganization();
  const { settings, updateSettings, isUpdatingSettings, toggleTimeClock, isTogglingTimeClock } = useTimeClockAdmin();
  const { hasSchedules } = useWorkSchedules();

  const isEnabled = !!(organization as any)?.time_clock_enabled;

  const [workHours, setWorkHours] = useState(8);
  const [breakMinutes, setBreakMinutes] = useState(60);
  const [lateTolerance, setLateTolerance] = useState(10);
  const [geoRequired, setGeoRequired] = useState(false);
  const [photoRequired, setPhotoRequired] = useState(false);
  const [expectedClockIn, setExpectedClockIn] = useState("08:00");
  const [workDays, setWorkDays] = useState<string[]>(["seg", "ter", "qua", "qui", "sex"]);
  const [flexibleSchedule, setFlexibleSchedule] = useState(false);
  const [overtimePolicy, setOvertimePolicy] = useState<string>("bank");
  const [defaultHourlyRate, setDefaultHourlyRate] = useState<string>("");
  const [overtimeRateWeekday, setOvertimeRateWeekday] = useState<number>(50);
  const [overtimeRateWeekend, setOvertimeRateWeekend] = useState<number>(100);
  const [considerSaturdayWeekend, setConsiderSaturdayWeekend] = useState(true);

  useEffect(() => {
    if (settings) {
      setWorkHours(settings.work_hours_per_day);
      setBreakMinutes(settings.min_break_minutes);
      setLateTolerance(settings.late_tolerance_minutes);
      setGeoRequired(settings.geolocation_required ?? false);
      setPhotoRequired((settings as any).photo_required ?? false);
      setExpectedClockIn(settings.expected_clock_in ?? "08:00");
      setWorkDays(settings.work_days);
      setFlexibleSchedule(settings.flexible_schedule ?? false);
      setOvertimePolicy((settings as any).overtime_policy ?? "bank");
      setDefaultHourlyRate((settings as any).default_hourly_rate ? String((settings as any).default_hourly_rate) : "");
      setOvertimeRateWeekday((settings as any).overtime_rate_weekday ?? 50);
      setOvertimeRateWeekend((settings as any).overtime_rate_weekend ?? 100);
      setConsiderSaturdayWeekend((settings as any).consider_saturday_weekend ?? true);
    }
  }, [settings]);

  const handleSave = () => {
    if (!hasSchedules && workDays.length === 0) {
      // Block saving without valid work days when no schedules exist
      return;
    }
    updateSettings({
      work_hours_per_day: workHours,
      min_break_minutes: breakMinutes,
      late_tolerance_minutes: lateTolerance,
      geolocation_required: geoRequired,
      photo_required: photoRequired,
      expected_clock_in: expectedClockIn,
      work_days: workDays,
      flexible_schedule: flexibleSchedule,
      overtime_policy: overtimePolicy,
      default_hourly_rate: defaultHourlyRate ? parseFloat(defaultHourlyRate) : null,
      overtime_rate_weekday: overtimeRateWeekday,
      overtime_rate_weekend: overtimeRateWeekend,
      consider_saturday_weekend: considerSaturdayWeekend,
    } as any);
  };

  const toggleDay = (day: string) => {
    setWorkDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-xl font-bold text-foreground">Controle de Ponto</h2>
          <p className="text-sm text-muted-foreground">Configure o sistema de ponto da sua equipe</p>
        </div>
      </div>

      {/* Enable/Disable */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Ativação do Sistema de Ponto
          </CardTitle>
          <CardDescription>Ative para habilitar o controle de ponto para sua equipe</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Sistema de Ponto</p>
              <p className="text-sm text-muted-foreground">
                {isEnabled ? "O módulo de ponto está ativo e visível para a equipe" : "O módulo de ponto está desativado"}
              </p>
            </div>
            <Switch
              checked={isEnabled}
              onCheckedChange={(checked) => toggleTimeClock(checked)}
              disabled={isTogglingTimeClock}
            />
          </div>
        </CardContent>
      </Card>

      {isEnabled && (
        <>
          {/* Schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Timer className="h-5 w-5 text-primary" />
                Jornada de Trabalho
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Horas por dia</Label>
                  <Input
                    type="number"
                    min={1}
                    max={24}
                    value={workHours}
                    onChange={e => setWorkHours(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Intervalo mínimo (min)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={120}
                    value={breakMinutes}
                    onChange={e => setBreakMinutes(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Horário de entrada esperado</Label>
                  <Input
                    type="time"
                    value={expectedClockIn}
                    onChange={e => setExpectedClockIn(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tolerância de atraso (min)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={60}
                    value={lateTolerance}
                    onChange={e => setLateTolerance(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Dias de trabalho</Label>
                <div className="flex gap-2 flex-wrap">
                  {WORK_DAYS.map(day => (
                    <button
                      key={day.id}
                      onClick={() => toggleDay(day.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        workDays.includes(day.id)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Horário flexível</p>
                  <p className="text-sm text-muted-foreground">Sem horário fixo de entrada</p>
                </div>
                <Switch checked={flexibleSchedule} onCheckedChange={setFlexibleSchedule} />
              </div>
            </CardContent>
          </Card>

          {/* Geolocation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Geolocalização
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Exigir localização no registro</p>
                  <p className="text-sm text-muted-foreground">O funcionário precisará compartilhar a localização ao bater o ponto</p>
                </div>
                <Switch checked={geoRequired} onCheckedChange={setGeoRequired} />
              </div>
            </CardContent>
          </Card>

          {/* Selfie */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-primary" />
                Selfie no Registro
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Exigir selfie ao bater ponto</p>
                  <p className="text-sm text-muted-foreground">O funcionário precisará tirar uma foto ao registrar o ponto</p>
                </div>
                <Switch checked={photoRequired} onCheckedChange={setPhotoRequired} />
              </div>
            </CardContent>
          </Card>

          {/* Overtime Policy */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                Política de Horas Extras
              </CardTitle>
              <CardDescription>Defina como a empresa trata horas excedentes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Modo de compensação</Label>
                <Select value={overtimePolicy} onValueChange={setOvertimePolicy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Banco de Horas — acumula saldo para compensação</SelectItem>
                    <SelectItem value="pay">Horas Extras — contabiliza para pagamento</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {overtimePolicy === "bank"
                    ? "As horas excedentes serão acumuladas no banco de horas do funcionário para compensação futura."
                    : "As horas excedentes serão contabilizadas como horas extras para pagamento em folha."}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Default Hourly Rate — only when pay mode */}
          {overtimePolicy === "pay" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Valor da Hora Padrão
                </CardTitle>
                <CardDescription>Usado para estimar o custo de horas extras</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label>Valor da hora padrão (R$)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Ex: 25.00"
                    value={defaultHourlyRate}
                    onChange={e => setDefaultHourlyRate(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Usado quando não houver valor definido no funcionário nem na escala. Prioridade: funcionário → escala → empresa.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Overtime Rates — only when pay mode */}
          {overtimePolicy === "pay" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  Adicionais de Horas Extras
                </CardTitle>
                <CardDescription>Percentuais aplicados sobre o valor da hora conforme o tipo de dia</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Adicional dia útil (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={200}
                      value={overtimeRateWeekday}
                      onChange={e => setOvertimeRateWeekday(Number(e.target.value))}
                    />
                    <p className="text-[10px] text-muted-foreground">Ex: 50 = hora + 50%</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Adicional fim de semana (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={200}
                      value={overtimeRateWeekend}
                      onChange={e => setOvertimeRateWeekend(Number(e.target.value))}
                    />
                    <p className="text-[10px] text-muted-foreground">Ex: 100 = hora + 100%</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Sábado como fim de semana</p>
                    <p className="text-xs text-muted-foreground">Aplica o adicional de fim de semana aos sábados</p>
                  </div>
                  <Switch checked={considerSaturdayWeekend} onCheckedChange={setConsiderSaturdayWeekend} />
                </div>
              </CardContent>
            </Card>
          )}

          {!hasSchedules && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-800 dark:text-amber-200">
                Configure uma escala de trabalho antes de salvar. Sem escala, os cálculos de ponto não funcionarão corretamente.
              </p>
            </div>
          )}

          <Button onClick={handleSave} disabled={isUpdatingSettings || (!hasSchedules && workDays.length === 0)} className="w-full">
            {isUpdatingSettings ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </>
      )}
    </div>
  );
}
