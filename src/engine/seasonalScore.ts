import type { Resort } from "../data/resorts";
import { CLIMATE, historicalSample, seasonalFactor, snowlineShift, type ResortClimate } from "../data/climatology";
import { ONI_HISTORY, analogWeight, CURRENT_ONI } from "../data/enso";

export type Confidence = "alta" | "média" | "baixa";
export type Tone = "good" | "neutral" | "warn";

export interface Estimator {
  mean: number; // cm of base depth
  var: number;  // variance (cm^2)
}

export interface SeasonalOpts {
  oni?: number;
  /** Target date (YYYY-MM-DD). Drives the seasonal curve so July ≠ October. */
  targetDate?: string;
  /** Days from today to the target date — drives the anchor's decay (Bloco 3). */
  leadDays?: number;
  /** Live 16-day forecast base depth (cm), only meaningful inside the window. */
  forecastBase?: number;
  forecastSd?: number;
  /** SEAS5 seasonal anomaly vs normal (cm). */
  seas5AnomalyCm?: number;
  /** Season-to-date snowpack ratio (1.0 = on track). */
  persistenceRatio?: number;
  /** Real ERA5 base depth at the target date (cm), 5-year mean + spread (3.1).
   *  When present it replaces the synthetic recent-climatology term — but it is
   *  still just ONE term in the fusion, never the answer on its own. */
  historicalBase?: { mean: number; sd: number };
  /** Current season-to-date base anomaly vs the 5-year normal (cm). The ANCHOR
   *  term (3.2): projected to the target date with autocorrelation decay so the
   *  model responds to THIS year and can disagree with the historical record. */
  currentAnomalyCm?: number;
}

/** Autocorrelation per ~month for projecting the current-season anomaly forward. */
const ANCHOR_AUTOCORR = 0.7;

/** Scale a PEAK-winter estimator into date-space by the season factor. */
function scaleEstimator(e: Estimator, sf: number): Estimator {
  return { mean: e.mean * sf, var: e.var * sf * sf };
}

export interface SeasonalResult {
  expectedBase: number;
  normalBase: number;
  low: number;          // base depth low (1σ)
  high: number;         // base depth high (1σ)
  sd: number;
  score: number;        // 0–100
  scoreLow: number;
  scoreHigh: number;
  confidence: Confidence;
  tag: string;
  tone: Tone;
  reasoning: string;
  qual: number;
  rainExposure: number;
  expectedSnowLine: number;
  seasonFactor: number; // fraction of peak base for this date
  sources: string[];    // which estimators contributed
}

const REFERENCE_BASE = 220; // cm of base that earns a top snow-amount score
const RECENT_YEARS = 5;     // baseline window: recent regime, not a 40-year mean

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Recent baseline: the last 5 winters only. Reflects the current regime
 * rather than a multi-decade average that washes out today's conditions.
 */
export function recentEstimate(resortId: string): Estimator {
  const recent = ONI_HISTORY.slice(-RECENT_YEARS);
  const samples = recent.map(({ year, oni }) => historicalSample(resortId, year, oni));
  const mean = samples.reduce((s, x) => s + x, 0) / samples.length;
  const variance = samples.reduce((s, x) => s + (x - mean) ** 2, 0) / samples.length;
  const c = CLIMATE[resortId];
  const sd = Math.max(Math.sqrt(variance), 0.7 * c.sd);
  return { mean, var: sd * sd };
}

/** ENSO-analog estimate: history re-weighted by similarity to this year's ONI. */
export function analogEstimate(resortId: string, oni: number): Estimator {
  let sw = 0, swx = 0;
  const samples: { w: number; x: number }[] = [];
  for (const { year, oni: o } of ONI_HISTORY) {
    const w = analogWeight(o, oni);
    const x = historicalSample(resortId, year, o);
    sw += w; swx += w * x;
    samples.push({ w, x });
  }
  const mean = swx / sw;
  let swv = 0;
  for (const s of samples) swv += s.w * (s.x - mean) ** 2;
  const wVar = swv / sw;
  const c = CLIMATE[resortId];
  // Floor the spread: a seasonal outlook is honestly uncertain.
  const sd = Math.max(Math.sqrt(wVar), 0.85 * c.sd);
  return { mean, var: sd * sd };
}

/** Inverse-variance (precision) fusion — the band falls straight out of it. */
export function fuse(estimators: Estimator[]): Estimator {
  let invSum = 0, weightedSum = 0;
  for (const e of estimators) {
    const inv = 1 / e.var;
    invSum += inv;
    weightedSum += e.mean * inv;
  }
  return { mean: weightedSum / invSum, var: 1 / invSum };
}

function geographicQuality(c: ResortClimate, r: Resort, oni: number, snowLineOffset: number) {
  const expectedSnowLine = c.snowLine + c.snowLineBeta * oni + snowLineOffset;
  const vertical = r.topElevation - r.baseElevation;
  let rainExposure = clamp((expectedSnowLine - r.baseElevation) / vertical, 0, 1);
  if (c.coldSecurity) rainExposure = Math.min(rainExposure, 0.1); // cold by latitude
  const leewardFactor = r.windward ? 1.0 : 0.85; // leeward = moisture-starved
  const qual = clamp((1 - rainExposure) * leewardFactor, 0, 1);
  return { qual, rainExposure, expectedSnowLine };
}

function baseToScore(base: number, qual: number) {
  const amount = clamp(base / REFERENCE_BASE, 0, 1);
  return Math.round(100 * amount * (0.5 + 0.5 * qual));
}

function buildReasoning(c: ResortClimate, r: Resort, rainExposure: number, oni: number): string {
  const parts: string[] = [];
  parts.push(r.windward ? "barlavento" : "sotavento (depende de spillover)");
  if (r.windward && c.ensoBeta >= 25 && oni >= 0.5) parts.push("favorecido pelo El Niño");
  if (c.coldSecurity) parts.push("frio garantido pela latitude");
  else if (rainExposure < 0.15) parts.push("base acima da linha de neve");
  else if (rainExposure > 0.5) parts.push("base exposta a chuva em ano quente");
  else parts.push("linha de neve perto da base");
  const s = parts.slice(0, 3).join(" · ");
  return s.charAt(0).toUpperCase() + s.slice(1) + ".";
}

export function computeSeasonalScore(r: Resort, opts: SeasonalOpts = {}): SeasonalResult {
  const oni = opts.oni ?? CURRENT_ONI;
  const c = CLIMATE[r.id];

  // Seasonality: the curve scales the mid-winter peak down for any other date.
  // No date → deep-winter peak (sf = 1, no snow-line shift), keeping the engine's
  // climatological reference intact.
  let sf = 1, sls = 0;
  if (opts.targetDate) {
    const m = Number(opts.targetDate.slice(5, 7));
    const d = Number(opts.targetDate.slice(8, 10));
    sf = seasonalFactor(m, d);
    sls = snowlineShift(m, d);
  }

  // ── Term fusion (Bloco 3): every term is brought into DATE-SPACE, then fused
  // by inverse variance. Fusing scaled estimators is mathematically identical to
  // the old "fuse in peak space, then scale" path, so the embedded-only behaviour
  // is unchanged — the new real-data terms simply join the same fusion. ──────────
  const sources: string[] = [];
  const climDate: Estimator[] = [];

  // (3.1) Historical term: real ERA5 at the target date if available — otherwise
  // the synthetic recent climatology. Either way it is just ONE term. The real
  // term's spread is floored so a quiet 5 years can't masquerade as certainty.
  let normalBase: number;
  if (opts.historicalBase) {
    const floorVar = (0.7 * c.sd * sf) ** 2;
    climDate.push({
      mean: Math.max(0, opts.historicalBase.mean),
      var: Math.max(opts.historicalBase.sd ** 2, floorVar),
    });
    normalBase = opts.historicalBase.mean;
    sources.push("histórico ERA5 (5 anos)");
  } else {
    const recent = recentEstimate(r.id);
    climDate.push(scaleEstimator(recent, sf));
    normalBase = recent.mean * sf;
    sources.push("climatologia recente (5 anos)");
  }

  // (3.3) ENSO analog — history re-weighted by similarity to this year's ONI.
  climDate.push(scaleEstimator(analogEstimate(r.id, oni), sf));
  sources.push("análogo de ENSO");

  if (opts.persistenceRatio != null) {
    climDate.push(scaleEstimator({ mean: c.meanBase * opts.persistenceRatio, var: (0.45 * c.sd) ** 2 }, sf));
    sources.push("persistência da temporada");
  }
  if (opts.seas5AnomalyCm != null) {
    climDate.push(scaleEstimator({ mean: c.meanBase + opts.seas5AnomalyCm, var: (0.55 * c.sd) ** 2 }, sf));
    sources.push("SEAS5");
  }

  // The climatology baseline = the "normal for this date". Honest-uncertainty
  // floor: a pure seasonal outlook (no live anchor/forecast yet) can't be narrow.
  const fusedClim = fuse(climDate);
  const seasonalMean = Math.max(0, fusedClim.mean);
  const seasonalSd = Math.max(Math.sqrt(fusedClim.var), 0.18 * seasonalMean);

  // Date-space fusion: baseline + anchor + live forecast (each present or not).
  const dateEst: Estimator[] = [{ mean: seasonalMean, var: seasonalSd ** 2 }];

  // (3.2) ANCHOR — the current season's anomaly persisted forward. This is the
  // channel that makes the model respond to THIS year: a dry start drags the
  // score below climatology even when history + El Niño say "good year". The
  // anomaly's weight decays with lead time (r^(lead/30)), so nearby dates feel
  // it strongly and distant ones barely.
  if (opts.currentAnomalyCm != null) {
    const lead = Math.max(0, opts.leadDays ?? 0);
    const decay = Math.pow(ANCHOR_AUTOCORR, lead / 30);
    const anchorMean = Math.max(0, seasonalMean + opts.currentAnomalyCm * decay);
    const anchorSd = Math.max(0.35 * c.sd * sf, 8);
    dateEst.push({ mean: anchorMean, var: anchorSd ** 2 });
    sources.push("estado atual da temporada (âncora)");
  }

  // The live forecast (≤16d) is a DATE-SPECIFIC base depth that joins the same
  // fusion. Crossing the 16-day edge never switches formulas — the score stays
  // put and only the band tightens.
  if (opts.forecastBase != null) {
    dateEst.push({ mean: Math.max(0, opts.forecastBase), var: (opts.forecastSd ?? 8) ** 2 });
    sources.push("previsão do tempo");
  }

  const combined = dateEst.length > 1 ? fuse(dateEst) : dateEst[0];
  const expectedBase = Math.max(0, combined.mean);
  const sd = Math.sqrt(combined.var);

  const low = Math.max(0, expectedBase - sd);
  const high = expectedBase + sd;

  const { qual, rainExposure, expectedSnowLine } = geographicQuality(c, r, oni, sls);
  const score = baseToScore(expectedBase, qual);
  const scoreLow = baseToScore(low, qual);
  const scoreHigh = baseToScore(high, qual);

  const relWidth = sd / Math.max(expectedBase, 1);
  const confidence: Confidence = relWidth < 0.16 ? "alta" : relWidth < 0.3 ? "média" : "baixa";

  const anomaly = expectedBase - normalBase;
  const aboveThresh = 0.3 * c.sd * sf;
  let tag: string, tone: Tone;
  if (confidence === "baixa") { tag = "Variável"; tone = "warn"; }
  else if (anomaly > aboveThresh) { tag = "Acima do normal"; tone = "good"; }
  else if (anomaly < -aboveThresh) { tag = "Abaixo do normal"; tone = "neutral"; }
  else { tag = "Perto do normal"; tone = "neutral"; }

  return {
    expectedBase: Math.round(expectedBase),
    normalBase: Math.round(normalBase),
    low: Math.round(low),
    high: Math.round(high),
    sd: Math.round(sd),
    score, scoreLow, scoreHigh,
    confidence, tag, tone,
    reasoning: buildReasoning(c, r, rainExposure, oni),
    qual: Math.round(qual * 100) / 100,
    rainExposure: Math.round(rainExposure * 100) / 100,
    expectedSnowLine: Math.round(expectedSnowLine),
    seasonFactor: Math.round(sf * 100) / 100,
    sources,
  };
}

/** Season-long curve of the expected score for a resort — drives the detail chart. */
export function monthlyOutlook(r: Resort, oni: number = CURRENT_ONI) {
  const months = [
    { m: 5, label: "Mai" }, { m: 6, label: "Jun" }, { m: 7, label: "Jul" },
    { m: 8, label: "Ago" }, { m: 9, label: "Set" }, { m: 10, label: "Out" },
    { m: 11, label: "Nov" },
  ];
  return months.map(({ m, label }) => {
    const res = computeSeasonalScore(r, { oni, targetDate: `2026-${String(m).padStart(2, "0")}-15` });
    return { label, month: m, score: res.score, base: res.expectedBase, low: res.low, high: res.high };
  });
}
