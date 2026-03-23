import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout";
import { useTimeClock } from "@/hooks/useTimeClock";
import { useWorkSchedules } from "@/hooks/useWorkSchedule";
import { useAuth } from "@/hooks/useAuth";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatTimeInTz, getDatePartInTz } from "@/lib/timezone";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, Edit3 } from "lucide-react";
import { calculateOvertimeMinutes } from "@/lib/timeClockUtils";

function getMonthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = subMonths(now, i);
    const value = format(d, "yyyy-MM");
    const label = format(d, "MMMM yyyy", { locale: ptBR });
    options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return options;
}

export default function HistoricoPonto() {
  const { user, profile } = useAuth();
  const tz = useOrgTimezone();
  const { settings } = useTimeClock();
  const { getScheduleForEmployee, isWorkDay } = useWorkSchedules();
  const employeeType = (profile as any)?.employee_type || "tecnico";
  const schedule = getScheduleForEmployee(user?.id || "", employeeType);
  const toleranceMin = settings?.late_tolerance_minutes ?? 10;
  const expectedPerDay = Math.round(schedule.work_hours_per_day * 60);

  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const monthOptions = useMemo(() => getMonthOptions(), []);

  // Fetch entries for selected month
  const { data: entries = [] } = useQuery({
    queryKey: ["historico-ponto-entries", user?.id, selectedMonth],
    queryFn: async () => {
      const [y, m] = selectedMonth.split("-").map(Number);
      const start = new Date(y, m - 1, 1).toISOString();
      const end = new Date(y, m, 0, 23, 59, 59).toISOString();
      const { data, error } = await supabase
        .from("time_clock_entries")
        .select("*")
        .eq("user_id", user!.id)
        .gte("recorded_at", start)
        .lte("recorded_at", end)
        .order("recorded_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch adjustments for these entries
  const entryIds = useMemo(() => entries.map((e: any) => e.id), [entries]);
  const { data: adjustments = [] } = useQuery({
    queryKey: ["historico-ponto-adj", entryIds],
    queryFn: async () => {
      if (entryIds.length === 0) return [];
      const { data, error } = await supabase
        .from("time_clock_adjustments")
        .select("entry_id, new_time, status, created_at")
        .in("entry_id", entryIds);
      if (error) throw error;
      return data || [];
    },
    enabled: entryIds.length > 0,
  });

  // Build adjustment map: entry_id -> latest approved/pending
  const adjMap = useMemo(() => {
    const map = new Map<string, { status: string; newTime: string | null }>();
    for (const a of adjustments) {
      const existing = map.get(a.entry_id);
      if (!existing || a.status === "approved") {
        map.set(a.entry_id, { status: a.status, newTime: a.new_time });
      }
    }
    return map;
  }, [adjustments]);

  // Group by date
  const dailyRecords = useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const start = startOfMonth(new Date(y, m - 1));
    const end = endOfMonth(new Date(y, m - 1));
    const days = eachDayOfInterval({ start, end });

    const byDate = new Map<string, typeof entries>();
    for (const e of entries) {
      const d = getDatePartInTz(e.recorded_at, tz);
      if (!byDate.has(d)) byDate.set(d, []);
      byDate.get(d)!.push(e);
    }

    return days.map((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const dayEntries = (byDate.get(dateStr) || []).sort((a: any, b: any) => 
        a.recorded_at.localeCompare(b.recorded_at)
      );

      const getEntry = (type: string) => dayEntries.find((e: any) => e.entry_type === type);
      const getEffectiveTime = (entry: any) => {
        if (!entry) return null;
        const adj = adjMap.get(entry.id);
        if (adj?.status === "approved" && adj.newTime) return adj.newTime;
        return entry.recorded_at;
      };
      const hasAdj = (entry: any) => {
        if (!entry) return false;
        return adjMap.has(entry.id);
      };
      const getAdjStatus = (entry: any) => {
        if (!entry) return null;
        return adjMap.get(entry.id)?.status || null;
      };

      const clockIn = getEntry("clock_in");
      const breakStart = getEntry("break_start");
      const breakEnd = getEntry("break_end");
      const clockOut = getEntry("clock_out");

      // Calculate worked minutes
      let workedMinutes = 0;
      let ci: Date | null = null;
      for (const e of dayEntries) {
        const t = new Date(getEffectiveTime(e) || e.recorded_at);
        if (e.entry_type === "clock_in" || e.entry_type === "break_end") ci = t;
        if ((e.entry_type === "break_start" || e.entry_type === "clock_out") && ci) {
          workedMinutes += (t.getTime() - ci.getTime()) / 60000;
          ci = null;
        }
      }

      const hasClockOut = !!clockOut;
      const isWorkingDay = isWorkDay(dateStr, user?.id || "", employeeType);
      const isIncomplete = isWorkingDay && dayEntries.length > 0 && !hasClockOut;
      const isFuture = day > new Date();
      const isMissing = isWorkingDay && dayEntries.length === 0 && !isFuture;
      const anyAdjusted = dayEntries.some((e: any) => hasAdj(e));

      return {
        date: dateStr,
        dayLabel: format(day, "EEE, dd", { locale: ptBR }),
        clockInTime: clockIn ? formatTimeInTz(getEffectiveTime(clockIn)!, tz) : null,
        breakStartTime: breakStart ? formatTimeInTz(getEffectiveTime(breakStart)!, tz) : null,
        breakEndTime: breakEnd ? formatTimeInTz(getEffectiveTime(breakEnd)!, tz) : null,
        clockOutTime: clockOut ? formatTimeInTz(getEffectiveTime(clockOut)!, tz) : null,
        workedMinutes: Math.round(workedMinutes),
        isWorkingDay,
        isIncomplete,
        isMissing,
        isFuture,
        anyAdjusted,
        hasEntries: dayEntries.length > 0,
      };
    });
  }, [entries, adjMap, selectedMonth, tz, user, employeeType]);

  const firstName = profile?.full_name?.split(" ")[0] || "Funcionário";

  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Histórico de Ponto</h1>
          <p className="text-sm text-muted-foreground">{firstName} — Registros mensais</p>
        </div>

        {/* Month Selector */}
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Daily Records */}
        <div className="space-y-2">
          {dailyRecords.map((day) => {
            if (day.isFuture) return null;

            return (
              <Card key={day.date} className={day.isMissing ? "border-destructive/30" : ""}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="min-w-[80px]">
                        <p className="text-sm font-medium capitalize">{day.dayLabel}</p>
                      </div>

                      {!day.isWorkingDay && !day.hasEntries ? (
                        <span className="text-xs text-muted-foreground">Folga</span>
                      ) : day.isMissing ? (
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                          <span className="text-xs text-destructive font-medium">Falta</span>
                        </div>
                      ) : day.hasEntries ? (
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span>{day.clockInTime || "—"}</span>
                          <span className="text-muted-foreground/40">→</span>
                          <span>{day.breakStartTime || "—"}</span>
                          <span className="text-muted-foreground/40">→</span>
                          <span>{day.breakEndTime || "—"}</span>
                          <span className="text-muted-foreground/40">→</span>
                          <span>{day.clockOutTime || "—"}</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {day.hasEntries && (
                        <span className="text-xs font-mono text-foreground">
                          {Math.floor(day.workedMinutes / 60)}h{String(day.workedMinutes % 60).padStart(2, "0")}
                        </span>
                      )}
                      {day.isIncomplete && (
                        <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600">
                          Incompleto
                        </Badge>
                      )}
                      {day.anyAdjusted && (
                        <Badge variant="outline" className="text-[10px] border-blue-500/50 text-blue-600">
                          <Edit3 className="h-2.5 w-2.5 mr-0.5" />
                          Ajustado
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
