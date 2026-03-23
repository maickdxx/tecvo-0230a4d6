import { getCorsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const headers = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  try {
    const { action } = await req.json().catch(() => ({ action: "get-public-key" }));

    if (action === "get-public-key") {
      const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
      if (!publicKey) {
        console.error("VAPID_PUBLIC_KEY not found in env");
        return new Response(
          JSON.stringify({ error: "VAPID_PUBLIC_KEY not configured" }),
          { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ publicKey }),
        { headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // Generate new VAPID keys (admin utility)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const keyPair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"]
    );

    const publicKeyRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
    const privateKeyRaw = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

    const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyRaw)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const privateKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(privateKeyRaw)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    return new Response(
      JSON.stringify({
        publicKey: publicKeyBase64,
        privateKey: privateKeyBase64,
        message: "Save these as VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY secrets",
      }),
      { headers: { ...headers, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
});
