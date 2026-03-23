import { useMemo } from "react";
import { getHourInTz, getMinutesInTz, DEFAULT_TIMEZONE } from "@/lib/timezone";
import type { Service } from "./useServices";

/** Fallback daily capacity in minutes (8h48 = 528min for 44h/week) */
const FALLBACK_DAILY_CAPACITY_MIN = 528;
/** Fallback travel time between services when no route data available (minutes) */
const FALLBACK_TRAVEL_MIN = 30;

export interface OperationalCapacity {
  /** Total daily capacity in minutes */
  capacityMin: number;
  /** Total productive (execution) time in minutes */
  productiveMin: number;
  /** Total travel/commute time in minutes */
  travelMin: number;
  /** Idle/available time in minutes */
  idleMin: number;
  /** Productive occupancy % */
  productiveOccupancy: number;
  /** Total (productive + travel) occupancy % */
  totalOccupancy: number;
  /** Predicted revenue */
  predictedRevenue: number;
  /** Revenue per productive hour */
  revenuePerProductiveHour: number;
  /** Number of services */
  serviceCount: number;
  /** Whether travel exceeds 25% of the day */
  travelAlert: boolean;
  /** Whether this day is a non-operational day (no work configured) */
  isNonOperational: boolean;
}

interface DistanceInfo {
  distanceKm: number;
  timeMin: number;
}

function sameAddress(a: Service, b: Service): boolean {
  const normalize = (v: string | null | undefined) => (v || "").trim().toLowerCase();
  const streetA = normalize(a.service_street);
  const streetB = normalize(b.service_street);
  if (!streetA || !streetB) return false;
  return (
    streetA === streetB &&
    normalize(a.service_number) === normalize(b.service_number) &&
    normalize(a.service_city) === normalize(b.service_city)
  );
}

function getServiceDurationMin(service: Service, tz: string): number {
  if (service.entry_date && service.exit_date) {
    const startMin = getHourInTz(service.entry_date, tz) * 60 + getMinutesInTz(service.entry_date, tz);
    const endMin = getHourInTz(service.exit_date, tz) * 60 + getMinutesInTz(service.exit_date, tz);
    const dur = endMin - startMin;
    if (dur > 0) return dur;
  }
  // Default: 60 min per service if no time info
  return 60;
}

export function useOperationalCapacity(
  services: Service[],
  teamSize: number,
  distances: Map<string, DistanceInfo>,
  configOverride?: { totalMinutesPerDay?: number; activeTeams?: number; defaultTravelMinutes?: number; saturdayMinutes?: number; worksSaturday?: boolean },
  selectedDate?: Date | null,
  tz: string = DEFAULT_TIMEZONE
): OperationalCapacity {
  return useMemo(() => {
    // Determine if this is a non-operational day
    const dayOfWeek = selectedDate ? selectedDate.getDay() : null; // 0=Sun, 6=Sat
    const isSunday = dayOfWeek === 0;
    const isSaturday = dayOfWeek === 6;
    const worksSaturday = configOverride?.worksSaturday ?? false;
    const saturdayMinutes = configOverride?.saturdayMinutes ?? 0;
    const isNonOperational = isSunday || (isSaturday && (!worksSaturday || saturdayMinutes === 0));

    const perTeamMin = isSaturday && worksSaturday && saturdayMinutes > 0
      ? saturdayMinutes
      : configOverride?.totalMinutesPerDay ?? FALLBACK_DAILY_CAPACITY_MIN;
    const teams = configOverride?.activeTeams ?? Math.max(teamSize, 1);
    const defaultTravel = configOverride?.defaultTravelMinutes ?? FALLBACK_TRAVEL_MIN;
    const capacityMin = isNonOperational ? 0 : perTeamMin * teams;

    const nonOpResult: OperationalCapacity = {
      capacityMin: 0,
      productiveMin: 0,
      travelMin: 0,
      idleMin: 0,
      productiveOccupancy: 0,
      totalOccupancy: 0,
      predictedRevenue: 0,
      revenuePerProductiveHour: 0,
      serviceCount: services.length,
      travelAlert: false,
      isNonOperational: true,
    };

    if (isNonOperational) return nonOpResult;

    if (services.length === 0) {
      return {
        capacityMin,
        productiveMin: 0,
        travelMin: 0,
        idleMin: capacityMin,
        productiveOccupancy: 0,
        totalOccupancy: 0,
        predictedRevenue: 0,
        revenuePerProductiveHour: 0,
        serviceCount: 0,
        travelAlert: false,
        isNonOperational: false,
      };
    }

    // Sort by entry time
    const sorted = [...services].sort((a, b) => {
      const aMin = (a.entry_date || a.scheduled_date)
        ? getHourInTz(a.entry_date || a.scheduled_date || "", tz) * 60 + getMinutesInTz(a.entry_date || a.scheduled_date || "", tz)
        : 9999;
      const bMin = (b.entry_date || b.scheduled_date)
        ? getHourInTz(b.entry_date || b.scheduled_date || "", tz) * 60 + getMinutesInTz(b.entry_date || b.scheduled_date || "", tz)
        : 9999;
      return aMin - bMin;
    });

    // Productive time
    let productiveMin = 0;
    sorted.forEach((s) => {
      productiveMin += getServiceDurationMin(s, tz);
    });

    // Travel time (between consecutive services, not after last)
    let travelMin = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      // Same address = no travel
      if (sameAddress(sorted[i], sorted[i + 1])) continue;

      const key = `${sorted[i].id}->${sorted[i + 1].id}`;
      const routeInfo = distances.get(key);
      if (routeInfo && routeInfo.timeMin > 0) {
        travelMin += routeInfo.timeMin;
      } else {
        travelMin += defaultTravel;
      }
    }

    const usedMin = productiveMin + travelMin;
    const idleMin = Math.max(capacityMin - usedMin, 0);

    const productiveOccupancy = Math.min(Math.round((productiveMin / capacityMin) * 100), 100);
    const totalOccupancy = Math.min(Math.round((usedMin / capacityMin) * 100), 100);

    const predictedRevenue = services.reduce((sum, s) => sum + (s.value || 0), 0);
    const productiveHours = productiveMin / 60;
    const revenuePerProductiveHour = productiveHours > 0 ? predictedRevenue / productiveHours : 0;

    const travelAlert = capacityMin > 0 && (travelMin / capacityMin) > 0.25;

    return {
      capacityMin,
      productiveMin,
      travelMin,
      idleMin,
      productiveOccupancy,
      totalOccupancy,
      predictedRevenue,
      revenuePerProductiveHour,
      serviceCount: services.length,
      travelAlert,
      isNonOperational: false,
    };
  }, [services, teamSize, distances, configOverride, selectedDate, tz]);
}
