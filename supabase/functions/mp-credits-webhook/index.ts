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
      console.error("[MP-CREDITS-WH] MERCADOPAGO_ACCESS_TOKEN not configured");
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    const body = await req.json();
    console.log("[MP-CREDITS-WH] Received:", JSON.stringify(body));

    const type = body.type || (body.action?.startsWith("payment") ? "payment" : null);
    const paymentId = body.data?.id;

    if (type !== "payment" || !paymentId) {
      console.log("[MP-CREDITS-WH] Ignoring non-payment event:", type);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${mpAccessToken}` },
    });

    if (!mpResponse.ok) {
      console.error("[MP-CREDITS-WH] MP API error:", mpResponse.status);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    const payment = await mpResponse.json();
    const { status, external_reference } = payment;

    console.log("[MP-CREDITS-WH] Payment status:", status, "ref:", external_reference);

    if (!external_reference || !external_reference.startsWith("credits|")) {
      console.log("[MP-CREDITS-WH] Not a credits purchase, ignoring");
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    const parts = external_reference.split("|");
    const organizationId = parts[1];
    const creditsAmount = parseInt(parts[2], 10);

    if (!organizationId || isNaN(creditsAmount)) {
      console.error("[MP-CREDITS-WH] Invalid reference format:", external_reference);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    if (status === "approved") {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: newBalance, error } = await supabase.rpc("add_ai_credits", {
        _org_id: organizationId,
        _amount: creditsAmount,
        _action_type: "purchase",
        _description: `Compra de ${creditsAmount} créditos de IA`,
      });

      if (error) {
        console.error("[MP-CREDITS-WH] Error adding credits:", error);
      } else {
        console.log("[MP-CREDITS-WH] Credits added:", creditsAmount, "new balance:", newBalance, "org:", organizationId);
      }
    } else {
      console.log("[MP-CREDITS-WH] Payment not approved:", status);
    }

    return new Response("OK", { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("[MP-CREDITS-WH] Error:", error);
    return new Response("OK", { status: 200, headers: corsHeaders });
  }
});
