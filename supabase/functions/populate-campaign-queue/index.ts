/**
 * populate-campaign-queue — Populates campaign_sends with eligible users.
 * Priority ordering:
 *   1. Recently active users (highest)
 *   2. Recently expired trial
 *   3. Users with some activity
 *   4. Users who never used (lowest)
 * 
 * Respects cooldown to avoid re-sending to users who already received.
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const campaignName = body.campaign_name || "reengagement";
    const minDays = body.min_days || 20;
    
    // Default templates for auto-population (cron doesn't send body)
    const messageTemplate = body.message_template || 
      "Olá {{name}}! 👋 Vimos que você criou sua conta na Tecvo há um tempo. Queremos te ajudar a aproveitar ao máximo a plataforma. Tem alguma dúvida? Responda aqui que te ajudamos! 🚀";
    const emailTemplate = body.email_template || 
      "Olá {{name}},\n\nVimos que você criou sua conta na Tecvo há algum tempo e gostaríamos de ajudar.\n\nA Tecvo pode simplificar a gestão da sua empresa de serviços — ordens de serviço, clientes, agenda e muito mais.\n\nQue tal dar uma olhada? Estamos aqui para ajudar!\n\nEquipe Tecvo";
    const emailSubject = body.email_subject || "Precisando de ajuda com a Tecvo? 🤝";

    if (!messageTemplate) {
      return jsonResponse({ error: "message_template is required" }, 400);
    }

    // Read config
    const { data: config } = await supabase
      .from("campaign_config")
      .select("*")
      .eq("id", 1)
      .single();

    const cooldownHours = config?.cooldown_hours || 72;
    const cooldownCutoff = new Date(Date.now() - cooldownHours * 3600000).toISOString();

    // Get users who already received this campaign recently
    const { data: recentlySent } = await supabase
      .from("campaign_sends")
      .select("user_id")
      .eq("campaign_name", campaignName)
      .eq("status", "sent")
      .gte("processed_at", cooldownCutoff);

    const excludeUserIds = new Set((recentlySent || []).map((r: any) => r.user_id));

    // Get already pending/processing items
    const { data: alreadyQueued } = await supabase
      .from("campaign_sends")
      .select("user_id")
      .eq("campaign_name", campaignName)
      .in("status", ["pending", "processing"]);

    for (const q of alreadyQueued || []) {
      excludeUserIds.add(q.user_id);
    }

    // Fetch all profiles with org data — filter by registration age
    const cutoffDate = new Date(Date.now() - minDays * 86400000).toISOString();
    
    const { data: profiles, error: profError } = await supabase
      .from("profiles")
      .select("id, user_id, full_name, organization_id, phone, whatsapp_personal, created_at, organizations!inner(subscription_status, plan, trial_ends_at, created_at)")
      .not("organization_id", "is", null)
      .lte("created_at", cutoffDate);

    if (profError) throw profError;
    if (!profiles || profiles.length === 0) {
      return jsonResponse({ success: true, queued: 0, message: `No profiles found with ${minDays}+ days` });
    }

    const now = new Date();
    const inserts: any[] = [];

    for (const profile of profiles) {
      if (excludeUserIds.has(profile.id)) continue;

      const org = profile.organizations as any;
      const phone = profile.whatsapp_personal || profile.phone;
      const firstName = profile.full_name?.split(" ")[0] || "";

      // Skip users with active paid subscription
      if (org?.subscription_status === "active" && org?.plan && org.plan !== "trial") continue;

      // Must have at least phone or email
      let userEmail: string | null = null;
      try {
        const { data: authUser } = await supabase.auth.admin.getUserById(profile.user_id);
        userEmail = authUser?.user?.email || null;
      } catch { /* skip */ }

      if (!phone && !userEmail) continue;

      // Calculate priority based on activity level
      let priority = 0;
      let lastSignIn: Date | null = null;

      try {
        const { data: authUser } = await supabase.auth.admin.getUserById(profile.user_id);
        if (authUser?.user?.last_sign_in_at) {
          lastSignIn = new Date(authUser.user.last_sign_in_at);
        }
      } catch { /* skip */ }

      const trialEndsAt = org?.trial_ends_at ? new Date(org.trial_ends_at) : null;
      const trialExpired = trialEndsAt && trialEndsAt <= now;

      if (lastSignIn) {
        const daysSinceAccess = Math.floor((now.getTime() - lastSignIn.getTime()) / 86400000);

        if (daysSinceAccess <= 7) {
          priority = 100; // Most recently active
        } else if (daysSinceAccess <= 14) {
          priority = 80;
        } else if (daysSinceAccess <= 30) {
          priority = 60;
        } else {
          priority = 20; // Very old users
        }

        // Bonus for trial recently expired
        if (trialExpired) {
          const daysSinceExpiry = Math.floor((now.getTime() - trialEndsAt!.getTime()) / 86400000);
          if (daysSinceExpiry <= 7) priority += 30;
          else if (daysSinceExpiry <= 14) priority += 20;
          else if (daysSinceExpiry <= 30) priority += 10;
        }
      } else {
        // Never logged in = lowest priority
        priority = 5;
      }

      // Check if user has any service orders (activity indicator)
      const { count: osCount } = await supabase
        .from("service_items")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", profile.organization_id);

      if ((osCount || 0) > 0) priority += 15;

      inserts.push({
        campaign_name: campaignName,
        user_id: profile.id,
        organization_id: profile.organization_id,
        phone: phone || null,
        email: userEmail,
        user_name: firstName,
        message_template: messageTemplate,
        email_template: emailTemplate,
        email_subject: emailSubject,
        status: "pending",
        priority,
      });
    }

    // Batch insert
    if (inserts.length > 0) {
      const { error: insertError } = await supabase
        .from("campaign_sends")
        .insert(inserts);

      if (insertError) throw insertError;
    }

    console.log(`[CAMPAIGN-POPULATE] Queued ${inserts.length} users for campaign '${campaignName}'`);

    return jsonResponse({
      success: true,
      queued: inserts.length,
      excluded: excludeUserIds.size,
      total_profiles: profiles.length,
      priority_breakdown: {
        high: inserts.filter(i => i.priority >= 80).length,
        medium: inserts.filter(i => i.priority >= 40 && i.priority < 80).length,
        low: inserts.filter(i => i.priority < 40).length,
      },
    });
  } catch (error: any) {
    console.error("[CAMPAIGN-POPULATE] Error:", error);
    return jsonResponse({ error: error.message }, 500);
  }
});

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
