import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
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

    // Client with user's JWT to identify them
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabaseUser.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    // Admin client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get user's organization
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .single();

    if (profile?.organization_id) {
      // Count members in the organization
      const { count } = await supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", profile.organization_id);

      if (count === 1) {
        // Only member: delete the entire organization (cascade cleans up related data)
        await supabaseAdmin
          .from("organizations")
          .delete()
          .eq("id", profile.organization_id);
      } else {
        // Multiple members: remove only this user's profile and roles
        await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("user_id", userId);
        await supabaseAdmin
          .from("user_organizations")
          .delete()
          .eq("user_id", userId);
        await supabaseAdmin
          .from("profiles")
          .delete()
          .eq("user_id", userId);
      }
    }

    // Clean up email_verifications to free the email
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userData?.user?.email) {
      await supabaseAdmin
        .from("email_verifications")
        .delete()
        .eq("email", userData.user.email.toLowerCase());
    }

    // Delete user from auth.users — this frees the email immediately
    const { error: deleteError } =
      await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error("Error deleting user:", deleteError);
      return new Response(
        JSON.stringify({ error: "Erro ao excluir conta. Tente novamente." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
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
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
