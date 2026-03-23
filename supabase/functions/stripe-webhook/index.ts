import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLAN_BY_PRICE: Record<string, string> = {
  "price_1TDFwCDojFnaEswEMumjlWaT": "starter",
  "price_1TDFwEDojFnaEswE98ByPgQo": "essential",
  "price_1TDFwFDojFnaEswEA0rf4ZBr": "pro",
  "price_1TC7KMDojFnaEswE0yDh1r5e": "teste",
  // Legacy price IDs (keep for existing subscriptions)
  "price_1TC5e1DojFnaEswEGqVyZedp": "starter",
  "price_1TC5epDojFnaEswEdgGOVsqd": "essential",
  "price_1TC5fADojFnaEswE36S6PApx": "pro",
};

/**
 * In Stripe API 2025-08-27.basil, `subscription.current_period_end` was removed.
 * The field now lives at `subscription.items.data[0].current_period_end`.
 */
function getSubscriptionPeriodEnd(subscription: Stripe.Subscription): string | null {
  // Try item-level first (basil API)
  const itemEnd = subscription.items?.data?.[0]?.current_period_end;
  if (typeof itemEnd === "number" && itemEnd > 0) {
    return new Date(itemEnd * 1000).toISOString();
  }
  // Fallback to subscription-level (pre-basil API)
  const subEnd = (subscription as Record<string, unknown>).current_period_end;
  if (typeof subEnd === "number" && subEnd > 0) {
    return new Date(subEnd * 1000).toISOString();
  }
  // Ultimate fallback: 30 days from now
  const fallback = new Date();
  fallback.setDate(fallback.getDate() + 30);
  return fallback.toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const body = await req.text();

    // ============ 1. SIGNATURE VERIFICATION ============
    let event: Stripe.Event;

    if (!webhookSecret) {
      console.error("[STRIPE-WEBHOOK] STRIPE_WEBHOOK_SECRET is NOT configured — rejecting request");
      return new Response(JSON.stringify({ error: "Webhook not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      console.error("[STRIPE-WEBHOOK] Missing stripe-signature header");
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      const cryptoProvider = Stripe.createSubtleCryptoProvider();
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret, undefined, cryptoProvider);
    } catch (err) {
      console.error("[STRIPE-WEBHOOK] Signature verification failed:", (err as Error).message);
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[STRIPE-WEBHOOK] Event:", event.type, "ID:", event.id);

    // ============ 2. IDEMPOTENCY CHECK (race-safe) ============
    const { error: idempotencyError } = await supabase
      .from("stripe_webhook_events")
      .insert({
        event_id: event.id,
        event_type: event.type,
        payload_summary: {
          type: event.type,
          object_id: (event.data.object as { id?: string }).id,
        },
      });

    if (idempotencyError) {
      if (idempotencyError.code === "23505") {
        console.log("[STRIPE-WEBHOOK] Event already processed (duplicate):", event.id);
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.warn("[STRIPE-WEBHOOK] Idempotency insert warning:", idempotencyError.message);
    }

    // ============ 3. HELPERS ============

    const resolveOrgId = async (opts: {
      metadataOrgId?: string;
      customerId?: string;
      subscriptionId?: string;
    }): Promise<string | null> => {
      if (opts.metadataOrgId) return opts.metadataOrgId;

      if (opts.subscriptionId) {
        const { data } = await supabase
          .from("organizations")
          .select("id")
          .eq("stripe_subscription_id", opts.subscriptionId)
          .single();
        if (data?.id) {
          console.log("[STRIPE-WEBHOOK] Resolved orgId via stripe_subscription_id:", opts.subscriptionId);
          return data.id;
        }
      }

      if (opts.customerId) {
        const { data } = await supabase
          .from("organizations")
          .select("id")
          .eq("stripe_customer_id", opts.customerId)
          .single();
        if (data?.id) {
          console.log("[STRIPE-WEBHOOK] Resolved orgId via stripe_customer_id:", opts.customerId);
          return data.id;
        }
      }

      return null;
    };

    const logBillingEvent = async (data: {
      organization_id: string;
      event_type: string;
      stripe_event_id?: string;
      plan?: string;
      previous_plan?: string;
      amount_cents?: number;
      stripe_invoice_id?: string;
      stripe_subscription_id?: string;
      status?: string;
      metadata?: Record<string, unknown>;
    }) => {
      try {
        await supabase.from("billing_events").insert(data);
      } catch (e) {
        console.warn("[STRIPE-WEBHOOK] Failed to log billing event:", (e as Error).message);
      }
    };

    const updateOrg = async (orgId: string, updateData: Record<string, unknown>, context: string) => {
      const { error } = await supabase.from("organizations").update(updateData).eq("id", orgId);
      if (error) {
        console.error(`[STRIPE-WEBHOOK] DB update FAILED (${context}):`, error.message, JSON.stringify(updateData));
      } else {
        console.log(`[STRIPE-WEBHOOK] DB update OK (${context}) — org: ${orgId}`);
      }
    };

    // ============ 4. EVENT HANDLING ============

    // --- checkout.session.completed ---
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;
      const plan = session.metadata?.plan;

      const orgId = await resolveOrgId({
        metadataOrgId: session.metadata?.organization_id,
        customerId,
        subscriptionId,
      });

      if (orgId && plan) {
        const updateData: Record<string, unknown> = {
          plan,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          cancel_at_period_end: false,
          subscription_status: "active",
          past_due_since: null,
          trial_started_at: null,
          trial_ends_at: null,
        };

        if (subscriptionId) {
          try {
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            const priceId = sub.items.data[0]?.price?.id;
            if (priceId) updateData.stripe_price_id = priceId;
            updateData.plan_expires_at = getSubscriptionPeriodEnd(sub);
            updateData.subscription_status = sub.status;
          } catch (e) {
            console.warn("[STRIPE-WEBHOOK] Could not retrieve subscription:", (e as Error).message);
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30);
            updateData.plan_expires_at = expiresAt.toISOString();
          }
        }

        await updateOrg(orgId, updateData, "checkout.session.completed");

        await logBillingEvent({
          organization_id: orgId,
          event_type: "subscription_created",
          stripe_event_id: event.id,
          plan,
          stripe_subscription_id: subscriptionId,
          amount_cents: session.amount_total || undefined,
          status: "completed",
        });

        console.log("[STRIPE-WEBHOOK] checkout.session.completed — org:", orgId, "plan:", plan);

        // Fire purchase confirmation email (fire-and-forget)
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
          fetch(`${supabaseUrl}/functions/v1/billing-send-purchase-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseAnonKey}`,
            },
            body: JSON.stringify({ organization_id: orgId, plan }),
          }).catch(e => console.warn("[STRIPE-WEBHOOK] Failed to trigger purchase email:", e.message));
        } catch (e) {
          console.warn("[STRIPE-WEBHOOK] Purchase email trigger error:", (e as Error).message);
        }
      } else {
        console.warn("[STRIPE-WEBHOOK] checkout.session.completed — could not resolve orgId or plan missing", {
          metadataOrgId: session.metadata?.organization_id,
          customerId,
          subscriptionId,
          plan,
        });
      }
    }

    // --- customer.subscription.created ---
    if (event.type === "customer.subscription.created") {
      const subscription = event.data.object as Stripe.Subscription;
      const priceId = subscription.items.data[0]?.price?.id;
      const plan = subscription.metadata?.plan || (priceId ? PLAN_BY_PRICE[priceId] : null);

      const orgId = await resolveOrgId({
        metadataOrgId: subscription.metadata?.organization_id,
        customerId: subscription.customer as string,
        subscriptionId: subscription.id,
      });

      if (orgId) {
        await updateOrg(orgId, {
          stripe_subscription_id: subscription.id,
          stripe_price_id: priceId || null,
          subscription_status: subscription.status,
          cancel_at_period_end: subscription.cancel_at_period_end,
          plan_expires_at: getSubscriptionPeriodEnd(subscription),
          past_due_since: null,
          trial_started_at: null,
          trial_ends_at: null,
          ...(plan ? { plan } : {}),
        }, "subscription.created");

        console.log("[STRIPE-WEBHOOK] subscription.created — org:", orgId, "status:", subscription.status);
      } else {
        console.warn("[STRIPE-WEBHOOK] subscription.created — could not resolve orgId");
      }
    }

    // --- customer.subscription.updated ---
    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription;
      const priceId = subscription.items.data[0]?.price?.id;
      const plan = subscription.metadata?.plan || (priceId ? PLAN_BY_PRICE[priceId] : null);

      const orgId = await resolveOrgId({
        metadataOrgId: subscription.metadata?.organization_id,
        customerId: subscription.customer as string,
        subscriptionId: subscription.id,
      });

      if (orgId) {
        const { data: currentOrg } = await supabase
          .from("organizations")
          .select("plan, subscription_status, past_due_since")
          .eq("id", orgId)
          .single();

        const updateData: Record<string, unknown> = {
          stripe_subscription_id: subscription.id,
          stripe_price_id: priceId || null,
          subscription_status: subscription.status,
          cancel_at_period_end: subscription.cancel_at_period_end,
          plan_expires_at: getSubscriptionPeriodEnd(subscription),
        };

        if (plan) updateData.plan = plan;

        if (subscription.status === "past_due" && currentOrg?.subscription_status !== "past_due") {
          updateData.past_due_since = new Date().toISOString();
        } else if (subscription.status === "active" && currentOrg?.past_due_since) {
          updateData.past_due_since = null;
        }

        if (subscription.status === "canceled" || subscription.status === "unpaid") {
          updateData.plan = "free";
          updateData.plan_expires_at = null;
          updateData.past_due_since = null;
        }

        await updateOrg(orgId, updateData, "subscription.updated");

        if (plan && currentOrg?.plan && plan !== currentOrg.plan) {
          await logBillingEvent({
            organization_id: orgId,
            event_type: "plan_changed",
            stripe_event_id: event.id,
            plan,
            previous_plan: currentOrg.plan,
            stripe_subscription_id: subscription.id,
            status: subscription.status,
          });
        }

        console.log("[STRIPE-WEBHOOK] subscription.updated — org:", orgId, "status:", subscription.status, "cancel_at_period_end:", subscription.cancel_at_period_end);
      } else {
        console.warn("[STRIPE-WEBHOOK] subscription.updated — could not resolve orgId");
      }
    }

    // --- invoice.paid ---
    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string;

      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = subscription.items.data[0]?.price?.id;
        const plan = subscription.metadata?.plan || (priceId ? PLAN_BY_PRICE[priceId] : null);

        const orgId = await resolveOrgId({
          metadataOrgId: subscription.metadata?.organization_id,
          customerId: subscription.customer as string,
          subscriptionId,
        });

        if (orgId && plan) {
          await updateOrg(orgId, {
            plan,
            plan_expires_at: getSubscriptionPeriodEnd(subscription),
            cancel_at_period_end: subscription.cancel_at_period_end,
            subscription_status: subscription.status,
            stripe_price_id: priceId || null,
            past_due_since: null,
          }, "invoice.paid");

          await logBillingEvent({
            organization_id: orgId,
            event_type: "payment_succeeded",
            stripe_event_id: event.id,
            plan,
            amount_cents: invoice.amount_paid,
            stripe_invoice_id: invoice.id,
            stripe_subscription_id: subscriptionId,
            status: "paid",
          });

          console.log("[STRIPE-WEBHOOK] invoice.paid — org:", orgId, "plan:", plan);
        } else {
          console.warn("[STRIPE-WEBHOOK] invoice.paid — could not resolve orgId or plan");
        }
      }
    }

    // --- invoice.payment_failed ---
    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string;

      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        const orgId = await resolveOrgId({
          metadataOrgId: subscription.metadata?.organization_id,
          customerId: subscription.customer as string,
          subscriptionId,
        });

        if (orgId) {
          const { data: currentOrg } = await supabase
            .from("organizations")
            .select("past_due_since")
            .eq("id", orgId)
            .single();

          await updateOrg(orgId, {
            subscription_status: subscription.status,
            past_due_since: currentOrg?.past_due_since || new Date().toISOString(),
          }, "invoice.payment_failed");

          await logBillingEvent({
            organization_id: orgId,
            event_type: "payment_failed",
            stripe_event_id: event.id,
            amount_cents: invoice.amount_due,
            stripe_invoice_id: invoice.id,
            stripe_subscription_id: subscriptionId,
            status: "failed",
          });

          console.log("[STRIPE-WEBHOOK] invoice.payment_failed — org:", orgId, "status:", subscription.status);
        } else {
          console.warn("[STRIPE-WEBHOOK] invoice.payment_failed — could not resolve orgId");
        }
      }
    }

    // --- customer.subscription.deleted ---
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;

      const orgId = await resolveOrgId({
        metadataOrgId: subscription.metadata?.organization_id,
        customerId: subscription.customer as string,
        subscriptionId: subscription.id,
      });

      if (orgId) {
        const { data: currentOrg } = await supabase
          .from("organizations")
          .select("plan")
          .eq("id", orgId)
          .single();

        await updateOrg(orgId, {
          plan: "free",
          plan_expires_at: null,
          cancel_at_period_end: false,
          subscription_status: "canceled",
          stripe_subscription_id: null,
          stripe_price_id: null,
          past_due_since: null,
        }, "subscription.deleted");

        await logBillingEvent({
          organization_id: orgId,
          event_type: "subscription_canceled",
          stripe_event_id: event.id,
          previous_plan: currentOrg?.plan || undefined,
          plan: "free",
          stripe_subscription_id: subscription.id,
          status: "canceled",
        });

        console.log("[STRIPE-WEBHOOK] subscription.deleted — org:", orgId);
      } else {
        console.warn("[STRIPE-WEBHOOK] subscription.deleted — could not resolve orgId");
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[STRIPE-WEBHOOK] Error:", (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
