/**
 * ── SEND FLOW: PLATFORM_NOTIFICATION ──
 * Auto weather notifications sent to org owners via their phone.
 *
 * PHONE SOURCE: Uses owner's phone (profiles.phone)
 * with fallback to legacy organizations.whatsapp_owner.
 *
 * IDEMPOTENCY: Uses INSERT-before-send pattern with unique constraint
 * on (organization_id, message_type, sent_date) to prevent duplicate sends.
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { resolveOwnerPhone, logShieldBlocked } from "../_shared/resolveOwnerPhone.ts";
import { idempotentSend } from "../_shared/idempotentSend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WEATHER_DESCRIPTIONS: Record<number, string> = {
  0: "céu limpo ☀️",
  1: "predominantemente limpo 🌤️",
  2: "parcialmente nublado ⛅",
  3: "nublado ☁️",
  45: "neblina 🌫️",
  48: "neblina com geada 🌫️",
  51: "garoa leve 🌦️",
  53: "garoa moderada 🌦️",
  55: "garoa intensa 🌧️",
  61: "chuva leve 🌧️",
  63: "chuva moderada 🌧️",
  65: "chuva forte 🌧️",
  71: "neve leve ❄️",
  73: "neve moderada ❄️",
  75: "neve forte ❄️",
  80: "pancadas leves 🌦️",
  81: "pancadas moderadas 🌧️",
  82: "pancadas fortes ⛈️",
  95: "tempestade ⛈️",
  96: "tempestade com granizo ⛈️",
  99: "tempestade forte com granizo ⛈️",
};

function getWeatherDescription(code: number): string {
  return WEATHER_DESCRIPTIONS[code] || "variável";
}

function getBusinessInsight(tempMax: number, precipProb: number): string {
  if (tempMax >= 32) {
    return "🔥 Dias quentes aumentam chamados de manutenção, carga de gás e instalação de ar-condicionado. Aproveite!";
  }
  if (tempMax >= 28) {
    return "☀️ Temperatura alta favorece demanda por limpeza e manutenção preventiva de ar-condicionado.";
  }
  if (precipProb >= 60) {
    return "🌧️ Previsão de chuva — avalie serviços externos e confirme agendamentos com clientes.";
  }
  if (tempMax <= 18) {
    return "🧊 Temperaturas baixas podem reduzir demanda por ar-condicionado. Bom momento para focar em manutenção preventiva.";
  }
  return "✅ Clima estável — semana favorável para operações normais.";
}

async function fetchCoordinates(city: string): Promise<{ lat: number; lon: number } | null> {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&country=BR&count=1&language=pt`
  );
  const data = await res.json();
  if (!data.results?.length) return null;
  return { lat: data.results[0].latitude, lon: data.results[0].longitude };
}

async function fetchTodayWeather(lat: number, lon: number, timezone: string) {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=${encodeURIComponent(timezone)}&forecast_days=1`
  );
  const data = await res.json();
  const daily = data.daily;
  return {
    tempMax: Math.round(daily.temperature_2m_max[0]),
    tempMin: Math.round(daily.temperature_2m_min[0]),
    weatherCode: daily.weather_code[0],
    precipProb: daily.precipitation_probability_max[0] ?? 0,
  };
}

async function sendWhatsApp(phone: string, text: string) {
  const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
  const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");
  if (!vpsUrl || !apiKey) return false;

  let cleanNumber = phone.replace(/\D/g, "");
  if (!cleanNumber.startsWith("55") && cleanNumber.length <= 11) {
    cleanNumber = "55" + cleanNumber;
  }
  const jid = cleanNumber.includes("@") ? cleanNumber : `${cleanNumber}@s.whatsapp.net`;

  try {
    const res = await fetch(`${vpsUrl}/message/sendText/tecvo`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number: jid, text }),
    });
    if (!res.ok) {
      console.error("[AUTO-WEATHER] Send failed:", res.status, await res.text());
      return false;
    }
    await res.text();
    return true;
  } catch (err) {
    console.error("[AUTO-WEATHER] Send error:", err);
    return false;
  }
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

    // Send to all organizations with active paid plans
    const { data: orgs, error: orgsErr } = await supabase
      .from("organizations")
      .select("id, city, timezone")
      .neq("plan", "free")
      .eq("messaging_paused", false);

    if (orgsErr) throw orgsErr;
    console.log(`[AUTO-WEATHER] Found ${orgs?.length || 0} orgs`);

    let sent = 0;
    for (const org of orgs || []) {
      if (!org.city) continue;

      // Resolve owner's personal phone via SHIELDED logic
      const ownerPhone = await resolveOwnerPhone(supabase, org.id);
      if (!ownerPhone.phone) {
        console.log(`[AUTO-WEATHER] No phone for org ${org.id} owner (userId=${ownerPhone.userId} reason=${ownerPhone.blockedReason})`);
        await logShieldBlocked(supabase, org.id, ownerPhone, "weather", `Weather notification: ${org.city}`);
        continue;
      }

      const coords = await fetchCoordinates(org.city);
      if (!coords) {
        console.log(`[AUTO-WEATHER] No coords for city: ${org.city}`);
        continue;
      }

      const orgTz = org.timezone || "America/Sao_Paulo";
      const weather = await fetchTodayWeather(coords.lat, coords.lon, orgTz);
      const desc = getWeatherDescription(weather.weatherCode);
      const insight = getBusinessInsight(weather.tempMax, weather.precipProb);

      const message = `☀️ Bom dia!\n\nPrevisão para ${org.city} hoje:\n🌡️ ${weather.tempMin}°C — ${weather.tempMax}°C | ${desc}\n💧 Chance de chuva: ${weather.precipProb}%\n\n${insight}\n\n— Tecvo`;

      // IDEMPOTENT: Insert log first, send only if insert succeeds
      const result = await idempotentSend({
        supabase,
        organizationId: org.id,
        messageType: "weather",
        content: message,
        timezone: orgTz,
        sendFn: () => sendWhatsApp(ownerPhone.phone!, message),
      });

      if (result.sent) {
        sent++;
        console.log(`[AUTO-WEATHER] ✅ Sent: org_id=${org.id} user_id=${ownerPhone.userId} role=owner function=auto-weather`);
      } else if (result.skipped) {
        console.log(`[AUTO-WEATHER] ⏭️ Skipped org ${org.id} (already sent today)`);
      } else {
        console.log(`[AUTO-WEATHER] ❌ Failed for org ${org.id}: ${result.error}`);
      }
    }

    console.log(`[AUTO-WEATHER] Done. Sent ${sent} messages.`);
    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[AUTO-WEATHER] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
