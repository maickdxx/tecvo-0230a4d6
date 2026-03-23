/**
 * Unified timezone utilities for the Tecvo platform.
 *
 * RULES (official as of 2026-03-16):
 * 1. All timestamps stored in the DB are in `timestamptz` and MUST be real UTC.
 * 2. When saving a user-supplied time (e.g. "07:30") we MUST attach the org's
 *    UTC offset so Postgres stores the correct UTC instant.
 * 3. When displaying a timestamp we convert from UTC to the org's timezone.
 * 4. The org timezone comes from `organizations.timezone` (IANA string).
 *    Default fallback: "America/Sao_Paulo".
 */

// ─── Constants ───────────────────────────────────────────────────────────

export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

// ─── Display helpers ─────────────────────────────────────────────────────

/**
 * Format a UTC ISO string to "HH:mm" in the given timezone.
 */
export function formatTimeInTz(iso: string | null | undefined, tz: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: tz,
    });
  } catch {
    return "—";
  }
}

/**
 * Format a UTC ISO string to "HH:mm:ss" in the given timezone.
 */
export function formatTimeWithSecondsInTz(iso: string | null | undefined, tz: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: tz,
    });
  } catch {
    return "—";
  }
}

/**
 * Format a UTC ISO string to "dd/MM/yyyy HH:mm" in the given timezone.
 */
export function formatDateTimeInTz(iso: string | null | undefined, tz: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const datePart = d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: tz,
    });
    const timePart = d.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: tz,
    });
    return `${datePart} ${timePart}`;
  } catch {
    return "—";
  }
}

/**
 * Format a UTC ISO string to "dd/MM/yyyy" in the given timezone.
 */
export function formatDateInTz(iso: string | null | undefined, tz: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: tz,
    });
  } catch {
    return "—";
  }
}

/**
 * Format a UTC ISO string to a date input value (YYYY-MM-DD) in the given timezone.
 */
export function formatDateInputInTz(iso: string | null | undefined, tz: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-CA", { timeZone: tz });
  } catch {
    return "";
  }
}

/**
 * Format a UTC ISO string to a time input value (HH:mm) in the given timezone.
 */
export function formatTimeInputInTz(iso: string | null | undefined, tz: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: tz,
    });
  } catch {
    return "";
  }
}

/**
 * Get today's date as "YYYY-MM-DD" in the given timezone.
 */
export function getTodayInTz(tz: string): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: tz });
}

/**
 * Get the "YYYY-MM-DD" portion of a UTC ISO timestamp in the given timezone.
 */
export function getDatePartInTz(iso: string, tz: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: tz });
}

/**
 * Format a JS Date object to "YYYY-MM-DD" in the given timezone.
 * Replaces legacy `formatLocalDateISO(date)`.
 */
export function formatDateObjInTz(date: Date, tz: string): string {
  return date.toLocaleDateString("en-CA", { timeZone: tz });
}

/**
 * Get the hour component of a UTC ISO timestamp in the given timezone.
 */
export function getHourInTz(iso: string | null | undefined, tz: string): number {
  if (!iso) return 0;
  try {
    return Number(
      new Date(iso).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        hour12: false,
        timeZone: tz,
      }).split(":")[0]
    );
  } catch {
    return 0;
  }
}

/**
 * Get the minutes component of a UTC ISO timestamp in the given timezone.
 */
export function getMinutesInTz(iso: string | null | undefined, tz: string): number {
  if (!iso) return 0;
  try {
    const parts = new Date(iso).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: tz,
    }).split(":");
    return Number(parts[1]);
  } catch {
    return 0;
  }
}

/**
 * Check if a UTC ISO timestamp falls on the same date as a JS Date,
 * both evaluated in the given timezone.
 */
export function isSameDayInTz(iso: string | null | undefined, day: Date, tz: string): boolean {
  if (!iso) return false;
  const isoDate = getDatePartInTz(iso, tz);
  const dayDate = day.toLocaleDateString("en-CA", { timeZone: tz });
  return isoDate === dayDate;
}

/**
 * Format a localized long date like "segunda-feira, 16 de março" in the given timezone.
 */
export function formatLongDateInTz(tz: string): string {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: tz,
  });
}

// ─── Query helpers ───────────────────────────────────────────────────────

/**
 * Get UTC boundaries for a local day in a given timezone.
 * Returns ISO strings that represent the exact start and end of the day in UTC.
 *
 * Example: For "2026-03-16" in "America/Sao_Paulo" (UTC-3):
 *   start = "2026-03-16T03:00:00.000Z"  (00:00 BRT = 03:00 UTC)
 *   end   = "2026-03-17T02:59:59.999Z"  (23:59:59 BRT = 02:59:59 UTC+1day)
 */
export function getLocalDayBoundsUTC(dateStr: string, tz: string): { start: string; end: string } {
  // Build a timestamp at 00:00 local and 23:59:59 local
  const startLocal = buildTimestamp(dateStr, "00:00:00", tz);
  const endLocal = buildTimestamp(dateStr, "23:59:59", tz);
  // Convert to UTC ISO strings for Postgres queries
  const startUTC = new Date(startLocal).toISOString();
  const endUTC = new Date(endLocal).toISOString();
  return { start: startUTC, end: endUTC };
}

// ─── Save helpers ────────────────────────────────────────────────────────

/**
 * Compute the current UTC offset string (e.g. "-03:00") for a timezone.
 * Uses a probe date (defaults to now) to account for DST.
 */
export function getUtcOffset(tz: string, probe: Date = new Date()): string {
  // Use Intl to get the offset
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "longOffset", // e.g. "GMT-03:00"
  });
  const parts = formatter.formatToParts(probe);
  const tzPart = parts.find((p) => p.type === "timeZoneName");
  // tzPart.value is like "GMT-03:00" or "GMT+05:30" or "GMT" (for UTC)
  const raw = tzPart?.value || "GMT";
  if (raw === "GMT") return "+00:00";
  // Extract sign and digits
  const match = raw.match(/GMT([+-])(\d{1,2}):?(\d{2})?/);
  if (!match) return "+00:00";
  const sign = match[1];
  const hours = match[2].padStart(2, "0");
  const minutes = (match[3] || "00").padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

/**
 * Build a full ISO timestamp from a date string and time string with the
 * correct offset for the given timezone. This ensures Postgres stores the
 * right UTC instant.
 *
 * @param dateStr - "YYYY-MM-DD"
 * @param timeStr - "HH:mm" or "HH:mm:ss"
 * @param tz - IANA timezone (e.g. "America/Sao_Paulo")
 * @returns ISO string like "2026-03-16T07:30:00-03:00"
 */
export function buildTimestamp(dateStr: string, timeStr: string, tz: string): string {
  const time = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  // Build a probe date roughly near the target to get correct DST offset
  const [y, mo, d] = dateStr.split("-").map(Number);
  const probe = new Date(y, mo - 1, d, 12, 0, 0);
  const offset = getUtcOffset(tz, probe);
  return `${dateStr}T${time}${offset}`;
}

/**
 * Converts time-only "HH:mm" strings to full ISO timestamps with proper offset.
 * Already-complete timestamps that include "T" pass through unchanged.
 * Used by the services module.
 *
 * @param timeStr - "HH:mm", "HH:mm:ss", or a full ISO string
 * @param dateStr - reference date string (ISO or YYYY-MM-DD)
 * @param tz - IANA timezone
 */
export function toTimestampWithTz(
  timeStr: string | undefined | null,
  dateStr: string | undefined | null,
  tz: string
): string | null {
  if (!timeStr) return null;
  // Already a full ISO timestamp
  if (timeStr.includes("T") && timeStr.length > 10) return timeStr;
  // Match HH:mm or HH:mm:ss
  const match = timeStr.match(/^(\d{2}:\d{2})(:\d{2})?$/);
  if (!match) return timeStr; // unrecognized format, pass through
  const refDate = dateStr ? dateStr.split("T")[0] : getTodayInTz(tz);
  const time = match[2] ? timeStr : `${timeStr}:00`;
  return buildTimestamp(refDate, time, tz);
}
