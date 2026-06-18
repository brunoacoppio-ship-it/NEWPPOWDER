// Real ERA5 history from the Open-Meteo Archive API. Provides two of the three
// fusion terms of Bloco 3 Parte A:
//   3.1 — historical base depth at the target date (±7d window, last 5 years).
//   3.2 — the ANCHOR term: how far THIS season's snowpack sits above/below the
//         normal for today's date, projected forward with autocorrelation decay.
//
// Both come from ONE archive request per resort (cached in memory + localStorage),
// so changing the target date never re-fetches. ALWAYS fail-soft: any network or
// data problem returns null and the engine falls back to its embedded climatology.

import type { Resort } from "./resorts";

const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";
const N_YEARS = 5;          // baseline window: last 5 completed winters
const WINDOW_DAYS = 7;      // ±7 days around a calendar date = the "normal"
const RECENT_DAYS = 14;     // current base = mean snow_depth over the last 14 days
const CACHE_TTL_MS = 24 * 3600 * 1000; // refresh at most once a day (ERA5 lags ~5d)

// Keep unit tests hermetic and fast: never touch the network under Vitest
// (Vitest runs with Vite mode "test"; the prod/dev bundles use the real fetch).
const IS_TEST = import.meta.env.MODE === "test";

export interface HistoricalTerms {
  /** Real ERA5 base depth (cm) at the target date — 5-year mean + spread (3.1). */
  historicalBase: { mean: number; sd: number };
  /** Current season-to-date base anomaly vs the 5-year normal (cm). + ahead / − behind (3.2). */
  currentAnomalyCm: number | null;
  fetchedAt: number;
}

// ── helpers ───────────────────────────────────────────────────────────────────

const iso = (d: Date): string => d.toISOString().slice(0, 10);
const avg = (a: number[]): number => a.reduce((s, x) => s + x, 0) / a.length;
const std = (a: number[]): number => {
  const m = avg(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length);
};

/** Mean snow_depth (cm) in a ±half-day window around (year, month, day), or null. */
function windowAvg(
  series: Map<string, number>, year: number, month: number, day: number, half: number
): number | null {
  const center = new Date(Date.UTC(year, month - 1, day));
  let sum = 0, n = 0;
  for (let off = -half; off <= half; off++) {
    const d = new Date(center);
    d.setUTCDate(d.getUTCDate() + off);
    const v = series.get(iso(d));
    if (v != null && !Number.isNaN(v)) { sum += v; n++; }
  }
  return n > 0 ? sum / n : null;
}

// ── archive series loader (1 request per resort, cached) ────────────────────────

const seriesMem = new Map<string, Map<string, number>>();

async function loadSeries(resort: Resort, today: string): Promise<Map<string, number> | null> {
  if (IS_TEST || typeof fetch === "undefined") return null;

  if (seriesMem.has(resort.id)) return seriesMem.get(resort.id)!;

  const lsKey = `pw:era5:v1:${resort.id}`;
  try {
    const raw = localStorage.getItem(lsKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.days && Date.now() - parsed.fetchedAt < CACHE_TTL_MS) {
        const m = new Map<string, number>(Object.entries(parsed.days) as [string, number][]);
        seriesMem.set(resort.id, m);
        return m;
      }
    }
  } catch { /* ignore corrupt cache */ }

  const startYear = Number(today.slice(0, 4)) - N_YEARS;
  const params = new URLSearchParams({
    latitude: String(resort.lat), longitude: String(resort.lon),
    start_date: `${startYear}-05-01`, end_date: today,
    hourly: "snow_depth", timezone: "auto",
  });

  let json: { hourly?: { time?: string[]; snow_depth?: number[] } };
  try {
    const res = await fetch(`${ARCHIVE_URL}?${params}`);
    if (!res.ok) return null;
    json = await res.json();
  } catch { return null; }

  const times = json?.hourly?.time ?? [];
  const depths = json?.hourly?.snow_depth ?? [];
  if (times.length === 0) return null;

  // Aggregate hourly snow_depth → daily mean (m → cm).
  const acc = new Map<string, { s: number; n: number }>();
  for (let i = 0; i < times.length; i++) {
    const v = depths[i];
    if (v == null || Number.isNaN(v)) continue;
    const day = times[i].slice(0, 10);
    const e = acc.get(day) ?? { s: 0, n: 0 };
    e.s += v; e.n++;
    acc.set(day, e);
  }
  const series = new Map<string, number>();
  for (const [day, e] of acc) series.set(day, (e.s / e.n) * 100);
  if (series.size === 0) return null;

  seriesMem.set(resort.id, series);
  try {
    localStorage.setItem(lsKey, JSON.stringify({
      fetchedAt: Date.now(), days: Object.fromEntries(series),
    }));
  } catch { /* quota / unavailable — in-memory cache still serves the session */ }

  return series;
}

// ── public: derive the two terms for a (resort, targetDate) ─────────────────────

export async function getHistoricalTerms(
  resort: Resort, targetDate: string, today: string
): Promise<HistoricalTerms | null> {
  const series = await loadSeries(resort, today);
  if (!series) return null;

  const Y = Number(today.slice(0, 4));
  const tMonth = Number(targetDate.slice(5, 7));
  const tDay = Number(targetDate.slice(8, 10));

  // 3.1 — historical base at the target date: one window-average per past year.
  const yearly: number[] = [];
  for (let y = Y - N_YEARS; y <= Y - 1; y++) {
    const v = windowAvg(series, y, tMonth, tDay, WINDOW_DAYS);
    if (v != null) yearly.push(v);
  }
  if (yearly.length < 2) return null; // not enough real data → fail-soft entirely
  const historicalBase = { mean: avg(yearly), sd: Math.max(std(yearly), 1) };

  // 3.2 — anchor: current base vs the normal for TODAY's calendar date.
  const hMonth = Number(today.slice(5, 7));
  const hDay = Number(today.slice(8, 10));

  let curSum = 0, curN = 0;
  const todayD = new Date(today + "T00:00:00Z");
  for (let off = -(RECENT_DAYS - 1); off <= 0; off++) {
    const d = new Date(todayD);
    d.setUTCDate(d.getUTCDate() + off);
    const v = series.get(iso(d));
    if (v != null && !Number.isNaN(v)) { curSum += v; curN++; }
  }

  const normYearly: number[] = [];
  for (let y = Y - N_YEARS; y <= Y - 1; y++) {
    const v = windowAvg(series, y, hMonth, hDay, WINDOW_DAYS);
    if (v != null) normYearly.push(v);
  }

  const currentAnomalyCm =
    curN > 0 && normYearly.length >= 2 ? (curSum / curN) - avg(normYearly) : null;

  return { historicalBase, currentAnomalyCm, fetchedAt: Date.now() };
}
