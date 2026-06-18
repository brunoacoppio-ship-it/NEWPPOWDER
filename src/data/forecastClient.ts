const BASE_URL = "https://api.open-meteo.com/v1/forecast";

export interface HourlyForecast {
  time: string[];
  snowfall: number[];
  snow_depth: number[];
  temperature_2m: number[];
  freezing_level_height: number[];
}

export interface ForecastResponse {
  latitude: number;
  longitude: number;
  hourly: HourlyForecast;
}

// Session-level cache: one fetch per resort per page load
const memCache = new Map<string, ForecastResponse>();

export function clearForecastCache() { memCache.clear(); }

export async function fetchForecast(
  lat: number, lon: number, resortId: string
): Promise<ForecastResponse> {
  if (memCache.has(resortId)) return memCache.get(resortId)!;
  const params = new URLSearchParams({
    latitude: String(lat), longitude: String(lon),
    hourly: "snowfall,snow_depth,temperature_2m,freezing_level_height",
    forecast_days: "16", timezone: "auto",
  });
  const res = await fetch(`${BASE_URL}?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const data: ForecastResponse = await res.json();
  memCache.set(resortId, data);
  return data;
}
