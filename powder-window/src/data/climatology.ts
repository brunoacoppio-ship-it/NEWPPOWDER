// Per-resort winter climatology, used as the historical baseline that the
// ENSO analog re-weights. All depths in cm, elevations in m.
//
//  meanBase        typical mid-winter base depth (the climatological mean)
//  sd              year-to-year spread of that base depth
//  ensoBeta        cm of base depth gained per +1.0 ONI (windward Chile > 0;
//                  leeward/Argentina ~0; far-south ~0). Encodes the teleconnection.
//  snowLine        typical winter rain/snow line elevation
//  snowLineBeta    m the snow line rises per +1.0 ONI (warm bias; bigger at low
//                  latitude, near-zero in the cold far south)
//  coldSecurity    far-south resorts whose snow is latitude-driven, not altitude-
//                  driven; rain risk capped low regardless of snow line

export interface ResortClimate {
  meanBase: number;
  sd: number;
  ensoBeta: number;
  snowLine: number;
  snowLineBeta: number;
  coldSecurity?: boolean;
}

export const CLIMATE: Record<string, ResortClimate> = {
  "valle-nevado":   { meanBase: 165, sd: 45, ensoBeta: 40, snowLine: 2400, snowLineBeta: 350 },
  "portillo":       { meanBase: 155, sd: 45, ensoBeta: 38, snowLine: 2400, snowLineBeta: 350 },
  "nevados-chillan":{ meanBase: 175, sd: 80, ensoBeta: 30, snowLine: 1700, snowLineBeta: 400 },
  "corralco":       { meanBase: 150, sd: 70, ensoBeta: 22, snowLine: 1500, snowLineBeta: 380 },
  "las-lenas":      { meanBase: 130, sd: 70, ensoBeta: 12, snowLine: 2200, snowLineBeta: 300 },
  "chapelco":       { meanBase: 110, sd: 60, ensoBeta: 6,  snowLine: 1400, snowLineBeta: 250 },
  "cerro-castor":   { meanBase: 95,  sd: 22, ensoBeta: 2,  snowLine: 700,  snowLineBeta: 120, coldSecurity: true },
};

// Deterministic pseudo-noise so the synthesized historical samples are stable
// across renders (no Math.random — reproducible by design).
function hashNoise(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // map to roughly [-1, 1]
  return ((h >>> 0) / 0xffffffff) * 2 - 1;
}

/**
 * Reconstruct the historical base-depth sample for a resort in a given ONI year:
 *   base = meanBase + ensoBeta * oni + residual
 * The residual is deterministic pseudo-noise scaled to the resort's spread.
 */
export function historicalSample(resortId: string, year: number, oni: number): number {
  const c = CLIMATE[resortId];
  const residualSd = Math.sqrt(Math.max(0, c.sd * c.sd - (c.ensoBeta * 0.5) ** 2));
  const residual = hashNoise(`${resortId}:${year}`) * residualSd * 0.3;
  return Math.max(0, c.meanBase + c.ensoBeta * oni + residual);
}

// ── Seasonality ────────────────────────────────────────────────────────────
// Southern-Hemisphere ski winter. meanBase is the mid-winter PEAK (August);
// every other date is a fraction of it. This is what makes a July outlook
// differ from an October one for the same resort.

// Base-depth fraction relative to the August peak, by month (1–12).
const SEASON_CURVE: Record<number, number> = {
  1: 0.04, 2: 0.02, 3: 0.04, 4: 0.10, 5: 0.30, 6: 0.60,
  7: 0.87, 8: 1.00, 9: 0.93, 10: 0.66, 11: 0.32, 12: 0.10,
};

// Snow line seasonal shift (m) vs deep-winter normal: lower mid-winter, much
// higher in spring as the freezing level climbs.
const SNOWLINE_SHIFT: Record<number, number> = {
  1: 600, 2: 650, 3: 550, 4: 350, 5: 120, 6: -40,
  7: -180, 8: -150, 9: 10, 10: 260, 11: 520, 12: 600,
};

function interpMonthly(table: Record<number, number>, month: number, day: number): number {
  const cur = table[month] ?? 1;
  const next = table[month === 12 ? 1 : month + 1] ?? cur;
  const frac = Math.max(0, Math.min(1, (day - 1) / 30));
  return cur + (next - cur) * frac;
}

/** Fraction of peak base depth for a given calendar date (smoothly interpolated). */
export function seasonalFactor(month: number, day: number): number {
  return Math.max(0.02, interpMonthly(SEASON_CURVE, month, day));
}

/** Snow-line shift (m) vs deep-winter normal for a given calendar date. */
export function snowlineShift(month: number, day: number): number {
  return interpMonthly(SNOWLINE_SHIFT, month, day);
}
