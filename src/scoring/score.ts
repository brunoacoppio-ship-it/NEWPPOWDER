import type { Resort } from "../data/resorts";
import type { HourlyForecast } from "../data/forecastClient";

export interface ScoreWeights {
  freshSnow: number;
  baseDepth: number;
  snowQuality: number;
  aboveSnowline: number;
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  freshSnow: 0.40, baseDepth: 0.20, snowQuality: 0.25, aboveSnowline: 0.15,
};

export interface ScoreBreakdown {
  total: number;
  freshSnow: number;
  baseDepth: number;
  snowQuality: number;
  aboveSnowline: number;
  confidence: number;
  freshSnowCm: number;
  baseDepthCm: number;
  meanTempC: number;
  freezingLevelM: number;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function computeScore(
  resort: Resort,
  targetDate: string,
  hourly: HourlyForecast,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
  today: string,
): ScoreBreakdown {
  const targetEnd = new Date(targetDate + "T23:59:59Z").getTime();
  const windowStart = targetEnd - 72 * 3600 * 1000;

  const indices72: number[] = [];
  const indicesDay: number[] = [];

  for (let i = 0; i < hourly.time.length; i++) {
    const t = new Date(hourly.time[i]).getTime();
    if (t >= windowStart && t <= targetEnd) indices72.push(i);
    if (hourly.time[i].slice(0, 10) === targetDate) indicesDay.push(i);
  }

  // Fresh snow: sum of snowfall in the 72h window
  const freshSnowCm = indices72.reduce((s, i) => s + (hourly.snowfall[i] ?? 0), 0);

  // Base depth: last reading of target day (meters → cm)
  const lastDepthIdx = indicesDay.length ? indicesDay[indicesDay.length - 1] : -1;
  const baseDepthCm = lastDepthIdx >= 0 ? (hourly.snow_depth[lastDepthIdx] ?? 0) * 100 : 0;

  // Temperature and freezing level: mean over target day
  const temps = indicesDay.map(i => hourly.temperature_2m[i]).filter(v => !isNaN(v));
  const meanTempC = temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : 0;
  const freezeLevels = indicesDay.map(i => hourly.freezing_level_height[i]).filter(v => !isNaN(v));
  const freezingLevelM = freezeLevels.length
    ? freezeLevels.reduce((a, b) => a + b, 0) / freezeLevels.length
    : resort.baseElevation + meanTempC * (1000 / 6.5);

  // Component scores (0–1)
  const freshSnowScore = clamp(freshSnowCm / 30, 0, 1);
  const baseDepthScore = clamp(baseDepthCm / 200, 0, 1);

  // Snow quality: cold + low rain exposure
  const qualityTemp = meanTempC <= -5 ? 1.0
    : meanTempC >= 2 ? 0
    : 1.0 - (meanTempC + 5) / 7 * 0.6;
  const vertical = resort.topElevation - resort.baseElevation;
  const rainExposure = clamp((freezingLevelM - resort.baseElevation) / vertical, 0, 1);
  const snowQualityScore = clamp(qualityTemp * (1 - rainExposure), 0, 1);

  // Above snowline
  const aboveSnowlineScore = clamp(
    (resort.topElevation - Math.max(freezingLevelM, resort.baseElevation)) / vertical, 0, 1
  );

  // Confidence decays with lead time
  const leadDays = Math.max(0, (new Date(targetDate).getTime() - new Date(today).getTime()) / 86400000);
  const confidence = leadDays <= 3 ? 1.0 : clamp(1.0 - (leadDays - 3) / 13 * 0.4, 0.6, 1.0);

  const raw =
    weights.freshSnow * freshSnowScore +
    weights.baseDepth * baseDepthScore +
    weights.snowQuality * snowQualityScore +
    weights.aboveSnowline * aboveSnowlineScore;

  return {
    total: Math.round(raw * confidence * 100),
    freshSnow: Math.round(freshSnowScore * 100),
    baseDepth: Math.round(baseDepthScore * 100),
    snowQuality: Math.round(snowQualityScore * 100),
    aboveSnowline: Math.round(aboveSnowlineScore * 100),
    confidence,
    freshSnowCm: Math.round(freshSnowCm),
    baseDepthCm: Math.round(baseDepthCm),
    meanTempC: Math.round(meanTempC * 10) / 10,
    freezingLevelM: Math.round(freezingLevelM),
  };
}
