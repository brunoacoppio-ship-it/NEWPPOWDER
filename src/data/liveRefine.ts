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

/**
 * Uncertainty (cm) to credit the live base-depth forecast at a given lead time.
 *
 * This is what keeps the engine *continuous* across the 16-day edge. Open-Meteo's
 * point snow_depth lives on a much thinner scale than the climatological base, so
 * a flat tight σ would let it slam the score down the instant a date crosses into
 * the window — the very day-16 jump we're removing. Instead the forecast enters
 * weak (wide σ ≈ no effect) at the edge and tightens to a precise 8 cm as the day
 * approaches, so the score slides smoothly toward reality and the band only ever
 * shrinks. 8 cm is the near-term (full-confidence) floor.
 */
export function forecastSdForLead(leadDays: number): number {
  const lead = Math.max(0, Math.min(15, leadDays));
  return 8 + 5 * lead; // 8 cm today → 83 cm at the window edge
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
