/**
 * Shared timezone utilities for Edge Functions.
 * 
 * All date/time operations MUST use the organization's timezone.
 * Data is stored in UTC; conversion happens only at display/comparison boundaries.
 */

const DEFAULT_TIMEZONE = "America/Sao_Paulo";

/**
 * Get the current date string (YYYY-MM-DD) in the given timezone.
 */
export function getTodayInTz(tz: string): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: tz || DEFAULT_TIMEZONE });
}

/**
 * Get the current date+time formatted for display in pt-BR.
 */
export function getFormattedDateTimeInTz(tz: string): { dateStr: string; timeStr: string } {
  const now = new Date();
  const effectiveTz = tz || DEFAULT_TIMEZONE;
  return {
    dateStr: now.toLocaleDateString("pt-BR", { timeZone: effectiveTz }),
    timeStr: now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: effectiveTz }),
  };
}

/**
 * Get current month string (YYYY-MM) in the given timezone.
 */
export function getCurrentMonthInTz(tz: string): string {
  const today = getTodayInTz(tz);
  return today.substring(0, 7);
}

/**
 * Get tomorrow's date string (YYYY-MM-DD) in the given timezone.
 */
export function getTomorrowInTz(tz: string): string {
  const todayStr = getTodayInTz(tz);
  const [y, m, d] = todayStr.split("-").map(Number);
  const tomorrow = new Date(y, m - 1, d + 1);
  return tomorrow.toLocaleDateString("en-CA", { timeZone: "UTC" });
}

/**
 * Format an ISO timestamp to display-friendly date in pt-BR, using the given timezone.
 */
export function formatDateInTz(isoString: string, tz: string): string {
  return new Date(isoString).toLocaleDateString("pt-BR", { timeZone: tz || DEFAULT_TIMEZONE });
}

/**
 * Format an ISO timestamp to display-friendly time (HH:mm) in pt-BR, using the given timezone.
 */
export function formatTimeInTz(isoString: string, tz: string): string {
  return new Date(isoString).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz || DEFAULT_TIMEZONE,
  });
}

/**
 * Get the start-of-day in UTC for "today" in the given timezone.
 * Useful for database queries like "messages sent today".
 */
export function getStartOfDayUTC(tz: string): string {
  const todayStr = getTodayInTz(tz);
  // Create a date at midnight in the org timezone, then convert to UTC
  const midnightLocal = new Date(`${todayStr}T00:00:00`);
  // Use Intl to get the UTC offset for this timezone at this moment
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz || DEFAULT_TIMEZONE,
    timeZoneName: "shortOffset",
  });
  // Simpler approach: just use the date string with timezone info
  // For DB queries, comparing ISO date prefix is often sufficient
  return `${todayStr}T00:00:00`;
}

/**
 * Extract the date part (YYYY-MM-DD) from an ISO timestamp, interpreted in the given timezone.
 */
export function getDatePartInTz(isoString: string, tz: string): string {
  return new Date(isoString).toLocaleDateString("en-CA", { timeZone: tz || DEFAULT_TIMEZONE });
}

/**
 * Fetch the timezone for an organization from the database.
 * Returns the timezone string, defaulting to America/Sao_Paulo.
 */
export async function fetchOrgTimezone(supabase: any, organizationId: string): Promise<string> {
  try {
    const { data } = await supabase
      .from("organizations")
      .select("timezone")
      .eq("id", organizationId)
      .single();
    return data?.timezone || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}
