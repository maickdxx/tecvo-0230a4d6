/**
 * ── SEND FLOW: PLATFORM_NOTIFICATION ──
 * Sends a one-time welcome message from the Tecvo platform to new org owners.
 * Always uses TECVO_PLATFORM_INSTANCE ("tecvo") — never an org channel.
 * This is NOT a customer conversation message.
 *
 * DEDUPLICATION: Uses atomic UPDATE ... WHERE welcome_whatsapp_sent = false
 * to guarantee exactly-once delivery even under concurrent calls.
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { checkSendLimit } from "../_shared/sendGuard.ts";
import { TECVO_PLATFORM_INSTANCE } from "../_shared/sendFlowTypes.ts";
import { resolveOwnerPhone } from "../_shared/resolveOwnerPhone.ts";

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User client to get authenticated user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role client for admin operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's organization
    const { data: profile } = await adminClient
      .from("profiles")
      .select("organization_id, full_name")
      .eq("user_id", user.id)
      .single();

    if (!profile?.organization_id) {
      return new Response(JSON.stringify({ error: "Organization not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ATOMIC LOCK: claim the welcome send right ──
    const { data: claimResult, error: claimError } = await adminClient
      .from("organizations")
      .update({ welcome_whatsapp_sent: true })
      .eq("id", profile.organization_id)
      .eq("welcome_whatsapp_sent", false)
      .select("id, name");

    if (claimError) {
      console.error("[WELCOME] Claim error:", claimError);
      return new Response(JSON.stringify({ error: "Internal error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!claimResult || claimResult.length === 0) {
      console.log("[WELCOME] Already sent (atomic lock) — skipping");
      return new Response(JSON.stringify({ message: "Already sent" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const org = claimResult[0];

    // Resolve owner's personal phone (profile-first, then legacy fallback)
    const ownerPhone = await resolveOwnerPhone(adminClient, profile.organization_id);

    if (!ownerPhone.phone) {
      // No phone — already marked as sent to avoid retries
      return new Response(JSON.stringify({ message: "No phone configured for owner" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phone = ownerPhone.phone;

    // Send welcome message via WhatsApp bridge
    const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
    const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");

    if (vpsUrl && apiKey) {
      // Send guard check
      const guard = await checkSendLimit(adminClient, profile.organization_id, null, "welcome");
      if (!guard.allowed) {
        console.log(`[WELCOME] Blocked by send guard: ${guard.reason}`);
        // Revert the flag so it can be retried later
        await adminClient
          .from("organizations")
          .update({ welcome_whatsapp_sent: false })
          .eq("id", profile.organization_id);
        return new Response(JSON.stringify({ message: "Rate limited, will retry" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userName = profile.full_name || org.name || "empreendedor";
      const welcomeText = `👋 Olá, ${userName}! Bem-vindo(a) à *Tecvo*!\n\nSua conta foi configurada com sucesso. Estamos aqui para facilitar a gestão do seu negócio.\n\nSe precisar de ajuda, é só mandar uma mensagem! 🚀`;

      let cleanNumber = phone.replace(/\D/g, "");
      if (!cleanNumber.startsWith("55") && cleanNumber.length <= 11) {
        cleanNumber = "55" + cleanNumber;
      }
      const jid = `${cleanNumber}@s.whatsapp.net`;

      try {
        const res = await fetch(`${vpsUrl}/message/sendText/${TECVO_PLATFORM_INSTANCE}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: apiKey },
          body: JSON.stringify({ number: jid, text: welcomeText }),
        });

        if (!res.ok) {
          console.error("[WELCOME] Send failed:", res.status, await res.text());
          // Revert flag on failure — allow retry
          await adminClient
            .from("organizations")
            .update({ welcome_whatsapp_sent: false })
            .eq("id", profile.organization_id);
          return new Response(JSON.stringify({ error: "Send failed" }), {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (err) {
        console.error("[WELCOME] Send error:", err);
        // Revert flag on error — allow retry
        await adminClient
          .from("organizations")
          .update({ welcome_whatsapp_sent: false })
          .eq("id", profile.organization_id);
        return new Response(JSON.stringify({ error: "Send error" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log(`[WELCOME] Successfully sent to org ${profile.organization_id}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[WELCOME] Error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
