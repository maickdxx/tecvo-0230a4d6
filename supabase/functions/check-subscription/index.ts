import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logging.ts";

const log = createLogger("CHECK-SUBSCRIPTION");

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    log.step("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    
    log.userAuth(user.id, user.email);

    // Get user's organization
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.organization_id) {
      log.step("No organization found");
      return new Response(JSON.stringify({ subscribed: false, plan: "free" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Read plan directly from organizations table
    const { data: org } = await supabaseClient
      .from("organizations")
      .select("plan, plan_expires_at, cancel_at_period_end, subscription_status, stripe_subscription_id")
      .eq("id", profile.organization_id)
      .single();

    const plan = org?.plan || "free";
    const planExpiresAt = org?.plan_expires_at ? new Date(org.plan_expires_at) : null;
    const cancelAtPeriodEnd = org?.cancel_at_period_end ?? false;
    const subscriptionStatus = org?.subscription_status || "inactive";
    const hasStripeSubscription = !!org?.stripe_subscription_id;
    const now = new Date();

    // Active if: has stripe subscription with active status, OR plan is not free and hasn't expired
    const isActive = (hasStripeSubscription && (subscriptionStatus === "active" || subscriptionStatus === "trialing"))
      || (plan !== "free" && (!planExpiresAt || planExpiresAt > now));

    if (!isActive && plan !== "free") {
      // Plan expired — reset to free and clear cancellation flag
      await supabaseClient
        .from("organizations")
        .update({ plan: "free", plan_expires_at: null, cancel_at_period_end: false })
        .eq("id", profile.organization_id);

      log.step("Plan expired, reset to free", { previousPlan: plan, wasCancelled: cancelAtPeriodEnd });

      return new Response(JSON.stringify({
        subscribed: false,
        plan: "free",
        subscription_end: null,
        cancel_at_period_end: false,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    log.step("Subscription checked", { plan, expiresAt: org?.plan_expires_at, cancelAtPeriodEnd });

    return new Response(JSON.stringify({
      subscribed: isActive,
      plan,
      subscription_end: org?.plan_expires_at || null,
      cancel_at_period_end: cancelAtPeriodEnd,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error("Check subscription failed", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
