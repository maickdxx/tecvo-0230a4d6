/**
 * ── SEND FLOW: PLATFORM_NOTIFICATION ──
 * Auto weather notifications sent to org owners via their personal phone.
 *
 * PHONE SOURCE: Uses owner's personal phone (profiles.whatsapp_personal)
 * with fallback to profiles.phone, then legacy organizations.whatsapp_owner.
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getTodayInTz } from "../_shared/timezone.ts";
import { resolveOwnerPhone } from "../_shared/resolveOwnerPhone.ts";

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

    // TEMP: Only send to Space Ar Condicionado
    const ALLOWED_ORG_ID = "f46f0514-fecf-4939-b1fa-6a0247f96540";

    const { data: orgs, error: orgsErr } = await supabase
      .from("organizations")
      .select("id, city, timezone")
      .eq("id", ALLOWED_ORG_ID);

    if (orgsErr) throw orgsErr;
    console.log(`[AUTO-WEATHER] Found ${orgs?.length || 0} orgs`);

    let sent = 0;
    for (const org of orgs || []) {
      if (!org.city) continue;

      // Resolve owner's personal phone
      const ownerPhone = await resolveOwnerPhone(supabase, org.id);
      if (!ownerPhone.phone) {
        console.log(`[AUTO-WEATHER] No phone for org ${org.id} owner`);
        continue;
      }

      // Check rate limit
      const orgTz = org.timezone || "America/Sao_Paulo";
      const todayStr = getTodayInTz(orgTz);
      const { count } = await supabase
        .from("auto_message_log")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", org.id)
        .in("message_type", ["weather", "business_tip"])
        .gte("sent_at", `${todayStr}T00:00:00`);

      if ((count || 0) >= 2) {
        console.log(`[AUTO-WEATHER] Rate limit reached for org ${org.id}`);
        continue;
      }

      const coords = await fetchCoordinates(org.city);
      if (!coords) {
        console.log(`[AUTO-WEATHER] No coords for city: ${org.city}`);
        continue;
      }

      const weather = await fetchTodayWeather(coords.lat, coords.lon, org.timezone || "America/Sao_Paulo");
      const desc = getWeatherDescription(weather.weatherCode);
      const insight = getBusinessInsight(weather.tempMax, weather.precipProb);

      const message = `☀️ Bom dia!\n\nPrevisão para ${org.city} hoje:\n🌡️ ${weather.tempMin}°C — ${weather.tempMax}°C | ${desc}\n💧 Chance de chuva: ${weather.precipProb}%\n\n${insight}\n\n— Tecvo`;

      const ok = await sendWhatsApp(ownerPhone.phone, message);
      if (ok) {
        await supabase.from("auto_message_log").insert({
          organization_id: org.id,
          message_type: "weather",
          content: message,
        });
        sent++;
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
