import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    // Check if already has demo data
    const { data: org } = await adminClient
      .from("organizations")
      .select("is_demo_mode")
      .eq("id", orgId)
      .single();

    if (org?.is_demo_mode) {
      return new Response(JSON.stringify({ success: true, message: "Já está em modo demonstração" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if org already has real data (don't overwrite)
    const { count: clientCount } = await adminClient
      .from("clients")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .is("deleted_at", null);

    if ((clientCount ?? 0) > 0) {
      return new Response(JSON.stringify({ success: true, message: "Organização já possui dados" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const today = now.toISOString().split("T")[0];
    
    // Helper to get date offset
    const offsetDate = (days: number) => {
      const d = new Date(now);
      d.setDate(d.getDate() + days);
      return d.toISOString().split("T")[0];
    };

    // 1. Create demo clients
    const demoClients = [
      {
        organization_id: orgId,
        name: "Maria Silva",
        phone: "(11) 99999-0001",
        email: "maria@exemplo.com",
        address: "Rua das Flores, 123",
        city: "São Paulo",
        state: "SP",
        zip_code: "01001-000",
        is_demo_data: true,
        person_type: "fisica",
        client_status: "active",
      },
      {
        organization_id: orgId,
        name: "João Santos",
        phone: "(11) 99999-0002",
        email: "joao@exemplo.com",
        address: "Av. Paulista, 1000",
        city: "São Paulo",
        state: "SP",
        zip_code: "01310-100",
        is_demo_data: true,
        person_type: "fisica",
        client_status: "active",
      },
      {
        organization_id: orgId,
        name: "Empresa ABC Climatização",
        phone: "(11) 99999-0003",
        email: "contato@abc.com",
        address: "Rua Industrial, 500",
        city: "São Paulo",
        state: "SP",
        zip_code: "04001-000",
        is_demo_data: true,
        person_type: "juridica",
        company_name: "ABC Climatização LTDA",
        document: "12.345.678/0001-90",
        client_status: "active",
      },
      {
        organization_id: orgId,
        name: "Ana Oliveira",
        phone: "(11) 99999-0004",
        email: "ana@exemplo.com",
        address: "Rua do Comércio, 75",
        city: "São Paulo",
        state: "SP",
        zip_code: "02001-000",
        is_demo_data: true,
        person_type: "fisica",
        client_status: "active",
      },
    ];

    const { data: insertedClients, error: clientsError } = await adminClient
      .from("clients")
      .insert(demoClients)
      .select("id, name");

    if (clientsError) {
      console.error("Error inserting demo clients:", clientsError);
      throw clientsError;
    }

    const clientIds = insertedClients?.map(c => c.id) || [];

    // 2. Get the next quote number
    const { data: maxQuote } = await adminClient
      .from("services")
      .select("quote_number")
      .eq("organization_id", orgId)
      .order("quote_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextQuote = (maxQuote?.quote_number ?? 0) + 1;

    // 3. Create demo services
    const demoServices = [
      {
        organization_id: orgId,
        client_id: clientIds[0],
        quote_number: nextQuote++,
        service_type: "ordem_servico" as const,
        status: "completed" as const,
        description: "Instalação de split 12.000 BTUs",
        value: 450,
        scheduled_date: offsetDate(-5),
        completed_date: offsetDate(-4),
        is_demo_data: true,
      },
      {
        organization_id: orgId,
        client_id: clientIds[1],
        quote_number: nextQuote++,
        service_type: "ordem_servico" as const,
        status: "approved" as const,
        description: "Manutenção preventiva - Limpeza completa",
        value: 280,
        scheduled_date: offsetDate(1),
        is_demo_data: true,
      },
      {
        organization_id: orgId,
        client_id: clientIds[2],
        quote_number: nextQuote++,
        service_type: "orcamento" as const,
        status: "pending" as const,
        description: "Orçamento para 3 splits - Escritório",
        value: 3200,
        is_demo_data: true,
      },
      {
        organization_id: orgId,
        client_id: clientIds[3],
        quote_number: nextQuote++,
        service_type: "ordem_servico" as const,
        status: "approved" as const,
        description: "Reparo em compressor - Ar condicionado central",
        value: 650,
        scheduled_date: offsetDate(3),
        is_demo_data: true,
      },
      {
        organization_id: orgId,
        client_id: clientIds[0],
        quote_number: nextQuote++,
        service_type: "ordem_servico" as const,
        status: "completed" as const,
        description: "Higienização e troca de filtro",
        value: 180,
        scheduled_date: offsetDate(-10),
        completed_date: offsetDate(-9),
        is_demo_data: true,
      },
    ];

    const { data: insertedServices, error: servicesError } = await adminClient
      .from("services")
      .insert(demoServices)
      .select("id, value, status");

    if (servicesError) {
      console.error("Error inserting demo services:", servicesError);
      throw servicesError;
    }

    // 4. Create financial account if not exists
    const { data: existingAccounts } = await adminClient
      .from("financial_accounts")
      .select("id")
      .eq("organization_id", orgId)
      .eq("account_type", "cash")
      .limit(1);

    let cashAccountId: string;
    if (existingAccounts && existingAccounts.length > 0) {
      cashAccountId = existingAccounts[0].id;
      // Update balance with demo completed services total
      const completedTotal = insertedServices
        ?.filter(s => s.status === "completed")
        .reduce((acc, s) => acc + (s.value || 0), 0) || 0;
      
      await adminClient
        .from("financial_accounts")
        .update({ balance: completedTotal })
        .eq("id", cashAccountId);
    } else {
      const completedTotal = insertedServices
        ?.filter(s => s.status === "completed")
        .reduce((acc, s) => acc + (s.value || 0), 0) || 0;

      const { data: newAccount } = await adminClient
        .from("financial_accounts")
        .insert({
          organization_id: orgId,
          name: "Caixa Principal",
          account_type: "cash",
          balance: completedTotal,
          is_active: true,
        })
        .select("id")
        .single();
      
      cashAccountId = newAccount?.id || "";
    }

    // 5. Create demo payments for completed services
    if (cashAccountId) {
      const completedServiceIds = insertedServices
        ?.filter(s => s.status === "completed")
        .map(s => ({ id: s.id, value: s.value })) || [];

      for (const svc of completedServiceIds) {
        await adminClient
          .from("service_payments")
          .insert({
            organization_id: orgId,
            service_id: svc.id,
            amount: svc.value || 0,
            payment_method: "pix",
            financial_account_id: cashAccountId,
            is_confirmed: true,
            confirmed_at: now.toISOString(),
          });
      }
    }

    // 6. Set organization to demo mode with a monthly goal
    await adminClient
      .from("organizations")
      .update({ 
        is_demo_mode: true,
        monthly_goal: 15000,
      })
      .eq("id", orgId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Dados de demonstração criados com sucesso",
        stats: {
          clients: clientIds.length,
          services: insertedServices?.length || 0,
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error seeding demo data:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao criar dados de demonstração" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
