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
  trial_d0: 5,
  trial_d1: 10,
  trial_d3: 20,
  trial_d5: 30,
  trial_d7: 40,
  trial_ending_3d: 50,
  trial_ending_1d: 60,
  trial_ending_0d: 70,
  post_trial_d1: 45,
  post_trial_d3: 35,
  post_trial_d7: 25,
  new_user_activation: 15,
  signup_recovery: 5,
  churn_recovery: 15,
  inactive_3d: 12,
  inactive_7d: 18,
  inactive_15d: 22,
};

const TRIAL_DAY_MAP: Record<string, number> = {
  trial_d0: 0,
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

/**
 * Calculate days between two dates using Brazil timezone (America/Sao_Paulo).
 * This avoids off-by-one errors for users in BRT/BRST timezones.
 */
function daysBetween(dateA: Date, dateB: Date): number {
  // Convert to BRT date strings and compare calendar days
  const fmt = (d: Date) => {
    const parts = d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).split("-");
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  };
  const a = fmt(dateA);
  const b = fmt(dateB);
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

// ── Email sending via Resend ──
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = "Tecvo <noreply@notify.tecvo.com.br>";

async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `Resend ${res.status}: ${errText}` };
    }
    await res.json();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

function buildAutomationEmailHtml(userName: string, bodyText: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
  <tr><td style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:24px 40px;text-align:center;">
    <h1 style="color:#ffffff;font-size:22px;margin:0;font-weight:700;">Tecvo</h1>
  </td></tr>
  <tr><td style="padding:32px 40px;">
    <p style="color:#3f3f46;font-size:15px;line-height:1.6;margin:0 0 16px;">${bodyText}</p>
    <table cellpadding="0" cellspacing="0" style="margin:24px auto;">
    <tr><td style="background:#2563eb;border-radius:8px;padding:14px 32px;">
      <a href="https://tecvo.com.br/dashboard" style="color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;">
        Acessar a Tecvo →
      </a>
    </td></tr></table>
  </td></tr>
  <tr><td style="background:#fafafa;padding:20px 40px;border-top:1px solid #e4e4e7;text-align:center;">
    <p style="color:#a1a1aa;font-size:12px;margin:0;">
      Tecvo — Gestão inteligente para empresas de serviço<br>
      <a href="https://tecvo.com.br" style="color:#2563eb;text-decoration:none;">tecvo.com.br</a>
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

// ── Email subject map ──
const EMAIL_SUBJECTS: Record<string, string> = {
  trial_d0: "🚀 Bem-vindo à Tecvo!",
  trial_d1: "📊 Como está sua experiência na Tecvo?",
  trial_d3: "🏆 Resultados Reais com a Tecvo",
  trial_d5: "🔥 Chega de planilhas e papelada!",
  trial_d7: "{{name}}, testar sem usar não mostra resultado",
  trial_ending_3d: "{{name}}, em 3 dias você perde o controle dos seus clientes",
  trial_ending_1d: "Amanhã você perde seus clientes de vista, {{name}}",
  trial_ending_0d: "{{name}}, seu faturamento automático parou agora",
  post_trial_d1: "💪 Seus dados ainda estão salvos",
  post_trial_d3: "🚀 Sentimos sua falta!",
  post_trial_d7: "⏰ Última chamada — reative agora",
  new_user_activation: "🚀 Crie sua primeira Ordem de Serviço",
  signup_recovery: "😊 Falta pouco pra finalizar seu cadastro",
  churn_recovery: "{{name}}, seus clientes continuam precisando de manutenção",
  inactive_3d: "{{name}}, seus clientes podem estar esperando",
  inactive_7d: "{{name}}, faz 1 semana — quanto dinheiro ficou na mesa?",
  inactive_15d: "{{name}}, última chamada antes de perder o controle",
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
    const todayStr = now.toISOString().split("T")[0];

    // ──────────────────────────────────────────────
    // 2. Build candidate list
    // ──────────────────────────────────────────────
    interface Candidate {
      user_id: string;
      org_id: string;
      phone: string | null;
      user_email: string | null;
      name: string;
      trigger_type: string;
      automation_id: string;
      priority: number;
      email?: string; // for signup_recovery
      metadata?: any;
    }
    const candidatesByUser = new Map<string, Candidate[]>();

    function addCandidate(c: Candidate) {
      const existing = candidatesByUser.get(c.user_id) || [];
      existing.push(c);
      candidatesByUser.set(c.user_id, existing);
    }

    // Helper to get user email from auth
    async function getUserEmail(userId: string): Promise<string | null> {
      try {
        const { data } = await supabase.auth.admin.getUserById(userId);
        return data?.user?.email || null;
      } catch {
        return null;
      }
    }

    // ── 2a. Trial journey (D0, D1, D3, D5, D7) ──
    const trialTriggers = automations.filter((a: any) => TRIAL_DAY_MAP[a.trigger_type] !== undefined);
    const postTrialTriggers = automations.filter((a: any) => POST_TRIAL_DAY_MAP[a.trigger_type] !== undefined);

    if (trialTriggers.length > 0 || postTrialTriggers.length > 0) {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString();
      const { data: profiles, error: profError } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, organization_id, phone, whatsapp_personal, created_at, organizations!inner(trial_ends_at, subscription_status, plan)")
        .gte("created_at", thirtyDaysAgo);

      if (profError) {
        console.error("[AUTOMATION-ENGINE] Profile query error:", profError);
      } else if (profiles && profiles.length > 0) {
        console.log(`[AUTOMATION-ENGINE] Found ${profiles.length} recent profiles to evaluate`);

        // Batch get emails for all users
        const emailCache = new Map<string, string | null>();

        for (const profile of profiles) {
          const org = profile.organizations as any;
          const trialEndsAt = org?.trial_ends_at ? new Date(org.trial_ends_at) : null;
          const signupDate = new Date(profile.created_at);
          const daysSinceSignup = daysBetween(signupDate, now);
          const phone = profile.whatsapp_personal || profile.phone;
          const firstName = profile.full_name?.split(" ")[0] || "amigo(a)";

          // Get user email (cached)
          if (!emailCache.has(profile.user_id)) {
            emailCache.set(profile.user_id, await getUserEmail(profile.user_id));
          }
          const userEmail = emailCache.get(profile.user_id) || null;

          const trialActive = trialEndsAt && trialEndsAt > now;
          const trialExpired = trialEndsAt && trialEndsAt <= now;
          const daysSinceExpiry = trialEndsAt ? daysBetween(trialEndsAt, now) : -1;

          // Skip users who already have a paid plan
          if (org?.subscription_status === "active" && org?.plan && org.plan !== "trial") {
            continue;
          }

          // Trial automations
          if (trialActive) {
            for (const auto of trialTriggers) {
              const targetDay = TRIAL_DAY_MAP[auto.trigger_type];
              if (daysSinceSignup === targetDay) {
                addCandidate({
                  user_id: profile.id,
                  org_id: profile.organization_id,
                  phone,
                  user_email: userEmail,
                  name: firstName,
                  trigger_type: auto.trigger_type,
                  automation_id: auto.id,
                  priority: TRIGGER_PRIORITY[auto.trigger_type] || 0,
                });
              }
            }
          }

          // Post-trial automations
          if (trialExpired && daysSinceExpiry >= 0) {
            for (const auto of postTrialTriggers) {
              const targetDay = POST_TRIAL_DAY_MAP[auto.trigger_type];
              if (daysSinceExpiry === targetDay) {
                addCandidate({
                  user_id: profile.id,
                  org_id: profile.organization_id,
                  phone,
                  user_email: userEmail,
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
            .select("id, user_id, full_name, phone, whatsapp_personal")
            .eq("organization_id", org.id)
            .order("created_at", { ascending: true })
            .limit(1)
            .single();

          if (profile) {
            const userEmail = await getUserEmail(profile.user_id);
            addCandidate({
              user_id: profile.id,
              org_id: org.id,
              phone: profile.whatsapp_personal || profile.phone,
              user_email: userEmail,
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
          const eventEmail = event.metadata?.email;
          const phone = event.metadata?.phone;
          const name = event.metadata?.fullName || "amigo(a)";
          if (!eventEmail) continue;

          const { count: completedCount } = await supabase
            .from("user_activity_events")
            .select("*", { count: "exact", head: true })
            .eq("event_type", "signup_completed")
            .or(`metadata->>email.eq.${eventEmail},metadata->>email.eq.${eventEmail.toLowerCase()}`);

          if (completedCount === 0) {
            addCandidate({
              user_id: `signup_${eventEmail}`,
              org_id: "",
              phone,
              user_email: eventEmail,
              name: name.split(" ")[0],
              trigger_type: "signup_recovery",
              automation_id: signupRecovery.id,
              priority: TRIGGER_PRIORITY["signup_recovery"] || 0,
              email: eventEmail,
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

      // Use a wider 24-hour window to not miss users due to cron timing
      const startTime = new Date(targetDate.getTime() - 12 * 3600000).toISOString();
      const endTime = new Date(targetDate.getTime() + 12 * 3600000).toISOString();

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, organization_id, phone, whatsapp_personal, created_at")
        .gte("created_at", startTime)
        .lte("created_at", endTime);

      if (profiles) {
        for (const profile of profiles) {
          const { count: osCount } = await supabase
            .from("service_items")
            .select("*", { count: "exact", head: true })
            .eq("organization_id", profile.organization_id);

          if (osCount === 0) {
            const userEmail = await getUserEmail(profile.user_id);
            addCandidate({
              user_id: profile.id,
              org_id: profile.organization_id,
              phone: profile.whatsapp_personal || profile.phone,
              user_email: userEmail,
              name: profile.full_name?.split(" ")[0] || "amigo(a)",
              trigger_type: "new_user_activation",
              automation_id: activationAuto.id,
              priority: TRIGGER_PRIORITY["new_user_activation"] || 0,
            });
          }
        }
      }
    }

    // ── 2e. Inactivity Detection (3d, 7d, 15d) + Churn Recovery ──
    const INACTIVITY_MAP: Record<string, number> = {
      inactive_3d: 3,
      inactive_7d: 7,
      inactive_15d: 15,
    };

    const inactivityTriggers = automations.filter((a: any) => INACTIVITY_MAP[a.trigger_type] !== undefined);
    const churnAuto = automationsByType.get("churn_recovery");

    if (inactivityTriggers.length > 0 || churnAuto) {
      // Get all users who have logged in at some point (use auth.users last_sign_in_at)
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, organization_id, phone, whatsapp_personal, created_at, organizations!inner(subscription_status, plan, trial_ends_at)")
        .not("organization_id", "is", null);

      if (allProfiles && allProfiles.length > 0) {
        for (const profile of allProfiles) {
          const org = profile.organizations as any;

          // Skip users in active trial (they get trial automations instead)
          const trialEndsAt = org?.trial_ends_at ? new Date(org.trial_ends_at) : null;
          const trialActive = trialEndsAt && trialEndsAt > now;
          if (trialActive) continue;

          // Skip users who expired less than 7 days ago (they get post_trial automations)
          const daysSinceExpiry = trialEndsAt ? daysBetween(trialEndsAt, now) : 999;
          if (daysSinceExpiry <= 7 && daysSinceExpiry >= 0) continue;

          // Use auth admin to get last_sign_in_at
          let lastSignIn: Date | null = null;
          try {
            const { data: authUser } = await supabase.auth.admin.getUserById(profile.user_id);
            if (authUser?.user?.last_sign_in_at) {
              lastSignIn = new Date(authUser.user.last_sign_in_at);
            }
          } catch { /* skip */ }

          if (!lastSignIn) continue;

          const daysSinceAccess = daysBetween(lastSignIn, now);
          if (daysSinceAccess < 3) continue; // Active user, skip

          const phone = profile.whatsapp_personal || profile.phone;
          const firstName = profile.full_name?.split(" ")[0] || "amigo(a)";

          // Cache email
          if (!emailCache.has(profile.user_id)) {
            emailCache.set(profile.user_id, await getUserEmail(profile.user_id));
          }
          const userEmail = emailCache.get(profile.user_id) || null;

          // Match to inactivity automations
          for (const auto of inactivityTriggers) {
            const targetDays = INACTIVITY_MAP[auto.trigger_type];
            // Use range: target ± 1 day to handle cron timing
            if (daysSinceAccess >= targetDays && daysSinceAccess <= targetDays + 1) {
              addCandidate({
                user_id: profile.id,
                org_id: profile.organization_id,
                phone,
                user_email: userEmail,
                name: firstName,
                trigger_type: auto.trigger_type,
                automation_id: auto.id,
                priority: TRIGGER_PRIORITY[auto.trigger_type] || 0,
              });
            }
          }

          // Churn recovery: 30+ days inactive
          if (churnAuto && daysSinceAccess >= 30 && daysSinceAccess <= 31) {
            addCandidate({
              user_id: profile.id,
              org_id: profile.organization_id,
              phone,
              user_email: userEmail,
              name: firstName,
              trigger_type: "churn_recovery",
              automation_id: churnAuto.id,
              priority: TRIGGER_PRIORITY["churn_recovery"] || 0,
            });
          }
        }
      }
    }


    // 3. DEDUP & SEND
    // ──────────────────────────────────────────────
    const results: any[] = [];

    for (const [userId, candidates] of candidatesByUser) {
      candidates.sort((a, b) => b.priority - a.priority);
      const best = candidates[0];

      console.log(`[AUTOMATION-ENGINE] User ${userId}: ${candidates.length} eligible, best=${best.trigger_type} (pri=${best.priority})`);

      // Check if already SUCCESSFULLY sent THIS automation to this user
      // Failed sends should be retried
      const { count: alreadySentThis } = await supabase
        .from("analytics_automation_logs")
        .select("*", { count: "exact", head: true })
        .eq("automation_id", best.automation_id)
        .eq(best.email ? "email" : "user_id", best.email || userId)
        .eq("status", "sent");

      if ((alreadySentThis || 0) > 0) {
        console.log(`[AUTOMATION-ENGINE] User ${userId}: already received ${best.trigger_type}, skipping`);
        continue;
      }

      // Check 1/day limit (only count successful sends)
      const { count: sentToday } = await supabase
        .from("analytics_automation_logs")
        .select("*", { count: "exact", head: true })
        .eq(best.email ? "email" : "user_id", best.email || userId)
        .eq("status", "sent")
        .gte("sent_at", `${todayStr}T00:00:00`);

      if ((sentToday || 0) > 0) {
        console.log(`[AUTOMATION-ENGINE] User ${userId}: already received an automation today, skipping`);
        continue;
      }

      // ── DETERMINE CHANNELS ──
      const hasPhone = !!best.phone;
      const hasEmail = !!(best.user_email || best.email);
      const contactEmail = best.user_email || best.email;

      if (!hasPhone && !hasEmail) {
        console.log(`[AUTOMATION-ENGINE] User ${userId}: no phone AND no email, skipping`);
        continue;
      }

      const automation = automationsByType.get(best.trigger_type)!;
      const waMessage = automation.message_template.replace("{{name}}", best.name);
      const emailBody = automation.email_template || waMessage;

      // ── SEND VIA WHATSAPP (if phone available) ──
      let waStatus = "skipped";
      let waError: string | null = null;

      if (hasPhone && vpsUrl && apiKey) {
        try {
          let cleanNumber = best.phone!.replace(/\D/g, "");
          if (!cleanNumber.startsWith("55") && cleanNumber.length <= 11) {
            cleanNumber = "55" + cleanNumber;
          }
          const jid = `${cleanNumber}@s.whatsapp.net`;

          const res = await fetch(`${vpsUrl}/message/sendText/${TECVO_PLATFORM_INSTANCE}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: apiKey },
            body: JSON.stringify({ number: jid, text: waMessage }),
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

      // ── SEND VIA EMAIL (if email available AND (no phone OR wa failed)) ──
      let emailStatus = "skipped";
      let emailError: string | null = null;

      // Send email alongside WhatsApp (both channels), not just as fallback
      const shouldSendEmail = hasEmail && !!automation.email_template;

      if (shouldSendEmail && contactEmail) {
        const subject = EMAIL_SUBJECTS[best.trigger_type] || "Novidades da Tecvo";
        const htmlBody = buildAutomationEmailHtml(
          best.name,
          emailBody.replace("{{name}}", best.name).replace(/\n/g, "<br>")
        );

        const result = await sendEmail(contactEmail, subject, htmlBody);
        emailStatus = result.success ? "sent" : "error";
        emailError = result.error || null;

        if (result.success) {
          console.log(`[AUTOMATION-ENGINE] Email sent to ${contactEmail} for ${best.trigger_type}`);
        } else {
          console.error(`[AUTOMATION-ENGINE] Email failed for ${contactEmail}:`, result.error);
        }
      }

      // Determine overall status
      const overallStatus = waStatus === "sent" || emailStatus === "sent" ? "sent" : "error";
      const channelUsed = waStatus === "sent" && emailStatus === "sent"
        ? "whatsapp+email"
        : waStatus === "sent"
        ? "whatsapp"
        : emailStatus === "sent"
        ? "email"
        : waStatus === "error" ? "whatsapp" : "email";

      // 5. Log the result
      await supabase.from("analytics_automation_logs").insert({
        automation_id: best.automation_id,
        user_id: best.email ? null : userId,
        email: contactEmail || null,
        organization_id: best.org_id || null,
        status: overallStatus,
        channel: channelUsed,
        error_message: waError || emailError,
        metadata: {
          phone: best.phone,
          name: best.name,
          wa_status: waStatus,
          email_status: emailStatus,
          email_error: emailError,
          wa_error: waError,
          message_sent: waMessage,
          trigger_type: best.trigger_type,
          candidates_count: candidates.length,
          all_eligible: candidates.map((c) => c.trigger_type),
        },
      });

      // 6. Update journey state (for ALL users, not just those with phone)
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

      results.push({
        user: userId,
        trigger: best.trigger_type,
        wa_status: waStatus,
        email_status: emailStatus,
        channel: channelUsed,
        status: overallStatus,
      });
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
