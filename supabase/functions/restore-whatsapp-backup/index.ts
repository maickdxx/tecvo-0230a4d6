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

    // Only super_admin can restore
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: super admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { backup_path, organization_id, new_channel_id } = await req.json();

    if (!backup_path || !organization_id || !new_channel_id) {
      return new Response(JSON.stringify({ error: "backup_path, organization_id, and new_channel_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download backup from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("organization-backups")
      .download(backup_path);

    if (downloadError || !fileData) {
      return new Response(JSON.stringify({ error: "Failed to download backup", details: downloadError?.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const backupText = await fileData.text();
    const backupData = JSON.parse(backupText);

    const contacts = backupData.whatsapp_contacts || [];
    const messages = backupData.whatsapp_messages || [];

    console.log(`[RESTORE] Found ${contacts.length} contacts and ${messages.length} messages in backup`);

    // Filter contacts for this organization only
    const orgContacts = contacts.filter((c: any) => c.organization_id === organization_id);
    console.log(`[RESTORE] ${orgContacts.length} contacts belong to org ${organization_id}`);

    if (orgContacts.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "No contacts found for this org in backup", restored_contacts: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get ALL existing contact IDs (handle >1000 rows)
    const existingIds = new Set<string>();
    let offset = 0;
    const PAGE = 1000;
    while (true) {
      const { data: page } = await supabase
        .from("whatsapp_contacts")
        .select("id")
        .eq("organization_id", organization_id)
        .range(offset, offset + PAGE - 1);
      if (!page || page.length === 0) break;
      page.forEach((c: any) => existingIds.add(c.id));
      if (page.length < PAGE) break;
      offset += PAGE;
    }

    // Prepare contacts for insert - point to new channel
    const contactsToInsert = orgContacts
      .filter((c: any) => !existingIds.has(c.id))
      .map((c: any) => ({
        ...c,
        channel_id: new_channel_id,
      }));

    let insertedContacts = 0;
    let insertedMessages = 0;

    // Insert contacts in batches of 100
    for (let i = 0; i < contactsToInsert.length; i += 100) {
      const batch = contactsToInsert.slice(i, i + 100);
      const { error } = await supabase.from("whatsapp_contacts").insert(batch);
      if (error) {
        console.error(`[RESTORE] Contact batch ${i} error:`, error.message);
      } else {
        insertedContacts += batch.length;
      }
    }

    console.log(`[RESTORE] Inserted ${insertedContacts} contacts`);

    // Get contact IDs that were restored
    const restoredContactIds = new Set(contactsToInsert.map((c: any) => c.id));

    // Re-fetch ALL contact IDs from DB after insert (source of truth)
    const dbContactIds = new Set<string>();
    let dbOffset = 0;
    while (true) {
      const { data: dbPage } = await supabase
        .from("whatsapp_contacts")
        .select("id")
        .eq("organization_id", organization_id)
        .range(dbOffset, dbOffset + PAGE - 1);
      if (!dbPage || dbPage.length === 0) break;
      dbPage.forEach((c: any) => dbContactIds.add(c.id));
      if (dbPage.length < PAGE) break;
      dbOffset += PAGE;
    }
    console.log(`[RESTORE] ${dbContactIds.size} contacts confirmed in DB`);

    // Filter messages only for contacts that ACTUALLY exist in DB
    const messagesToRestore = messages
      .filter((m: any) => dbContactIds.has(m.contact_id));

    console.log(`[RESTORE] ${messagesToRestore.length} messages match org contacts (out of ${messages.length} total)`);

    const messagesToInsert = messagesToRestore
      .map((m: any) => {
        const cleaned = { ...m };
        // Remap channel_id to new channel
        if (cleaned.channel_id) cleaned.channel_id = new_channel_id;
        // Clear reply_to_id to avoid FK issues (replies to messages not yet inserted)
        cleaned.reply_to_id = null;
        return cleaned;
      });

    // Get existing message IDs
    const existingMsgIds = new Set<string>();
    if (messagesToInsert.length > 0) {
      const sampleIds = messagesToInsert.slice(0, 1000).map((m: any) => m.id);
      const { data: existingMsgs } = await supabase
        .from("whatsapp_messages")
        .select("id")
        .in("id", sampleIds);
      (existingMsgs || []).forEach((m: any) => existingMsgIds.add(m.id));
    }

    const uniqueMessages = messagesToInsert.filter((m: any) => !existingMsgIds.has(m.id));

    // Insert messages in batches of 200
    for (let i = 0; i < uniqueMessages.length; i += 200) {
      const batch = uniqueMessages.slice(i, i + 200);
      const { error } = await supabase.from("whatsapp_messages").upsert(batch, { onConflict: "id", ignoreDuplicates: true });
      if (error) {
        console.error(`[RESTORE] Message batch ${i} error:`, error.message);
      } else {
        insertedMessages += batch.length;
      }
    }

    console.log(`[RESTORE] Inserted ${insertedMessages} messages`);

    return new Response(JSON.stringify({
      ok: true,
      restored_contacts: insertedContacts,
      restored_messages: insertedMessages,
      total_contacts_in_backup: orgContacts.length,
      total_messages_in_backup: messagesToInsert.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[RESTORE] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});