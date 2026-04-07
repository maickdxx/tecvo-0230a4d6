/**
 * WhatsApp audio processing: STT (transcription) and TTS (speech generation).
 * Single source of truth for audio operations with provider fallbacks.
 */

// ─────── Base64 / PCM helpers ───────

export function decodeBase64ToBytes(base64Data: string) {
  const cleanBase64 = base64Data.includes(",")
    ? base64Data.split(",")[1]
    : base64Data;
  const binaryString = atob(cleanBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return { cleanBase64, bytes };
}

export function encodeBytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function buildWavFromPcm(
  pcmBytes: Uint8Array,
  sampleRate = 24000,
  channels = 1,
  bitsPerSample = 16,
) {
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + pcmBytes.length);
  const view = new DataView(buffer);
  const wavBytes = new Uint8Array(buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  const byteRate = sampleRate * channels * bitsPerSample / 8;
  const blockAlign = channels * bitsPerSample / 8;

  writeString(0, "RIFF");
  view.setUint32(4, 36 + pcmBytes.length, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, pcmBytes.length, true);
  wavBytes.set(pcmBytes, headerSize);

  return wavBytes;
}

function extractGatewayMessageText(content: unknown): string | null {
  if (typeof content === "string") {
    const text = content.trim();
    return text || null;
  }
  if (Array.isArray(content)) {
    const text = content
      .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
      .join("\n")
      .trim();
    return text || null;
  }
  return null;
}

function extractGeminiText(result: any): string | null {
  const parts = result?.candidates?.[0]?.content?.parts || [];
  const text = parts
    .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
    .join("\n")
    .trim();
  return text || null;
}

function getAudioFormatFromMime(baseMime: string) {
  const normalizedMime = baseMime.split(";")[0].trim().toLowerCase();
  if (normalizedMime.includes("mpeg")) return "mp3";
  if (normalizedMime.includes("ogg")) return "ogg";
  if (normalizedMime.includes("wav")) return "wav";
  if (normalizedMime.includes("webm")) return "webm";
  if (normalizedMime.includes("mp4")) return "m4a";
  return normalizedMime.split("/")[1] || "ogg";
}

// ─────── STT Providers ───────

async function transcribeWithLovableAI(
  cleanBase64: string,
  baseMime: string,
  byteLength: number,
): Promise<string | null> {
  try {
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) return null;
    if (byteLength > 20 * 1024 * 1024) return null;

    const audioFormat = getAudioFormatFromMime(baseMime);
    console.log("[WHATSAPP-AUDIO] STT via Lovable AI, size:", byteLength, "format:", audioFormat);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "Transcreva este áudio em português brasileiro. Retorne apenas o texto transcrito, sem explicações, sem aspas e sem prefixos. Se não houver fala inteligível, retorne exatamente: [inaudível]." },
            { type: "input_audio", input_audio: { data: cleanBase64, format: audioFormat } },
          ],
        }],
        stream: false,
      }),
    });

    if (!response.ok) return null;
    const result = await response.json();
    const transcription = extractGatewayMessageText(result?.choices?.[0]?.message?.content);
    if (!transcription || /^\[?inaud[ií]vel\]?$/i.test(transcription)) return null;
    console.log("[WHATSAPP-AUDIO] Lovable AI transcription:", transcription.slice(0, 200));
    return transcription;
  } catch (err: any) {
    console.error("[WHATSAPP-AUDIO] Lovable AI STT exception:", err.message);
    return null;
  }
}

async function transcribeWithGemini(
  cleanBase64: string,
  baseMime: string,
  byteLength: number,
): Promise<string | null> {
  try {
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) return null;
    if (byteLength > 15 * 1024 * 1024) return null;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      {
        method: "POST",
        headers: { "x-goog-api-key": geminiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: "Transcreva este áudio em português brasileiro. Retorne apenas o texto transcrito, sem explicações, sem aspas e sem prefixos. Se não houver fala inteligível, retorne exatamente: [inaudível]." },
              { inline_data: { mime_type: baseMime, data: cleanBase64 } },
            ],
          }],
        }),
      },
    );

    if (!response.ok) return null;
    const result = await response.json();
    const transcription = extractGeminiText(result);
    if (!transcription || /^\[?inaud[ií]vel\]?$/i.test(transcription)) return null;
    return transcription;
  } catch (err: any) {
    console.error("[WHATSAPP-AUDIO] Gemini STT exception:", err.message);
    return null;
  }
}

async function transcribeWithElevenLabs(
  bytes: Uint8Array,
  baseMime: string,
): Promise<string | null> {
  try {
    const elevenLabsKey = Deno.env.get("ELEVENLABS_API_KEY_1") || Deno.env.get("ELEVENLABS_API_KEY");
    if (!elevenLabsKey) return null;

    const extMap: Record<string, string> = { "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/wav": "wav", "audio/webm": "webm" };
    const ext = extMap[baseMime] || "ogg";

    const formData = new FormData();
    formData.append("file", new Blob([bytes], { type: baseMime }), `audio.${ext}`);
    formData.append("model_id", "scribe_v2");
    formData.append("language_code", "por");

    const sttResp = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": elevenLabsKey },
      body: formData,
    });

    if (!sttResp.ok) return null;
    const sttResult = await sttResp.json();
    return sttResult?.text?.trim() || null;
  } catch (err: any) {
    console.error("[WHATSAPP-AUDIO] ElevenLabs STT exception:", err.message);
    return null;
  }
}

/**
 * Transcribe audio with provider fallbacks: Lovable AI → Gemini → ElevenLabs
 */
export async function transcribeAudio(
  instance: string,
  messageKey: any,
  mimeType: string | null,
): Promise<string | null> {
  try {
    const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
    const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");
    if (!vpsUrl || !apiKey) return null;

    const baseUrl = vpsUrl.replace(/\/+$/, "");
    const resp = await fetch(`${baseUrl}/chat/getBase64FromMediaMessage/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ message: { key: messageKey }, convertToMp4: false }),
    });

    if (!resp.ok) return null;
    const result = await resp.json();
    const base64Data = result?.base64 || result?.data || null;
    const returnedMime = result?.mimetype || result?.mimeType || mimeType || "audio/ogg";
    if (!base64Data || typeof base64Data !== "string") return null;

    const baseMime = (returnedMime || "audio/ogg").split(";")[0].trim().toLowerCase();
    const { cleanBase64, bytes } = decodeBase64ToBytes(base64Data);

    return await transcribeWithLovableAI(cleanBase64, baseMime, bytes.length)
      || await transcribeWithGemini(cleanBase64, baseMime, bytes.length)
      || await transcribeWithElevenLabs(bytes, baseMime);
  } catch (err: any) {
    console.error("[WHATSAPP-AUDIO] transcribeAudio exception:", err.message);
    return null;
  }
}

// ─────── TTS Providers ───────

async function generateTTSWithGemini(text: string): Promise<string | null> {
  try {
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) return null;

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

    if (!response.ok) return null;
    const result = await response.json();
    const audioPart = (result?.candidates?.[0]?.content?.parts || []).find(
      (part: any) => part?.inlineData?.data || part?.inline_data?.data
    );
    const inlineData = audioPart?.inlineData || audioPart?.inline_data;
    const base64Audio = inlineData?.data || null;
    const mimeType = String(inlineData?.mimeType || inlineData?.mime_type || "").toLowerCase();

    if (!base64Audio) return null;

    if (/audio\/l16|codec=pcm/i.test(mimeType)) {
      const pcmBytes = decodeBase64ToBytes(base64Audio).bytes;
      const sampleRateMatch = mimeType.match(/rate=(\d+)/i);
      const sampleRate = sampleRateMatch ? Number(sampleRateMatch[1]) : 24000;
      const wavBytes = buildWavFromPcm(pcmBytes, sampleRate);
      const wavBase64 = encodeBytesToBase64(wavBytes);
      return `data:audio/wav;base64,${wavBase64}`;
    }

    if (mimeType.startsWith("audio/")) {
      return `data:${mimeType};base64,${base64Audio}`;
    }
    return null;
  } catch (err: any) {
    console.error("[WHATSAPP-AUDIO] Gemini TTS exception:", err.message);
    return null;
  }
}

async function generateTTSWithElevenLabs(text: string): Promise<string | null> {
  try {
    const elevenLabsKey = Deno.env.get("ELEVENLABS_API_KEY_1") || Deno.env.get("ELEVENLABS_API_KEY");
    if (!elevenLabsKey) return null;

    const voiceId = "EXAVITQu4vr4xnSDxMaL";
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_22050_32`,
      {
        method: "POST",
        headers: { "xi-api-key": elevenLabsKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.65, similarity_boost: 0.80, style: 0.2, speed: 0.95 },
        }),
      },
    );

    if (!response.ok) return null;
    const audioBuffer = await response.arrayBuffer();
    const uint8 = new Uint8Array(audioBuffer);
    const base64Audio = encodeBytesToBase64(uint8);
    return `data:audio/mpeg;base64,${base64Audio}`;
  } catch (err: any) {
    console.error("[WHATSAPP-AUDIO] ElevenLabs TTS exception:", err.message);
    return null;
  }
}

/**
 * Generate TTS audio with provider fallbacks: Gemini → ElevenLabs
 */
export async function generateTTSAudio(text: string): Promise<string | null> {
  return await generateTTSWithGemini(text) || await generateTTSWithElevenLabs(text);
}

/**
 * Send audio message via Evolution API.
 */
export async function sendWhatsAppAudio(
  instance: string,
  remoteJid: string,
  audioPayload: string,
  _supabase?: any,
): Promise<boolean> {
  const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
  const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");
  if (!vpsUrl || !apiKey) return false;

  try {
    const baseUrl = vpsUrl.replace(/\/+$/, "");
    let audioUrl = audioPayload;

    if (audioPayload.startsWith("data:")) {
      const dataUriMatch = audioPayload.match(/^data:([^;]+);base64,(.+)$/);
      if (dataUriMatch) audioUrl = dataUriMatch[2];
    }

    const response = await fetch(`${baseUrl}/message/sendWhatsAppAudio/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number: remoteJid, audio: audioUrl }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[WHATSAPP-AUDIO] sendAudio error:", response.status, errText.slice(0, 200));
      return false;
    }
    await response.text();
    return true;
  } catch (err: any) {
    console.error("[WHATSAPP-AUDIO] sendAudio exception:", err.message);
    return false;
  }
}
