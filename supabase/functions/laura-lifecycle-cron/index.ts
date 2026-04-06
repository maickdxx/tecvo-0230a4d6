/**
 * ── LAURA LIFECYCLE CRON ──
 * 
 * Central lifecycle messaging system. Laura is the ONLY voice.
 * Runs hourly via cron. All messages go through send window.
 * 
 * FLOWS:
 * A) Welcome (immediate after signup) — handled by send-welcome-whatsapp
 * B) Activation D+1 (no usage) — nudge first action
 * C) Activation D+3 (no usage) — pain point + benefit
 * D) Reactivation D+7 (no usage or abandoned) — light re-engagement
 * E) Positive reinforcement (active user) — retention boost
 * 
 * RULES:
 * - Only sends to org owners
 * - Respects send window (08:00-20:00)
 * - Max 1 message per user per day
 * - No duplicate message types
 * - Uses Laura's voice (natural, human, practical)
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { TECVO_PLATFORM_INSTANCE } from "../_shared/sendFlowTypes.ts";
import { resolveOwnerContact } from "../_shared/resolveOwnerPhone.ts";
import { checkAndEnqueue } from "../_shared/sendWindow.ts";
import { checkSendLimit } from "../_shared/sendGuard.ts";
import { fetchOrgTimezone } from "../_shared/timezone.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── LAURA'S MESSAGES ──
// Natural, human, practical. Always leads to a clear action.

const MESSAGES = {
  // D+1: User signed up but did nothing
  activation_d1: (name: string) =>
    `Oi ${name}! 😊 Tudo bem?\n\nVi que você criou sua conta na Tecvo ontem. Que tal começar registrando um serviço que você fez recentemente?\n\nÉ rápido: me manda aqui o nome do cliente e o que foi feito que eu já organizo pra você.\n\n— Laura`,

  // D+3: Still no usage — show the pain
  activation_d3: (name: string) =>
    `${name}, me conta uma coisa: como você controla hoje os serviços que já fez e os que tem pendente?\n\nSe usa caderno ou WhatsApp, é bem provável que já perdeu algum agendamento ou esqueceu de cobrar alguém.\n\nMe manda o próximo serviço que você tem agendado que eu coloco na sua agenda aqui. Assim você já começa a ter tudo num lugar só. 📋\n\n— Laura`,

  // D+7: Light re-engagement
  reactivation_d7: (name: string) =>
    `Oi ${name}! Faz uma semana que você criou sua conta. 😊\n\nSei que a correria do dia a dia é grande, mas queria te lembrar que tô aqui pra te ajudar.\n\nQuer começar de um jeito simples? Me manda o nome de um cliente seu e eu cadastro pra você em segundos.\n\n— Laura`,

  // Positive reinforcement for active users
  positive_active: (name: string, osCount: number) =>
    `${name}, parabéns! 🎉 Você já tem ${osCount} serviço${osCount > 1 ? "s" : ""} registrado${osCount > 1 ? "s" : ""} na Tecvo.\n\nIsso significa que você tá cada vez mais organizado. Continue assim!\n\nSe precisar de qualquer coisa, é só me chamar aqui. 😊\n\n— Laura`,

  // Inactivity D+3 (was active, stopped)
  inactive_3d: (name: string) =>
    `Oi ${name}! Vi que faz uns dias que você não apareceu por aqui.\n\nTá tudo bem? Se precisar de ajuda com alguma coisa, é só me mandar uma mensagem.\n\nQuer que eu te mostre um resumo rápido de como tá sua agenda? 📅\n\n— Laura`,

  // Inactivity D+7 (was active, stopped for a week)
  inactive_7d: (name: string) =>
    `${name}, faz uma semana que a gente não se fala. 😊\n\nSei que a rotina aperta, mas seus clientes continuam precisando de manutenção.\n\nQuer que eu te ajude a organizar a semana? Me manda o que você tem pendente que eu cuido.\n\n— Laura`,
};

type MessageType = keyof typeof MESSAGES;

function daysBetween(dateA: Date, dateB: Date): number {
  const fmt = (d: Date) => {
    const parts = d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).split("-");
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  };
  return Math.floor((fmt(dateB).getTime() - fmt(dateA).getTime()) / 86400000);
}

async function sendWhatsApp(phone: string, text: string): Promise<boolean> {
  const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
  const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");
  if (!vpsUrl || !apiKey) return false;

  let cleanNumber = phone.replace(/\D/g, "");
  if (!cleanNumber.startsWith("55") && cleanNumber.length <= 11) {
    cleanNumber = "55" + cleanNumber;
  }
  const jid = `${cleanNumber}@s.whatsapp.net`;

  try {
    const res = await fetch(`${vpsUrl}/message/sendText/${TECVO_PLATFORM_INSTANCE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number: jid, text }),
    });
    if (!res.ok) {
      console.error("[LAURA-LIFECYCLE] Send failed:", res.status, await res.text());
      return false;
    }
    await res.text();
    return true;
  } catch (err) {
    console.error("[LAURA-LIFECYCLE] Send error:", err);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date();
    const todayStr = now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

    // Get all organizations (both free and paid)
    const { data: orgs } = await supabase
      .from("organizations")
      .select("id, plan, subscription_status, messaging_paused, timezone")
      .eq("messaging_paused", false);

    if (!orgs || orgs.length === 0) {
      return jsonResponse({ message: "No organizations to process" });
    }

    // Get all owner roles
    const { data: ownerRoles } = await supabase
      .from("user_roles")
      .select("user_id, organization_id")
      .eq("role", "owner");

    const ownerByOrg = new Map<string, string>();
    for (const r of ownerRoles || []) {
      ownerByOrg.set(r.organization_id, r.user_id);
    }

    const results: any[] = [];

    for (const org of orgs) {
      const ownerId = ownerByOrg.get(org.id);
      if (!ownerId) continue;

      // Resolve owner contact
      const owner = await resolveOwnerContact(supabase, org.id);
      if (!owner.phone || !owner.aiEnabled) {
        continue;
      }

      // Check if already sent a lifecycle message today
      const { count: sentToday } = await supabase
        .from("auto_message_log")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", org.id)
        .in("message_type", ["activation_d1", "activation_d3", "reactivation_d7", "positive_active", "inactive_3d", "inactive_7d"])
        .gte("sent_at", `${todayStr}T00:00:00`);

      if ((sentToday || 0) > 0) continue;

      // Get profile info
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, created_at")
        .eq("user_id", ownerId)
        .single();

      if (!profile) continue;

      const firstName = profile.full_name?.split(" ")[0] || "amigo(a)";
      const signupDate = new Date(profile.created_at);
      const daysSinceSignup = daysBetween(signupDate, now);

      // Get last sign-in
      let lastSignIn: Date | null = null;
      try {
        const { data: authUser } = await supabase.auth.admin.getUserById(ownerId);
        if (authUser?.user?.last_sign_in_at) {
          lastSignIn = new Date(authUser.user.last_sign_in_at);
        }
      } catch { /* skip */ }

      // Get service count
      const { count: osCount } = await supabase
        .from("services")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", org.id);

      const hasUsage = (osCount || 0) > 0;
      const daysSinceAccess = lastSignIn ? daysBetween(lastSignIn, now) : daysSinceSignup;

      // ── DETERMINE WHICH MESSAGE TO SEND ──
      let messageType: MessageType | null = null;
      let messageText: string | null = null;

      // New users (first 7 days) — activation journey
      if (daysSinceSignup <= 7 && !hasUsage) {
        if (daysSinceSignup === 1) {
          messageType = "activation_d1";
        } else if (daysSinceSignup === 3) {
          messageType = "activation_d3";
        } else if (daysSinceSignup === 7) {
          messageType = "reactivation_d7";
        }
      }
      // Active users — positive reinforcement (only once, when they hit 3+ services)
      else if (hasUsage && (osCount || 0) >= 3 && daysSinceSignup >= 3) {
        // Check if positive message was already sent
        const { count: positiveSent } = await supabase
          .from("auto_message_log")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", org.id)
          .eq("message_type", "positive_active");

        if ((positiveSent || 0) === 0) {
          messageType = "positive_active";
        }
      }
      // Inactive users (had usage, stopped accessing)
      else if (hasUsage && daysSinceAccess >= 3 && daysSinceSignup > 7) {
        // Check if this specific inactivity message was already sent
        if (daysSinceAccess >= 3 && daysSinceAccess < 7) {
          const { count: sent3d } = await supabase
            .from("auto_message_log")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", org.id)
            .eq("message_type", "inactive_3d");

          if ((sent3d || 0) === 0) {
            messageType = "inactive_3d";
          }
        } else if (daysSinceAccess >= 7 && daysSinceAccess < 15) {
          const { count: sent7d } = await supabase
            .from("auto_message_log")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", org.id)
            .eq("message_type", "inactive_7d");

          if ((sent7d || 0) === 0) {
            messageType = "inactive_7d";
          }
        }
      }

      if (!messageType) continue;

      // Build message text
      if (messageType === "positive_active") {
        messageText = MESSAGES[messageType](firstName, osCount || 0);
      } else {
        messageText = MESSAGES[messageType](firstName);
      }

      // Send guard check
      const guard = await checkSendLimit(supabase, org.id, null, "lifecycle");
      if (!guard.allowed) {
        console.log(`[LAURA-LIFECYCLE] Org ${org.id} blocked by guard: ${guard.reason}`);
        continue;
      }

      const orgTz = org.timezone || "America/Sao_Paulo";

      // Check send window — queue if outside hours
      const windowCheck = await checkAndEnqueue({
        supabase,
        organizationId: org.id,
        phone: owner.phone,
        messageContent: messageText,
        messageType,
        sourceFunction: "laura-lifecycle-cron",
        idempotencyKey: `lifecycle-${org.id}-${messageType}-${todayStr}`,
        timezone: orgTz,
      });

      if (windowCheck.action === "queued") {
        console.log(`[LAURA-LIFECYCLE] ⏰ Org ${org.id} ${messageType} queued for ${windowCheck.scheduledFor}`);
        // Log the queued message
        await supabase.from("auto_message_log").insert({
          organization_id: org.id,
          message_type: messageType,
          content: messageText,
          send_status: "queued",
          sent_at: new Date().toISOString(),
          sent_date: todayStr,
        });
        results.push({ org: org.id, type: messageType, status: "queued" });
        continue;
      }

      // Send via WhatsApp
      const sent = await sendWhatsApp(owner.phone, messageText);

      // Log the send
      await supabase.from("auto_message_log").insert({
        organization_id: org.id,
        message_type: messageType,
        content: messageText,
        send_status: sent ? "sent" : "failed",
        sent_at: new Date().toISOString(),
        sent_date: todayStr,
      });

      results.push({ org: org.id, type: messageType, status: sent ? "sent" : "failed" });

      if (sent) {
        console.log(`[LAURA-LIFECYCLE] ✅ ${messageType} sent to org ${org.id} (${firstName})`);
      } else {
        console.log(`[LAURA-LIFECYCLE] ❌ ${messageType} failed for org ${org.id}`);
      }

      // Small delay between orgs
      await new Promise(r => setTimeout(r, 2000));
    }

    console.log(`[LAURA-LIFECYCLE] Done. Processed ${results.length} messages.`);
    return jsonResponse({ success: true, processed: results.length, results });
  } catch (error: any) {
    console.error("[LAURA-LIFECYCLE] Error:", error);
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
