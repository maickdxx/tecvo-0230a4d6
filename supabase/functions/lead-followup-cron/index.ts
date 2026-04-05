import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkSendLimit, logSend } from "../_shared/sendGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Follow-up messages by step (1-4)
const FOLLOWUP_MESSAGES: Record<number, string> = {
  1: "Conseguiu ver minha mensagem? Posso te mostrar rapidinho como funciona 😊",
  2: "Muita gente me chama porque está perdendo cliente por falta de organização. É o seu caso também?",
  3: "Se quiser, te explico em 1 minuto como organizar agenda, clientes e financeiro tudo no mesmo lugar. E o primeiro mês sai por apenas R$ 1 🔥",
  4: "Se não for o momento agora, sem problema 😊\nQuando quiser organizar sua operação, é só me chamar por aqui.\n\n— Laura | Secretária Inteligente da Tecvo",
};

async function sendWhatsAppMessage(instance: string, remoteJid: string, text: string) {
  const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
  const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");
  if (!vpsUrl || !apiKey) {
    console.error("[LEAD-FOLLOWUP] Missing VPS URL or API Key");
    return false;
  }
  try {
    const resp = await fetch(`${vpsUrl}/message/sendText/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number: remoteJid, text }),
    });
    const ok = resp.ok;
    if (!ok) console.error("[LEAD-FOLLOWUP] Send failed:", await resp.text());
    return ok;
  } catch (e: any) {
    console.error("[LEAD-FOLLOWUP] Send error:", e.message);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date().toISOString();

    // Fetch follow-ups that are due
    const { data: followups, error } = await supabase
      .from("lead_followups")
      .select("*")
      .eq("status", "pending")
      .lte("next_followup_at", now)
      .order("next_followup_at", { ascending: true })
      .limit(20);

    if (error) {
      console.error("[LEAD-FOLLOWUP] Query error:", error);
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!followups || followups.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[LEAD-FOLLOWUP] Processing ${followups.length} follow-ups`);

    let processed = 0;

    for (const fu of followups) {
      const nextStep = fu.step + 1;

      if (nextStep > 4) {
        // All follow-ups sent, mark as completed
        await supabase.from("lead_followups").update({
          status: "completed",
          completed_at: now,
          updated_at: now,
        }).eq("id", fu.id);
        continue;
      }

      const message = FOLLOWUP_MESSAGES[nextStep];
      if (!message) continue;

      // Find the contact for SendGuard
      const { data: contact } = await supabase
        .from("whatsapp_contacts")
        .select("id")
        .eq("phone", fu.phone)
        .eq("channel_id", fu.channel_id)
        .single();

      // ── SEND GUARD: check rate limits before sending ──
      const guardContactId = contact?.id || null;
      const sendCheck = await checkSendLimit(
        supabase,
        fu.organization_id,
        guardContactId,
        "lead_followup",
      );

      if (!sendCheck.allowed) {
        console.warn(`[LEAD-FOLLOWUP] BLOCKED by SendGuard for ${fu.phone}: ${sendCheck.reason}`);
        await logSend(
          supabase,
          fu.organization_id,
          guardContactId,
          "lead_followup",
          "blocked",
          sendCheck.reason,
          message.substring(0, 200),
        );
        continue;
      }

      // Find the channel instance name
      const { data: channel } = await supabase
        .from("whatsapp_channels")
        .select("instance_name")
        .eq("id", fu.channel_id)
        .single();

      if (!channel) {
        console.warn(`[LEAD-FOLLOWUP] Channel not found: ${fu.channel_id}`);
        await supabase.from("lead_followups").update({
          status: "completed",
          completed_at: now,
          updated_at: now,
        }).eq("id", fu.id);
        continue;
      }

      // Build remoteJid
      const remoteJid = `${fu.phone}@s.whatsapp.net`;
      const sent = await sendWhatsAppMessage(channel.instance_name, remoteJid, message);

      if (sent) {
        // Save the message in whatsapp_messages
        if (contact) {
          await supabase.from("whatsapp_messages").insert({
            organization_id: fu.organization_id,
            contact_id: contact.id,
            message_id: `followup_${nextStep}_${crypto.randomUUID()}`,
            content: message,
            is_from_me: true,
            status: "sent",
            channel_id: fu.channel_id,
            ai_generated: true,
          });
        }

        // Log successful send
        await logSend(
          supabase,
          fu.organization_id,
          guardContactId,
          "lead_followup",
          "sent",
          undefined,
          message.substring(0, 200),
        );

        // Calculate next follow-up time
        let nextFollowupAt: string | null = null;
        if (nextStep === 1) {
          nextFollowupAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
        } else if (nextStep === 2) {
          nextFollowupAt = new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString();
        } else if (nextStep === 3) {
          nextFollowupAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
        }

        await supabase.from("lead_followups").update({
          step: nextStep,
          last_followup_sent_at: now,
          next_followup_at: nextFollowupAt,
          status: nextStep >= 4 ? "completed" : "pending",
          completed_at: nextStep >= 4 ? now : null,
          updated_at: now,
        }).eq("id", fu.id);

        processed++;
        console.log(`[LEAD-FOLLOWUP] Sent step ${nextStep} to ${fu.phone}`);
      } else {
        console.warn(`[LEAD-FOLLOWUP] Failed to send step ${nextStep} to ${fu.phone}`);
        await logSend(
          supabase,
          fu.organization_id,
          guardContactId,
          "lead_followup",
          "error",
          "send_failed",
          message.substring(0, 200),
        );
      }

      // Small delay between sends
      await new Promise(r => setTimeout(r, 2000));
    }

    return new Response(JSON.stringify({ ok: true, processed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[LEAD-FOLLOWUP] Error:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
