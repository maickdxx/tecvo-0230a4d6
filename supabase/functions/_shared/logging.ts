// Shared logging utilities with PII masking for production security

/**
 * Masks an email address for safe logging
 * Example: "john.doe@example.com" -> "jo***@example.com"
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return "***";
  const [name, domain] = email.split("@");
  const maskedName = name.length > 2 ? `${name.slice(0, 2)}***` : "***";
  return `${maskedName}@${domain}`;
}

/**
 * Masks a user ID for safe logging (shows first 8 chars)
 * Example: "550e8400-e29b-41d4-a716-446655440000" -> "550e8400-****"
 */
export function maskUserId(userId: string): string {
  if (!userId || userId.length < 8) return "****";
  return `${userId.slice(0, 8)}-****`;
}

/**
 * Masks a customer ID for safe logging
 * Example: "cus_NffrFeUfNV2Hib" -> "cus_****Hib"
 */
export function maskCustomerId(customerId: string): string {
  if (!customerId || customerId.length < 8) return "****";
  return `${customerId.slice(0, 4)}****${customerId.slice(-3)}`;
}

/**
 * Creates a structured logger with PII masking
 */
export function createLogger(functionName: string) {
  return {
    step: (step: string, details?: Record<string, unknown>) => {
      const safeDetails = details ? ` - ${JSON.stringify(details)}` : "";
      console.log(`[${functionName}] ${step}${safeDetails}`);
    },
    error: (message: string, error?: unknown) => {
      const errorStr = error instanceof Error ? error.message : String(error);
      console.error(`[${functionName}] ERROR: ${message} - ${errorStr}`);
    },
    userAuth: (userId: string, email: string) => {
      console.log(`[${functionName}] User authenticated - id: ${maskUserId(userId)}, email: ${maskEmail(email)}`);
    },
    customer: (customerId: string) => {
      console.log(`[${functionName}] Found customer - id: ${maskCustomerId(customerId)}`);
    },
  };
}
