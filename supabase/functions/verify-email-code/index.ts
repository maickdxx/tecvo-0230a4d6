import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger, maskEmail } from "../_shared/logging.ts";

const logger = createLogger("verify-email-code");

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, code } = await req.json();

    if (!email || !code) {
      return new Response(
        JSON.stringify({ error: "Email e código são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logger.step("Verifying code", { email: maskEmail(email) });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find valid code
    const { data: verification, error: fetchError } = await supabaseAdmin
      .from("email_verifications")
      .select("*")
      .eq("email", email.toLowerCase())
      .eq("code", code)
      .eq("verified", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      logger.error("DB fetch error", fetchError);
      throw fetchError;
    }

    if (!verification) {
      return new Response(
        JSON.stringify({ error: "Código inválido ou expirado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark as verified
    await supabaseAdmin
      .from("email_verifications")
      .update({ verified: true })
      .eq("id", verification.id);

    // Find user and confirm email
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      logger.error("Failed to list users", listError);
      throw listError;
    }

    const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      return new Response(
        JSON.stringify({ error: "Usuário não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Confirm user's email
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { email_confirm: true }
    );

    if (updateError) {
      logger.error("Failed to confirm user", updateError);
      throw updateError;
    }

    logger.step("Email confirmed successfully", { email: maskEmail(email) });

    // ── Dispatch welcome messages (WhatsApp + email) AFTER verification ──
    // Find user's profile to get organization_id
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("user_id, organization_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile?.organization_id) {
      logger.step("Dispatching welcome after verification", { userId: user.id });
      try {
        await supabaseAdmin.functions.invoke("dispatch-welcome", {
          body: {
            user_id: user.id,
            organization_id: profile.organization_id,
          },
        });
        logger.step("Welcome dispatched successfully");
      } catch (welcomeErr) {
        logger.error("Failed to dispatch welcome (non-blocking)", welcomeErr);
        // Non-blocking — user is already verified, welcome failure shouldn't break flow
      }
    } else {
      logger.step("No profile/org found, skipping welcome dispatch");
    }

    // Generate a magic link token for auto-login
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: email.toLowerCase(),
    });

    if (linkError || !linkData) {
      logger.error("Failed to generate auto-login link", linkError);
      return new Response(
        JSON.stringify({ success: true, autoLogin: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = linkData.properties?.hashed_token;
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        autoLogin: true,
        token_hash: token,
        email: email.toLowerCase(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    logger.error("Unexpected error", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
