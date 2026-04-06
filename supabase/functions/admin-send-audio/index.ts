/**
 * Admin-only: Generate TTS audio and send via WhatsApp.
 * Used for one-off proactive audio messages.
 * Uses Gemini TTS (primary) with ElevenLabs fallback.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function decodeBase64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function encodeBytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function buildWavFromPcm(pcmBytes: Uint8Array, sampleRate: number): Uint8Array {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmBytes.length;
  const headerSize = 44;
  const wav = new Uint8Array(headerSize + dataSize);
  const view = new DataView(wav.buffer);
  const writeStr = (offset: number, str: string) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  wav.set(pcmBytes, headerSize);
  return wav;
}

async function generateTTSWithGemini(text: string): Promise<string | null> {
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) { console.warn("Missing GEMINI_API_KEY"); return null; }

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent",
    {
      method: "POST",
      headers: { "x-goog-api-key": geminiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Leda" } } },
        },
      }),
    },
  );

  if (!response.ok) {
    console.error("Gemini TTS error:", response.status, (await response.text()).slice(0, 300));
    return null;
  }

  const result = await response.json();
  const audioPart = (result?.candidates?.[0]?.content?.parts || []).find(
    (part: any) => part?.inlineData?.data || part?.inline_data?.data
  );
  const inlineData = audioPart?.inlineData || audioPart?.inline_data;
  const base64Audio = inlineData?.data || null;
  const mimeType = String(inlineData?.mimeType || inlineData?.mime_type || "").toLowerCase();

  if (!base64Audio) return null;

  if (/audio\/l16|codec=pcm/i.test(mimeType)) {
    const pcmBytes = decodeBase64ToBytes(base64Audio);
    const sampleRateMatch = mimeType.match(/rate=(\d+)/i);
    const sampleRate = sampleRateMatch ? Number(sampleRateMatch[1]) : 24000;
    const wavBytes = buildWavFromPcm(pcmBytes, sampleRate);
    return encodeBytesToBase64(wavBytes);
  }

  return base64Audio;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, text, instance_name } = await req.json();

    if (!phone || !text) {
      return new Response(JSON.stringify({ error: "phone and text required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const inst = instance_name || "tecvo";
    const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
    const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");
    if (!vpsUrl || !apiKey) {
      return new Response(JSON.stringify({ error: "VPS not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[ADMIN-SEND-AUDIO] Generating TTS for text length:", text.length);
    const audioBase64 = await generateTTSWithGemini(text);
    if (!audioBase64) {
      return new Response(JSON.stringify({ error: "TTS generation failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[ADMIN-SEND-AUDIO] TTS generated, audio base64 length:", audioBase64.length);

    let cleanNumber = phone.replace(/\D/g, "");
    if (!cleanNumber.startsWith("55") && cleanNumber.length <= 11) cleanNumber = "55" + cleanNumber;
    const jid = `${cleanNumber}@s.whatsapp.net`;
    const baseUrl = vpsUrl.replace(/\/+$/, "");

    const response = await fetch(`${baseUrl}/message/sendWhatsAppAudio/${inst}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number: jid, audio: audioBase64 }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[ADMIN-SEND-AUDIO] Send failed:", response.status, errText.slice(0, 300));
      return new Response(JSON.stringify({ error: "Send failed", details: errText.slice(0, 200) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await response.json().catch(() => ({}));
    console.log("[ADMIN-SEND-AUDIO] Audio sent successfully to", jid);

    return new Response(JSON.stringify({ ok: true, jid }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[ADMIN-SEND-AUDIO] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
