import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Credit packages with ~30% margin over AI cost
const CREDIT_PACKAGES: Record<string, { credits: number; price: number; label: string }> = {
  pack_100: { credits: 100, price: 9.90, label: "100 créditos de IA" },
  pack_500: { credits: 500, price: 39.90, label: "500 créditos de IA" },
  pack_1000: { credits: 1000, price: 69.90, label: "1000 créditos de IA" },
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
      console.error("[MP-CREDITS] MERCADOPAGO_ACCESS_TOKEN not configured");
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
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { packageId } = body;

    const pack = CREDIT_PACKAGES[packageId];
    if (!pack) {
      return new Response(JSON.stringify({ error: "Invalid package" }), {
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
      throw new Error("Organization not found");
    }

    const origin = req.headers.get("origin") || "https://tecvo.lovable.app";
    const webhookUrl = `${supabaseUrl}/functions/v1/mp-credits-webhook`;

    const preference = {
      items: [
        {
          title: pack.label,
          quantity: 1,
          unit_price: pack.price,
          currency_id: "BRL",
        },
      ],
      payer: {
        email: user.email,
        name: profile.full_name || user.email,
      },
      back_urls: {
        success: `${origin}/whatsapp?credits=success&amount=${pack.credits}`,
        failure: `${origin}/whatsapp?credits=failed`,
        pending: `${origin}/whatsapp?credits=pending`,
      },
      auto_return: "approved",
      external_reference: `credits|${profile.organization_id}|${pack.credits}`,
      notification_url: webhookUrl,
      statement_descriptor: "TECVO IA",
    };

    console.log("[MP-CREDITS] Creating preference for org:", profile.organization_id, "package:", packageId);

    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mpAccessToken}`,
      },
      body: JSON.stringify(preference),
    });

    if (!mpResponse.ok) {
      const errorBody = await mpResponse.text();
      console.error("[MP-CREDITS] MP API error:", mpResponse.status, errorBody);
      throw new Error(`Mercado Pago error: ${mpResponse.status}`);
    }

    const mpData = await mpResponse.json();
    const checkoutUrl = mpData.init_point || mpData.sandbox_init_point;

    if (!checkoutUrl) {
      throw new Error("Checkout URL not found");
    }

    return new Response(JSON.stringify({ url: checkoutUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[MP-CREDITS] Error:", (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
