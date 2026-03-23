import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const mpAccessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");

    if (!mpAccessToken) {
      console.error("[MP-WEBHOOK] MERCADOPAGO_ACCESS_TOKEN not configured");
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    const body = await req.json();
    console.log("[MP-WEBHOOK] Received:", JSON.stringify(body));

    // Handle both notification formats
    // Format 1: { type: "payment", data: { id: "123" } }
    // Format 2: { action: "payment.created", data: { id: "123" } }
    const type = body.type || (body.action?.startsWith("payment") ? "payment" : null);
    const paymentId = body.data?.id;

    if (type !== "payment" || !paymentId) {
      console.log("[MP-WEBHOOK] Ignoring non-payment event:", type);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // Fetch payment details from Mercado Pago API
    console.log("[MP-WEBHOOK] Fetching payment:", paymentId);
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${mpAccessToken}` },
    });

    if (!mpResponse.ok) {
      console.error("[MP-WEBHOOK] MP API error:", mpResponse.status);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    const payment = await mpResponse.json();
    const { status, external_reference } = payment;

    console.log("[MP-WEBHOOK] Payment status:", status, "ref:", external_reference);

    if (!external_reference) {
      console.error("[MP-WEBHOOK] No external_reference in payment");
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // Decode external_reference: "orgId|plan"
    const [organizationId, plan] = external_reference.split("|");

    if (!organizationId || !plan) {
      console.error("[MP-WEBHOOK] Invalid external_reference format:", external_reference);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    if (status === "approved") {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Set plan expiration to 30 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const { error } = await supabase
        .from("organizations")
        .update({
          plan: plan,
          plan_expires_at: expiresAt.toISOString(),
          cancel_at_period_end: false,
          welcome_shown: false,
        })
        .eq("id", organizationId);

      if (error) {
        console.error("[MP-WEBHOOK] DB update error:", error);
      } else {
        console.log("[MP-WEBHOOK] Plan activated:", plan, "for org:", organizationId, "expires:", expiresAt.toISOString());
      }
    } else {
      console.log("[MP-WEBHOOK] Payment not approved, status:", status, "- no action taken");
    }

    return new Response("OK", { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("[MP-WEBHOOK] Error:", error);
    // Always return 200 so MP stops retrying
    return new Response("OK", { status: 200, headers: corsHeaders });
  }
});
