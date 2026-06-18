import type { CSSProperties } from "react";
import type { Resort } from "../data/resorts";
import { COUNTRY_FLAGS } from "../data/resorts";
import { computeSeasonalScore } from "../engine/seasonalScore";

export interface WindowRow {
  resort: Resort;
  avgScore: number;
  bestScore: number;
  bestDate: string;
  rank: number;
}

/**
 * For each resort, sample computeSeasonalScore every 3 days across [from, to]
 * and return a ranked list with the average score and the single best day.
 * Pure function — no network, safe in useMemo.
 */
export function computeWindowScores(
  resorts: Resort[],
  from: string,
  to: string
): WindowRow[] {
  // Build sample dates
  const dates: string[] = [];
  const d = new Date(from + "T12:00:00Z");
  const end = new Date(to + "T12:00:00Z");
  while (d <= end) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 3);
  }
  if (dates.length === 0) dates.push(from);

  return resorts
    .map((resort) => {
      let total = 0, bestScore = 0, bestDate = from;
      for (const date of dates) {
        const { score } = computeSeasonalScore(resort, { targetDate: date });
        total += score;
        if (score > bestScore) { bestScore = score; bestDate = date; }
      }
      return { resort, avgScore: Math.round(total / dates.length), bestScore, bestDate };
    })
    .sort((a, b) => b.avgScore - a.avgScore)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

// ── Display component ─────────────────────────────────────────────────────────

const MONTH_PT_SHORT = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

function fmtDate(d: string): string {
  const mo = Number(d.slice(5, 7)) - 1;
  const da = Number(d.slice(8, 10));
  return `${da} ${MONTH_PT_SHORT[mo]}`;
}

function scoreColor(s: number): string {
  if (s >= 65) return "var(--cyan-bright)";
  if (s >= 40) return "var(--cyan)";
  return "var(--faint)";
}

export function WindowRanking({
  rows, from, to,
}: {
  rows: WindowRow[];
  from: string;
  to: string;
}) {
  return (
    <div style={section}>
      <div style={headerRow}>
        <span style={badge}>Melhor janela: {fmtDate(from)} – {fmtDate(to)}</span>
        <span style={hint}>nota média · melhor dia por resort</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {rows.map((row) => (
          <div key={row.resort.id} className="glass" style={rowStyle}>
            <span style={rankSt}>{String(row.rank).padStart(2, "0")}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={nameSt}>{row.resort.name}</span>
              <span style={regionSt}>
                {COUNTRY_FLAGS[row.resort.country]} {row.resort.region}
              </span>
            </div>
            <div style={scoreBlock}>
              <span style={{ ...scoreNum, color: scoreColor(row.avgScore) }}>
                {row.avgScore}
              </span>
              <span style={scoreSub}>média</span>
            </div>
            <div style={bestBlock}>
              <span style={bestDateSt}>{fmtDate(row.bestDate)}</span>
              <span style={bestScoreSt}>{row.bestScore} pts</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const section: CSSProperties = { display: "flex", flexDirection: "column", gap: 8 };
const headerRow: CSSProperties = { display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" };
const badge: CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 11.5, letterSpacing: "0.06em",
  color: "var(--cyan-bright)", background: "var(--cyan-soft)",
  padding: "3px 11px", borderRadius: 999,
};
const hint: CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--faint)" };

const rowStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 11, padding: "9px 14px",
};
const rankSt: CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--faint)", flexShrink: 0 };
const nameSt: CSSProperties = { fontSize: 14.5, fontWeight: 600, color: "var(--ink)", marginRight: 7 };
const regionSt: CSSProperties = { fontSize: 11, color: "var(--faint)" };

const scoreBlock: CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 44,
};
const scoreNum: CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 500, lineHeight: 1,
};
const scoreSub: CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--faint)",
};

const bestBlock: CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0, minWidth: 56,
};
const bestDateSt: CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--cyan)" };
const bestScoreSt: CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--faint)" };
