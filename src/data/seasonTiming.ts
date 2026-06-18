// Item 3.6 — adaptive season open/close forecasting.
//
// Same philosophy as the rest of Bloco 3: the projection is the historical
// record CORRECTED BY THE DIRECTION things are drifting, not the raw mean. We
// reconstruct ~18 years of opening/closing dates from ERA5 (Open-Meteo Archive),
// fit a ROBUST trend (Theil-Sen — median of pairwise slopes, immune to a freak
// year), and project the target year — presented as a WINDOW (± the year-to-year
// scatter), never a single cast-in-stone date. Optional ENSO nudge if the signal
// is clear. Pure math is exported for tests; the network wrapper fails soft.

import type { Resort } from "./resorts";
import { ONI_HISTORY } from "./enso";

const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";
const TIMING_YEARS = 18;            // reconstruction window
const TIMING_TTL_MS = 30 * 24 * 3600 * 1000; // timing is stable; refresh monthly
const OPEN_THRESHOLD_CM = 40;       // skiable base
const OPEN_CONSEC_DAYS = 5;         // sustained, not a one-day blip
const MIN_YEARS = 5;                // need enough points to fit a trend
const BAND_FLOOR_DAYS = 3;          // never claim a falsely precise window
const ENSO_MIN_YEARS = 8;           // only attempt the ENSO nudge with enough data
const ENSO_MIN_CORR = 0.4;          // ...and only if the correlation is clear

const IS_TEST = import.meta.env.MODE === "test";

export interface YearValue { x: number; y: number } // x = year, y = day-of-year

export interface SeasonProjection {
  predictedDoy: number;  // projected day-of-year for the target year
  lowDoy: number;        // window edges (± year-to-year scatter)
  highDoy: number;
  slopePerDecade: number; // trend in days/decade (+ = drifting later)
  nYears: number;
}

export interface SeasonTiming {
  open: SeasonProjection | null;
  close: SeasonProjection | null;
  targetYear: number;
}

// ── day-of-year helpers ─────────────────────────────────────────────────────

const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

export function doyToDate(year: number, doy: number): Date {
  return new Date(Date.UTC(year, 0, 1) + (doy - 1) * 86_400_000);
}

// ── statistics ───────────────────────────────────────────────────────────────

export function median(a: number[]): number {
  if (a.length === 0) return NaN;
  const s = [...a].sort((p, q) => p - q);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const mean = (a: number[]): number => a.reduce((s, x) => s + x, 0) / a.length;
const stdev = (a: number[]): number => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length);
};

/** Ordinary least-squares slope + Pearson correlation (for the ENSO nudge). */
function linreg(xs: number[], ys: number[]): { slope: number; corr: number } {
  const n = xs.length;
  if (n < 2) return { slope: 0, corr: 0 };
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  const slope = sxx > 0 ? sxy / sxx : 0;
  const corr = sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
  return { slope, corr };
}

/**
 * Theil-Sen robust line: slope = median of all pairwise slopes; intercept =
 * median of (y − slope·x). Resistant to outlier years that would tug a naive
 * least-squares fit.
 */
export function theilSen(pts: YearValue[]): { slope: number; intercept: number } {
  const slopes: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      if (pts[j].x !== pts[i].x) slopes.push((pts[j].y - pts[i].y) / (pts[j].x - pts[i].x));
    }
  }
  const slope = slopes.length ? median(slopes) : 0;
  const intercept = median(pts.map((p) => p.y - slope * p.x));
  return { slope, intercept };
}

/**
 * Project a season event (open or close) to the target year. The center is the
 * robust Theil-Sen line; the window is ± the residual scatter (floored so it
 * never looks falsely precise). An ENSO nudge is applied only when ONI explains
 * a clear share of the residuals — otherwise the trend alone speaks.
 */
export function projectSeasonEvent(
  series: YearValue[],
  targetYear: number,
  opts?: { oni?: number; oniByYear?: Map<number, number> }
): SeasonProjection | null {
  if (series.length < MIN_YEARS) return null;

  const { slope, intercept } = theilSen(series);
  let predicted = slope * targetYear + intercept;

  const residuals = series.map((p) => p.y - (slope * p.x + intercept));
  const band = Math.max(stdev(residuals), BAND_FLOOR_DAYS);

  // Optional ENSO correction: regress the residuals on that year's ONI.
  if (opts?.oni != null && opts.oniByYear) {
    const pairs = series
      .map((p) => ({ o: opts.oniByYear!.get(p.x), r: p.y - (slope * p.x + intercept) }))
      .filter((q): q is { o: number; r: number } => q.o != null);
    if (pairs.length >= ENSO_MIN_YEARS) {
      const { slope: b, corr } = linreg(pairs.map((q) => q.o), pairs.map((q) => q.r));
      if (Math.abs(corr) >= ENSO_MIN_CORR) {
        predicted += b * (opts.oni - mean(pairs.map((q) => q.o)));
      }
    }
  }

  return {
    predictedDoy: predicted,
    lowDoy: predicted - band,
    highDoy: predicted + band,
    slopePerDecade: slope * 10,
    nYears: series.length,
  };
}

/**
 * Reconstruct open/close day-of-year per year from a daily snow_depth (cm) map:
 *   open  = first day starting a run of `consec` days all ≥ threshold
 *   close = last day ≥ threshold
 * Years that never reach the threshold contribute no point (fail soft per year).
 */
export function reconstructSeason(
  daily: Map<string, number>,
  years: number[],
  threshold = OPEN_THRESHOLD_CM,
  consec = OPEN_CONSEC_DAYS
): { open: YearValue[]; close: YearValue[] } {
  const open: YearValue[] = [];
  const close: YearValue[] = [];

  for (const y of years) {
    const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const maxDoy = isLeap ? 366 : 365;
    const depth = (doy: number): number | undefined => daily.get(isoDate(doyToDate(y, doy)));

    let openDoy: number | null = null;
    for (let d = 1; d + consec - 1 <= maxDoy; d++) {
      let ok = true;
      for (let k = 0; k < consec; k++) {
        const v = depth(d + k);
        if (v == null || v < threshold) { ok = false; break; }
      }
      if (ok) { openDoy = d; break; }
    }

    let closeDoy: number | null = null;
    for (let d = maxDoy; d >= 1; d--) {
      const v = depth(d);
      if (v != null && v >= threshold) { closeDoy = d; break; }
    }

    if (openDoy != null) open.push({ x: y, y: openDoy });
    if (closeDoy != null) close.push({ x: y, y: closeDoy });
  }

  return { open, close };
}

// ── network wrapper (one wide fetch per resort, cached; fail-soft) ─────────────

const timingMem = new Map<string, { open: YearValue[]; close: YearValue[] }>();

async function loadTimingSeries(
  resort: Resort, today: string
): Promise<{ open: YearValue[]; close: YearValue[] } | null> {
  if (IS_TEST || typeof fetch === "undefined") return null;

  if (timingMem.has(resort.id)) return timingMem.get(resort.id)!;

  const lsKey = `pw:timing:v1:${resort.id}`;
  try {
    const raw = localStorage.getItem(lsKey);
    if (raw) {
      const p = JSON.parse(raw);
      if (p?.open && Date.now() - p.fetchedAt < TIMING_TTL_MS) {
        const s = { open: p.open as YearValue[], close: p.close as YearValue[] };
        timingMem.set(resort.id, s);
        return s;
      }
    }
  } catch { /* corrupt cache */ }

  const curYear = Number(today.slice(0, 4));
  const startYear = curYear - TIMING_YEARS;
  const endYear = curYear - 1;
  const params = new URLSearchParams({
    latitude: String(resort.lat), longitude: String(resort.lon),
    start_date: `${startYear}-01-01`, end_date: `${endYear}-12-31`,
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

  // Daily MAX snow_depth (cm) — the deepest base each day defines the season.
  const daily = new Map<string, number>();
  for (let i = 0; i < times.length; i++) {
    const v = depths[i];
    if (v == null || Number.isNaN(v)) continue;
    const day = times[i].slice(0, 10);
    const cm = v * 100;
    const prev = daily.get(day);
    if (prev == null || cm > prev) daily.set(day, cm);
  }
  if (daily.size === 0) return null;

  const years: number[] = [];
  for (let y = startYear; y <= endYear; y++) years.push(y);
  const series = reconstructSeason(daily, years);

  timingMem.set(resort.id, series);
  try {
    localStorage.setItem(lsKey, JSON.stringify({
      fetchedAt: Date.now(), open: series.open, close: series.close,
    }));
  } catch { /* quota — session cache still serves */ }

  return series;
}

export async function getSeasonTiming(
  resort: Resort, today: string, targetYear: number, oni: number
): Promise<SeasonTiming | null> {
  const series = await loadTimingSeries(resort, today);
  if (!series) return null;

  const oniByYear = new Map(ONI_HISTORY.map((o) => [o.year, o.oni]));
  const open = projectSeasonEvent(series.open, targetYear, { oni, oniByYear });
  const close = projectSeasonEvent(series.close, targetYear, { oni, oniByYear });
  if (!open && !close) return null;

  return { open, close, targetYear };
}
