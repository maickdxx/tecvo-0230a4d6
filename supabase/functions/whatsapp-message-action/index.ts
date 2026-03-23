import { createClient } from "npm:@supabase/supabase-js@2.57.2";

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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, message_db_id, new_text, emoji } = await req.json();

    if (!action || !message_db_id) {
      return new Response(JSON.stringify({ error: "Missing action or message_db_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch message
    const { data: message } = await supabase
      .from("whatsapp_messages")
      .select("id, message_id, contact_id, channel_id, is_from_me, created_at, content")
      .eq("id", message_db_id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (!message) {
      return new Response(JSON.stringify({ error: "Message not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!message.is_from_me && action !== "react") {
      return new Response(JSON.stringify({ error: "Can only act on sent messages" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch channel for instance name
    const { data: channel } = await supabase
      .from("whatsapp_channels")
      .select("instance_name")
      .eq("id", message.channel_id)
      .single();

    if (!channel) {
      return new Response(JSON.stringify({ error: "Channel not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch contact for remoteJid
    const { data: contact } = await supabase
      .from("whatsapp_contacts")
      .select("whatsapp_id")
      .eq("id", message.contact_id)
      .single();

    if (!contact) {
      return new Response(JSON.stringify({ error: "Contact not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
    const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");

    if (!vpsUrl || !apiKey) {
      return new Response(JSON.stringify({ error: "WhatsApp API not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Helper to log audit
    const logAudit = async (auditAction: string, originalContent: string | null, newContent: string | null) => {
      try {
        await supabase.from("whatsapp_message_audit").insert({
          organization_id: profile.organization_id,
          message_id: message_db_id,
          action: auditAction,
          performed_by: user.id,
          original_content: originalContent,
          new_content: newContent,
        });
      } catch (e) {
        console.error("[WHATSAPP-ACTION] Audit log failed:", e);
      }
    };

    if (action === "delete") {
      console.log("[WHATSAPP-ACTION] DELETE request:", {
        db_id: message_db_id,
        message_id: message.message_id,
        remoteJid: contact.whatsapp_id,
        instance: channel.instance_name,
      });

      // Validate we have a real WhatsApp message ID (not a Tecvo-generated one)
      if (!message.message_id || message.message_id.startsWith("out_")) {
        console.error("[WHATSAPP-ACTION] Cannot delete: message_id is a Tecvo-generated ID, not a real WhatsApp ID:", message.message_id);
        return new Response(JSON.stringify({ 
          error: "Não foi possível apagar: esta mensagem não possui ID real do WhatsApp. Mensagens enviadas antes da correção não podem ser apagadas para todos.",
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Evolution API: DELETE chat message for everyone
      const deleteUrl = `${vpsUrl}/chat/deleteMessageForEveryone/${channel.instance_name}`;
      const deleteBody = {
        id: message.message_id,
        remoteJid: contact.whatsapp_id,
        fromMe: true,
      };
      console.log("[WHATSAPP-ACTION] Calling Evolution DELETE:", deleteUrl, JSON.stringify(deleteBody));

      const evoResponse = await fetch(deleteUrl, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          apikey: apiKey,
        },
        body: JSON.stringify(deleteBody),
      });

      const evoResponseText = await evoResponse.text();
      console.log("[WHATSAPP-ACTION] Evolution DELETE response:", evoResponse.status, evoResponseText);

      if (!evoResponse.ok) {
        console.error("[WHATSAPP-ACTION] Delete FAILED at provider:", evoResponse.status, evoResponseText);
        return new Response(JSON.stringify({ 
          error: "Não foi possível apagar a mensagem para todos. A operação falhou no provedor de WhatsApp.", 
          details: evoResponseText,
        }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Only update DB after confirmed success from provider
      console.log("[WHATSAPP-ACTION] Delete confirmed by provider, updating DB");
      await supabase
        .from("whatsapp_messages")
        .update({ status: "deleted", content: "" })
        .eq("id", message_db_id);

      await logAudit("delete_all", message.content, null);

      return new Response(JSON.stringify({ ok: true, action: "deleted" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_local") {
      console.log("[WHATSAPP-ACTION] DELETE_LOCAL request for message:", message_db_id);
      // Only hide from platform, don't call WhatsApp API
      await supabase
        .from("whatsapp_messages")
        .update({ status: "deleted_local", content: "" })
        .eq("id", message_db_id);

      await logAudit("delete_local", message.content, null);
      console.log("[WHATSAPP-ACTION] DELETE_LOCAL completed");

      return new Response(JSON.stringify({ ok: true, action: "deleted_local" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "edit") {
      if (!new_text?.trim()) {
        return new Response(JSON.stringify({ error: "new_text is required for edit" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check 15-minute edit window
      const sentAt = new Date(message.created_at).getTime();
      const now = Date.now();
      const fifteenMin = 15 * 60 * 1000;
      if (now - sentAt > fifteenMin) {
        return new Response(JSON.stringify({ error: "Janela de edição expirada (15 min)" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("[WHATSAPP-ACTION] EDIT request:", {
        db_id: message_db_id,
        message_id: message.message_id,
        remoteJid: contact.whatsapp_id,
        instance: channel.instance_name,
        original_content: message.content?.substring(0, 50),
        new_content: new_text.trim().substring(0, 50),
      });

      // Validate we have a real WhatsApp message ID
      if (!message.message_id || message.message_id.startsWith("out_")) {
        console.error("[WHATSAPP-ACTION] Cannot edit: message_id is a Tecvo-generated ID:", message.message_id);
        return new Response(JSON.stringify({ 
          error: "Não foi possível editar: esta mensagem não possui ID real do WhatsApp. Mensagens enviadas antes da correção não podem ser editadas.",
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Evolution API: update message (POST /chat/updateMessage)
      const editUrl = `${vpsUrl}/chat/updateMessage/${channel.instance_name}`;
      const editBody = {
        number: contact.whatsapp_id,
        key: {
          remoteJid: contact.whatsapp_id,
          fromMe: true,
          id: message.message_id,
        },
        text: new_text.trim(),
      };
      console.log("[WHATSAPP-ACTION] Calling Evolution EDIT:", editUrl, JSON.stringify(editBody));

      const evoResponse = await fetch(editUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: apiKey,
        },
        body: JSON.stringify(editBody),
      });

      const evoResponseText = await evoResponse.text();
      console.log("[WHATSAPP-ACTION] Evolution EDIT response:", evoResponse.status, evoResponseText);

      if (!evoResponse.ok) {
        console.error("[WHATSAPP-ACTION] Edit FAILED at provider:", evoResponse.status, evoResponseText);
        return new Response(JSON.stringify({ 
          error: "Não foi possível editar esta mensagem. A operação falhou no provedor de WhatsApp.", 
          details: evoResponseText,
        }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Only update DB after confirmed success from provider
      // Preserve the original signature prefix (e.g. "*Name:*\n") if present
      console.log("[WHATSAPP-ACTION] Edit confirmed by provider, updating DB");
      const sigMatch = (message.content || "").match(/^(\*[^*]+:\*\s*\n?)/);
      const sigPrefix = sigMatch ? sigMatch[1] : "";
      const newContentWithSig = sigPrefix + new_text.trim();
      await supabase
        .from("whatsapp_messages")
        .update({ content: newContentWithSig, status: "edited" })
        .eq("id", message_db_id);

      await logAudit("edit", message.content, new_text.trim());

      return new Response(JSON.stringify({ ok: true, action: "edited" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "react") {
      // Try v2 format first, fallback to v1
      const v2Body = {
        key: {
          remoteJid: contact.whatsapp_id,
          fromMe: message.is_from_me,
          id: message.message_id,
        },
        reaction: emoji || "",
      };

      let evoResponse = await fetch(
        `${vpsUrl}/message/sendReaction/${channel.instance_name}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: apiKey,
          },
          body: JSON.stringify(v2Body),
        }
      );

      // If v2 fails, try v1 format with reactionMessage wrapper
      if (!evoResponse.ok) {
        console.log("[WHATSAPP-ACTION] v2 react failed, trying v1 format");
        await evoResponse.text();
        const v1Body = {
          reactionMessage: {
            key: {
              remoteJid: contact.whatsapp_id,
              fromMe: message.is_from_me,
              id: message.message_id,
            },
            text: emoji || "",
          },
        };
        evoResponse = await fetch(
          `${vpsUrl}/message/sendReaction/${channel.instance_name}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: apiKey,
            },
            body: JSON.stringify(v1Body),
          }
        );
      }

      if (!evoResponse.ok) {
        const errText = await evoResponse.text();
        console.error("[WHATSAPP-ACTION] React error:", evoResponse.status, errText);
        return new Response(JSON.stringify({ error: "Failed to send reaction", details: errText }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await evoResponse.text();

      // Save reaction to DB
      const { data: targetMsg } = await supabase
        .from("whatsapp_messages")
        .select("id, reactions")
        .eq("id", message_db_id)
        .single();

      if (targetMsg) {
        const currentReactions: any[] = Array.isArray(targetMsg.reactions) ? targetMsg.reactions : [];
        const myJid = "me";
        
        if (emoji) {
          const existingIdx = currentReactions.findIndex((r: any) => r.jid === myJid);
          if (existingIdx >= 0) {
            currentReactions[existingIdx] = { emoji, jid: myJid, name: "Você" };
          } else {
            currentReactions.push({ emoji, jid: myJid, name: "Você" });
          }
        } else {
          const filtered = currentReactions.filter((r: any) => r.jid !== myJid);
          currentReactions.length = 0;
          currentReactions.push(...filtered);
        }

        await supabase
          .from("whatsapp_messages")
          .update({ reactions: currentReactions })
          .eq("id", message_db_id);
      }

      return new Response(JSON.stringify({ ok: true, action: "reacted" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[WHATSAPP-ACTION] Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
