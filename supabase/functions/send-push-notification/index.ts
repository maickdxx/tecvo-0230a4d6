import { getCorsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const headers = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  console.log("[PUSH] Request received, method:", req.method);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    console.log("[PUSH] VAPID configured:", !!vapidPublicKey, !!vapidPrivateKey);

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error("[PUSH] Missing VAPID keys");
      return new Response(
        JSON.stringify({ error: "VAPID keys not configured" }),
        { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    const { user_id, title, body: msgBody, url, category, tag } = await req.json();
    console.log("[PUSH] Payload — user_id:", user_id, "title:", title, "category:", category, "tag:", tag);

    if (!user_id || !title) {
      return new Response(
        JSON.stringify({ error: "user_id and title are required" }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Check user preferences
    if (category) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("notification_preferences")
        .eq("user_id", user_id)
        .single();

      const prefs = profile?.notification_preferences as Record<string, boolean> | null;
      if (prefs && prefs[category] === false) {
        return new Response(
          JSON.stringify({ message: "Notification disabled for this category", sent: 0 }),
          { headers: { ...headers, "Content-Type": "application/json" } }
        );
      }
    }

    // Get all tokens for this user
    const { data: tokens, error: tokensError } = await supabase
      .from("notification_tokens")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", user_id);

    console.log("[PUSH] Tokens found:", tokens?.length ?? 0, "error:", tokensError?.message);

    if (tokensError || !tokens?.length) {
      return new Response(
        JSON.stringify({ message: "No tokens found", sent: 0 }),
        { headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    const notificationTag = tag || (category === "whatsapp_message" ? `whatsapp_message_${Date.now()}` : category || "general");

    const payload = JSON.stringify({
      title,
      body: msgBody || "",
      url: url || "/",
      tag: notificationTag,
    });

    let sent = 0;
    const staleTokenIds: string[] = [];

    for (const token of tokens) {
      try {
        console.log(`[PUSH] Sending to token ${token.id}, endpoint: ${token.endpoint.substring(0, 80)}...`);
        const result = await sendWebPush(
          token.endpoint,
          token.p256dh,
          token.auth,
          payload,
          vapidPublicKey,
          vapidPrivateKey,
          supabaseUrl
        );

        console.log(`[PUSH] Token ${token.id} => status ${result.status}, body: ${result.body}`);

        if (result.status === 201) {
          sent++;
        } else if (result.status === 404 || result.status === 410) {
          staleTokenIds.push(token.id);
        } else {
          console.error(`[PUSH] Push failed for ${token.id}: status ${result.status}, body: ${result.body}`);
        }
      } catch (err) {
        console.error(`[PUSH] Error sending to ${token.id}:`, err);
      }
    }

    // Clean up stale tokens
    if (staleTokenIds.length > 0) {
      await supabase.from("notification_tokens").delete().in("id", staleTokenIds);
    }

    return new Response(
      JSON.stringify({ sent, total: tokens.length, removed: staleTokenIds.length }),
      { headers: { ...headers, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-push-notification error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
});

// ============================================================
// RFC 8291 Web Push Encryption using Web Crypto API
// ============================================================

async function sendWebPush(
  endpoint: string,
  p256dhBase64: string,
  authBase64: string,
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  subject: string
): Promise<{ status: number; body: string }> {
  // 1. Build VAPID Authorization header
  const vapidToken = await createVapidToken(vapidPublicKey, vapidPrivateKey, endpoint, subject);

  // 2. Encrypt payload per RFC 8291
  const encrypted = await encryptPayloadRFC8291(payload, p256dhBase64, authBase64);

  // 3. Send to push service
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      TTL: "86400",
      Authorization: `vapid t=${vapidToken}, k=${vapidPublicKey}`,
    },
    body: encrypted,
  });

  const responseBody = await response.text();
  return { status: response.status, body: responseBody };
}

async function encryptPayloadRFC8291(
  payload: string,
  subscriberPublicKeyBase64: string,
  subscriberAuthBase64: string
): Promise<Uint8Array> {
  const payloadBytes = new TextEncoder().encode(payload);

  // Import subscriber's public key (p256dh)
  const subscriberPublicKeyRaw = base64UrlDecode(subscriberPublicKeyBase64);
  const subscriberPublicKey = await crypto.subtle.importKey(
    "raw",
    subscriberPublicKeyRaw,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // Import subscriber's auth secret
  const authSecret = base64UrlDecode(subscriberAuthBase64);

  // Generate ephemeral ECDH key pair (as_keypair)
  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  // Export local public key
  const localPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", localKeyPair.publicKey)
  );

  // ECDH shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: subscriberPublicKey },
      localKeyPair.privateKey,
      256
    )
  );

  // HKDF to derive IKM from auth secret
  // PRK = HKDF-Extract(salt=auth_secret, IKM=ecdh_secret)
  // IKM = HKDF-Expand(PRK, key_info, 32)
  const keyInfoBuf = createInfo(
    "WebPush: info\0",
    new Uint8Array(subscriberPublicKeyRaw),
    localPublicKeyRaw
  );

  const prkKey = await crypto.subtle.importKey(
    "raw",
    sharedSecret,
    { name: "HKDF" },
    false,
    ["deriveBits"]
  );

  // Import auth as salt for HKDF
  const ikm = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: new Uint8Array(authSecret),
        info: keyInfoBuf,
      },
      prkKey,
      256
    )
  );

  // Generate random 16-byte salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Derive CEK and nonce from IKM + salt
  const ikmKey = await crypto.subtle.importKey(
    "raw",
    ikm,
    { name: "HKDF" },
    false,
    ["deriveBits"]
  );

  const cekInfo = new TextEncoder().encode("Content-Encoding: aes128gcm\0");
  const nonceInfo = new TextEncoder().encode("Content-Encoding: nonce\0");

  const cekBits = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt, info: cekInfo },
      ikmKey,
      128
    )
  );

  const nonce = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt, info: nonceInfo },
      ikmKey,
      96
    )
  );

  // Add padding delimiter (RFC 8188: payload || 0x02 for last record)
  const paddedPayload = new Uint8Array(payloadBytes.length + 1);
  paddedPayload.set(payloadBytes);
  paddedPayload[payloadBytes.length] = 2; // Last record delimiter

  // Encrypt with AES-128-GCM
  const contentKey = await crypto.subtle.importKey(
    "raw",
    cekBits,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      contentKey,
      paddedPayload
    )
  );

  // Build aes128gcm header:
  // salt (16) || rs (4, big-endian uint32) || idlen (1) || keyid (65 for P-256 uncompressed)
  const recordSize = paddedPayload.length + 16; // payload + GCM tag
  const header = new Uint8Array(16 + 4 + 1 + localPublicKeyRaw.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, recordSize, false);
  header[20] = localPublicKeyRaw.length;
  header.set(localPublicKeyRaw, 21);

  // Combine header + encrypted content
  const result = new Uint8Array(header.length + encrypted.length);
  result.set(header);
  result.set(encrypted, header.length);

  return result;
}

function createInfo(
  type: string,
  subscriberPublicKey: Uint8Array,
  localPublicKey: Uint8Array
): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const result = new Uint8Array(
    typeBytes.length + subscriberPublicKey.length + localPublicKey.length
  );
  result.set(typeBytes, 0);
  result.set(subscriberPublicKey, typeBytes.length);
  result.set(localPublicKey, typeBytes.length + subscriberPublicKey.length);
  return result;
}

// ============================================================
// VAPID JWT (RFC 8292)
// ============================================================

async function createVapidToken(
  publicKey: string,
  privateKey: string,
  endpoint: string,
  subject: string
): Promise<string> {
  const audience = new URL(endpoint).origin;
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const jwtPayload = {
    aud: audience,
    exp: now + 12 * 60 * 60,
    sub: `mailto:no-reply@${new URL(subject).hostname}`,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(jwtPayload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const keyData = base64UrlDecode(privateKey);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const rawSignature = derToRaw(new Uint8Array(signature));
  const encodedSignature = uint8ToBase64Url(rawSignature);

  return `${unsignedToken}.${encodedSignature}`;
}

function derToRaw(der: Uint8Array): Uint8Array {
  if (der.length === 64) return der;

  const raw = new Uint8Array(64);
  let offset = 2;
  const rLen = der[offset + 1];
  offset += 2;
  const rStart = rLen > 32 ? offset + (rLen - 32) : offset;
  const rDest = rLen < 32 ? 32 - rLen : 0;
  raw.set(der.slice(rStart, rStart + Math.min(rLen, 32)), rDest);
  offset += rLen;
  const sLen = der[offset + 1];
  offset += 2;
  const sStart = sLen > 32 ? offset + (sLen - 32) : offset;
  const sDest = sLen < 32 ? 64 - sLen : 32;
  raw.set(der.slice(sStart, sStart + Math.min(sLen, 32)), sDest);
  return raw;
}

// ============================================================
// Base64URL helpers
// ============================================================

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function uint8ToBase64Url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(str: string): ArrayBuffer {
  const padding = "=".repeat((4 - (str.length % 4)) % 4);
  const base64 = (str + padding).replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
