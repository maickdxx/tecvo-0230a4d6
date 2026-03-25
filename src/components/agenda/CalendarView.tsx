import { useMemo } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Service, type ServiceStatus } from "@/hooks/useServices";
import { useServiceTypes } from "@/hooks/useServiceTypes";
import {
  formatTimeInTz,
  getDatePartInTz,
  getHourInTz,
  getMinutesInTz,
  isSameDayInTz,
  getTodayInTz,
  parseDurationToMinutes,
} from "@/lib/timezone";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle } from "lucide-react";

export type ViewMode = "month" | "week" | "day";

export function getEffectiveStatus(service: Service, tz?: string): ServiceStatus | "overdue" {
  if (service.status === "completed" || service.status === "cancelled") return service.status;
  if (service.status === "in_progress") return "in_progress";
  if (service.status !== "scheduled") return service.status;

  // Sem entry_date = sem horário definido = nunca pode ser "atrasado"
  if (!service.entry_date) return service.status;

  const timezone = tz || "America/Sao_Paulo";
  const todayStr = getTodayInTz(timezone);
  if (!service.scheduled_date || getDatePartInTz(service.scheduled_date, timezone) !== todayStr) return service.status;

  const nowTime = new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: timezone,
  });
  // Usa entry_date (horário de início real) para comparação
  const scheduledTime = formatTimeInTz(service.entry_date, timezone);
  if (!scheduledTime || scheduledTime === "—") return service.status;

  if (nowTime > scheduledTime) return "overdue";
  return "scheduled";
}

function hasOverload(dayServices: Service[]): boolean {
  const byTech: Record<string, number> = {};
  dayServices.forEach(s => {
    if (s.assigned_to) {
      byTech[s.assigned_to] = (byTech[s.assigned_to] || 0) + 1;
    }
  });
  return Object.values(byTech).some(count => count > 6);
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-500/20 border-blue-500 text-blue-700 dark:text-blue-300",
  in_progress: "bg-yellow-500/20 border-yellow-500 text-yellow-700 dark:text-yellow-300",
  completed: "bg-green-500/20 border-green-500 text-green-700 dark:text-green-300",
  cancelled: "bg-gray-500/20 border-gray-500 text-gray-700 dark:text-gray-300",
  overdue: "bg-red-500/20 border-red-500 text-red-700 dark:text-red-300",
};

// Service type dot colors for calendar month view
const SERVICE_TYPE_DOT_COLORS: Record<string, string> = {
  limpeza: "bg-green-500",
  instalacao: "bg-blue-500",
  manutencao: "bg-amber-500",
  reparo: "bg-red-500",
  
  contratos: "bg-purple-500",
  outros: "bg-gray-400",
};

function getServiceTypeDotColor(serviceType: string): string {
  return SERVICE_TYPE_DOT_COLORS[serviceType] || SERVICE_TYPE_DOT_COLORS.outros;
}

interface CalendarViewProps {
  currentDate: Date;
  viewMode: ViewMode;
  services: Service[];
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  onServiceClick: (service: Service) => void;
  onReschedule: (serviceId: string, newDate: Date) => void;
  isLoading: boolean;
  readOnly?: boolean;
}

export function CalendarView({
  currentDate,
  viewMode,
  services,
  selectedDate,
  onDateSelect,
  onServiceClick,
  onReschedule,
  isLoading,
  readOnly = false,
}: CalendarViewProps) {
  const tz = useOrgTimezone();
  const { typeLabels } = useServiceTypes();


  if (isLoading) {
    return (
      <div className="h-full rounded-lg border border-border bg-card p-4">
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  switch (viewMode) {
    case "month":
      return (
        <MonthView
          currentDate={currentDate}
          services={services}
          selectedDate={selectedDate}
          onDateSelect={onDateSelect}
          onServiceClick={onServiceClick}
          tz={tz}
          typeLabels={typeLabels}
        />
      );
    case "week":
      return (
        <WeekView
          currentDate={currentDate}
          services={services}
          selectedDate={selectedDate}
          onDateSelect={onDateSelect}
          onServiceClick={onServiceClick}
          tz={tz}
          typeLabels={typeLabels}
        />
      );
    case "day":
      return (
        <DayView
          currentDate={selectedDate || currentDate}
          services={services}
          onServiceClick={onServiceClick}
          tz={tz}
          typeLabels={typeLabels}
        />
      );
  }
}

// Month View Component
function MonthView({
  currentDate,
  services,
  selectedDate,
  onDateSelect,
  onServiceClick,
  tz,
  typeLabels,
}: {
  currentDate: Date;
  services: Service[];
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  onServiceClick: (service: Service) => void;
  tz: string;
  typeLabels: Record<string, string>;
}) {

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentDate]);

  const getServicesForDay = (day: Date) => {
    return services
      .filter((s) => isSameDayInTz(s.scheduled_date!, day, tz))
      .sort((a, b) => {
        const timeA = a.entry_date || a.scheduled_date || "";
        const timeB = b.entry_date || b.scheduled_date || "";
        return timeA.localeCompare(timeB);
      });
  };

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <div className="h-full rounded-lg border border-border bg-card flex flex-col">
      {/* Week day headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {weekDays.map((day) => (
          <div
            key={day}
            className="py-2 text-center text-sm font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr">
        {calendarDays.map((day, index) => {
          const dayServices = getServicesForDay(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const dayIsToday = isToday(day);
          const overloaded = hasOverload(dayServices);
          const isBusyDay = dayServices.length >= 5;

          // Get unique service types for dots
          const uniqueTypes = Array.from(new Set(dayServices.map(s => s.service_type)));

          return (
            <div
              key={index}
              onClick={() => onDateSelect(day)}
              className={cn(
                "min-h-[80px] border-b border-r border-border p-1 cursor-pointer transition-colors hover:bg-muted/50",
                !isCurrentMonth && "bg-muted/30",
                isSelected && "bg-primary/10 ring-1 ring-primary",
                overloaded && "ring-2 ring-amber-500 bg-amber-500/5",
                isBusyDay && !overloaded && !isSelected && "bg-primary/5"
              )}
            >
              <div className="flex justify-between items-start mb-1">
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-sm",
                    dayIsToday && "bg-primary text-primary-foreground font-bold",
                    !isCurrentMonth && "text-muted-foreground"
                  )}
                >
                  {format(day, "d")}
                </span>
                <div className="flex items-center gap-0.5">
                  {overloaded && (
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                  )}
                  {dayServices.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {dayServices.length}
                    </span>
                  )}
                </div>
              </div>

              {/* Service type dots + revenue */}
              {uniqueTypes.length > 0 && (
                <div className="flex items-center gap-1 mb-0.5 px-0.5">
                  <div className="flex gap-0.5">
                    {uniqueTypes.slice(0, 4).map((type) => (
                      <div
                        key={type}
                        className={cn("h-1.5 w-1.5 rounded-full", getServiceTypeDotColor(type))}
                      />
                    ))}
                  </div>
                  {(() => {
                    const total = dayServices.reduce((s, sv) => s + (sv.value || 0), 0);
                    if (total <= 0) return null;
                    const label = total >= 1000 ? `R$ ${(total / 1000).toFixed(1)}k` : `R$ ${total}`;
                    return <span className="text-2xs text-primary/60 number-display ml-auto">{label}</span>;
                  })()}
                </div>
              )}

              <div className="space-y-0.5 overflow-hidden">
                {dayServices.slice(0, 3).map((service) => {
                  const effectiveStatus = getEffectiveStatus(service, tz);
                  return (
                    <div
                      key={service.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onServiceClick(service);
                      }}
                      className={cn(
                        "text-2xs px-1 py-0.5 rounded border-l-2 truncate cursor-pointer hover:opacity-80",
                        STATUS_COLORS[effectiveStatus]
                      )}
                    >
                      {service.client?.name || typeLabels[service.service_type] || service.service_type}
                    </div>
                  );
                })}
                {dayServices.length > 3 && (
                  <div className="text-2xs text-muted-foreground px-1">
                    +{dayServices.length - 3} mais
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Helper to compute top/height for absolute positioned service blocks
const WEEK_SLOT_HEIGHT = 64; // h-16 = 64px
const WEEK_GRID_START_HOUR = 6;

function getServicePosition(service: Service, slotHeight: number, gridStartHour: number, tz: string) {
  const dateStr = service.entry_date || service.scheduled_date || "";
  const startHour = getHourInTz(dateStr, tz);
  const startMinutes = getMinutesInTz(dateStr, tz);

  const top = (startHour - gridStartHour) * slotHeight + (startMinutes / 60) * slotHeight;

  let height = slotHeight; // default 1h
  
  // 1. Real duration from execution
  if (service.entry_date && service.exit_date) {
    const endHour = getHourInTz(service.exit_date, tz);
    const endMinutes = getMinutesInTz(service.exit_date, tz);
    const durationMinutes = (endHour * 60 + endMinutes) - (startHour * 60 + startMinutes);
    if (durationMinutes > 0) {
      height = (durationMinutes / 60) * slotHeight;
    }
  } 
  // 2. Estimated duration from items
  else if (service.estimated_duration) {
    const dur = parseDurationToMinutes(service.estimated_duration);
    if (dur > 0) {
      height = (dur / 60) * slotHeight;
    }
  }


  return { top, height: Math.max(height, slotHeight * 0.5) }; // min 30min visual
}

// Week View Component
function WeekView({
  currentDate,
  services,
  selectedDate,
  onDateSelect,
  onServiceClick,
  tz,
  typeLabels,
}: {
  currentDate: Date;
  services: Service[];
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  onServiceClick: (service: Service) => void;
  tz: string;
  typeLabels: Record<string, string>;
}) {
  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  }, [currentDate]);

  const hours = useMemo(() => {
    return Array.from({ length: 13 }, (_, i) => i + WEEK_GRID_START_HOUR);
  }, []);

  const getServicesForDay = (day: Date) => {
    return services
      .filter((s) => isSameDayInTz(s.scheduled_date!, day, tz))
      .sort((a, b) => {
        const timeA = a.entry_date || a.scheduled_date || "";
        const timeB = b.entry_date || b.scheduled_date || "";
        return timeA.localeCompare(timeB);
      });
  };

  return (
    <div className="h-full rounded-lg border border-border bg-card flex flex-col overflow-hidden">
      {/* Header with days */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border">
        <div className="py-2 text-center text-sm font-medium text-muted-foreground border-r border-border" />
        {weekDays.map((day) => {
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const dayIsToday = isToday(day);
          const dayServicesForOverload = getServicesForDay(day);
          const overloaded = hasOverload(dayServicesForOverload);
          return (
            <div
              key={day.toISOString()}
              onClick={() => onDateSelect(day)}
              className={cn(
                "py-2 text-center cursor-pointer hover:bg-muted/50 transition-colors",
                isSelected && "bg-primary/10",
                overloaded && "ring-2 ring-amber-500 bg-amber-500/5"
              )}
            >
              <div className="flex items-center justify-center gap-0.5">
                <span className="text-xs text-muted-foreground">
                  {format(day, "EEE", { locale: ptBR })}
                </span>
                {overloaded && <AlertTriangle className="h-3 w-3 text-amber-500" />}
              </div>
              <div
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
                  dayIsToday && "bg-primary text-primary-foreground"
                )}
              >
                {format(day, "d")}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <ScrollArea className="flex-1">
        <div className="grid grid-cols-[60px_repeat(7,1fr)]">
          {/* Hour labels column + empty grid cells */}
          {hours.map((hour) => (
            <div key={hour} className="contents">
              <div className="h-16 border-b border-r border-border flex items-start justify-center pt-1">
                <span className="text-xs text-muted-foreground">
                  {String(hour).padStart(2, "0")}:00
                </span>
              </div>
              {weekDays.map((day) => (
                <div
                  key={`${day.toISOString()}-${hour}`}
                  className="h-16 border-b border-r border-border"
                />
              ))}
            </div>
          ))}
        </div>

        {/* Absolutely positioned service blocks overlay */}
        <div className="absolute top-0 left-0 right-0 grid grid-cols-[60px_repeat(7,1fr)] pointer-events-none">
          {/* Empty spacer for time column */}
          <div />
          {weekDays.map((day) => {
            const dayServices = getServicesForDay(day);
            const layout = computeOverlapLayout(dayServices, WEEK_SLOT_HEIGHT, WEEK_GRID_START_HOUR, tz);
            return (
              <div key={day.toISOString()} className="relative" style={{ height: hours.length * WEEK_SLOT_HEIGHT }}>
                {dayServices.map((service) => {
                  const { top, height } = getServicePosition(service, WEEK_SLOT_HEIGHT, WEEK_GRID_START_HOUR, tz);
                  const effectiveStatus = getEffectiveStatus(service, tz);
                  const timeStr = formatTimeInTz(service.entry_date || service.scheduled_date || "", tz);
                  const overlap = layout[service.id] || { column: 0, totalColumns: 1 };
                  const widthPct = 100 / overlap.totalColumns;
                  const leftPct = overlap.column * widthPct;
                  return (
                    <div
                      key={service.id}
                      onClick={() => onServiceClick(service)}
                      className={cn(
                        "absolute px-1 py-0.5 rounded border-l-2 cursor-pointer hover:opacity-80 overflow-hidden pointer-events-auto z-10",
                        STATUS_COLORS[effectiveStatus]
                      )}
                      style={{
                        top,
                        height,
                        minHeight: 20,
                        left: `calc(${leftPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                      }}
                    >
                      <div className="text-2xs font-medium truncate">
                        {service.client?.name || typeLabels[service.service_type] || service.service_type}
                      </div>
                      {height >= 40 && timeStr && timeStr !== "—" && (
                        <div className="text-2xs opacity-70 truncate">{timeStr}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

// Day View Component
const DAY_SLOT_HEIGHT = 60;
const DAY_GRID_START_HOUR = 6;

/**
 * Compute overlap columns for services so overlapping events render side-by-side.
 * Returns a map of serviceId -> { column, totalColumns }.
 */
function computeOverlapLayout(dayServices: Service[], slotHeight: number, gridStartHour: number, tz: string) {
  type Block = { id: string; top: number; bottom: number; column: number; totalColumns: number };

  const blocks: Block[] = dayServices.map((s) => {
    const { top, height } = getServicePosition(s, slotHeight, gridStartHour, tz);
    return { id: s.id, top, bottom: top + height, column: 0, totalColumns: 1 };
  });

  // Sort by top, then by bottom (shorter first)
  blocks.sort((a, b) => a.top - b.top || a.bottom - b.bottom);

  // Find overlapping clusters and assign columns
  const clusters: Block[][] = [];
  let currentCluster: Block[] = [];
  let clusterEnd = -Infinity;

  blocks.forEach((block) => {
    if (block.top >= clusterEnd && currentCluster.length > 0) {
      clusters.push(currentCluster);
      currentCluster = [];
      clusterEnd = -Infinity;
    }
    // Assign column: first available that doesn't overlap
    let col = 0;
    const usedCols = new Set<number>();
    currentCluster.forEach((b) => {
      if (b.bottom > block.top) usedCols.add(b.column);
    });
    while (usedCols.has(col)) col++;
    block.column = col;
    currentCluster.push(block);
    clusterEnd = Math.max(clusterEnd, block.bottom);
  });
  if (currentCluster.length > 0) clusters.push(currentCluster);

  // Set totalColumns per cluster
  clusters.forEach((cluster) => {
    const maxCol = Math.max(...cluster.map((b) => b.column)) + 1;
    cluster.forEach((b) => (b.totalColumns = maxCol));
  });

  const layoutMap: Record<string, { column: number; totalColumns: number }> = {};
  blocks.forEach((b) => {
    layoutMap[b.id] = { column: b.column, totalColumns: b.totalColumns };
  });
  return layoutMap;
}

function DayView({
  currentDate,
  services,
  onServiceClick,
  tz,
}: {
  currentDate: Date;
  services: Service[];
  onServiceClick: (service: Service) => void;
  tz: string;
  typeLabels: Record<string, string>;
}) {
  const hours = useMemo(() => {
    return Array.from({ length: 16 }, (_, i) => i + DAY_GRID_START_HOUR);
  }, []);

  const dayServices = useMemo(() => {
    return services.filter((s) => isSameDayInTz(s.scheduled_date!, currentDate, tz));
  }, [services, currentDate, tz]);

  const overlapLayout = useMemo(
    () => computeOverlapLayout(dayServices, DAY_SLOT_HEIGHT, DAY_GRID_START_HOUR, tz),
    [dayServices, tz]
  );

  return (
    <div className="h-full rounded-lg border border-border bg-card flex flex-col overflow-hidden">
      {/* Header */}
      <div className="py-3 px-4 border-b border-border text-center">
        <div className="text-lg font-semibold">
          {format(currentDate, "EEEE", { locale: ptBR })}
        </div>
        <div
          className={cn(
            "inline-flex h-10 w-10 items-center justify-center rounded-full text-xl font-medium mt-1",
            isToday(currentDate) && "bg-primary text-primary-foreground"
          )}
        >
          {format(currentDate, "d")}
        </div>
      </div>

      {/* Time grid */}
      <ScrollArea className="flex-1">
        <div className="min-w-[300px] relative">
          {/* Grid background */}
          {hours.map((hour) => (
            <div
              key={hour}
              className="flex border-b border-border"
              style={{ height: DAY_SLOT_HEIGHT }}
            >
              <div className="w-16 flex-shrink-0 border-r border-border flex items-start justify-center pt-2">
                <span className="text-sm text-muted-foreground">
                  {String(hour).padStart(2, "0")}:00
                </span>
              </div>
              <div className="flex-1" />
            </div>
          ))}

          {/* Absolute service blocks with overlap handling */}
          <div className="absolute top-0 left-16 right-0">
            {dayServices.map((service) => {
              const { top, height } = getServicePosition(service, DAY_SLOT_HEIGHT, DAY_GRID_START_HOUR, tz);
              const effectiveStatus = getEffectiveStatus(service, tz);
              const layout = overlapLayout[service.id] || { column: 0, totalColumns: 1 };
              const widthPercent = 100 / layout.totalColumns;
              const leftPercent = layout.column * widthPercent;

              return (
                <div
                  key={service.id}
                  onClick={() => onServiceClick(service)}
                  className={cn(
                    "absolute px-2 py-1.5 rounded-lg border-l-4 cursor-pointer hover:opacity-80 transition-opacity overflow-hidden z-10",
                    STATUS_COLORS[effectiveStatus]
                  )}
                  style={{
                    top,
                    height,
                    minHeight: 28,
                    left: `calc(${leftPercent}% + 2px)`,
                    width: `calc(${widthPercent}% - 4px)`,
                  }}
                >
                  <div className="font-medium text-sm truncate">
                    {service.client?.name}
                  </div>
                  {height >= 40 && (
                    <div className="text-xs opacity-80 truncate">
                      {SERVICE_TYPE_LABELS[service.service_type]}
                    </div>
                  )}
                  {height >= 56 && service.assigned_profile?.full_name && (
                    <div className="text-xs opacity-70 mt-0.5 truncate">
                      🔧 {service.assigned_profile.full_name}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
