// Optional live refinement. When the target date is inside the 16-day window,
// pull Open-Meteo's real forecast base depth so the engine can collapse the
// confidence band. Beyond the window this is skipped (returns null), and the
// app runs entirely on the embedded seasonal model. Always fails soft.

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

export function leadDaysTo(targetDate: string): number {
  const today = new Date(new Date().toISOString().slice(0, 10)).getTime();
  const target = new Date(targetDate).getTime();
  return Math.round((target - today) / 86_400_000);
}

/** Returns base depth (cm) forecast for the target date, or null. */
export async function fetchForecastBase(
  lat: number,
  lon: number,
  targetDate: string
): Promise<number | null> {
  if (leadDaysTo(targetDate) > 15) return null;
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: "snow_depth",
    forecast_days: "16",
    timezone: "auto",
  });
  try {
    const res = await fetch(`${FORECAST_URL}?${params}`);
    if (!res.ok) return null;
    const j = await res.json();
    const times: string[] = j?.hourly?.time ?? [];
    const depths: number[] = j?.hourly?.snow_depth ?? [];
    let last: number | null = null;
    for (let i = 0; i < times.length; i++) {
      if (times[i].slice(0, 10) === targetDate && typeof depths[i] === "number") {
        last = depths[i];
      }
    }
    return last == null ? null : Math.round(last * 100); // m → cm
  } catch {
    return null;
  }
}
