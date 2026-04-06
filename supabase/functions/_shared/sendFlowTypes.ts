/**
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │                WHATSAPP SEND FLOW CLASSIFICATION                   │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │                                                                     │
 * │  Every outbound WhatsApp message in the Tecvo platform belongs     │
 * │  to exactly ONE of these categories. This classification governs   │
 * │  which instance/channel is used and what fallback rules apply.     │
 * │                                                                     │
 * │  ── CUSTOMER_CONVERSATION ──                                       │
 * │  Messages within a client support thread.                          │
 * │  • MUST use the channel bound to the conversation/contact.         │
 * │  • NO fallback to any other channel or instance.                   │
 * │  • If channel disconnected → BLOCK send with explicit error.       │
 * │  • Functions: whatsapp-send, send-scheduled-messages,              │
 * │              recurrence-automation, bot-engine, whatsapp-media.    │
 * │                                                                     │
 * │  ── PLATFORM_NOTIFICATION ──                                       │
 * │  Messages sent BY the Tecvo platform (not by any org channel).     │
 * │  • Always uses the "tecvo" institutional instance.                 │
 * │  • These are NOT part of any customer conversation thread.         │
 * │  • Must NEVER be used as a fallback for customer conversations.    │
 * │  • Functions: laura-lifecycle-cron, send-welcome-whatsapp.         │
 * │                                                                     │
 * │  ── ORG_AUTOMATION ──                                              │
 * │  Automated messages sent on behalf of an organization.             │
 * │  • SHOULD use the org's own channel (client's last channel).       │
 * │  • For OWNER notifications: uses "tecvo" (platform instance)       │
 * │    because these target the owner, not a client conversation.      │
 * │  • For CLIENT notifications (e.g., service completion portal       │
 * │    link): uses the client's channel if found, otherwise uses       │
 * │    "tecvo" — this is acceptable because the message is a           │
 * │    one-shot notification, NOT a conversation reply.                │
 * │  • Functions: auto-service-notify.                                 │
 * │                                                                     │
 * │  ── PLATFORM_AUTH ──                                               │
 * │  Security/auth messages (e.g., password reset codes).              │
 * │  • Uses any connected org channel for delivery convenience.        │
 * │  • NOT a conversation — fire-and-forget, no thread context.        │
 * │  • Functions: send-password-reset-code.                            │
 * │                                                                     │
 * │  ── INTERNAL_TEST ──                                               │
 * │  Functions used exclusively for internal testing/QA.               │
 * │  • NOT production flows. Must NEVER be confused with real sends.   │
 * │  • Functions: test-service-notification.                           │
 * │                                                                     │
 * │  ═══════════════════════════════════════════════════════════════    │
 * │  GOLDEN RULE: A customer conversation message can NEVER use        │
 * │  the "tecvo" institutional instance or any channel other than      │
 * │  the one bound to the conversation. Violation = critical bug.      │
 * │  ═══════════════════════════════════════════════════════════════    │
 * │                                                                     │
 * └─────────────────────────────────────────────────────────────────────┘
 */

/** The Tecvo platform institutional instance name — used ONLY for platform notifications and owner alerts. */
export const TECVO_PLATFORM_INSTANCE = "tecvo";

export type SendFlowCategory =
  | "CUSTOMER_CONVERSATION"
  | "PLATFORM_NOTIFICATION"
  | "ORG_AUTOMATION"
  | "PLATFORM_AUTH"
  | "INTERNAL_TEST";
