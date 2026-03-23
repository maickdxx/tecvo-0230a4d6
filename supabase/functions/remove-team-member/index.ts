import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger, maskUserId } from "../_shared/logging.ts";

const log = createLogger("REMOVE-TEAM-MEMBER");

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();
    
    if (!userId) {
      throw new Error("ID do usuário é obrigatório");
    }

    // Create admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Create user client to verify permissions
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Não autenticado");
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify who is making the request
    const { data: { user: requestingUser }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !requestingUser) {
      throw new Error("Não autenticado");
    }

    // Prevent self-deletion
    if (requestingUser.id === userId) {
      throw new Error("Você não pode remover a si mesmo");
    }

    // Check if requester is admin or owner
    const { data: requesterRoles, error: requesterRoleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id);

    if (requesterRoleError || !requesterRoles || requesterRoles.length === 0) {
      throw new Error("Não foi possível verificar suas permissões");
    }

    if (!requesterRoles.some(r => ["owner", "admin"].includes(r.role))) {
      throw new Error("Sem permissão para excluir membros");
    }

    // Check if target user is owner
    const { data: targetRoles, error: targetRoleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (targetRoleError || !targetRoles || targetRoles.length === 0) {
      throw new Error("Usuário não encontrado");
    }

    if (targetRoles.some(r => r.role === "owner")) {
      throw new Error("Não é possível excluir o proprietário");
    }

    // Verify both are in the same organization
    const { data: requesterProfile, error: requesterProfileError } = await supabaseAdmin
      .from("profiles")
      .select("organization_id")
      .eq("user_id", requestingUser.id)
      .single();

    if (requesterProfileError || !requesterProfile) {
      throw new Error("Perfil não encontrado");
    }

    const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .single();

    if (targetProfileError || !targetProfile) {
      throw new Error("Membro não encontrado");
    }

    if (requesterProfile.organization_id !== targetProfile.organization_id) {
      throw new Error("Membro não pertence à sua organização");
    }

    // Clean up email_verifications
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userData?.user?.email) {
      await supabaseAdmin
        .from("email_verifications")
        .delete()
        .eq("email", userData.user.email.toLowerCase());
    }

    // Clean up related records before deleting auth user
    // Order matters: delete from child tables first, then parent references
    await supabaseAdmin.from("time_clock_adjustments").delete().eq("requested_by", userId);
    await supabaseAdmin.from("time_clock_entries").delete().eq("user_id", userId);
    await supabaseAdmin.from("time_clock_bank_hours").delete().eq("user_id", userId);
    await supabaseAdmin.from("time_clock_month_closures").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_activity_events").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_sessions").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_organizations").delete().eq("user_id", userId);
    await supabaseAdmin.from("super_admin_grants").delete().eq("user_id", userId);
    await supabaseAdmin.from("member_permissions").delete().eq("user_id", userId);
    await supabaseAdmin.from("employee_expenses").delete().eq("employee_id", userId);
    await supabaseAdmin.from("service_execution_logs").delete().eq("user_id", userId);
    await supabaseAdmin.from("notification_tokens").delete().eq("user_id", userId);

    // Nullify FK references (SET NULL columns)
    await supabaseAdmin.from("services").update({ assigned_to: null }).eq("assigned_to", userId);
    await supabaseAdmin.from("whatsapp_contacts").update({ assigned_to: null }).eq("assigned_to", userId);
    await supabaseAdmin.from("time_clock_month_closures").update({ closed_by: null }).eq("closed_by", userId);
    await supabaseAdmin.from("time_clock_month_closures").update({ reopened_by: null }).eq("reopened_by", userId);

    // Delete profile last (has organization_id needed by other queries)
    await supabaseAdmin.from("profiles").delete().eq("user_id", userId);

    // Delete the user from auth
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      log.error("Error deleting user", deleteError);
      throw new Error("Erro ao excluir usuário");
    }

    // Log with masked IDs
    log.step("User deleted", { 
      deletedUser: maskUserId(userId), 
      deletedBy: maskUserId(requestingUser.id) 
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    log.error("Remove team member failed", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
