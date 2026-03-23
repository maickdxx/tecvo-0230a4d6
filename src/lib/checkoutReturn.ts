const CHECKOUT_CONTEXT_KEY = "tecvo_checkout_return_context";
const CHECKOUT_CONTEXT_TTL_MS = 6 * 60 * 60 * 1000;

export interface CheckoutReturnContext {
  plan: string | null;
  checkoutSessionId: string | null;
  returnTo: string;
  createdAt: number;
}

export function sanitizeInternalPath(path: string | null | undefined) {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}

export function buildCheckoutSuccessPath(plan?: string | null, checkoutSessionId?: string | null) {
  const params = new URLSearchParams();

  if (plan) params.set("plan", plan);
  if (checkoutSessionId) params.set("checkout_session_id", checkoutSessionId);

  const query = params.toString();
  return query ? `/assinatura/sucesso?${query}` : "/assinatura/sucesso";
}

export function readCheckoutContext(): CheckoutReturnContext | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(CHECKOUT_CONTEXT_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<CheckoutReturnContext>;
    const createdAt = typeof parsed.createdAt === "number" ? parsed.createdAt : 0;
    const isExpired = !createdAt || Date.now() - createdAt > CHECKOUT_CONTEXT_TTL_MS;
    const returnTo = sanitizeInternalPath(parsed.returnTo);

    if (isExpired || !returnTo) {
      window.localStorage.removeItem(CHECKOUT_CONTEXT_KEY);
      return null;
    }

    return {
      plan: typeof parsed.plan === "string" ? parsed.plan : null,
      checkoutSessionId: typeof parsed.checkoutSessionId === "string" ? parsed.checkoutSessionId : null,
      returnTo,
      createdAt,
    };
  } catch {
    window.localStorage.removeItem(CHECKOUT_CONTEXT_KEY);
    return null;
  }
}

export function saveCheckoutContext(input: {
  plan?: string | null;
  checkoutSessionId?: string | null;
  returnTo?: string | null;
}) {
  if (typeof window === "undefined") return null;

  const current = readCheckoutContext();
  const plan = input.plan ?? current?.plan ?? null;
  const checkoutSessionId = input.checkoutSessionId ?? current?.checkoutSessionId ?? null;
  const returnTo =
    sanitizeInternalPath(input.returnTo) ??
    buildCheckoutSuccessPath(plan, checkoutSessionId);

  const nextContext: CheckoutReturnContext = {
    plan,
    checkoutSessionId,
    returnTo,
    createdAt: Date.now(),
  };

  window.localStorage.setItem(CHECKOUT_CONTEXT_KEY, JSON.stringify(nextContext));
  return nextContext;
}

export function clearCheckoutContext() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CHECKOUT_CONTEXT_KEY);
}
