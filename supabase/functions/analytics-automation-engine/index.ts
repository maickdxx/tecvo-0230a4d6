import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { TECVO_PLATFORM_INSTANCE } from "../_shared/sendFlowTypes.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
  const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");

  try {
    console.log("[AUTOMATION-ENGINE] Starting processing...");

    // 1. Fetch enabled automations
    const { data: automations } = await supabase
      .from("analytics_automations")
      .select("*")
      .eq("enabled", true);

    if (!automations || automations.length === 0) {
      return new Response(JSON.stringify({ message: "No active automations" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];

    for (const automation of automations) {
      console.log(`[AUTOMATION-ENGINE] Checking trigger: ${automation.trigger_type}`);
      
      const targets = [];

      // TRIGGER: Signup Recovery
      if (automation.trigger_type === "signup_recovery") {
        const delay = automation.delay_minutes || 30;
        const startTime = new Date(Date.now() - (delay + 60) * 60000).toISOString();
        const endTime = new Date(Date.now() - delay * 60000).toISOString();

        const { data: events } = await supabase
          .from("user_activity_events")
          .select("metadata, created_at")
          .eq("event_type", "signup_started")
          .gte("created_at", startTime)
          .lte("created_at", endTime);

        if (events) {
          for (const event of events) {
            const email = event.metadata?.email;
            const phone = event.metadata?.phone;
            const name = event.metadata?.fullName || "amigo(a)";
            
            if (!email) continue;

            const { count: completedCount } = await supabase
              .from("user_activity_events")
              .select("*", { count: 'exact', head: true })
              .eq("event_type", "signup_completed")
              .or(`metadata->>email.eq.${email},metadata->>email.eq.${email.toLowerCase()}`);

            const { count: profileCount } = await supabase
              .from("profiles")
              .select("*", { count: 'exact', head: true })
              .or(`email.eq.${email},email.eq.${email.toLowerCase()}`);

            if (completedCount === 0 && profileCount === 0) {
              const { count: alreadySent } = await supabase
                .from("analytics_automation_logs")
                .select("*", { count: 'exact', head: true })
                .eq("automation_id", automation.id)
                .eq("email", email);

              if (alreadySent === 0) {
                targets.push({ email, phone, name, metadata: event.metadata });
              }
            }
          }
        }
      } 
      // TRIGGER: New User Activation
      else if (automation.trigger_type === "new_user_activation") {
        const delay = automation.delay_minutes || 1440; 
        const startTime = new Date(Date.now() - (delay + 1440) * 60000).toISOString();
        const endTime = new Date(Date.now() - delay * 60000).toISOString();

        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, organization_id, phone, email, created_at")
          .gte("created_at", startTime)
          .lte("created_at", endTime);

        if (profiles) {
          for (const profile of profiles) {
            const { count: osCount } = await supabase
              .from("service_items")
              .select("*", { count: 'exact', head: true })
              .eq("organization_id", profile.organization_id);

            if (osCount === 0) {
              const { count: alreadySent } = await supabase
                .from("analytics_automation_logs")
                .select("*", { count: 'exact', head: true })
                .eq("automation_id", automation.id)
                .eq("user_id", profile.id);

              if (alreadySent === 0) {
                targets.push({ 
                  user_id: profile.id, 
                  email: profile.email,
                  org_id: profile.organization_id, 
                  phone: profile.phone, 
                  name: profile.full_name?.split(' ')[0] || "amigo(a)" 
                });
              }
            }
          }
        }
      }
      // TRIGGER: Trial Journey (d0, d1, d3, d5, d7, d10, d13, d14)
      else if (automation.trigger_type.startsWith("trial_d")) {
        const delay = automation.delay_minutes || 0;
        const startTime = new Date(Date.now() - (delay + 60) * 60000).toISOString();
        const endTime = new Date(Date.now() - delay * 60000).toISOString();

        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, organization_id, phone, email, created_at")
          .gte("created_at", startTime)
          .lte("created_at", endTime);

        if (profiles) {
          for (const profile of profiles) {
            const { count: alreadySent } = await supabase
              .from("analytics_automation_logs")
              .select("*", { count: 'exact', head: true })
              .eq("automation_id", automation.id)
              .eq("user_id", profile.id);

            if (alreadySent === 0) {
              targets.push({ 
                user_id: profile.id, 
                email: profile.email,
                org_id: profile.organization_id, 
                phone: profile.phone, 
                name: profile.full_name?.split(' ')[0] || "amigo(a)" 
              });
            }
          }
        }
      }
      // TRIGGER: Trial Ending Alerts
      else if (automation.trigger_type.startsWith("trial_ending_")) {
        const daysMap: Record<string, number> = { "3d": 3, "1d": 1, "0d": 0 };
        const suffix = automation.trigger_type.split("_")[2];
        const daysUntilEnd = daysMap[suffix] ?? -1;

        if (daysUntilEnd !== -1) {
          const targetDate = new Date();
          targetDate.setDate(targetDate.getDate() + daysUntilEnd);
          const dateStr = targetDate.toISOString().split('T')[0];

          // Find orgs ending on this specific date
          const { data: orgs } = await supabase
            .from("organizations")
            .select("id, name, trial_ends_at")
            .filter('trial_ends_at', 'gte', `${dateStr}T00:00:00`)
            .filter('trial_ends_at', 'lte', `${dateStr}T23:59:59`);

          if (orgs) {
            for (const org of orgs) {
              // Find first user of this org
              const { data: profile } = await supabase
                .from("profiles")
                .select("id, full_name, phone, email")
                .eq("organization_id", org.id)
                .order('created_at', { ascending: true })
                .limit(1)
                .single();

              if (profile) {
                const { count: alreadySent } = await supabase
                  .from("analytics_automation_logs")
                  .select("*", { count: 'exact', head: true })
                  .eq("automation_id", automation.id)
                  .eq("user_id", profile.id);

                if (alreadySent === 0) {
                  targets.push({ 
                    user_id: profile.id, 
                    email: profile.email,
                    org_id: org.id, 
                    phone: profile.phone, 
                    name: profile.full_name?.split(' ')[0] || "amigo(a)" 
                  });
                }
              }
            }
          }
        }
      }

      // 3. Send messages to targets
      for (const target of targets) {
        const message = automation.message_template.replace("{{name}}", target.name);
        console.log(`[AUTOMATION-ENGINE] Target: ${target.phone || target.email} for ${automation.name}`);

        // --- WHATSAPP CHANNEL ---
        let waStatus = "skipped";
        let waError = null;

        if (target.phone && vpsUrl && apiKey) {
          try {
            let cleanNumber = target.phone.replace(/\D/g, "");
            if (!cleanNumber.startsWith("55") && cleanNumber.length <= 11) {
              cleanNumber = "55" + cleanNumber;
            }
            const jid = `${cleanNumber}@s.whatsapp.net`;

            const res = await fetch(`${vpsUrl}/message/sendText/${TECVO_PLATFORM_INSTANCE}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: apiKey },
              body: JSON.stringify({ number: jid, text: message }),
            });

            if (res.ok) {
              waStatus = "sent";
            } else {
              waStatus = "error";
              waError = await res.text();
              console.error(`[AUTOMATION-ENGINE] WA failed for ${target.phone}:`, res.status, waError);
            }
          } catch (err) {
            waStatus = "error";
            waError = err.message;
            console.error(`[AUTOMATION-ENGINE] WA error for ${target.phone}:`, err);
          }
        }

        // --- EMAIL CHANNEL (Complementary) ---
        let emailStatus = "skipped";
        let emailError = null;

        if (target.email && automation.email_template) {
          try {
            // We use the existing send-support-email or direct insert to queue
            // For now, we'll use the analytics-automation-logs to track intent
            // and log the content. In a full implementation, we'd trigger the email engine.
            const emailContent = automation.email_template.replace("{{name}}", target.name);
            
            // Try calling send-support-email or process-email-queue if possible
            // But since we want to be safe, we just log it for now as "queued" 
            // and in the next step we can add actual sending if required.
            emailStatus = "pending_infrastructure";
          } catch (err) {
            emailStatus = "error";
            emailError = err.message;
          }
        }

        // 4. Log the result
        await supabase.from("analytics_automation_logs").insert({
          automation_id: automation.id,
          user_id: target.user_id || null,
          email: target.email || null,
          organization_id: target.org_id || null,
          status: waStatus === "sent" ? "sent" : (waStatus === "error" ? "error" : "processed"),
          channel: "whatsapp",
          error_message: waError,
          metadata: { 
            phone: target.phone, 
            name: target.name,
            wa_status: waStatus,
            email_status: emailStatus,
            message_sent: message
          }
        });

        results.push({ target: target.email || target.user_id, status: waStatus });
      }
    }

    return new Response(JSON.stringify({ success: true, processed_count: results.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[AUTOMATION-ENGINE] Critical error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});