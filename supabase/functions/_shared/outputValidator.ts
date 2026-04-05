/**
 * AI Output Validator — filters sensitive data from AI responses
 * before they reach the end user.
 * 
 * IMPORTANT: Phone numbers, email addresses, and UUIDs are NOT blocked.
 * These are normal operational data that the AI needs to share with users
 * (client phones, service IDs, etc.). Only truly sensitive documents
 * (CPF, CNPJ) and prompt leakage are blocked.
 */

// Patterns for sensitive data detection — only truly sensitive documents
const SENSITIVE_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  // CPF: 000.000.000-00 or 00000000000 (11 digits)
  { name: "cpf", regex: /\b\d{3}[\.\s]?\d{3}[\.\s]?\d{3}[\-\s]?\d{2}\b/ },
  // CNPJ: 00.000.000/0000-00
  { name: "cnpj", regex: /\b\d{2}[\.\s]?\d{3}[\.\s]?\d{3}[\/\s]?\d{4}[\-\s]?\d{2}\b/ },
];

// Phrases that indicate prompt/system leakage
const PROMPT_LEAK_PATTERNS: RegExp[] = [
  /meu\s+prompt\s+(?:é|diz|instrui)/i,
  /system\s*prompt/i,
  /instrução\s+interna/i,
  /regras?\s+do\s+sistema/i,
  /você\s+(?:é|foi)\s+(?:programado|instruído|configurado)\s+para/i,
  /aqui\s+(?:está|estão)\s+(?:as\s+)?minhas?\s+(?:regras|instruções)/i,
];

// Cross-org mention patterns
const CROSS_ORG_PATTERNS: RegExp[] = [
  /(?:dados?\s+d[aeo]s?\s+outr[ao]s?\s+(?:empresa|organização|cliente))/i,
  /(?:informaç(?:ão|ões)\s+d[aeo]\s+outr[ao]\s+(?:empresa|organização))/i,
];

export interface ValidationResult {
  safe: boolean;
  reasons: string[];
  sanitizedContent: string | null;
}

const SAFE_FALLBACK_RESPONSE =
  "Desculpe, não consegui gerar uma resposta adequada. Por favor, reformule sua pergunta.";

/**
 * Validates a complete (non-streaming) AI response text.
 */
export function validateAIOutput(text: string): ValidationResult {
  const reasons: string[] = [];

  // 1. Check for sensitive document patterns (CPF/CNPJ only)
  for (const { name, regex } of SENSITIVE_PATTERNS) {
    if (regex.test(text)) {
      reasons.push(`sensitive_data:${name}`);
    }
  }

  // 2. Check for prompt/system leakage
  for (const pattern of PROMPT_LEAK_PATTERNS) {
    if (pattern.test(text)) {
      reasons.push("prompt_leakage");
      break;
    }
  }

  // 3. Check for cross-org data mention
  for (const pattern of CROSS_ORG_PATTERNS) {
    if (pattern.test(text)) {
      reasons.push("cross_org_mention");
      break;
    }
  }

  if (reasons.length === 0) {
    return { safe: true, reasons: [], sanitizedContent: null };
  }

  return {
    safe: false,
    reasons,
    sanitizedContent: SAFE_FALLBACK_RESPONSE,
  };
}

/**
 * Sanitizes text by redacting sensitive patterns inline.
 * Used for streaming where we can't block the whole response.
 */
export function sanitizeStreamChunk(text: string): string {
  let sanitized = text;
  for (const { regex } of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(new RegExp(regex, "g"), "[REDACTED]");
  }
  return sanitized;
}

/**
 * Creates a TransformStream that sanitizes SSE streaming responses in real-time.
 * Redacts sensitive data from each chunk and accumulates for post-stream audit.
 */
export function createSanitizedStream(
  inputStream: ReadableStream<Uint8Array>,
  onComplete: (fullText: string, hadIssues: boolean) => void
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let fullText = "";
  let hadIssues = false;

  return new ReadableStream({
    async start(controller) {
      const reader = inputStream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            // Post-stream validation
            const result = validateAIOutput(fullText);
            onComplete(fullText, !result.safe);
            controller.close();
            break;
          }

          let chunk = decoder.decode(value, { stream: true });

          // Extract content from SSE data lines for validation
          const lines = chunk.split("\n");
          const processedLines: string[] = [];

          for (const line of lines) {
            if (line.startsWith("data: ") && line.trim() !== "data: [DONE]") {
              try {
                const jsonStr = line.slice(6).trim();
                const parsed = JSON.parse(jsonStr);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  fullText += content;
                  const sanitized = sanitizeStreamChunk(content);
                  if (sanitized !== content) {
                    hadIssues = true;
                    // Reconstruct the SSE line with sanitized content
                    parsed.choices[0].delta.content = sanitized;
                    processedLines.push("data: " + JSON.stringify(parsed));
                    continue;
                  }
                }
              } catch {
                // Not valid JSON, pass through
              }
            }
            processedLines.push(line);
          }

          controller.enqueue(encoder.encode(processedLines.join("\n")));
        }
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

/**
 * Logs a security event when an AI response is flagged.
 */
export async function logOutputViolation(
  supabaseAdmin: any,
  organizationId: string,
  userId: string,
  functionName: string,
  reasons: string[],
  snippet: string
): Promise<void> {
  try {
    await supabaseAdmin.from("data_audit_log").insert({
      organization_id: organizationId,
      user_id: userId,
      table_name: functionName,
      operation: "AI_OUTPUT_BLOCKED",
      metadata: {
        reasons,
        snippet: snippet.substring(0, 200),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error("[SECURITY] Failed to log output violation:", e);
  }
}
