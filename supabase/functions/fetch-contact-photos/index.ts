import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL")?.replace(/\/+$/, "");
    const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");

    if (!vpsUrl || !apiKey) {
      return new Response(JSON.stringify({ error: "Missing WhatsApp config" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get contacts that need name update (name is phone-like and not custom)
    const { data: contacts, error } = await supabase
      .from("whatsapp_contacts")
      .select("id, whatsapp_id, channel_id, is_group, profile_picture_url, name, phone, is_name_custom")
      .eq("is_group", false)
      .eq("is_name_custom", false)
      .not("whatsapp_id", "is", null)
      .limit(500);

    if (error || !contacts || contacts.length === 0) {
      return new Response(JSON.stringify({ ok: true, updated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get channel instance names
    const channelIds = [...new Set(contacts.map(c => c.channel_id).filter(Boolean))];
    const { data: channels } = await supabase
      .from("whatsapp_channels")
      .select("id, instance_name, is_connected")
      .in("id", channelIds)
      .eq("is_connected", true);

    if (!channels || channels.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "No connected channels" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For each connected channel, fetch all contacts at once
    const contactNames = new Map<string, string>();

    for (const ch of channels) {
      try {
        const resp = await fetch(`${vpsUrl}/chat/findContacts/${ch.instance_name}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": apiKey },
          body: JSON.stringify({}),
        });

        if (resp.ok) {
          const result = await resp.json();
          const list = Array.isArray(result) ? result : [];
          console.log(`[FETCH] Got ${list.length} contacts from findContacts`);
          if (list.length > 0) {
            console.log("[FETCH] Contact sample:", JSON.stringify(list[0]).slice(0, 300));
          }

          for (const c of list) {
            // Use remoteJid (phone@s.whatsapp.net) as key, fallback to id
            const jid = c.remoteJid || c.id || "";
            const name = c.pushName || c.name || c.verifiedName || c.notify || "";
            if (jid && name && typeof name === "string" && name.trim() && !/^\+?\d[\d\s\-()]+$/.test(name.trim())) {
              contactNames.set(jid, name.trim());
            }
          }
        }
      } catch (e) {
        console.warn("[FETCH] findContacts error:", e.message);
      }
    }

    console.log(`[FETCH] Found ${contactNames.size} contact names. Sample:`, JSON.stringify(Object.fromEntries([...contactNames.entries()].slice(0, 5))));

    let namesUpdated = 0;
    let photosUpdated = 0;

    for (const contact of contacts) {
      const instanceName = channels.find(c => c.id === contact.channel_id)?.instance_name;
      if (!instanceName) continue;

      const updateData: Record<string, any> = {};

      // Update name
      const nameIsPhone = !contact.name || /^\+?\d[\d\s\-()]+$/.test(contact.name.trim());
      if (nameIsPhone) {
        const chatName = contactNames.get(contact.whatsapp_id);
        if (chatName) {
          updateData.name = chatName;
          namesUpdated++;
        }
      }

      // Fetch photo if missing
      if (!contact.profile_picture_url) {
        try {
          const resp = await fetch(`${vpsUrl}/chat/fetchProfilePictureUrl/${instanceName}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "apikey": apiKey },
            body: JSON.stringify({ number: contact.whatsapp_id }),
          });
          if (resp.ok) {
            const result = await resp.json();
            const picUrl = result?.profilePictureUrl || result?.profilePicture || result?.picture || null;
            if (typeof picUrl === "string" && picUrl.startsWith("http")) {
              updateData.profile_picture_url = picUrl;
              photosUpdated++;
            }
          }
        } catch (_) {}
        await new Promise(r => setTimeout(r, 200));
      }

      if (Object.keys(updateData).length > 0) {
        await supabase.from("whatsapp_contacts").update(updateData).eq("id", contact.id);
      }
    }

    console.log(`[FETCH] Done: names=${namesUpdated}, photos=${photosUpdated}, total=${contacts.length}`);

    return new Response(JSON.stringify({ ok: true, total: contacts.length, namesUpdated, photosUpdated, contactNamesFound: contactNames.size }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Unexpected error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
