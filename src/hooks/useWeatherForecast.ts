import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "./useOrganization";

interface DayForecast {
  date: string;
  dayName: string;
  tempMin: number;
  tempMax: number;
  weatherCode: number;
  precipProbability: number;
  apparentTempMax: number;
  apparentTempMin: number;
  humidity: number;
}

interface WeatherAlert {
  message: string;
  type: "heat" | "rain" | "cold" | "stable";
}

interface WeatherData {
  city: string;
  days: DayForecast[];
  alert: WeatherAlert;
  missingCity: boolean;
  sourceType: "org";
}

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function getWeatherAlert(days: DayForecast[]): WeatherAlert {
  const avgMax = days.reduce((s, d) => s + d.tempMax, 0) / days.length;
  const avgMin = days.reduce((s, d) => s + d.tempMin, 0) / days.length;
  const rainyDays = days.filter((d) => d.precipProbability > 60).length;

  if (avgMax > 30) {
    return { message: "Previsão de calor — boa semana para novos serviços e manutenções.", type: "heat" };
  }
  if (rainyDays >= 3) {
    return { message: "Previsão de chuva — avalie serviços externos agendados.", type: "rain" };
  }
  if (avgMin < 15) {
    return { message: "Temperaturas baixas — possível redução na demanda.", type: "cold" };
  }
  return { message: "Clima estável — semana favorável para operações.", type: "stable" };
}

async function fetchCoordinates(city: string): Promise<{ lat: number; lon: number } | null> {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&country=BR&count=1&language=pt`
  );
  const data = await res.json();
  if (!data.results?.length) return null;
  return { lat: data.results[0].latitude, lon: data.results[0].longitude };
}

async function fetchForecast(lat: number, lon: number, timezone: string): Promise<DayForecast[]> {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max,weather_code,relative_humidity_2m_mean&timezone=${encodeURIComponent(timezone)}&forecast_days=7`
  );
  const data = await res.json();
  const daily = data.daily;
  return daily.time.map((date: string, i: number) => ({
    date,
    dayName: DAY_NAMES[new Date(date + "T12:00:00").getDay()],
    tempMin: Math.round(daily.temperature_2m_min[i]),
    tempMax: Math.round(daily.temperature_2m_max[i]),
    weatherCode: daily.weather_code[i],
    precipProbability: daily.precipitation_probability_max[i] ?? 0,
    apparentTempMax: Math.round(daily.apparent_temperature_max?.[i] ?? daily.temperature_2m_max[i]),
    apparentTempMin: Math.round(daily.apparent_temperature_min?.[i] ?? daily.temperature_2m_min[i]),
    humidity: Math.round(daily.relative_humidity_2m_mean?.[i] ?? 0),
  }));
}

export function useWeatherForecast() {
  const { organization } = useOrganization();
  const orgCity = organization?.city || "";
  const orgTimezone = organization?.timezone || "America/Sao_Paulo";
  const hasAddress = !!organization?.zip_code;

  const { data, isLoading, error } = useQuery<WeatherData>({
    queryKey: ["weather-forecast", orgCity, orgTimezone],
    queryFn: async () => {
      if (!orgCity) {
        throw new Error("Cidade da empresa não cadastrada");
      }

      const coords = await fetchCoordinates(orgCity);
      if (coords) {
        const days = await fetchForecast(coords.lat, coords.lon, orgTimezone);
        return { city: orgCity, days, alert: getWeatherAlert(days), missingCity: false, sourceType: "org" as const };
      }

      throw new Error("Não foi possível obter coordenadas para a cidade cadastrada");
    },
    staleTime: 4 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    enabled: !!orgCity && hasAddress,
  });

  return { weather: data, isLoading, error, hasAddress };
}

export type { DayForecast, WeatherAlert, WeatherData };
