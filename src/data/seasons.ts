import type { Resort } from "./resorts";

// Season windows are configured PER ZONE so other ranges can be added later
// (Alps, North America) without touching any UI logic — just append a config
// here and tag the resorts with the matching `seasonZone`. Nothing about the
// June–October window is hardcoded in the components.

export interface MonthPoint {
  month: number; // 1–12
  day?: number;  // optional; defaults to the 1st / last day of the month
}

export interface SeasonConfig {
  zone: string;
  hemisphere: "south" | "north";
  seasonStart: MonthPoint;
  seasonEnd: MonthPoint;
}

export const SEASONS: SeasonConfig[] = [
  // South American Andes — ski winter runs ~June to October.
  { zone: "Andes", hemisphere: "south", seasonStart: { month: 6 }, seasonEnd: { month: 10 } },
  // Futuro (hemisfério norte — a temporada atravessa a virada do ano):
  // { zone: "Alpes",            hemisphere: "north", seasonStart: { month: 11 }, seasonEnd: { month: 4 } },
  // { zone: "América do Norte", hemisphere: "north", seasonStart: { month: 11 }, seasonEnd: { month: 4 } },
];

const BY_ZONE = new Map(SEASONS.map((s) => [s.zone, s]));

const MONTHS_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** The season zones present in a set of resorts (deduped). */
export function zonesOf(resorts: Resort[]): string[] {
  return [...new Set(resorts.map((r) => r.seasonZone))];
}

/** Is month (1–12) inside this season? Handles the year-wrap case (start > end). */
export function isMonthInSeason(month: number, s: SeasonConfig): boolean {
  const a = s.seasonStart.month, b = s.seasonEnd.month;
  return a <= b ? month >= a && month <= b : month >= a || month <= b;
}

/** Is the date (YYYY-MM-DD) in season for ANY of the given zones? */
export function isDateInSeason(date: string, zones: string[]): boolean {
  const month = Number(date.slice(5, 7));
  return zones.some((z) => {
    const s = BY_ZONE.get(z);
    return !!s && isMonthInSeason(month, s);
  });
}

/** Human label of the season window(s), e.g. "junho a outubro". */
export function seasonLabel(zones: string[]): string {
  const labels = zones
    .map((z) => BY_ZONE.get(z))
    .filter((s): s is SeasonConfig => !!s)
    .map((s) => `${MONTHS_PT[s.seasonStart.month - 1]} a ${MONTHS_PT[s.seasonEnd.month - 1]}`);
  return [...new Set(labels)].join(" · ") || "—";
}

function lastDayOfMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate();
}

function ymd(year: number, month1to12: number, day: number): string {
  return `${year}-${String(month1to12).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** [startStr, endStr] of the active-or-next occurrence of a season (YYYY-MM-DD). */
function seasonOccurrence(s: SeasonConfig, todayStr: string): [string, string] {
  const ty = Number(todayStr.slice(0, 4));
  const tm = Number(todayStr.slice(5, 7));
  const contiguous = s.seasonStart.month <= s.seasonEnd.month;
  let startYear = ty;
  if (contiguous && tm > s.seasonEnd.month) startYear += 1; // this year's season already over
  const endYear = contiguous ? startYear : startYear + 1;   // wrap seasons end next year
  const startStr = ymd(startYear, s.seasonStart.month, s.seasonStart.day ?? 1);
  const endStr = ymd(endYear, s.seasonEnd.month, s.seasonEnd.day ?? lastDayOfMonth(endYear, s.seasonEnd.month));
  return [startStr, endStr];
}

/**
 * Date bounds (YYYY-MM-DD) for the upcoming/active season across the given zones,
 * clamped to >= today — feeds the native date picker so it greys out off-season
 * months. Works cleanly for a single contiguous season (the current Andes case);
 * with mixed/wrapping seasons it widens and the out-of-season guard still keeps
 * the ranking honest. String comparison keeps it timezone-proof.
 */
export function seasonDateBounds(zones: string[], todayStr: string): { min: string; max: string } {
  const oneYearOut = `${Number(todayStr.slice(0, 4)) + 1}${todayStr.slice(4)}`;
  const configs = zones.map((z) => BY_ZONE.get(z)).filter((s): s is SeasonConfig => !!s);
  if (configs.length === 0) return { min: todayStr, max: oneYearOut };

  let minStr: string | null = null;
  let maxStr: string | null = null;
  for (const s of configs) {
    const [startStr, endStr] = seasonOccurrence(s, todayStr);
    if (minStr === null || startStr < minStr) minStr = startStr;
    if (maxStr === null || endStr > maxStr) maxStr = endStr;
  }
  const min = minStr! < todayStr ? todayStr : minStr!;
  return { min, max: maxStr! };
}

/** Default target date: the climatological peak (~15 Aug for the Andes), >= today. */
export function peakDefaultDate(todayStr: string): string {
  const year = Number(todayStr.slice(0, 4));
  const augThis = `${year}-08-15`;
  return augThis >= todayStr ? augThis : `${year + 1}-08-15`;
}
