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
      
      let targets = [];

      if (automation.trigger_type === "signup_recovery") {
        // Find signup_started events (delay_minutes ago) that didn't complete
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

            // Check if completed
            const { count: completedCount } = await supabase
              .from("user_activity_events")
              .select("*", { count: 'exact', head: true })
              .eq("event_type", "signup_completed")
              .or(`metadata->>email.eq.${email},metadata->>email.eq.${email.toLowerCase()}`);

            if (completedCount === 0) {
              // Check if already sent
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
      else if (automation.trigger_type === "new_user_activation") {
        // Users created delay_minutes ago who didn't create an OS
        const delay = automation.delay_minutes || 1440; // 24h default
        const startTime = new Date(Date.now() - (delay + 1440) * 60000).toISOString();
        const endTime = new Date(Date.now() - delay * 60000).toISOString();

        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, organization_id, phone, created_at")
          .gte("created_at", startTime)
          .lte("created_at", endTime);

        if (profiles) {
          for (const profile of profiles) {
            // Check if they created an OS
            const { count: osCount } = await supabase
              .from("service_orders")
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
                  org_id: profile.organization_id, 
                  phone: profile.phone, 
                  name: profile.full_name?.split(' ')[0] || "amigo(a)" 
                });
              }
            }
          }
        }
      }
      else if (automation.trigger_type === "churn_recovery") {
        // Users classified as 'em risco'
        const { data: scores } = await supabase
          .from("view_analytics_user_scores")
          .select("user_id, full_name, phone, organization_id")
          .eq("classification", "em risco");

        if (scores) {
          for (const score of scores) {
            // Check cooldown (7 days for churn)
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60000).toISOString();
            const { count: alreadySent } = await supabase
              .from("analytics_automation_logs")
              .select("*", { count: 'exact', head: true })
              .eq("automation_id", automation.id)
              .eq("user_id", score.user_id)
              .gt("sent_at", weekAgo);

            if (alreadySent === 0) {
              targets.push({ 
                user_id: score.user_id, 
                org_id: score.organization_id, 
                phone: score.phone, 
                name: score.full_name?.split(' ')[0] || "amigo(a)" 
              });
            }
          }
        }
      }

      // 3. Send messages to targets
      for (const target of targets) {
        if (!target.phone) {
          console.log(`[AUTOMATION-ENGINE] Target ${target.email || target.user_id} has no phone. Skipping.`);
          continue;
        }

        const message = automation.message_template.replace("{{name}}", target.name);
        
        console.log(`[AUTOMATION-ENGINE] Sending message to ${target.phone} for ${automation.name}`);

        let status = "sent";
        let errorMsg = null;

        if (vpsUrl && apiKey) {
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

            if (!res.ok) {
              status = "error";
              errorMsg = await res.text();
              console.error(`[AUTOMATION-ENGINE] Send failed for ${target.phone}:`, res.status, errorMsg);
            }
          } catch (err) {
            status = "error";
            errorMsg = err.message;
            console.error(`[AUTOMATION-ENGINE] Send error for ${target.phone}:`, err);
          }
        } else {
          status = "error";
          errorMsg = "WhatsApp API not configured";
          console.warn("[AUTOMATION-ENGINE] WhatsApp API not configured. Skipping actual send.");
        }

        // Log the result
        await supabase.from("analytics_automation_logs").insert({
          automation_id: automation.id,
          user_id: target.user_id || null,
          email: target.email || null,
          organization_id: target.org_id || null,
          status: status,
          error_message: errorMsg,
          metadata: { 
            phone: target.phone, 
            name: target.name,
            original_metadata: target.metadata 
          }
        });

        results.push({ target: target.email || target.user_id, status });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
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
