/**
 * Idempotent send helper for auto-message flows.
 *
 * Pattern: INSERT log first (with unique constraint) → send message → update status.
 * If the INSERT fails (duplicate), the send is skipped entirely.
 *
 * The partial unique index `uq_auto_message_idempotent` on
 * (organization_id, message_type, sent_date) WHERE message_type IN ('business_tip','broadcast')
 * guarantees at-most-once delivery per org per type per day.
 */

export interface IdempotentSendOptions {
  supabase: any;
  organizationId: string;
  messageType: "business_tip" | "broadcast";
  content: string;
  /** The timezone of the org, used to compute sent_date */
  timezone?: string;
  /** The actual send function — called only if the log insert succeeds */
  sendFn: () => Promise<boolean>;
}

function getDateInTz(tz: string): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: tz }); // "YYYY-MM-DD"
}

export async function idempotentSend(opts: IdempotentSendOptions): Promise<{ sent: boolean; skipped: boolean; error?: string }> {
  const { supabase, organizationId, messageType, content, timezone = "America/Sao_Paulo", sendFn } = opts;

  const sentDate = getDateInTz(timezone);

  // Step 1: Try to INSERT the log entry first (atomic claim)
  const { error: insertError } = await supabase
    .from("auto_message_log")
    .insert({
      organization_id: organizationId,
      message_type: messageType,
      content,
      sent_date: sentDate,
      send_status: "pending",
    });

  if (insertError) {
    // Unique constraint violation = already sent today
    if (insertError.code === "23505") {
      console.log(`[IDEMPOTENT] ${messageType} already sent today for org ${organizationId}, skipping`);
      return { sent: false, skipped: true };
    }
    console.error(`[IDEMPOTENT] Insert error:`, insertError);
    return { sent: false, skipped: false, error: insertError.message };
  }

  // Step 2: Send the message
  try {
    const ok = await sendFn();

    // Step 3: Update status
    await supabase
      .from("auto_message_log")
      .update({ send_status: ok ? "sent" : "send_failed" })
      .eq("organization_id", organizationId)
      .eq("message_type", messageType)
      .eq("sent_date", sentDate);

    if (!ok) {
      return { sent: false, skipped: false, error: "send_failed" };
    }

    return { sent: true, skipped: false };
  } catch (err) {
    // Update status to failed
    await supabase
      .from("auto_message_log")
      .update({ send_status: "send_error" })
      .eq("organization_id", organizationId)
      .eq("message_type", messageType)
      .eq("sent_date", sentDate);

    console.error(`[IDEMPOTENT] Send error:`, err);
    return { sent: false, skipped: false, error: String(err) };
  }
}
