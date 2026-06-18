import { useMemo, type CSSProperties } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid,
} from "recharts";
import type { OutlookRow } from "../hooks/useSeasonalOutlook";
import { COUNTRY_FLAGS } from "../data/resorts";
import { monthlyOutlook } from "../engine/seasonalScore";
import { scoreColor, scoreLabel } from "../utils/scoreColor";

const MONTH_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function DetailPanel({ row, targetDate }: { row: OutlookRow; targetDate: string }) {
  const { resort, mode } = row;
  const accent = scoreColor(row.score);

  // Forecast mode: daily base-depth curve over the 16-day window
  const forecastSeries = useMemo(() => {
    if (mode !== "forecast" || !row.forecast) return [];
    const h = row.forecast.hourly;
    const byDay = new Map<string, { depth: number; snow: number }>();
    for (let i = 0; i < h.time.length; i++) {
      const day = h.time[i].slice(0, 10);
      const prev = byDay.get(day) ?? { depth: 0, snow: 0 };
      byDay.set(day, {
        depth: (h.snow_depth[i] ?? 0) * 100, // last write wins = end of day, m→cm
        snow: prev.snow + (h.snowfall[i] ?? 0),
      });
    }
    return Array.from(byDay.entries()).map(([day, v]) => ({
      label: day.slice(8, 10) + "/" + day.slice(5, 7),
      day,
      base: Math.round(v.depth),
      fresh: Math.round(v.snow),
    }));
  }, [mode, row.forecast]);

  // Seasonal mode: month-by-month outlook curve
  const seasonalSeries = useMemo(
    () => (mode === "seasonal" ? monthlyOutlook(resort) : []),
    [mode, resort]
  );

  const targetMonthLabel = MONTH_PT[Number(targetDate.slice(5, 7)) - 1];
  const inSeasonRange = ["Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov"].includes(targetMonthLabel);

  return (
    <div className="glass" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600 }}>
            {resort.name}
          </h2>
          <span style={{ color: "var(--faint)", fontSize: 13 }}>
            {COUNTRY_FLAGS[resort.country]} {resort.region} · {resort.baseElevation}–{resort.topElevation} m
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 40, fontWeight: 500, color: accent, lineHeight: 1 }}>
            {row.score}
          </span>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: accent }}>{scoreLabel(row.score)}</span>
            <span style={{ fontSize: 12, color: "var(--faint)" }}>
              {mode === "forecast" ? "previsão real Open-Meteo" : "outlook sazonal"}
            </span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          {mode === "forecast" ? (
            <AreaChart data={forecastSeries} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="baseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={accent} stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="label" tick={{ fill: "#5e6e8c", fontSize: 10 }} interval={2} />
              <YAxis tick={{ fill: "#5e6e8c", fontSize: 10 }} />
              <Tooltip content={<ChartTip unit="cm" />} />
              <Area type="monotone" dataKey="base" name="Base" stroke={accent} strokeWidth={2} fill="url(#baseGrad)" />
            </AreaChart>
          ) : (
            <AreaChart data={seasonalSeries} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={accent} stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="label" tick={{ fill: "#5e6e8c", fontSize: 10 }} />
              <YAxis tick={{ fill: "#5e6e8c", fontSize: 10 }} domain={[0, 100]} />
              <Tooltip content={<ChartTip unit="pts" />} />
              {inSeasonRange && (
                <ReferenceLine
                  x={targetMonthLabel}
                  stroke="#fff" strokeDasharray="4 3" strokeOpacity={0.5}
                  label={{ value: "alvo", fill: "#97a6c0", fontSize: 10, position: "top" }}
                />
              )}
              <Area type="monotone" dataKey="score" name="Nota" stroke={accent} strokeWidth={2.5} fill="url(#bandGrad)" />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Metrics */}
      {mode === "forecast" && row.breakdown ? (
        <div style={metricsGrid}>
          <Metric label="Neve fresca (72h)" value={`${row.breakdown.freshSnowCm} cm`} hot={row.breakdown.freshSnowCm >= 20} />
          <Metric label="Base" value={`${row.breakdown.baseDepthCm} cm`} />
          <Metric label="Temp. média" value={`${row.breakdown.meanTempC}°C`} hot={row.breakdown.meanTempC <= -3} />
          <Metric label="Linha de neve" value={`${row.breakdown.freezingLevelM} m`} />
          <Metric label="Qualidade" value={`${row.breakdown.snowQuality}%`} />
          <Metric label="Confiança" value={`${Math.round(row.breakdown.confidence * 100)}%`} />
        </div>
      ) : row.result ? (
        <>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--muted)", lineHeight: 1.55 }}>
            {row.result.reasoning}
          </p>
          <div style={metricsGrid}>
            <Metric label="Base esperada" value={`${row.result.low}–${row.result.high} cm`} />
            <Metric label="vs. normal (5a)" value={`${row.result.normalBase} cm`} />
            <Metric label="Linha de neve" value={`${row.result.expectedSnowLine} m`} />
            <Metric label="Temporada" value={`${Math.round(row.result.seasonFactor * 100)}% do pico`} />
            <Metric label="Qualidade" value={`${Math.round(row.result.qual * 100)}%`} />
            <Metric label="Confiança" value={row.result.confidence} />
          </div>
          <div style={{ fontSize: 11.5, color: "var(--faint)", fontFamily: "var(--font-mono)" }}>
            fontes: {row.result.sources.join(" · ")}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Metric({ label, value, hot }: { label: string; value: string; hot?: boolean }) {
  return (
    <div style={{
      background: "var(--stone-soft)", borderRadius: 10, padding: "9px 11px",
      border: hot ? "1px solid var(--blue)" : "1px solid transparent",
    }}>
      <div style={{ fontSize: 11, color: "var(--faint)", marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, color: hot ? "var(--blue)" : "var(--ink)" }}>{value}</div>
    </div>
  );
}

interface TipPayload { value: number; name: string; }
function ChartTip({ active, payload, label, unit }: {
  active?: boolean; payload?: TipPayload[]; label?: string; unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--surface-solid)", border: "1px solid var(--line-strong)",
      borderRadius: 8, padding: "7px 10px", fontSize: 12,
    }}>
      <div style={{ color: "var(--faint)", marginBottom: 2 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontFamily: "var(--font-mono)", color: "var(--ink)" }}>
          {p.name}: {Math.round(p.value)} {unit}
        </div>
      ))}
    </div>
  );
}

const metricsGrid: CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))", gap: 8,
};
