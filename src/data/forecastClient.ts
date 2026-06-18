const BASE_URL = "https://api.open-meteo.com/v1/forecast";

export interface HourlyForecast {
  time: string[];
  snowfall: number[];
  snow_depth: number[];
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
    hourly: "snowfall,snow_depth",
    forecast_days: "16", timezone: "auto",
  });
  const res = await fetch(`${BASE_URL}?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const data: ForecastResponse = await res.json();
  memCache.set(resortId, data);
  return data;
}

export interface ForecastSummary {
  /** Modeled base depth (cm) at the end of the target day. */
  baseDepthCm: number;
  /** Snowfall (cm) accumulated over the 72h leading up to the target day. */
  freshSnowCm: number;
}

/**
 * Pull the two date-specific signals the engine needs out of a 16-day forecast:
 * the base depth at the target day (fed in as `forecastBase`) and the 72h fresh
 * snowfall (display only). Pure — safe to unit-test without the network.
 */
export function summarizeForecast(hourly: HourlyForecast, targetDate: string): ForecastSummary {
  const targetEnd = new Date(targetDate + "T23:59:59Z").getTime();
  const windowStart = targetEnd - 72 * 3600 * 1000;
  let baseDepthCm = 0;
  let freshSnowCm = 0;
  for (let i = 0; i < hourly.time.length; i++) {
    const t = new Date(hourly.time[i]).getTime();
    if (t >= windowStart && t <= targetEnd) freshSnowCm += hourly.snowfall[i] ?? 0;
    // last write within the target day wins = end-of-day depth (m → cm)
    if (hourly.time[i].slice(0, 10) === targetDate) baseDepthCm = (hourly.snow_depth[i] ?? 0) * 100;
  }
  return { baseDepthCm: Math.round(baseDepthCm), freshSnowCm: Math.round(freshSnowCm) };
}
