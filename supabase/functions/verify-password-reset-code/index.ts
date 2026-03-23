import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger, maskEmail } from "../_shared/logging.ts";

const logger = createLogger("verify-password-reset-code");

// Validate strong password: min 8 chars, 1 uppercase, 1 number, 1 symbol
function isStrongPassword(password: string): boolean {
  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[^A-Za-z0-9]/.test(password)) return false;
  return true;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, code, new_password } = await req.json();

    if (!email || !code) {
      return new Response(
        JSON.stringify({ error: "Email e código são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    logger.step("Verifying reset code", { email: maskEmail(normalizedEmail) });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Step 3 (with new_password) looks for already-verified codes; Step 2 looks for unverified
    const isPasswordStep = !!new_password;

    const { data: resetRecord, error: fetchError } = await supabaseAdmin
      .from("password_reset_codes")
      .select("*")
      .eq("email", normalizedEmail)
      .eq("verified", isPasswordStep ? true : false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError || !resetRecord) {
      return new Response(
        JSON.stringify({ error: "Código inválido ou expirado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For Step 3 (password update), the code is already verified — skip code re-validation
    if (isPasswordStep) {
      // Just ensure the verified record isn't too old (10 min window still applies)
      if (new Date(resetRecord.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: "Código expirado. Solicite um novo código." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // Step 2: check block and expiry before validating the code

      // Check if blocked
      if (resetRecord.blocked_until && new Date(resetRecord.blocked_until) > new Date()) {
        const blockedUntil = new Date(resetRecord.blocked_until);
        const remainingMs = blockedUntil.getTime() - Date.now();
        const remainingMin = Math.ceil(remainingMs / 60000);
        return new Response(
          JSON.stringify({
            error: `Muitas tentativas incorretas. Tente novamente em ${remainingMin} minuto${remainingMin !== 1 ? "s" : ""}.`,
            blocked: true,
            blocked_until: resetRecord.blocked_until,
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if expired
      if (new Date(resetRecord.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: "Código expirado. Solicite um novo código." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify code
      if (resetRecord.code !== String(code).trim()) {
        const newAttempts = (resetRecord.attempts || 0) + 1;
        const shouldBlock = newAttempts >= 5;

        await supabaseAdmin
          .from("password_reset_codes")
          .update({
            attempts: newAttempts,
            ...(shouldBlock
              ? { blocked_until: new Date(Date.now() + 15 * 60 * 1000).toISOString() }
              : {}),
          })
          .eq("id", resetRecord.id);

        if (shouldBlock) {
          return new Response(
            JSON.stringify({
              error: "Muitas tentativas incorretas. Aguarde 15 minutos para tentar novamente.",
              blocked: true,
            }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const remaining = 5 - newAttempts;
        return new Response(
          JSON.stringify({
            error: `Código inválido. ${remaining} tentativa${remaining !== 1 ? "s" : ""} restante${remaining !== 1 ? "s" : ""}.`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Code is correct — mark as verified (step 2 → 3)
      await supabaseAdmin
        .from("password_reset_codes")
        .update({ verified: true })
        .eq("id", resetRecord.id);

      return new Response(
        JSON.stringify({ valid: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Step 3: update the password ---
    if (!isStrongPassword(new_password)) {
      return new Response(
        JSON.stringify({
          error: "A senha deve ter no mínimo 8 caracteres, uma letra maiúscula, um número e um símbolo.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the user by email
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const user = users?.users?.find((u) => u.email?.toLowerCase() === normalizedEmail);

    if (!user) {
      return new Response(
        JSON.stringify({ error: "Usuário não encontrado." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update password and invalidate all sessions
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: new_password,
    });

    if (updateError) {
      logger.error("Failed to update password", updateError);
      return new Response(
        JSON.stringify({ error: "Erro ao redefinir senha. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Invalidate all active sessions
    try {
      await supabaseAdmin.auth.admin.signOut(user.id, "global");
    } catch (signOutError) {
      logger.error("Failed to sign out sessions (non-critical)", signOutError);
    }

    // Mark code as used
    await supabaseAdmin
      .from("password_reset_codes")
      .update({ verified: true })
      .eq("id", resetRecord.id);

    logger.step("Password reset successful", { email: maskEmail(normalizedEmail) });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    logger.error("Unexpected error", error);
    return new Response(
      JSON.stringify({ error: "Erro interno. Tente novamente." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
