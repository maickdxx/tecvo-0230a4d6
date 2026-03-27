/**
 * Evolution API Error Classifier
 * 
 * Maps raw Evolution API responses to standardized domain errors.
 * Used by whatsapp-send, whatsapp-media-send, and any other outbound function.
 */

export type DomainError =
  | "channel_disconnected"
  | "channel_not_linked"
  | "channel_unavailable"
  | "invalid_recipient"
  | "rate_limited"
  | "send_failed"
  | "timeout"
  | "unknown";

export interface ClassifiedError {
  domainError: DomainError;
  isDisconnection: boolean;
  userMessage: string;
  technicalReason: string;
}

// Patterns that indicate the WhatsApp session is no longer active
const DISCONNECTION_PATTERNS = [
  "connection closed",
  "disconnected",
  "not connected",
  "qr code",
  "qrcode",
  "session not found",
  "session expired",
  "instance not found",
  "device disconnected",
  "logged out",
  "logout",
  "websocket closed",
  "ws closed",
  "not logged in",
  "scan qr",
  "close session",
  "instance is not connected",
  "status: close",
  "connecting",
  "denied",          // auth denied usually means session invalid
  "unauthorized",    // Evolution API auth issues for the instance
];

// Patterns that indicate an invalid recipient
const INVALID_RECIPIENT_PATTERNS = [
  "invalid jid",
  "jid invalid",
  "not a valid",
  "number does not exist",
  "not registered",
  "not on whatsapp",
  "invalid number",
  "number not found",
];

// Patterns that indicate rate limiting
const RATE_LIMIT_PATTERNS = [
  "rate limit",
  "too many requests",
  "429",
  "spam",
  "blocked",
  "temporarily banned",
];

// Patterns for timeout
const TIMEOUT_PATTERNS = [
  "timeout",
  "timed out",
  "504",
  "gateway timeout",
  "econnreset",
  "econnrefused",
  "enotfound",
  "fetch failed",
];

/**
 * Classify an Evolution API error response into a domain error.
 */
export function classifyEvoError(
  statusCode: number,
  responseText: string,
  phoneLabel?: string,
): ClassifiedError {
  const lower = responseText.toLowerCase();
  const phone = phoneLabel || "desconhecido";

  // 1. Check disconnection patterns
  for (const pattern of DISCONNECTION_PATTERNS) {
    if (lower.includes(pattern)) {
      return {
        domainError: "channel_disconnected",
        isDisconnection: true,
        userMessage: `O número ${phone} perdeu a conexão com o WhatsApp. Reconecte-o nas configurações para voltar a enviar mensagens.`,
        technicalReason: `Evolution API: ${pattern} detected (HTTP ${statusCode})`,
      };
    }
  }

  // 2. Check invalid recipient
  for (const pattern of INVALID_RECIPIENT_PATTERNS) {
    if (lower.includes(pattern)) {
      return {
        domainError: "invalid_recipient",
        isDisconnection: false,
        userMessage: "Este número não é válido ou não está registrado no WhatsApp.",
        technicalReason: `Evolution API: ${pattern} detected (HTTP ${statusCode})`,
      };
    }
  }

  // 3. Check rate limiting
  for (const pattern of RATE_LIMIT_PATTERNS) {
    if (lower.includes(pattern)) {
      return {
        domainError: "rate_limited",
        isDisconnection: false,
        userMessage: "WhatsApp está limitando o envio. Aguarde alguns minutos antes de tentar novamente.",
        technicalReason: `Evolution API: ${pattern} detected (HTTP ${statusCode})`,
      };
    }
  }

  // 4. Check timeouts
  for (const pattern of TIMEOUT_PATTERNS) {
    if (lower.includes(pattern)) {
      return {
        domainError: "timeout",
        isDisconnection: false,
        userMessage: "Não foi possível enviar a mensagem. O servidor WhatsApp não respondeu. Tente novamente.",
        technicalReason: `Evolution API: ${pattern} detected (HTTP ${statusCode})`,
      };
    }
  }

  // 5. HTTP status fallbacks
  if (statusCode === 401 || statusCode === 403) {
    return {
      domainError: "channel_disconnected",
      isDisconnection: true,
      userMessage: `O número ${phone} perdeu a conexão com o WhatsApp. Reconecte-o nas configurações.`,
      technicalReason: `Evolution API returned HTTP ${statusCode} — likely auth/session issue`,
    };
  }

  // 6. Generic failure
  return {
    domainError: "send_failed",
    isDisconnection: false,
    userMessage: "Não foi possível enviar a mensagem. Tente novamente em alguns instantes.",
    technicalReason: `Evolution API returned HTTP ${statusCode}: ${responseText.substring(0, 200)}`,
  };
}
