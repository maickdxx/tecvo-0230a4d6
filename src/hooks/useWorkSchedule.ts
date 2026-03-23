import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface WorkSchedule {
  schedule_name: string;
  schedule_type: string;
  work_days: string[];
  expected_clock_in: string;
  expected_clock_out: string;
  work_hours_per_day: number;
  break_minutes: number;
  hourly_rate: number | null;
}

interface CalendarEvent {
  id: string;
  event_type: string;
  title: string;
  start_date: string;
  end_date: string;
  user_id: string | null;
}

// Standard PT-BR day names used throughout the system
const DAY_NAMES = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

// Map English day abbreviations to PT-BR for backward compatibility
const EN_TO_PT: Record<string, string> = {
  sun: "dom", mon: "seg", tue: "ter", wed: "qua", thu: "qui", fri: "sex", sat: "sab",
  sunday: "dom", monday: "seg", tuesday: "ter", wednesday: "qua", thursday: "qui", friday: "sex", saturday: "sab",
};

const DEFAULT_SCHEDULE: WorkSchedule = {
  schedule_name: "Padrão",
  schedule_type: "5x2",
  work_days: ["seg", "ter", "qua", "qui", "sex"],
  expected_clock_in: "08:00",
  expected_clock_out: "17:48",
  work_hours_per_day: 8,
  break_minutes: 60,
  hourly_rate: null,
};

/**
 * Normalize a single day string to PT-BR format.
 * Handles: "mon" -> "seg", "seg" -> "seg", "Mon" -> "seg"
 */
function normalizeDayName(day: string): string {
  const lower = day.toLowerCase().trim();
  return EN_TO_PT[lower] || lower;
}

/**
 * Parse and normalize work_days from any format to PT-BR string array.
 */
function parseWorkDays(raw: any): string[] {
  let days: string[] = [];
  if (Array.isArray(raw)) {
    days = raw;
  } else if (typeof raw === "string") {
    try { days = JSON.parse(raw); } catch { return []; }
  } else {
    return [];
  }
  return days.map(normalizeDayName).filter(d => DAY_NAMES.includes(d));
}

export function useWorkSchedules() {
  const { profile } = useAuth();
  const orgId = (profile as any)?.organization_id;

  const { data: schedules = [] } = useQuery({
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

  const { data: calendarEvents = [] } = useQuery({
    queryKey: ["time-clock-calendar-events", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_clock_calendar_events")
        .select("*")
        .eq("organization_id", orgId);
      if (error) throw error;
      return (data || []) as CalendarEvent[];
    },
    enabled: !!orgId,
  });

  const { data: settings } = useQuery({
    queryKey: ["time-clock-settings", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_clock_settings")
        .select("*")
        .eq("organization_id", orgId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  // Build non-working date sets
  const { globalNonWorkDates, userNonWorkDates } = useMemo(() => {
    const globalDates = new Set<string>();
    const userDates = new Map<string, Set<string>>();

    for (const event of calendarEvents) {
      const start = new Date(event.start_date + "T12:00:00");
      const end = new Date(event.end_date + "T12:00:00");
      const isGlobal = !event.user_id && ["holiday", "day_off"].includes(event.event_type);
      const isUserSpecific = !!event.user_id;

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toLocaleDateString("en-CA");
        if (isGlobal) {
          globalDates.add(dateStr);
        }
        if (isUserSpecific) {
          if (!userDates.has(event.user_id!)) userDates.set(event.user_id!, new Set());
          userDates.get(event.user_id!)!.add(dateStr);
        }
      }
    }
    return { globalNonWorkDates: globalDates, userNonWorkDates: userDates };
  }, [calendarEvents]);

  /**
   * Get the effective work schedule for a specific employee.
   * Priority: individual schedule > employee_type schedule > default schedule > settings fallback
   */
  const getScheduleForEmployee = (userId: string, employeeType?: string): WorkSchedule => {
    // 1. Individual schedule
    const individual = schedules.find((s: any) => s.user_id === userId);
    if (individual) return scheduleFromRow(individual);

    // 2. Employee type schedule
    if (employeeType) {
      const typeSchedule = schedules.find((s: any) => !s.user_id && s.employee_type === employeeType);
      if (typeSchedule) return scheduleFromRow(typeSchedule);
    }

    // 3. Default org schedule
    const defaultSchedule = schedules.find((s: any) => s.is_default && !s.user_id && !s.employee_type);
    if (defaultSchedule) return scheduleFromRow(defaultSchedule);

    // 4. Fallback to time_clock_settings (normalize EN -> PT)
    if (settings) {
      return {
        schedule_name: "Configuração Global",
        schedule_type: "custom",
        work_days: parseWorkDays(settings.work_days) || DEFAULT_SCHEDULE.work_days,
        expected_clock_in: settings.expected_clock_in || DEFAULT_SCHEDULE.expected_clock_in,
        expected_clock_out: DEFAULT_SCHEDULE.expected_clock_out,
        work_hours_per_day: settings.work_hours_per_day || DEFAULT_SCHEDULE.work_hours_per_day,
        break_minutes: settings.min_break_minutes || DEFAULT_SCHEDULE.break_minutes,
        hourly_rate: (settings as any).default_hourly_rate ?? null,
      };
    }

    return DEFAULT_SCHEDULE;
  };

  /**
   * Check if a specific date is a work day for an employee.
   */
  const isWorkDay = (dateStr: string, userId: string, employeeType?: string): boolean => {
    if (globalNonWorkDates.has(dateStr)) return false;
    const userLeaves = userNonWorkDates.get(userId);
    if (userLeaves?.has(dateStr)) return false;

    const schedule = getScheduleForEmployee(userId, employeeType);
    const date = new Date(dateStr + "T12:00:00");
    const dayName = DAY_NAMES[date.getDay()];
    return schedule.work_days.includes(dayName);
  };

  const isTodayWorkDay = (userId: string, employeeType?: string, timezone?: string): boolean => {
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: timezone || "America/Sao_Paulo" });
    return isWorkDay(todayStr, userId, employeeType);
  };

  const getNonWorkDayReason = (dateStr: string, userId: string, employeeType?: string): string | null => {
    if (globalNonWorkDates.has(dateStr)) {
      const event = calendarEvents.find(e =>
        !e.user_id && ["holiday", "day_off"].includes(e.event_type) &&
        dateStr >= e.start_date && dateStr <= e.end_date
      );
      if (event) {
        return event.event_type === "holiday" ? `Feriado: ${event.title}` : `Folga: ${event.title}`;
      }
      return "Feriado/Folga";
    }

    const userLeaves = userNonWorkDates.get(userId);
    if (userLeaves?.has(dateStr)) {
      const event = calendarEvents.find(e =>
        e.user_id === userId && dateStr >= e.start_date && dateStr <= e.end_date
      );
      if (event) {
        const labels: Record<string, string> = {
          vacation: "Férias", sick_leave: "Atestado", leave: "Afastamento",
          day_off: "Folga", bonus: "Abono",
        };
        return `${labels[event.event_type] || event.event_type}: ${event.title}`;
      }
      return "Afastamento";
    }

    const schedule = getScheduleForEmployee(userId, employeeType);
    const date = new Date(dateStr + "T12:00:00");
    const dayName = DAY_NAMES[date.getDay()];
    if (!schedule.work_days.includes(dayName)) {
      const dayLabels: Record<string, string> = {
        dom: "Domingo", seg: "Segunda", ter: "Terça", qua: "Quarta",
        qui: "Quinta", sex: "Sexta", sab: "Sábado",
      };
      return `${dayLabels[dayName]} fora da escala de trabalho`;
    }

    return null;
  };

  const countExpectedWorkDays = (userId: string, employeeType: string | undefined, startDate: Date, endDate: Date, timezone?: string): number => {
    let count = 0;
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = timezone ? d.toLocaleDateString("en-CA", { timeZone: timezone }) : d.toLocaleDateString("en-CA");
      if (isWorkDay(dateStr, userId, employeeType)) count++;
    }
    return count;
  };

  const hasSchedules = schedules.length > 0;
  const hasSettings = !!settings;
  const isConfigured = hasSchedules || hasSettings;

  return {
    schedules,
    calendarEvents,
    settings,
    getScheduleForEmployee,
    isWorkDay,
    isTodayWorkDay,
    getNonWorkDayReason,
    countExpectedWorkDays,
    globalNonWorkDates,
    userNonWorkDates,
    hasSchedules,
    hasSettings,
    isConfigured,
  };
}

function scheduleFromRow(row: any): WorkSchedule {
  return {
    schedule_name: row.schedule_name || "Escala",
    schedule_type: row.schedule_type || "custom",
    work_days: parseWorkDays(row.work_days),
    expected_clock_in: row.expected_clock_in || "08:00",
    expected_clock_out: row.expected_clock_out || "17:48",
    work_hours_per_day: row.work_hours_per_day || 8,
    break_minutes: row.break_minutes || 60,
    hourly_rate: row.hourly_rate ?? null,
  };
}
