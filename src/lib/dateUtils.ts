/**
 * Legacy utility functions for handling dates.
 *
 * NOTE (2026-03-16): These functions use a "strip offset" approach that was
 * designed for an older architecture where timestamps were saved as local-as-UTC.
 * New code should use the centralized timezone utilities in `@/lib/timezone.ts`
 * which properly convert real UTC to the organization's timezone.
 *
 * These functions are kept for backward-compatible modules that still rely on
 * legacy data patterns. Do NOT use them in new code.
 */

const TIMEZONE = "America/Sao_Paulo";

/**
 * @deprecated Use formatTimeInTz / formatDateInTz from @/lib/timezone instead.
 * Converts a date string by stripping offset (legacy approach).
 */
function toLocalParts(dateStr: string): { year: number; month: number; day: number; hours: number; minutes: number; seconds: number } | null {
  if (!dateStr) return null;

  // LEGACY: strips timezone suffix — kept only for backward compatibility
  // with data that was saved as local-time-labeled-as-UTC.

  // Strip timezone suffix (+00:00, +00, Z, etc.) to get the naive local string
  const naive = dateStr.trim().replace(/Z$|[+-]\d{2}(:\d{2})?$/, "");

  const [datePart, timePart] = naive.split("T");
  if (!datePart) return null;
  const [year, month, day] = datePart.split("-").map(Number);
  if (!year || !month || !day) return null;

  if (!timePart) {
    return { year, month, day, hours: 0, minutes: 0, seconds: 0 };
  }
  const [hours, minutes, seconds] = timePart.substring(0, 8).split(":").map(Number);
  return { year, month, day, hours: hours || 0, minutes: minutes || 0, seconds: seconds || 0 };
}

/**
 * Formats a date string to dd/MM/yyyy format with proper timezone conversion.
 * @param dateStr - ISO date string (e.g. "2026-02-08T08:00:00+00:00" or "2026-02-08T08:00:00")
 * @returns Formatted date string like "08/02/2026"
 */
export function formatLocalDate(dateStr: string): string {
  const p = toLocalParts(dateStr);
  if (!p) return "";
  return `${String(p.day).padStart(2, "0")}/${String(p.month).padStart(2, "0")}/${p.year}`;
}

/**
 * Formats a time string to HH:mm format with proper timezone conversion.
 * @param dateStr - ISO date string
 * @returns Formatted time string like "08:00"
 */
export function formatLocalTime(dateStr: string): string {
  if (!dateStr) return "";
  // Support both "T" and space separator (Supabase may return either)
  const normalized = dateStr.includes("T") ? dateStr : dateStr.replace(" ", "T");
  if (!normalized.includes("T")) return "";
  const p = toLocalParts(normalized);
  if (!p) return "";
  return `${String(p.hours).padStart(2, "0")}:${String(p.minutes).padStart(2, "0")}`;
}

/**
 * Formats a date string to dd/MM/yyyy às HH:mm format with proper timezone conversion.
 */
export function formatLocalDateTime(dateStr: string): string {
  if (!dateStr) return "";
  const date = formatLocalDate(dateStr);
  const time = formatLocalTime(dateStr);
  // Don't show "às 00:00" when no real time was set
  if (time && time !== "00:00") return `${date} às ${time}`;
  return date;
}

/**
 * Formats a JS Date to YYYY-MM-DD string using LOCAL components (no UTC conversion).
 */
export function formatLocalDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Formats a JS Date to YYYY-MM-DDTHH:mm:ss string using LOCAL components (no UTC conversion).
 */
export function formatLocalDateTimeISO(date: Date): string {
  const datePart = formatLocalDateISO(date);
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${datePart}T${h}:${min}:${s}`;
}

/**
 * Extracts hour from a date string with proper timezone conversion.
 */
export function getLocalHour(dateStr: string): number {
  const p = toLocalParts(dateStr);
  return p ? p.hours : 0;
}

/**
 * Extracts minutes from a date string with proper timezone conversion.
 */
export function getLocalMinutes(dateStr: string): number {
  const p = toLocalParts(dateStr);
  return p ? p.minutes : 0;
}

/**
 * Compares day by converting to local timezone first — avoids timezone issues.
 */
export function isSameDayISO(dateStr: string, day: Date): boolean {
  if (!dateStr) return false;
  const p = toLocalParts(dateStr);
  if (!p) return false;
  const dayStr = formatLocalDateISO(day);
  const dateStrLocal = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
  return dateStrLocal === dayStr;
}

/**
 * Extracts the YYYY-MM-DD portion of a date string after converting to local timezone.
 * Useful for date comparisons that need timezone awareness.
 */
export function getLocalDateString(dateStr: string): string {
  const p = toLocalParts(dateStr);
  if (!p) return "";
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}
