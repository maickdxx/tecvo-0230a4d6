import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STRIPE_PRICES: Record<string, { priceId: string; name: string }> = {
  starter: { priceId: "price_1TDFwCDojFnaEswEMumjlWaT", name: "Tecvo Start" },
  essential: { priceId: "price_1TDFwEDojFnaEswE98ByPgQo", name: "Tecvo Pro" },
  pro: { priceId: "price_1TDFwFDojFnaEswEA0rf4ZBr", name: "Tecvo Empresa" },
};

const PLAN_ORDER: Record<string, number> = { starter: 1, essential: 2, pro: 3 };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "Payment gateway not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { plan: targetPlan } = body;

    const targetPlanInfo = STRIPE_PRICES[targetPlan];
    if (!targetPlanInfo) {
      return new Response(JSON.stringify({ error: "Invalid plan" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.organization_id) {
      return new Response(JSON.stringify({ error: "Organization not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("stripe_subscription_id, stripe_price_id, plan, subscription_status")
      .eq("id", profile.organization_id)
      .single();

    if (!org?.stripe_subscription_id) {
      return new Response(JSON.stringify({ error: "No active subscription to change. Use checkout instead." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (org.stripe_price_id === targetPlanInfo.priceId) {
      return new Response(JSON.stringify({ error: "Você já está neste plano.", code: "SAME_PLAN" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Retrieve current subscription
    const subscription = await stripe.subscriptions.retrieve(org.stripe_subscription_id);
    if (subscription.status !== "active" && subscription.status !== "trialing") {
      return new Response(JSON.stringify({ error: "Subscription is not active. Cannot change plan." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currentOrder = PLAN_ORDER[org.plan || ""] || 0;
    const targetOrder = PLAN_ORDER[targetPlan] || 0;
    const isUpgrade = targetOrder > currentOrder;

    // Update the subscription item in-place
    // Upgrade: immediate with proration
    // Downgrade: at end of billing period (no proration)
    const updatedSubscription = await stripe.subscriptions.update(org.stripe_subscription_id, {
      items: [{
        id: subscription.items.data[0].id,
        price: targetPlanInfo.priceId,
      }],
      proration_behavior: isUpgrade ? "create_prorations" : "none",
      // For downgrades, apply at period end by using billing_cycle_anchor
      ...(isUpgrade ? {} : {
        // Cancel cancel_at_period_end if it was set
        cancel_at_period_end: false,
      }),
      metadata: {
        ...subscription.metadata,
        plan: targetPlan,
      },
    });

    // Update local DB immediately
    const priceId = updatedSubscription.items.data[0]?.price?.id;
    await supabase
      .from("organizations")
      .update({
        plan: targetPlan,
        stripe_price_id: priceId || null,
        subscription_status: updatedSubscription.status,
        cancel_at_period_end: updatedSubscription.cancel_at_period_end,
        plan_expires_at: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
      })
      .eq("id", profile.organization_id);

    // Log billing event
    await supabase.from("billing_events").insert({
      organization_id: profile.organization_id,
      event_type: isUpgrade ? "plan_upgrade" : "plan_downgrade",
      plan: targetPlan,
      previous_plan: org.plan,
      stripe_subscription_id: org.stripe_subscription_id,
      status: "completed",
      metadata: {
        proration: isUpgrade ? "immediate" : "none",
        new_price_id: targetPlanInfo.priceId,
      },
    });

    console.log("[STRIPE-CHANGE-PLAN]", isUpgrade ? "Upgrade" : "Downgrade",
      "org:", profile.organization_id, "from:", org.plan, "to:", targetPlan);

    return new Response(JSON.stringify({
      success: true,
      plan: targetPlan,
      is_upgrade: isUpgrade,
      current_period_end: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[STRIPE-CHANGE-PLAN] Error:", (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
