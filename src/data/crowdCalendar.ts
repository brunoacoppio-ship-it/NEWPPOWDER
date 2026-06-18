// Item 4.2 — static high-crowd calendar for the Andes ski season.
//
// These are recurring (year-agnostic) windows when the resorts fill up: Brazilian
// July school holidays, the Chile/Argentina winter recess, and a couple of high-
// traffic long weekends. Pure date math — no network, never throws.

interface MonthDay { m: number; d: number }
interface CrowdWindow { start: MonthDay; end: MonthDay; label: string }

const WINDOWS: CrowdWindow[] = [
  // Brazilian school July break — the big inbound wave to the Andes.
  { start: { m: 7, d: 1 }, end: { m: 7, d: 20 }, label: "férias de julho (Brasil)" },
  // Chile + Argentina winter school recess (~mid-July).
  { start: { m: 7, d: 8 }, end: { m: 7, d: 28 }, label: "férias de inverno (Chile/Argentina)" },
  // Fiestas Patrias (Chile, 18 Sep) — packed Chilean resorts around the holiday.
  { start: { m: 9, d: 16 }, end: { m: 9, d: 21 }, label: "Fiestas Patrias (Chile)" },
  // Día del Libertador San Martín (Argentina, 17 Aug long weekend).
  { start: { m: 8, d: 15 }, end: { m: 8, d: 18 }, label: "feriado de San Martín (Argentina)" },
];

const asNum = (md: MonthDay): number => md.m * 100 + md.d;

/** Labels of every high-crowd window the date (YYYY-MM-DD) falls within. */
export function crowdWindowsFor(dateStr: string): string[] {
  if (!dateStr || dateStr.length < 10) return [];
  const cur = Number(dateStr.slice(5, 7)) * 100 + Number(dateStr.slice(8, 10));
  return WINDOWS.filter((w) => cur >= asNum(w.start) && cur <= asNum(w.end)).map((w) => w.label);
}

/** True when the target date lands in any high-crowd window. */
export function isHighCrowd(dateStr: string): boolean {
  return crowdWindowsFor(dateStr).length > 0;
}
