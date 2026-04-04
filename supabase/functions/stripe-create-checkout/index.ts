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
  teste: { priceId: "price_1TC7KMDojFnaEswE0yDh1r5e", name: "Tecvo Teste Interno" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      console.error("[STRIPE-CHECKOUT] STRIPE_SECRET_KEY is NOT configured!");
      return new Response(JSON.stringify({ error: "Payment gateway not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    const userId = claimsData?.claims?.sub as string | undefined;
    const userEmail = claimsData?.claims?.email as string | undefined;

    if (claimsError || !userId || !userEmail) {
      console.error("[STRIPE-CHECKOUT] Auth error:", claimsError?.message || "missing claims");
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { plan, coupon_id, coupon_code } = body;
    console.log("[STRIPE-CHECKOUT] Request - plan:", plan, "user:", userId, "email:", userEmail);

    const planInfo = STRIPE_PRICES[plan];
    if (!planInfo) {
      return new Response(JSON.stringify({ error: "Invalid plan" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get organization_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id, full_name")
      .eq("user_id", userId)
      .single();

    if (!profile?.organization_id) {
      throw new Error("Organization not found");
    }

    // ============ DUPLICATE SUBSCRIPTION CHECK ============
    const { data: org } = await supabase
      .from("organizations")
      .select("stripe_subscription_id, subscription_status, plan, stripe_customer_id")
      .eq("id", profile.organization_id)
      .single();

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // If org has an active Stripe subscription, verify it's truly active
    if (org?.stripe_subscription_id && org.subscription_status === "active") {
      try {
        const existingSub = await stripe.subscriptions.retrieve(org.stripe_subscription_id);
        if (existingSub.status === "active" || existingSub.status === "trialing") {
          // If same plan, block duplicate
          const existingPriceId = existingSub.items.data[0]?.price?.id;
          if (existingPriceId === planInfo.priceId) {
            console.log("[STRIPE-CHECKOUT] Duplicate subscription blocked — org:", profile.organization_id);
            return new Response(JSON.stringify({ 
              error: "Você já possui este plano ativo. Para alterar, cancele o atual primeiro.",
              code: "DUPLICATE_SUBSCRIPTION"
            }), {
              status: 409,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          // Different plan — cancel old subscription at period end and create new checkout
          // This handles upgrade scenarios
          console.log("[STRIPE-CHECKOUT] Upgrading — will cancel old sub at period end");
        }
      } catch (e) {
        // Subscription doesn't exist in Stripe anymore, proceed normally
        console.warn("[STRIPE-CHECKOUT] Could not retrieve existing subscription:", (e as Error).message);
      }
    }

    // Check for existing Stripe customer — prefer stored ID, fallback to email
    let customerId: string | undefined = org?.stripe_customer_id || undefined;

    if (!customerId) {
      const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        // Persist for future lookups
        await supabase
          .from("organizations")
          .update({ stripe_customer_id: customerId })
          .eq("id", profile.organization_id);
      }
    }

    const origin = req.headers.get("origin") || "https://tecvo.com.br";
    const successUrl = `${origin}/assinatura/sucesso?plan=${plan}&checkout_session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/pricing?subscription=cancelled`;

    console.log("[STRIPE-CHECKOUT] Return URLs", { origin, successUrl, cancelUrl });

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : userEmail,
      line_items: [{ price: planInfo.priceId, quantity: 1 }],
      mode: "subscription",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        organization_id: profile.organization_id,
        plan,
        user_id: userId,
      },
      subscription_data: {
        metadata: {
          organization_id: profile.organization_id,
          plan,
        },
      },
    });

    console.log("[STRIPE-CHECKOUT] Session created:", session.id, "org:", profile.organization_id);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[STRIPE-CHECKOUT] Error:", (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
