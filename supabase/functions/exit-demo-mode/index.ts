import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse body for confirmation
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // No body is fine for backward compat, but we'll require confirmation
    }

    if (!body.confirm) {
      return new Response(
        JSON.stringify({ error: "Confirmação obrigatória. Envie { confirm: true } para prosseguir." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User client to get profile
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role client for deletions
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's organization
    const { data: profile } = await adminClient
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.organization_id) {
      return new Response(JSON.stringify({ error: "Organização não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgId = profile.organization_id;

    // Verify org is in demo mode
    const { data: org } = await adminClient
      .from("organizations")
      .select("is_demo_mode")
      .eq("id", orgId)
      .single();

    if (!org?.is_demo_mode) {
      return new Response(JSON.stringify({ error: "Organização não está em modo demonstração" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log the operation before executing
    await adminClient
      .from("data_audit_log")
      .insert({
        organization_id: orgId,
        user_id: user.id,
        table_name: "organizations",
        operation: "FUNCTION_CALL",
        record_id: orgId,
        metadata: { function: "exit-demo-mode", confirmed: true },
      });

    // Delete demo data in correct order (respecting foreign keys)
    // 1. Transactions (references services and clients)
    await adminClient
      .from("transactions")
      .delete()
      .eq("organization_id", orgId)
      .eq("is_demo_data", true);

    // 2. Service-related tables
    await adminClient
      .from("service_payments")
      .delete()
      .eq("organization_id", orgId)
      .in("service_id", 
        (await adminClient.from("services").select("id").eq("organization_id", orgId).eq("is_demo_data", true)).data?.map((s: any) => s.id) || []
      );

    await adminClient
      .from("service_items")
      .delete()
      .eq("organization_id", orgId)
      .in("service_id",
        (await adminClient.from("services").select("id").eq("organization_id", orgId).eq("is_demo_data", true)).data?.map((s: any) => s.id) || []
      );

    // 3. Services
    await adminClient
      .from("services")
      .delete()
      .eq("organization_id", orgId)
      .eq("is_demo_data", true);

    // 4. Clients
    await adminClient
      .from("clients")
      .delete()
      .eq("organization_id", orgId)
      .eq("is_demo_data", true);

    // 5. Reset financial account balance to 0
    await adminClient
      .from("financial_accounts")
      .update({ balance: 0 })
      .eq("organization_id", orgId)
      .eq("account_type", "cash");

    // 6. Set is_demo_mode = false and clear monthly_goal
    await adminClient
      .from("organizations")
      .update({ is_demo_mode: false, monthly_goal: null })
      .eq("id", orgId);

    return new Response(
      JSON.stringify({ success: true, message: "Ambiente pronto. Agora sua empresa começa aqui." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error exiting demo mode:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao sair do modo demonstração" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
