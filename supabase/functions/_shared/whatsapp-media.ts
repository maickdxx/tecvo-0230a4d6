/**
 * WhatsApp media handling: download from Evolution API, persist to Supabase Storage.
 * Single source of truth for media operations.
 */

/**
 * Fetch profile picture URL from Evolution API
 */
export async function fetchProfilePicture(
  instance: string,
  remoteJid: string,
): Promise<string | null> {
  try {
    const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
    const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");
    if (!vpsUrl || !apiKey) return null;

    const baseUrl = vpsUrl.replace(/\/+$/, "");
    const url = `${baseUrl}/chat/fetchProfilePictureUrl/${instance}`;

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": apiKey,
      },
      body: JSON.stringify({ number: remoteJid }),
    });

    if (!resp.ok) return null;
    const result = await resp.json();
    const picUrl = result?.profilePictureUrl || result?.profilePicture ||
      result?.picture || null;
    return typeof picUrl === "string" && picUrl.startsWith("http")
      ? picUrl
      : null;
  } catch (e: any) {
    console.warn("[WHATSAPP-MEDIA] fetchProfilePicture error:", e.message);
    return null;
  }
}

/**
 * Download media from Evolution API and persist to Supabase Storage.
 * Returns the permanent public URL, or null on failure.
 */
export async function persistMedia(
  supabase: any,
  instance: string,
  messageKey: any,
  mimeType: string | null,
  organizationId: string,
): Promise<string | null> {
  try {
    const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
    const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");
    if (!vpsUrl || !apiKey) {
      console.warn("[WHATSAPP-MEDIA] persistMedia: missing VPS config");
      return null;
    }

    const baseUrl = vpsUrl.replace(/\/+$/, "");
    const url = `${baseUrl}/chat/getBase64FromMediaMessage/${instance}`;

    console.log(
      "[WHATSAPP-MEDIA] persistMedia: fetching base64 for message",
      messageKey?.id,
    );

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({
        message: { key: messageKey },
        convertToMp4: false,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(
        "[WHATSAPP-MEDIA] persistMedia: getBase64 failed",
        resp.status,
        errText.slice(0, 200),
      );
      return null;
    }

    const result = await resp.json();
    const base64Data = result?.base64 || result?.data || null;
    const returnedMime = result?.mimetype || result?.mimeType || mimeType ||
      "application/octet-stream";

    if (!base64Data || typeof base64Data !== "string") {
      console.warn("[WHATSAPP-MEDIA] persistMedia: no base64 data returned");
      return null;
    }

    // Clean base64 — remove data URI prefix if present
    const cleanBase64 = base64Data.includes(",")
      ? base64Data.split(",")[1]
      : base64Data;

    // Convert base64 to Uint8Array
    const binaryString = atob(cleanBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Determine file extension from mime
    const extMap: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "video/mp4": "mp4",
      "video/3gpp": "3gp",
      "audio/ogg": "ogg",
      "audio/mpeg": "mp3",
      "audio/mp4": "m4a",
      "audio/ogg; codecs=opus": "ogg",
      "application/pdf": "pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    };
    const baseMime = returnedMime.split(";")[0].trim().toLowerCase();
    const ext = extMap[baseMime] || baseMime.split("/")[1] || "bin";
    const fileName = `${organizationId}/${crypto.randomUUID()}.${ext}`;

    console.log(
      "[WHATSAPP-MEDIA] persistMedia: uploading",
      fileName,
      "size:",
      bytes.length,
      "mime:",
      baseMime,
    );

    const { error: uploadError } = await supabase.storage
      .from("whatsapp-media")
      .upload(fileName, bytes, { contentType: baseMime, upsert: true });

    if (uploadError) {
      console.error("[WHATSAPP-MEDIA] persistMedia: upload error", uploadError);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("whatsapp-media")
      .getPublicUrl(fileName);

    console.log("[WHATSAPP-MEDIA] persistMedia: success →", publicUrl);
    return publicUrl;
  } catch (err: any) {
    console.error("[WHATSAPP-MEDIA] persistMedia: exception", err.message);
    return null;
  }
}
