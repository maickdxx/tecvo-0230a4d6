import { useState, useEffect, useRef } from "react";

interface ServiceWithAddress {
  id: string;
  service_street?: string | null;
  service_number?: string | null;
  service_city?: string | null;
  service_state?: string | null;
}

interface DistanceInfo {
  distanceKm: number;
  timeMin: number;
}

type DistanceMap = Map<string, DistanceInfo>;

const geocodeCache = new Map<string, { lat: number; lon: number } | null>();

function buildGeoQuery(s: ServiceWithAddress): string | null {
  const parts = [s.service_street, s.service_number, s.service_city, s.service_state].filter(Boolean);
  return parts.length >= 2 ? parts.join(", ") : null;
}

async function geocode(address: string): Promise<{ lat: number; lon: number } | null> {
  if (geocodeCache.has(address)) return geocodeCache.get(address)!;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
      { headers: { "User-Agent": "TecvoPlatform/1.0" } }
    );
    const data = await res.json();
    if (data?.[0]) {
      const coords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      geocodeCache.set(address, coords);
      return coords;
    }
    geocodeCache.set(address, null);
    return null;
  } catch {
    geocodeCache.set(address, null);
    return null;
  }
}

async function getRoute(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number }
): Promise<DistanceInfo | null> {
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`
    );
    const data = await res.json();
    if (data?.routes?.[0]) {
      return {
        distanceKm: Math.round((data.routes[0].distance / 1000) * 10) / 10,
        timeMin: Math.round(data.routes[0].duration / 60),
      };
    }
    return null;
  } catch {
    return null;
  }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useDistanceBetweenServices(services: ServiceWithAddress[]) {
  const [distances, setDistances] = useState<DistanceMap>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const lastKey = useRef("");

  useEffect(() => {
    const ids = services.map((s) => s.id).join(",");
    if (ids === lastKey.current || services.length < 2) {
      if (services.length < 2) setDistances(new Map());
      return;
    }
    lastKey.current = ids;

    let cancelled = false;

    async function compute() {
      setIsLoading(true);
      const result: DistanceMap = new Map();

      // Limit to first 10 pairs to avoid excessive geocoding delays
      const maxPairs = Math.min(services.length - 1, 10);
      for (let i = 0; i < maxPairs; i++) {
        if (cancelled) break;

        const a = services[i];
        const b = services[i + 1];
        const addrA = buildGeoQuery(a);
        const addrB = buildGeoQuery(b);
        if (!addrA || !addrB) continue;

        const coordsA = await geocode(addrA);
        await delay(1100); // Nominatim rate limit
        if (cancelled) break;

        const coordsB = await geocode(addrB);
        await delay(1100);
        if (cancelled) break;

        if (!coordsA || !coordsB) continue;

        const route = await getRoute(coordsA, coordsB);
        if (route) {
          result.set(`${a.id}->${b.id}`, route);
          // Update progressively
          if (!cancelled) setDistances(new Map(result));
        }
      }

      if (!cancelled) {
        setDistances(new Map(result));
        setIsLoading(false);
      }
    }

    compute();
    return () => { cancelled = true; };
  }, [services]);

  return { distances, isLoading };
}
