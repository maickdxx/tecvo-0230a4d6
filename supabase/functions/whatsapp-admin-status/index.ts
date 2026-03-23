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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate super_admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: super admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
    const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");

    if (!vpsUrl || !apiKey) {
      return new Response(JSON.stringify({ error: "WhatsApp API not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, instance_name } = body;

    // ── ACTION: LIST ── List all instances with their DB info
    if (action === "list") {
      const { data: channels } = await supabase
        .from("whatsapp_channels")
        .select("id, instance_name, name, is_connected, phone_number, last_connected_at, channel_type, organization_id, created_at")
        .order("created_at", { ascending: false });

      // Fetch org names for display
      const orgIds = [...new Set((channels || []).map(c => c.organization_id))];
      const { data: orgs } = await supabase
        .from("organizations")
        .select("id, name")
        .in("id", orgIds);

      const orgMap = new Map((orgs || []).map(o => [o.id, o.name]));

      const enriched = (channels || []).map(ch => ({
        ...ch,
        organization_name: orgMap.get(ch.organization_id) || "Desconhecida",
      }));

      return new Response(JSON.stringify({ ok: true, channels: enriched }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: STATUS ── Get live status from Evolution API
    if (action === "status") {
      if (!instance_name) {
        return new Response(JSON.stringify({ error: "instance_name required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let state = "unknown";
      let phoneNumber: string | null = null;
      let errorMsg: string | null = null;

      try {
        const evoRes = await fetch(`${vpsUrl}/instance/connectionState/${instance_name}`, {
          method: "GET",
          headers: { apikey: apiKey },
        });

        if (evoRes.ok) {
          const evoData = await evoRes.json();
          state = evoData.instance?.state || "unknown";
          phoneNumber = evoData.instance?.phoneNumber || null;
        } else {
          errorMsg = `Evolution API returned ${evoRes.status}`;
        }
      } catch (e) {
        errorMsg = `Connection failed: ${e.message}`;
      }

      return new Response(JSON.stringify({
        ok: true,
        instance_name,
        state,
        phone_number: phoneNumber,
        error_message: errorMsg,
        checked_at: new Date().toISOString(),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: QRCODE ── Get QR code from Evolution API
    if (action === "qrcode") {
      if (!instance_name) {
        return new Response(JSON.stringify({ error: "instance_name required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const evoRes = await fetch(`${vpsUrl}/instance/connect/${instance_name}`, {
          method: "GET",
          headers: { apikey: apiKey },
        });

        const evoData = await evoRes.json();
        console.log("[WHATSAPP-ADMIN-STATUS] QR RAW response:", JSON.stringify(evoData).slice(0, 2000));
        console.log("[WHATSAPP-ADMIN-STATUS] QR fields - base64:", !!evoData.base64, "qrcode.base64:", !!evoData.qrcode?.base64, "qrcode.pairingCode:", !!evoData.qrcode?.pairingCode, "state:", evoData.instance?.state);

        // Try multiple possible field locations
        const qrBase64 = evoData.base64 || evoData.qrcode?.base64 || null;
        const qrString = evoData.qrcode?.pairingCode || evoData.code || evoData.qrcode?.code || evoData.pairingCode || null;

        return new Response(JSON.stringify({
          ok: true,
          instance_name,
          qrcode: qrBase64,
          qr_string: qrString,
          state: evoData.instance?.state || evoData.state || null,
          raw_keys: Object.keys(evoData),
          checked_at: new Date().toISOString(),
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({
          ok: false,
          error: `Failed to get QR: ${e.message}`,
        }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use: list, status, qrcode" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[WHATSAPP-ADMIN-STATUS] Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
