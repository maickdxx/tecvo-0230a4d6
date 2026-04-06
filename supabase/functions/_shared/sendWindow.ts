/**
 * Send Window — Controls when messages can be sent.
 *
 * RULES:
 * - Normal messages: 08:00–20:00 in org timezone
 * - Urgent/operational messages: bypass window
 * - Messages outside window are queued for next valid time
 *
 * This module provides:
 * 1. isWithinSendWindow() — checks if current time is in window
 * 2. getNextSendTime() — returns next valid send time
 * 3. enqueueOrSend() — sends immediately or queues for later
 */

const WINDOW_START_HOUR = 8;  // 08:00
const WINDOW_END_HOUR = 20;   // 20:00
const DEFAULT_TIMEZONE = "America/Sao_Paulo";

/** Message priority types */
export type MessagePriority = "urgent" | "normal";

/** Types that bypass the send window */
const URGENT_MESSAGE_TYPES = new Set([
  "service_notify",       // Técnico a caminho, serviço concluído
  "otp",                  // Códigos de verificação
  "password_reset",       // Reset de senha
  "portal_auth",          // Autenticação portal do cliente
]);

/**
 * Get the current hour in the given timezone.
 */
function getCurrentHourInTz(tz: string): number {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", {
    timeZone: tz || DEFAULT_TIMEZONE,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
  return parseInt(timeStr.split(":")[0], 10);
}

/**
 * Check if the current time is within the allowed send window.
 */
export function isWithinSendWindow(timezone: string): boolean {
  const hour = getCurrentHourInTz(timezone || DEFAULT_TIMEZONE);
  return hour >= WINDOW_START_HOUR && hour < WINDOW_END_HOUR;
}

/**
 * Check if a message type should bypass the send window.
 */
export function isUrgentMessage(messageType: string): boolean {
  return URGENT_MESSAGE_TYPES.has(messageType);
}

/**
 * Get the next valid send time (08:00 in org timezone).
 * If currently within window, returns now.
 * If outside window, returns 08:00 of the next valid day.
 */
export function getNextSendTime(timezone: string): Date {
  const tz = timezone || DEFAULT_TIMEZONE;
  const now = new Date();
  const hour = getCurrentHourInTz(tz);

  if (hour >= WINDOW_START_HOUR && hour < WINDOW_END_HOUR) {
    return now;
  }

  // Calculate next 08:00 in the org timezone
  // Get today's date in the org timezone
  const todayStr = now.toLocaleDateString("en-CA", { timeZone: tz });
  const [y, m, d] = todayStr.split("-").map(Number);

  // If it's before 08:00, schedule for today at 08:00
  // If it's after 20:00, schedule for tomorrow at 08:00
  let targetDate: Date;
  if (hour < WINDOW_START_HOUR) {
    // Today at 08:00
    targetDate = new Date(`${todayStr}T08:00:00`);
  } else {
    // Tomorrow at 08:00
    const tomorrow = new Date(y, m - 1, d + 1);
    const tomorrowStr = tomorrow.toLocaleDateString("en-CA", { timeZone: "UTC" });
    targetDate = new Date(`${tomorrowStr}T08:00:00`);
  }

  // Convert from org timezone to UTC by computing offset
  // Use a pragmatic approach: create formatter to get offset
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "longOffset",
  });
  const parts = formatter.formatToParts(now);
  const tzPart = parts.find((p) => p.type === "timeZoneName")?.value || "";

  // Parse offset like "GMT-03:00" or "GMT+05:30"
  const offsetMatch = tzPart.match(/GMT([+-])(\d{1,2}):?(\d{2})?/);
  if (offsetMatch) {
    const sign = offsetMatch[1] === "+" ? 1 : -1;
    const hours = parseInt(offsetMatch[2], 10);
    const minutes = parseInt(offsetMatch[3] || "0", 10);
    const totalOffsetMs = sign * (hours * 60 + minutes) * 60 * 1000;
    // targetDate is in local time, we need UTC
    return new Date(targetDate.getTime() - totalOffsetMs);
  }

  // Fallback: assume -3 (Sao Paulo)
  return new Date(targetDate.getTime() + 3 * 60 * 60 * 1000);
}

export interface EnqueueOptions {
  supabase: any;
  organizationId: string;
  phone: string;
  messageContent: string;
  messageType: string;
  priority?: MessagePriority;
  sourceFunction: string;
  idempotencyKey?: string;
  instanceName?: string;
  timezone?: string;
}

export interface SendWindowResult {
  action: "send_now" | "queued" | "error";
  scheduledFor?: string;
  error?: string;
}

/**
 * Check send window and either allow immediate send or enqueue for later.
 *
 * Returns:
 * - { action: "send_now" } if within window or urgent
 * - { action: "queued", scheduledFor } if outside window and queued
 * - { action: "error", error } if queueing failed
 */
export async function checkAndEnqueue(opts: EnqueueOptions): Promise<SendWindowResult> {
  const {
    supabase,
    organizationId,
    phone,
    messageContent,
    messageType,
    priority = "normal",
    sourceFunction,
    idempotencyKey,
    instanceName = "tecvo",
    timezone = DEFAULT_TIMEZONE,
  } = opts;

  // Urgent messages bypass the window entirely
  if (priority === "urgent" || isUrgentMessage(messageType)) {
    return { action: "send_now" };
  }

  // Check if within send window
  if (isWithinSendWindow(timezone)) {
    return { action: "send_now" };
  }

  // Outside window — enqueue for next valid time
  const nextSend = getNextSendTime(timezone);

  // Add small random jitter (0-15 min) to avoid all messages at exactly 08:00
  const jitterMs = Math.floor(Math.random() * 15 * 60 * 1000);
  const scheduledFor = new Date(nextSend.getTime() + jitterMs);

  try {
    const { error } = await supabase.from("message_send_queue").insert({
      organization_id: organizationId,
      phone,
      message_content: messageContent,
      message_type: messageType,
      priority,
      scheduled_for: scheduledFor.toISOString(),
      source_function: sourceFunction,
      idempotency_key: idempotencyKey || null,
      instance_name: instanceName,
    });

    if (error) {
      // Idempotency conflict — already queued
      if (error.code === "23505") {
        console.log(`[SEND-WINDOW] Message already queued: ${idempotencyKey}`);
        return { action: "queued", scheduledFor: scheduledFor.toISOString() };
      }
      console.error("[SEND-WINDOW] Queue insert error:", error);
      return { action: "error", error: error.message };
    }

    console.log(
      `[SEND-WINDOW] Message queued: type=${messageType} org=${organizationId} scheduled=${scheduledFor.toISOString()}`
    );
    return { action: "queued", scheduledFor: scheduledFor.toISOString() };
  } catch (err) {
    console.error("[SEND-WINDOW] Queue error:", err);
    return { action: "error", error: String(err) };
  }
}
