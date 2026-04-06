/**
 * Admin-only: Generate TTS audio and send via WhatsApp.
 * Used for one-off proactive audio messages.
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function generateTTSAudio(text: string): Promise<string | null> {
  const elevenLabsKey = Deno.env.get("ELEVENLABS_API_KEY_1") || Deno.env.get("ELEVENLABS_API_KEY");
  if (!elevenLabsKey) return null;

  // Laura voice - "Sarah" from ElevenLabs (same as webhook)
  const voiceId = "EXAVITQu4vr4xnSDxMaL";

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_22050_32`,
    {
      method: "POST",
      headers: {
        "xi-api-key": elevenLabsKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.75,
          style: 0.45,
          use_speaker_boost: true,
          speed: 1.05,
        },
      }),
    },
  );

  if (!response.ok) {
    console.error("TTS error:", response.status, await response.text());
    return null;
  }

  const buf = await response.arrayBuffer();
  const uint8 = new Uint8Array(buf);
  // Convert to base64
  let binary = "";
  for (let i = 0; i < uint8.length; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, text, instance_name } = await req.json();

    if (!phone || !text) {
      return new Response(JSON.stringify({ error: "phone and text required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const inst = instance_name || "tecvo";
    const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
    const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");

    if (!vpsUrl || !apiKey) {
      return new Response(JSON.stringify({ error: "VPS not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate TTS
    console.log("[ADMIN-SEND-AUDIO] Generating TTS for text length:", text.length);
    const audioBase64 = await generateTTSAudio(text);
    if (!audioBase64) {
      return new Response(JSON.stringify({ error: "TTS generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[ADMIN-SEND-AUDIO] TTS generated, audio size:", audioBase64.length);

    // Send via Evolution API
    let cleanNumber = phone.replace(/\D/g, "");
    if (!cleanNumber.startsWith("55") && cleanNumber.length <= 11) {
      cleanNumber = "55" + cleanNumber;
    }
    const jid = `${cleanNumber}@s.whatsapp.net`;

    const baseUrl = vpsUrl.replace(/\/+$/, "");
    const response = await fetch(
      `${baseUrl}/message/sendWhatsAppAudio/${inst}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: apiKey,
        },
        body: JSON.stringify({
          number: jid,
          audio: audioBase64,
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("[ADMIN-SEND-AUDIO] Send failed:", response.status, errText.slice(0, 300));
      return new Response(JSON.stringify({ error: "Send failed", details: errText.slice(0, 200) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json().catch(() => ({}));
    console.log("[ADMIN-SEND-AUDIO] Audio sent successfully to", jid);

    return new Response(JSON.stringify({ ok: true, jid }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[ADMIN-SEND-AUDIO] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
