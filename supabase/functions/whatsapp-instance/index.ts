import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VALID_TRANSITIONS: Record<string, string[]> = {
  provisioning: ["qr_pending", "error", "deleted"],
  qr_pending: ["connected", "disconnected", "error", "deleted"],
  connected: ["disconnected", "deleting", "error"],
  disconnected: ["reconnecting", "qr_pending", "deleting", "deleted", "error"],
  reconnecting: ["qr_pending", "connected", "disconnected", "error"],
  deleting: ["deleted", "error"],
  deleted: [],
  error: ["provisioning", "qr_pending", "reconnecting", "deleted", "disconnected"],
};

function canTransition(from: string, to: string): boolean {
  return (VALID_TRANSITIONS[from] || []).includes(to);
}

async function setChannelStatus(
  supabase: any,
  organizationId: string,
  channelId: string,
  newStatus: string,
  extra: Record<string, any> = {}
) {
  const { data: current } = await supabase
    .from("whatsapp_channels")
    .select("channel_status")
    .eq("id", channelId)
    .eq("organization_id", organizationId)
    .single();

  const currentStatus = current?.channel_status || "disconnected";

  if (!canTransition(currentStatus, newStatus)) {
    console.warn(
      `[STATE] Invalid transition ${currentStatus} → ${newStatus} for channel ${channelId}. Forcing.`
    );
  }

  const { error } = await supabase
    .from("whatsapp_channels")
    .update({ channel_status: newStatus, ...extra })
    .eq("id", channelId)
    .eq("organization_id", organizationId);

  if (error) {
    throw error;
  }
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();
    if (!profile) return json({ error: "Profile not found" }, 400);

    const orgId = profile.organization_id;
    const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
    const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");
    if (!vpsUrl || !apiKey) return json({ error: "WhatsApp API not configured" }, 500);

    const { action, channel_id, instance_name } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const webhookUrl = `${supabaseUrl}/functions/v1/webhook-whatsapp`;

    if (action === "create") {
      if (!instance_name) return json({ error: "instance_name required" }, 400);

      const { data: newChannel, error: dbErr } = await supabase
        .from("whatsapp_channels")
        .insert({
          organization_id: orgId,
          instance_name,
          name: instance_name,
          is_connected: false,
          channel_type: "CUSTOMER_INBOX",
          channel_status: "provisioning",
        })
        .select("id")
        .single();

      if (dbErr) {
        console.error("[CREATE] DB error:", dbErr);
        return json({ error: dbErr.message || "Failed to save channel" }, 400);
      }

      let evoData: any = {};
      try {
        const evoRes = await fetch(`${vpsUrl}/instance/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: apiKey },
          body: JSON.stringify({
            instanceName: instance_name,
            integration: "WHATSAPP-BAILEYS",
            qrcode: true,
            webhook: {
              url: webhookUrl,
              byEvents: false,
              base64: false,
              events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
            },
          }),
        });

        evoData = await evoRes.json().catch(() => ({}));
        console.log("[CREATE] Evolution response:", JSON.stringify(evoData).slice(0, 500));

        const alreadyInUse =
          !evoRes.ok && evoRes.status === 403 && JSON.stringify(evoData).includes("already in use");

        if (!evoRes.ok && !alreadyInUse) {
          await supabase
            .from("whatsapp_channels")
            .update({
              channel_status: "error",
              disconnected_reason: `instance_create_failed:${evoRes.status}`,
            })
            .eq("id", newChannel.id)
            .eq("organization_id", orgId);

          return json({ error: "Failed to create instance", details: evoData }, 502);
        }
      } catch (e: any) {
        await supabase
          .from("whatsapp_channels")
          .update({
            channel_status: "error",
            disconnected_reason: e?.message || "instance_create_failed",
          })
          .eq("id", newChannel.id)
          .eq("organization_id", orgId);

        return json({ error: "Failed to create instance" }, 502);
      }

      await setChannelStatus(supabase, orgId, newChannel.id, "qr_pending");

      return json({
        ok: true,
        channel_id: newChannel.id,
        qrcode: evoData.qrcode?.base64 || null,
      });
    }

    if (action === "qrcode") {
      if (!channel_id) return json({ error: "channel_id required" }, 400);

      const { data: channel } = await supabase
        .from("whatsapp_channels")
        .select("instance_name, organization_id, channel_status")
        .eq("id", channel_id)
        .eq("organization_id", orgId)
        .single();
      if (!channel) return json({ error: "Channel not found" }, 404);

      if (["disconnected", "reconnecting", "provisioning", "error"].includes(channel.channel_status)) {
        await setChannelStatus(supabase, orgId, channel_id, "qr_pending");
      }

      const evoRes = await fetch(`${vpsUrl}/instance/connect/${channel.instance_name}`, {
        method: "GET",
        headers: { apikey: apiKey },
      });

      const evoData = await evoRes.json();

      if (evoData.instance?.state === "open") {
        await setChannelStatus(supabase, orgId, channel_id, "connected", {
          is_connected: true,
          last_connected_at: new Date().toISOString(),
        });
      }

      return json({
        ok: true,
        qrcode: evoData.base64 || evoData.qrcode?.base64 || null,
        status: evoData.instance?.state || null,
      });
    }

    if (action === "status") {
      if (!channel_id) return json({ error: "channel_id required" }, 400);

      const { data: channel } = await supabase
        .from("whatsapp_channels")
        .select("id, instance_name, organization_id, is_connected, last_connected_at, phone_number, channel_status, disconnected_reason")
        .eq("id", channel_id)
        .eq("organization_id", orgId)
        .single();
      if (!channel) return json({ error: "Channel not found" }, 404);

      if (channel.channel_status === "deleted" || channel.disconnected_reason === "user_deleted") {
        await supabase
          .from("whatsapp_channels")
          .update({
            is_connected: false,
            channel_status: "deleted",
            instance_name: null,
            disconnected_reason: "user_deleted",
          })
          .eq("id", channel_id)
          .eq("organization_id", orgId);

        return json({
          ok: true,
          connected: false,
          state: "deleted",
          phone_number: channel.phone_number,
          last_connected_at: channel.last_connected_at,
          error_message: null,
          channel_status: "deleted",
        });
      }

      let evoData: any = {};
      let evoError: string | null = null;
      let isConnected = false;

      try {
        const evoRes = await fetch(
          `${vpsUrl}/instance/connectionState/${channel.instance_name}`,
          { method: "GET", headers: { apikey: apiKey } }
        );

        if (!evoRes.ok) {
          evoError = `Evolution API returned ${evoRes.status}`;
          evoData = await evoRes.json().catch(() => ({}));
        } else {
          evoData = await evoRes.json();
          isConnected = evoData.instance?.state === "open";
        }
      } catch (e) {
        evoError = `Connection failed: ${e.message}`;
        await setChannelStatus(supabase, orgId, channel_id, "error", {
          disconnected_reason: evoError,
        });
      }

      const connectedPhone = evoData.instance?.phoneNumber || null;

      if (!isConnected) {
        const newStatus = evoError ? "error" : "disconnected";
        await supabase
          .from("whatsapp_channels")
          .update({
            is_connected: false,
            channel_status: newStatus,
            ...(evoError ? { disconnected_reason: evoError } : {}),
          })
          .eq("id", channel_id)
          .eq("organization_id", orgId)
          .neq("channel_status", "deleted")
          .neq("disconnected_reason", "user_deleted");

        return json({
          ok: true,
          connected: false,
          state: evoData.instance?.state || "unknown",
          phone_number: connectedPhone,
          last_connected_at: channel.last_connected_at,
          error_message: evoError,
          channel_status: newStatus,
        });
      }

      // NEVER merge channels automatically. Each channel is independent.
      // Simply update this channel's status — no cross-channel contact reassignment.
      await supabase
        .from("whatsapp_channels")
        .update({
          is_connected: true,
          channel_status: "connected",
          phone_number: connectedPhone || undefined,
          last_connected_at: new Date().toISOString(),
          disconnected_reason: null,
        })
        .eq("id", channel_id)
        .eq("organization_id", orgId);

      // Only adopt orphaned contacts (channel_id IS NULL) — never reassign from other channels
      if (connectedPhone) {
        await supabase
          .from("whatsapp_contacts")
          .update({ channel_id: channel_id })
          .eq("organization_id", orgId)
          .is("channel_id", null);
      }

      return json({
        ok: true,
        connected: true,
        state: "open",
        phone_number: connectedPhone,
        last_connected_at: new Date().toISOString(),
        error_message: null,
        channel_status: "connected",
        effective_channel_id: channel_id,
        merged: false,
      });
    }

    if (action === "delete") {
      let targetChannel: any = null;

      if (channel_id) {
        const { data } = await supabase
          .from("whatsapp_channels")
          .select("id, channel_status, instance_name, disconnected_reason")
          .eq("id", channel_id)
          .eq("organization_id", orgId)
          .maybeSingle();
        targetChannel = data;
      } else if (instance_name) {
        const { data } = await supabase
          .from("whatsapp_channels")
          .select("id, channel_status, instance_name, disconnected_reason")
          .eq("instance_name", instance_name)
          .eq("organization_id", orgId)
          .maybeSingle();
        targetChannel = data;
      } else {
        return json({ error: "channel_id or instance_name required" }, 400);
      }

      if (!targetChannel) return json({ error: "Channel not found" }, 404);

      if (targetChannel.channel_status === "deleted" || targetChannel.disconnected_reason === "user_deleted") {
        return json({
          ok: true,
          channel_id: targetChannel.id,
          channel_status: "deleted",
          evolution_response: null,
          evolution_error: null,
        });
      }

      await setChannelStatus(supabase, orgId, targetChannel.id, "deleting");

      let evolutionResult: any = null;
      let evolutionError: string | null = null;

      if (targetChannel.instance_name) {
        try {
          const evoRes = await fetch(`${vpsUrl}/instance/delete/${targetChannel.instance_name}`, {
            method: "DELETE",
            headers: { apikey: apiKey },
          });
          try {
            evolutionResult = await evoRes.json();
          } catch {
            evolutionResult = { status: evoRes.status, text: await evoRes.text().catch(() => "") };
          }
          console.log("[DELETE] Evolution response:", JSON.stringify(evolutionResult).slice(0, 500));
        } catch (e: any) {
          evolutionError = e?.message || "Failed to delete from Evolution API";
          console.error("[DELETE] Evolution API error:", evolutionError);
        }
      }

      const { data: deletedChannel, error: deleteError } = await supabase
        .from("whatsapp_channels")
        .update({
          is_connected: false,
          channel_status: "deleted",
          instance_name: null,
          disconnected_reason: "user_deleted",
        })
        .eq("id", targetChannel.id)
        .eq("organization_id", orgId)
        .select("id, channel_status")
        .single();

      if (deleteError || !deletedChannel) {
        console.error("[DELETE] Failed to persist deletion:", deleteError);
        return json({ error: "Failed to persist channel deletion" }, 500);
      }

      console.log(`[DELETE] Channel ${deletedChannel.id} marked as deleted. Evolution error: ${evolutionError || "none"}`);

      return json({
        ok: true,
        channel_id: deletedChannel.id,
        channel_status: deletedChannel.channel_status,
        evolution_response: evolutionResult,
        evolution_error: evolutionError,
      });
    }

    if (action === "disconnect") {
      if (!channel_id) return json({ error: "channel_id required" }, 400);

      const { data: channel } = await supabase
        .from("whatsapp_channels")
        .select("instance_name, channel_status")
        .eq("id", channel_id)
        .eq("organization_id", orgId)
        .single();
      if (!channel) return json({ error: "Channel not found" }, 404);

      if (channel.instance_name) {
        try {
          await fetch(`${vpsUrl}/instance/logout/${channel.instance_name}`, {
            method: "DELETE",
            headers: { apikey: apiKey },
          });
        } catch (e) {
          console.warn("[DISCONNECT] Logout failed:", e);
        }
      }

      await supabase
        .from("whatsapp_channels")
        .update({
          is_connected: false,
          channel_status: "disconnected",
          disconnected_reason: "user_disconnected",
        })
        .eq("id", channel_id)
        .eq("organization_id", orgId);

      return json({ ok: true, channel_status: "disconnected" });
    }

    if (action === "reconnect") {
      if (!channel_id) return json({ error: "channel_id required" }, 400);

      const { data: channel } = await supabase
        .from("whatsapp_channels")
        .select("id, instance_name, phone_number, channel_status")
        .eq("id", channel_id)
        .eq("organization_id", orgId)
        .single();
      if (!channel) return json({ error: "Channel not found" }, 404);

      if (!["disconnected", "error"].includes(channel.channel_status)) {
        return json({ error: `Cannot reconnect from status: ${channel.channel_status}` }, 400);
      }

      await setChannelStatus(supabase, orgId, channel_id, "reconnecting");

      const newInstanceName = instance_name || channel.instance_name || `org-${orgId.replace(/-/g, "").substring(0, 12)}-${Date.now() % 10000}`;

      const evoRes = await fetch(`${vpsUrl}/instance/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify({
          instanceName: newInstanceName,
          integration: "WHATSAPP-BAILEYS",
          qrcode: true,
          webhook: {
            url: webhookUrl,
            byEvents: false,
            base64: false,
            events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
          },
        }),
      });

      const evoData = await evoRes.json();
      const alreadyInUse =
        !evoRes.ok && evoRes.status === 403 && JSON.stringify(evoData).includes("already in use");

      if (!evoRes.ok && !alreadyInUse) {
        await setChannelStatus(supabase, orgId, channel_id, "error", {
          disconnected_reason: "Failed to create instance on reconnect",
        });
        return json({ error: "Failed to create instance", details: evoData }, 502);
      }

      await supabase
        .from("whatsapp_channels")
        .update({
          instance_name: newInstanceName,
          channel_status: "qr_pending",
        })
        .eq("id", channel_id)
        .eq("organization_id", orgId);

      return json({
        ok: true,
        channel_id: channel_id,
        qrcode: evoData.qrcode?.base64 || null,
        channel_status: "qr_pending",
      });
    }

    if (action === "set_webhook") {
      if (!instance_name) return json({ error: "instance_name required" }, 400);

      const evoRes = await fetch(`${vpsUrl}/webhook/set/${instance_name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify({
          webhook: {
            enabled: true,
            url: webhookUrl,
            byEvents: false,
            base64: false,
            events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
          },
        }),
      });

      const evoData = await evoRes.json();
      return json({ ok: evoRes.ok, evolution_response: evoData });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (error) {
    console.error("[WHATSAPP-INSTANCE] Error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
