import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { TECVO_PLATFORM_INSTANCE } from "../_shared/sendFlowTypes.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Priority map: higher number = higher priority.
 * When multiple automations are eligible on the same day, only the highest priority fires.
 */
const TRIGGER_PRIORITY: Record<string, number> = {
  // Trial journey (ascending urgency)
  trial_d1: 10,
  trial_d3: 20,
  trial_d5: 30,
  trial_d7: 40,
  // Trial ending alerts (highest urgency)
  trial_ending_3d: 50,
  trial_ending_1d: 60,
  trial_ending_0d: 70,
  // Post-trial recovery
  post_trial_d1: 45,
  post_trial_d3: 35,
  post_trial_d7: 25,
  // Activation & recovery
  new_user_activation: 15,
  signup_recovery: 5,
  churn_recovery: 15,
};

/**
 * Maps trigger_type to the number of days after signup when it should fire.
 * trial_d0 is handled by welcome whatsapp and is disabled.
 */
const TRIAL_DAY_MAP: Record<string, number> = {
  trial_d1: 1,
  trial_d3: 3,
  trial_d5: 5,
  trial_d7: 7,
};

const POST_TRIAL_DAY_MAP: Record<string, number> = {
  post_trial_d1: 1,
  post_trial_d3: 3,
  post_trial_d7: 7,
};

function daysBetween(dateA: Date, dateB: Date): number {
  const msPerDay = 86400000;
  return Math.floor((dateB.getTime() - dateA.getTime()) / msPerDay);
}

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
    const { data: automations, error: autoError } = await supabase
      .from("analytics_automations")
      .select("*")
      .eq("enabled", true);

    if (autoError) throw autoError;
    if (!automations || automations.length === 0) {
      console.log("[AUTOMATION-ENGINE] No active automations found.");
      return jsonResponse({ message: "No active automations" });
    }

    const automationsByType = new Map(automations.map((a: any) => [a.trigger_type, a]));
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0]; // YYYY-MM-DD

    // ──────────────────────────────────────────────
    // 2. Build candidate list: all (user, automation) pairs eligible RIGHT NOW
    // ──────────────────────────────────────────────
    interface Candidate {
      user_id: string;
      org_id: string;
      phone: string | null;
      name: string;
      trigger_type: string;
      automation_id: string;
      priority: number;
      email?: string;
      metadata?: any;
    }
    const candidatesByUser = new Map<string, Candidate[]>();

    function addCandidate(c: Candidate) {
      const existing = candidatesByUser.get(c.user_id) || [];
      existing.push(c);
      candidatesByUser.set(c.user_id, existing);
    }

    // ── 2a. Trial journey (D1, D3, D5, D7) ──
    // Get all profiles in active trial (trial hasn't ended yet OR ended within 7 days for post-trial)
    const trialTriggers = automations.filter((a: any) => TRIAL_DAY_MAP[a.trigger_type] !== undefined);
    const postTrialTriggers = automations.filter((a: any) => POST_TRIAL_DAY_MAP[a.trigger_type] !== undefined);

    if (trialTriggers.length > 0 || postTrialTriggers.length > 0) {
      // Fetch profiles created in the last 30 days (covers all trial + post-trial windows)
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString();
      const { data: profiles, error: profError } = await supabase
        .from("profiles")
        .select("id, full_name, organization_id, phone, whatsapp_personal, created_at, organizations!inner(trial_ends_at, subscription_status, plan)")
        .gte("created_at", thirtyDaysAgo);

      if (profError) {
        console.error("[AUTOMATION-ENGINE] Profile query error:", profError);
      } else if (profiles && profiles.length > 0) {
        console.log(`[AUTOMATION-ENGINE] Found ${profiles.length} recent profiles to evaluate`);

        for (const profile of profiles) {
          const org = profile.organizations as any;
          const trialEndsAt = org?.trial_ends_at ? new Date(org.trial_ends_at) : null;
          const signupDate = new Date(profile.created_at);
          const daysSinceSignup = daysBetween(signupDate, now);
          const phone = profile.whatsapp_personal || profile.phone;
          const firstName = profile.full_name?.split(" ")[0] || "amigo(a)";

          // Check if trial is still active
          const trialActive = trialEndsAt && trialEndsAt > now;
          // Check if trial expired (for post-trial)
          const trialExpired = trialEndsAt && trialEndsAt <= now;
          const daysSinceExpiry = trialEndsAt ? daysBetween(trialEndsAt, now) : -1;

          // Skip users who already have a paid plan
          if (org?.subscription_status === "active" && org?.plan && org.plan !== "trial") {
            continue;
          }

          // Trial automations: only if trial is active
          if (trialActive) {
            for (const auto of trialTriggers) {
              const targetDay = TRIAL_DAY_MAP[auto.trigger_type];
              if (daysSinceSignup === targetDay) {
                addCandidate({
                  user_id: profile.id,
                  org_id: profile.organization_id,
                  phone,
                  name: firstName,
                  trigger_type: auto.trigger_type,
                  automation_id: auto.id,
                  priority: TRIGGER_PRIORITY[auto.trigger_type] || 0,
                });
              }
            }
          }

          // Post-trial automations: only if trial expired
          if (trialExpired && daysSinceExpiry >= 0) {
            for (const auto of postTrialTriggers) {
              const targetDay = POST_TRIAL_DAY_MAP[auto.trigger_type];
              if (daysSinceExpiry === targetDay) {
                addCandidate({
                  user_id: profile.id,
                  org_id: profile.organization_id,
                  phone,
                  name: firstName,
                  trigger_type: auto.trigger_type,
                  automation_id: auto.id,
                  priority: TRIGGER_PRIORITY[auto.trigger_type] || 0,
                });
              }
            }
          }
        }
      }
    }

    // ── 2b. Trial ending alerts ──
    const endingTriggers = automations.filter((a: any) => a.trigger_type.startsWith("trial_ending_"));
    for (const auto of endingTriggers) {
      const daysMap: Record<string, number> = { "3d": 3, "1d": 1, "0d": 0 };
      const suffix = auto.trigger_type.split("_")[2];
      const daysUntilEnd = daysMap[suffix] ?? -1;
      if (daysUntilEnd === -1) continue;

      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + daysUntilEnd);
      const dateStr = targetDate.toISOString().split("T")[0];

      const { data: orgs } = await supabase
        .from("organizations")
        .select("id, name, trial_ends_at")
        .filter("trial_ends_at", "gte", `${dateStr}T00:00:00`)
        .filter("trial_ends_at", "lte", `${dateStr}T23:59:59`);

      if (orgs && orgs.length > 0) {
        for (const org of orgs) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, full_name, phone, whatsapp_personal")
            .eq("organization_id", org.id)
            .order("created_at", { ascending: true })
            .limit(1)
            .single();

          if (profile) {
            addCandidate({
              user_id: profile.id,
              org_id: org.id,
              phone: profile.whatsapp_personal || profile.phone,
              name: profile.full_name?.split(" ")[0] || "amigo(a)",
              trigger_type: auto.trigger_type,
              automation_id: auto.id,
              priority: TRIGGER_PRIORITY[auto.trigger_type] || 0,
            });
          }
        }
      }
    }

    // ── 2c. Signup Recovery ──
    const signupRecovery = automationsByType.get("signup_recovery");
    if (signupRecovery) {
      const delay = signupRecovery.delay_minutes || 30;
      const startTime = new Date(now.getTime() - (delay + 60) * 60000).toISOString();
      const endTime = new Date(now.getTime() - delay * 60000).toISOString();

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
            .select("*", { count: "exact", head: true })
            .eq("event_type", "signup_completed")
            .or(`metadata->>email.eq.${email},metadata->>email.eq.${email.toLowerCase()}`);

          if (completedCount === 0) {
            // Use email as pseudo user_id for signup recovery
            addCandidate({
              user_id: `signup_${email}`,
              org_id: "",
              phone,
              name: name.split(" ")[0],
              trigger_type: "signup_recovery",
              automation_id: signupRecovery.id,
              priority: TRIGGER_PRIORITY["signup_recovery"] || 0,
              email,
              metadata: event.metadata,
            });
          }
        }
      }
    }

    // ── 2d. New User Activation ──
    const activationAuto = automationsByType.get("new_user_activation");
    if (activationAuto) {
      const delay = activationAuto.delay_minutes || 1440;
      const targetDate = new Date(now.getTime() - delay * 60000);
      const daysSinceSignup = 1; // activation fires at D1

      // Get profiles created ~24h ago
      const startTime = new Date(targetDate.getTime() - 3600000).toISOString();
      const endTime = new Date(targetDate.getTime() + 3600000).toISOString();

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, organization_id, phone, whatsapp_personal, created_at")
        .gte("created_at", startTime)
        .lte("created_at", endTime);

      if (profiles) {
        for (const profile of profiles) {
          const { count: osCount } = await supabase
            .from("service_items")
            .select("*", { count: "exact", head: true })
            .eq("organization_id", profile.organization_id);

          if (osCount === 0) {
            addCandidate({
              user_id: profile.id,
              org_id: profile.organization_id,
              phone: profile.whatsapp_personal || profile.phone,
              name: profile.full_name?.split(" ")[0] || "amigo(a)",
              trigger_type: "new_user_activation",
              automation_id: activationAuto.id,
              priority: TRIGGER_PRIORITY["new_user_activation"] || 0,
            });
          }
        }
      }
    }

    // ──────────────────────────────────────────────
    // 3. DEDUP: For each user, pick only the highest-priority candidate
    //    AND check that no automation was sent to them today already
    // ──────────────────────────────────────────────
    const results: any[] = [];

    for (const [userId, candidates] of candidatesByUser) {
      // Sort by priority descending
      candidates.sort((a, b) => b.priority - a.priority);
      const best = candidates[0];

      console.log(`[AUTOMATION-ENGINE] User ${userId}: ${candidates.length} eligible, best=${best.trigger_type} (pri=${best.priority})`);

      // Check if already sent THIS automation to this user
      const { count: alreadySentThis } = await supabase
        .from("analytics_automation_logs")
        .select("*", { count: "exact", head: true })
        .eq("automation_id", best.automation_id)
        .eq(best.email ? "email" : "user_id", best.email || userId);

      if ((alreadySentThis || 0) > 0) {
        console.log(`[AUTOMATION-ENGINE] User ${userId}: already received ${best.trigger_type}, skipping`);
        continue;
      }

      // Check if ANY automation was sent to this user today (1/day limit)
      const { count: sentToday } = await supabase
        .from("analytics_automation_logs")
        .select("*", { count: "exact", head: true })
        .eq(best.email ? "email" : "user_id", best.email || userId)
        .gte("sent_at", `${todayStr}T00:00:00`);

      if ((sentToday || 0) > 0) {
        console.log(`[AUTOMATION-ENGINE] User ${userId}: already received an automation today, skipping`);
        continue;
      }

      // 4. Send message
      if (!best.phone) {
        console.log(`[AUTOMATION-ENGINE] User ${userId}: no phone, skipping`);
        continue;
      }

      const automation = automationsByType.get(best.trigger_type)!;
      const message = automation.message_template.replace("{{name}}", best.name);

      console.log(`[AUTOMATION-ENGINE] Sending ${best.trigger_type} to ${best.phone}`);

      let waStatus = "skipped";
      let waError: string | null = null;

      if (vpsUrl && apiKey) {
        try {
          let cleanNumber = best.phone.replace(/\D/g, "");
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
            console.error(`[AUTOMATION-ENGINE] WA failed for ${best.phone}:`, res.status, waError);
          }
        } catch (err: any) {
          waStatus = "error";
          waError = err.message;
          console.error(`[AUTOMATION-ENGINE] WA error for ${best.phone}:`, err);
        }
      }

      // 5. Log the result
      await supabase.from("analytics_automation_logs").insert({
        automation_id: best.automation_id,
        user_id: best.email ? null : userId,
        email: best.email || null,
        organization_id: best.org_id || null,
        status: waStatus === "sent" ? "sent" : waStatus === "error" ? "error" : "processed",
        channel: "whatsapp",
        error_message: waError,
        metadata: {
          phone: best.phone,
          name: best.name,
          wa_status: waStatus,
          message_sent: message,
          trigger_type: best.trigger_type,
          candidates_count: candidates.length,
          all_eligible: candidates.map((c) => c.trigger_type),
        },
      });

      // 6. Update journey state
      if (!best.email) {
        await supabase
          .from("user_journey_state")
          .upsert(
            {
              user_id: userId,
              organization_id: best.org_id || null,
              journey_type: best.trigger_type.startsWith("post_trial") ? "post_trial" : "trial",
              current_step: best.trigger_type,
              last_automation_id: best.automation_id,
              last_sent_at: new Date().toISOString(),
              last_sent_date: todayStr,
              status: "active",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,journey_type" }
          );
      }

      results.push({ user: userId, trigger: best.trigger_type, status: waStatus });
    }

    console.log(`[AUTOMATION-ENGINE] Done. Processed ${results.length} sends.`);

    return jsonResponse({ success: true, processed_count: results.length, results });
  } catch (error: any) {
    console.error("[AUTOMATION-ENGINE] Critical error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function jsonResponse(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
