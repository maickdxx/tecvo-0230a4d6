import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLAN_VALUES: Record<string, { name: string; value: number }> = {
  starter: { name: "Tecvo Essencial", value: 39 },
  essential: { name: "Tecvo Profissional", value: 89 },
  pro: { name: "Tecvo Empresa", value: 179 },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const mpAccessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");

    if (mpAccessToken) {
      console.log("[MP-CHECKOUT] Token present, length:", mpAccessToken.length, "prefix:", mpAccessToken.substring(0, 8));
    } else {
      console.error("[MP-CHECKOUT] MERCADOPAGO_ACCESS_TOKEN is NOT configured!");
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("[MP-CHECKOUT] Auth error:", authError?.message);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { plan } = body;
    console.log("[MP-CHECKOUT] Received request - plan:", plan, "user:", user.id, "email:", user.email);

    const planInfo = PLAN_VALUES[plan];
    if (!planInfo) {
      console.error("[MP-CHECKOUT] Invalid plan requested:", plan);
      return new Response(JSON.stringify({ error: "Invalid plan" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id, full_name")
      .eq("user_id", user.id)
      .single();

    if (!profile?.organization_id) {
      console.error("[MP-CHECKOUT] Organization not found for user:", user.id);
      throw new Error("Organization not found");
    }

    const origin = req.headers.get("origin") || "https://tecvo.lovable.app";
    const webhookUrl = `${supabaseUrl}/functions/v1/mp-webhook`;

    const preference = {
      items: [
        {
          title: planInfo.name,
          quantity: 1,
          unit_price: planInfo.value,
          currency_id: "BRL",
        },
      ],
      payer: {
        email: user.email,
        name: profile.full_name || user.email,
      },
      back_urls: {
        success: `${origin}/assinatura/sucesso?plan=${plan}`,
        failure: `${origin}/pricing?subscription=cancelled`,
        pending: `${origin}/assinatura/sucesso?plan=${plan}&status=pending`,
      },
      auto_return: "approved",
      external_reference: `${profile.organization_id}|${plan}`,
      notification_url: webhookUrl,
      statement_descriptor: "TECVO",
    };

    console.log("[MP-CHECKOUT] Creating preference for org:", profile.organization_id, "plan:", plan, "value:", planInfo.value);

    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mpAccessToken}`,
      },
      body: JSON.stringify(preference),
    });

    const contentType = mpResponse.headers.get("content-type");
    console.log("[MP-CHECKOUT] MP response status:", mpResponse.status, "content-type:", contentType);

    if (!contentType?.includes("application/json")) {
      const textBody = await mpResponse.text();
      console.error("[MP-CHECKOUT] MP returned non-JSON response:", textBody.substring(0, 500));
      throw new Error(`Mercado Pago returned non-JSON response (status ${mpResponse.status})`);
    }

    if (!mpResponse.ok) {
      const errorBody = await mpResponse.json();
      console.error("[MP-CHECKOUT] MP API error:", mpResponse.status, JSON.stringify(errorBody));
      throw new Error(`Mercado Pago error: ${mpResponse.status} - ${JSON.stringify(errorBody)}`);
    }

    const mpData = await mpResponse.json();
    console.log("[MP-CHECKOUT] Preference created:", mpData.id);

    const checkoutUrl = mpData.init_point || mpData.sandbox_init_point;

    if (!checkoutUrl) {
      console.error("[MP-CHECKOUT] No init_point in response:", JSON.stringify(mpData).substring(0, 500));
      throw new Error("Checkout URL not found in Mercado Pago response");
    }

    console.log("[MP-CHECKOUT] Redirecting to:", checkoutUrl.substring(0, 60) + "...");

    return new Response(JSON.stringify({ url: checkoutUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[MP-CHECKOUT] Error:", (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
