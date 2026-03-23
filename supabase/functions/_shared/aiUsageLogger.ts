// Shared AI usage logging utility

// Cost estimation per model (USD per 1M tokens)
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "google/gemini-2.5-flash": { input: 0.15, output: 0.60 },
  "google/gemini-3-flash-preview": { input: 0.15, output: 0.60 },
  "google/gemini-2.5-pro": { input: 1.25, output: 5.00 },
  "google/gemini-3.1-pro-preview": { input: 1.25, output: 5.00 },
  "openai/gpt-5": { input: 5.00, output: 15.00 },
  "openai/gpt-5-mini": { input: 0.15, output: 0.60 },
  "openai/gpt-5-nano": { input: 0.10, output: 0.40 },
};

export interface AIUsageData {
  organizationId: string | null;
  userId: string | null;
  actionSlug: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs: number;
  status: "success" | "error" | "rate_limited";
}

export function calculateCostUSD(model: string, promptTokens: number, completionTokens: number): number {
  const costs = MODEL_COSTS[model] || MODEL_COSTS["google/gemini-2.5-flash"];
  const inputCost = (promptTokens / 1_000_000) * costs.input;
  const outputCost = (completionTokens / 1_000_000) * costs.output;
  return inputCost + outputCost;
}

export async function logAIUsage(supabaseAdmin: any, data: AIUsageData): Promise<void> {
  try {
    const estimatedCostUsd = calculateCostUSD(data.model, data.promptTokens, data.completionTokens);
    
    await supabaseAdmin.from("ai_usage_logs").insert({
      organization_id: data.organizationId,
      user_id: data.userId,
      action_slug: data.actionSlug,
      model: data.model,
      prompt_tokens: data.promptTokens,
      completion_tokens: data.completionTokens,
      total_tokens: data.totalTokens,
      estimated_cost_usd: estimatedCostUsd,
      duration_ms: data.durationMs,
      status: data.status,
    });
  } catch (err) {
    console.error("[AI-USAGE-LOG] Failed to log usage:", err);
    // Don't throw - logging failures shouldn't break the main flow
  }
}

// Extract usage from OpenAI-compatible response
export function extractUsageFromResponse(result: any): { promptTokens: number; completionTokens: number; totalTokens: number } {
  const usage = result?.usage || {};
  return {
    promptTokens: usage.prompt_tokens || 0,
    completionTokens: usage.completion_tokens || 0,
    totalTokens: usage.total_tokens || 0,
  };
}
