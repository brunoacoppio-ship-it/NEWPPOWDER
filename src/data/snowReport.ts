// Shared SnowReport contract (Bloco 6). Imported by the front-end hook and, as a
// type-only import, by the serverless scraper in api/snow-report.ts.

export type Difficulty =
  | "beginner"      // principiante / fácil
  | "intermediate"  // intermediário
  | "advanced"      // avançado / difícil
  | "expert"        // experto / muito difícil
  | "freeride"
  | "link";         // ligação / conexão

export interface DifficultyTally {
  open: number;
  total: number;
}

export interface SnowReport {
  resortId: string;
  liftsOpen: number | null;
  liftsTotal: number | null;
  runsOpen: number | null;
  runsTotal: number | null;
  runsByDifficulty: Partial<Record<Difficulty, DifficultyTally>> | null;
  baseDepthCm: number | null;
  /** Resort-provided "last updated" (ISO when we can parse it) or our fetch time. */
  updatedAt: string | null;
  /** Official source URL the data was scraped from. */
  source: string;
  /** True ⇒ data is unavailable/stale/out-of-season; UI shows the soft fallback. */
  stale: boolean;
}
