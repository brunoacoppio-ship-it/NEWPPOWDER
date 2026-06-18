import type { CSSProperties } from "react";
import type { OutlookRow } from "../hooks/useSeasonalOutlook";
import { COUNTRY_FLAGS } from "../data/resorts";
import { scoreColor } from "../utils/scoreColor";

export function ResortOutlookCard({
  row, selected, onSelect,
}: {
  row: OutlookRow;
  selected: boolean;
  onSelect: () => void;
}) {
  const { resort, rank, mode, score } = row;
  const accent = scoreColor(score);

  const sub = mode === "forecast"
    ? `${row.breakdown?.freshSnowCm ?? 0} cm frescos · base ${row.breakdown?.baseDepthCm ?? 0} cm`
    : row.result?.reasoning ?? "";

  const badge = mode === "forecast"
    ? { text: "PREVISÃO", fg: "var(--blue-ink)", bg: "var(--blue-soft)" }
    : { text: "SAZONAL", fg: "var(--amber-ink)", bg: "var(--amber-soft)" };

  return (
    <button
      onClick={onSelect}
      className="glass"
      style={{
        ...cardStyle,
        cursor: "pointer",
        textAlign: "left",
        outline: "none",
        borderColor: selected ? accent : undefined,
        boxShadow: selected ? `0 0 0 1px ${accent}, 0 8px 30px rgba(0,0,0,0.35)` : undefined,
      }}
    >
      <div style={{ width: 4, alignSelf: "stretch", borderRadius: 4, background: accent, opacity: selected ? 1 : 0.55 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={nameRowStyle}>
          <span style={rankStyle}>{String(rank).padStart(2, "0")}</span>
          <span style={nameStyle}>{resort.name}</span>
          <span style={regionStyle}>{COUNTRY_FLAGS[resort.country]} {resort.region}</span>
          <span style={{ ...badgeStyle, color: badge.fg, background: badge.bg }}>{badge.text}</span>
        </div>
        <p style={{
          margin: "5px 0 0", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.45,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {sub}
        </p>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 500, color: accent, lineHeight: 1 }}>
          {score}
        </div>
        <div style={{ position: "relative", height: 5, width: 88, background: "var(--stone-soft)", borderRadius: 3, marginTop: 8 }}>
          <div style={{ position: "absolute", inset: "0 auto 0 0", width: `${Math.min(100, score)}%`, background: accent, borderRadius: 3 }} />
        </div>
      </div>
    </button>
  );
}

const cardStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
  width: "100%", transition: "border-color 0.15s, box-shadow 0.15s",
};
const nameRowStyle: CSSProperties = { display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap" };
const rankStyle: CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--faint)" };
const nameStyle: CSSProperties = { fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--ink)" };
const regionStyle: CSSProperties = { fontSize: 12, color: "var(--faint)" };
const badgeStyle: CSSProperties = {
  fontSize: 9.5, fontFamily: "var(--font-mono)", letterSpacing: "0.05em", padding: "2px 7px", borderRadius: 999,
};
