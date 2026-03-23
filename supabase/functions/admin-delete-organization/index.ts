import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = claimsData.claims.sub as string;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Check caller is super_admin
    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "super_admin");

    if (!callerRoles || callerRoles.length === 0) {
      return new Response(JSON.stringify({ error: "Acesso negado: requer super_admin" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { organizationId } = await req.json();

    if (!organizationId) {
      return new Response(JSON.stringify({ error: "organizationId é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Log the destructive operation BEFORE deleting (will be cleaned up with org)
    // Note: We insert the audit log but it will be deleted along with the org data

    // Get all users linked to this organization
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("organization_id", organizationId);

    const userIds = profiles?.map((p) => p.user_id) || [];

    // For each user, check if they belong ONLY to this org
    for (const userId of userIds) {
      // Don't delete the caller
      if (userId === callerId) continue;

      // Don't delete root super admins
      const { data: rootCheck } = await supabaseAdmin
        .from("super_admin_grants")
        .select("is_root")
        .eq("user_id", userId)
        .eq("is_root", true)
        .maybeSingle();

      if (rootCheck) continue;

      // Clean up user data
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
      await supabaseAdmin.from("super_admin_grants").delete().eq("user_id", userId);

      // Get user email for email_verifications cleanup
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (userData?.user?.email) {
        await supabaseAdmin
          .from("email_verifications")
          .delete()
          .eq("email", userData.user.email.toLowerCase());
      }

      // Delete from auth (profile will cascade with org deletion)
      await supabaseAdmin.auth.admin.deleteUser(userId);
    }

    // Delete audit log entries for this org BEFORE deleting the org
    // This prevents the audit trigger from failing on FK constraint
    await supabaseAdmin
      .from("data_audit_log")
      .delete()
      .eq("organization_id", organizationId);

    // Now delete the organization — CASCADE handles all related data
    const { error: deleteError } = await supabaseAdmin
      .from("organizations")
      .delete()
      .eq("id", organizationId);

    if (deleteError) {
      console.error("Error deleting organization:", deleteError);
      return new Response(
        JSON.stringify({ error: "Erro ao excluir organização: " + deleteError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
