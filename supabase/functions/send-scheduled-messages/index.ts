import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { checkSendLimit } from "../_shared/sendGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalizePhone(input: string): string {
  const beforeAt = input.split("@")[0];
  return beforeAt.replace(/\D/g, "");
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

    // Fetch due scheduled messages
    const { data: dueMessages, error: fetchError } = await supabase
      .from("whatsapp_scheduled_messages")
      .select("*, contact:contact_id(id, phone, whatsapp_id, normalized_phone, organization_id, source), channel:channel_id(id, instance_name, organization_id)")
      .eq("status", "scheduled")
      .lte("scheduled_at", new Date().toISOString())
      .limit(50);

    if (fetchError) {
      console.error("[SCHEDULED-SEND] Fetch error:", fetchError);
      return new Response(JSON.stringify({ error: "Fetch error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!dueMessages || dueMessages.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[SCHEDULED-SEND] Processing ${dueMessages.length} scheduled messages`);

    const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
    const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");
    let sent = 0;
    let errors = 0;

    for (const msg of dueMessages) {
      try {
        const contact = msg.contact as any;
        const channel = msg.channel as any;

        if (!contact || !channel) {
          await supabase.from("whatsapp_scheduled_messages").update({
            status: "error",
            error_message: "Contact or channel not found",
            updated_at: new Date().toISOString(),
          }).eq("id", msg.id);
          errors++;
          continue;
        }

        const isWebchat = contact.source === "webchat" || (contact.whatsapp_id || "").startsWith("webchat-");
        const messageId = `out_sched_${crypto.randomUUID()}`;

        // Send guard check
        const guard = await checkSendLimit(supabase, contact.organization_id, contact.id, "scheduled");
        if (!guard.allowed) {
          console.warn(`[SCHEDULED-SEND] Message ${msg.id} blocked by send guard: ${guard.reason}`);
          await supabase.from("whatsapp_scheduled_messages").update({
            status: "error",
            error_message: `Blocked: ${guard.reason} — ${guard.detail}`,
            updated_at: new Date().toISOString(),
          }).eq("id", msg.id);
          errors++;
          continue;
        }

        if (isWebchat) {
          // Save directly for webchat
          await supabase.from("whatsapp_messages").insert({
            organization_id: contact.organization_id,
            contact_id: contact.id,
            message_id: messageId,
            content: msg.content,
            is_from_me: true,
            status: "sent",
            channel_id: channel.id,
            timestamp: new Date().toISOString(),
          });
        } else {
          // Send via Evolution API
          if (!vpsUrl || !apiKey) {
            await supabase.from("whatsapp_scheduled_messages").update({
              status: "error",
              error_message: "WhatsApp API not configured",
              updated_at: new Date().toISOString(),
            }).eq("id", msg.id);
            errors++;
            continue;
          }

          const digits = contact.normalized_phone || normalizePhone(contact.phone || contact.whatsapp_id || "");
          if (!digits) {
            await supabase.from("whatsapp_scheduled_messages").update({
              status: "error",
              error_message: "No phone number",
              updated_at: new Date().toISOString(),
            }).eq("id", msg.id);
            errors++;
            continue;
          }

          const recipientJid = `${digits}@s.whatsapp.net`;
          const evoResponse = await fetch(`${vpsUrl}/message/sendText/${channel.instance_name}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: apiKey },
            body: JSON.stringify({ number: recipientJid, text: msg.content }),
          });

          if (!evoResponse.ok) {
            const errText = await evoResponse.text();
            console.error(`[SCHEDULED-SEND] API error for ${msg.id}:`, errText);
            await supabase.from("whatsapp_scheduled_messages").update({
              status: "error",
              error_message: `API error: ${evoResponse.status}`,
              updated_at: new Date().toISOString(),
            }).eq("id", msg.id);
            errors++;
            continue;
          }
          await evoResponse.text();

          // Save message
          await supabase.from("whatsapp_messages").insert({
            organization_id: contact.organization_id,
            contact_id: contact.id,
            message_id: messageId,
            content: msg.content,
            is_from_me: true,
            status: "sent",
            channel_id: channel.id,
            timestamp: new Date().toISOString(),
          });
        }

        // Update contact last message
        const { data: currentContactData } = await supabase
          .from("whatsapp_contacts")
          .select("conversation_status")
          .eq("id", contact.id)
          .single();
        const currentStatus = currentContactData?.conversation_status || "novo";
        const contactUpdate: Record<string, any> = {
          last_message_at: new Date().toISOString(),
          last_message_content: msg.content.substring(0, 200),
          last_message_is_from_me: true,
        };
        // Only transition "novo" to "atendendo" — do NOT reopen finalized conversations with automated messages
        if (currentStatus === "novo") {
          contactUpdate.conversation_status = "atendendo";
        }
        await supabase.from("whatsapp_contacts").update(contactUpdate).eq("id", contact.id);

        // Mark as sent
        await supabase.from("whatsapp_scheduled_messages").update({
          status: "sent",
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", msg.id);

        sent++;
        console.log(`[SCHEDULED-SEND] Sent message ${msg.id} to contact ${contact.id}`);
      } catch (err) {
        console.error(`[SCHEDULED-SEND] Error processing ${msg.id}:`, err);
        await supabase.from("whatsapp_scheduled_messages").update({
          status: "error",
          error_message: String(err),
          updated_at: new Date().toISOString(),
        }).eq("id", msg.id);
        errors++;
      }
    }

    console.log(`[SCHEDULED-SEND] Done: ${sent} sent, ${errors} errors`);
    return new Response(JSON.stringify({ processed: dueMessages.length, sent, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[SCHEDULED-SEND] Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
