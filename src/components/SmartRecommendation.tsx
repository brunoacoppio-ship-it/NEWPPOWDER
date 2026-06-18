import type { CSSProperties } from "react";
import type { OutlookRow } from "../hooks/useSeasonalOutlook";

export function SmartRecommendation({ rows }: { rows: OutlookRow[] }) {
  if (rows.length < 2) return null;

  // "Aposta segura": maior score entre os de confiança alta/média; cai no #1 se todos forem baixa.
  const confident = rows.filter((r) => r.result.confidence !== "baixa");
  const safeBet = confident.length > 0 ? confident[0] : rows[0];

  // "Teto alto": maior scoreHigh — pode ter confiança baixa (alto risco, alta recompensa).
  const highCeiling = [...rows].sort((a, b) => b.result.scoreHigh - a.result.scoreHigh)[0];

  let text: string;
  if (safeBet.resort.id === highCeiling.resort.id) {
    text = `${safeBet.resort.name} lidera em nota e confiança — a escolha mais segura para esta data.`;
  } else {
    text = `${safeBet.resort.name} é a aposta segura. Se tolerar incerteza, ${highCeiling.resort.name} pode surpreender (teto mais alto).`;
  }

  return (
    <div style={wrap}>
      <span style={label}>RECOMENDAÇÃO</span>
      <p style={body}>{text}</p>
    </div>
  );
}

const wrap: CSSProperties = {
  padding: "11px 16px",
  borderLeft: "2px solid var(--cyan)",
  background: "var(--cyan-soft)",
  borderRadius: "0 10px 10px 0",
  display: "flex", flexDirection: "column", gap: 3,
};
const label: CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em",
  color: "var(--cyan)", opacity: 0.8,
};
const body: CSSProperties = {
  margin: 0, fontSize: 13.5, color: "var(--ink)", lineHeight: 1.5,
};
