import type { CSSProperties } from "react";
import type { OutlookRow } from "../hooks/useSeasonalOutlook";
import { COUNTRY_FLAGS } from "../data/resorts";

// ── Brand gauge geometry ─────────────────────────────────────────────────────
// A 270° ring (gap at the bottom) echoing the logo's dial. The arc length is the
// score; the lit segment is the confidence band (wide = uncertain, narrow = sure).
const CX = 42, CY = 42, R = 33, START = 225, SWEEP = 270;

function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }

function polar(thetaDeg: number): [number, number] {
  const t = (thetaDeg * Math.PI) / 180;
  return [CX + R * Math.sin(t), CY - R * Math.cos(t)]; // 0° = top, clockwise
}

/** SVG arc path for the fraction range [t0, t1] of the 270° sweep. */
function arc(t0: number, t1: number): string {
  const th0 = START + clamp01(t0) * SWEEP;
  const th1 = START + clamp01(t1) * SWEEP;
  const [x0, y0] = polar(th0);
  const [x1, y1] = polar(th1);
  const large = th1 - th0 > 180 ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${R} ${R} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

const TONE: Record<string, { fg: string; bg: string }> = {
  good:    { fg: "var(--cyan-bright)", bg: "var(--cyan-soft)" },
  warn:    { fg: "var(--warn)",        bg: "var(--warn-soft)" },
  neutral: { fg: "var(--muted)",       bg: "var(--stone-soft)" },
};

/** Human "updated Xh ago" from a fetch timestamp. */
function freshness(fetchedAt: number): string {
  const min = Math.floor((Date.now() - fetchedAt) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  return `há ${Math.floor(min / 60)} h`;
}

export function ResortOutlookCard({
  row, selected, onSelect,
}: {
  row: OutlookRow;
  selected: boolean;
  onSelect: () => void;
}) {
  const { resort, rank, score, result, mode, forecast } = row;
  const { scoreLow, scoreHigh, low, high, confidence, tag, tone } = result;

  // Provenance line (item 1.6): live freshness in forecast mode, model note otherwise.
  const source = mode === "forecast"
    ? forecast
      ? `atualizado ${freshness(forecast.fetchedAt)} · Open-Meteo`
      : "previsão indisponível · Open-Meteo"
    : "modelo sazonal · ENSO + climatologia 5a";

  const gid = `grad-${resort.id}`;
  // Confidence drives the lit segment's hue: amber only when genuinely shaky.
  const bandColor = confidence === "baixa" ? "var(--warn)" : "var(--cyan-bright)";
  const bandHalo = confidence === "baixa" ? "var(--warn-soft)" : "var(--cyan-soft)";
  const toneStyle = TONE[tone] ?? TONE.neutral;

  return (
    <button
      onClick={onSelect}
      className="glass"
      style={{
        ...cardStyle,
        cursor: "pointer",
        textAlign: "left",
        outline: "none",
        borderColor: selected ? "var(--line-strong)" : undefined,
        boxShadow: selected ? "0 0 0 1px var(--glow-cyan), 0 8px 30px rgba(0,0,0,0.35)" : undefined,
      }}
    >
      {/* Info column */}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={nameRowStyle}>
          <span style={rankStyle}>{String(rank).padStart(2, "0")}</span>
          <span style={nameStyle}>{resort.name}</span>
          <span style={regionStyle}>{COUNTRY_FLAGS[resort.country]} {resort.region}</span>
        </div>
        <div style={{ marginTop: 7, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ ...tagStyle, color: toneStyle.fg, background: toneStyle.bg }}>{tag}</span>
          {row.windRisk && row.windRisk !== "none" && (
            <span
              title={row.windRisk === "high"
                ? "Ventos severos — fechamento de lifts provável"
                : "Ventos fortes — risco de lift hold"}
              style={{
                ...tagStyle,
                color: row.windRisk === "high" ? "var(--red)" : "var(--warn)",
                background: row.windRisk === "high" ? "var(--red-soft)" : "var(--warn-soft)",
              }}
            >
              {row.windRisk === "high" ? "✕ hold provável" : "⚠ vento"}
            </span>
          )}
        </div>
        <div style={metricsRow}>
          <Metric label="base" value={`${result.expectedBase} cm`} />
          <span style={dotSep}>·</span>
          <Metric label="linha" value={`${result.expectedSnowLine} m`} />
          <span style={dotSep}>·</span>
          <Metric label="conf." value={confidence} />
        </div>
        <div style={sourceLine}>{source}</div>
      </div>

      {/* Brand dial: score arc + confidence band */}
      <div style={{ position: "relative", width: 84, height: 84, flexShrink: 0 }}>
        <svg viewBox="0 0 84 84" width={84} height={84} aria-hidden>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--cyan-bright)" />
              <stop offset="45%" stopColor="var(--cyan)" />
              <stop offset="100%" stopColor="var(--blue-deep)" />
            </linearGradient>
          </defs>
          {/* track */}
          <path d={arc(0, 1)} fill="none" stroke="var(--line)" strokeWidth={5} strokeLinecap="round" />
          {/* confidence band: halo + lit segment (thicker than the score arc) */}
          <path d={arc(scoreLow / 100, scoreHigh / 100)} fill="none" stroke={bandHalo} strokeWidth={13} strokeLinecap="round" />
          <path d={arc(scoreLow / 100, scoreHigh / 100)} fill="none" stroke={bandColor} strokeWidth={8} strokeLinecap="round" />
          {/* score arc: brand gradient, on top */}
          <path d={arc(0, score / 100)} fill="none" stroke={`url(#${gid})`} strokeWidth={5} strokeLinecap="round" />
        </svg>
        <div style={dialCenter}>
          <span style={scoreNum}>{score}</span>
          <span style={scoreRange}>{low}–{high} cm</span>
        </div>
      </div>
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
      <span style={{ color: "var(--faint)" }}>{label} </span>
      <span style={{ color: "var(--ink)" }}>{value}</span>
    </span>
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
const tagStyle: CSSProperties = {
  fontSize: 10.5, fontFamily: "var(--font-mono)", letterSpacing: "0.04em",
  padding: "3px 9px", borderRadius: 999,
};
const metricsRow: CSSProperties = {
  marginTop: 8, display: "flex", alignItems: "baseline", gap: 7, flexWrap: "wrap",
};
const dotSep: CSSProperties = { color: "var(--faint)", fontFamily: "var(--font-mono)", fontSize: 12 };
const sourceLine: CSSProperties = {
  marginTop: 6, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--faint)",
  letterSpacing: "0.02em",
};
const dialCenter: CSSProperties = {
  position: "absolute", inset: 0, display: "flex", flexDirection: "column",
  alignItems: "center", justifyContent: "center", gap: 2, pointerEvents: "none",
};
const scoreNum: CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 23, fontWeight: 500, color: "var(--ink)", lineHeight: 1,
};
const scoreRange: CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--faint)", lineHeight: 1,
};
