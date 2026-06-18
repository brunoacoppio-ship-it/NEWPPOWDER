import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid,
} from "recharts";
import type { OutlookRow } from "../hooks/useSeasonalOutlook";
import type { HourlyForecast } from "../data/forecastClient";
import { COUNTRY_FLAGS } from "../data/resorts";
import { monthlyOutlook } from "../engine/seasonalScore";
import { scoreColor, scoreLabel } from "../utils/scoreColor";
import { ONI_HISTORY, analogWeight, CURRENT_ONI, ensoPhase } from "../data/enso";
import { historicalSample } from "../data/climatology";
import {
  getSeasonTiming, doyToDate, type SeasonTiming, type SeasonProjection,
} from "../data/seasonTiming";
import { fetchWebcams, type Webcam } from "../data/webcamsClient";

// ── Snow quality types (2.3) ──────────────────────────────────────────────────

type SnowQuality = "pó" | "batida" | "úmida" | "chuva";

const Q_ICON: Record<SnowQuality, string> = {
  pó: "❄", batida: "◦", úmida: "~", chuva: "✕",
};
const Q_COLOR: Record<SnowQuality, string> = {
  pó: "var(--cyan-bright)", batida: "var(--ink)", úmida: "var(--warn)", chuva: "var(--red)",
};
const Q_BG: Record<SnowQuality, string> = {
  pó: "var(--cyan-soft)", batida: "var(--stone-soft)",
  úmida: "var(--warn-soft)", chuva: "var(--red-soft)",
};

function dayQuality(day: string, h: HourlyForecast, baseElev: number): SnowQuality {
  let freshSnow = 0, sumTemp = 0, nTemp = 0, sumFreeze = 0, nFreeze = 0;
  for (let i = 0; i < h.time.length; i++) {
    if (h.time[i].slice(0, 10) !== day) continue;
    freshSnow += h.snowfall[i] ?? 0;
    if (h.temperature_2m?.[i] != null) { sumTemp += h.temperature_2m[i]!; nTemp++; }
    if (h.freezing_level_height?.[i] != null) { sumFreeze += h.freezing_level_height[i]!; nFreeze++; }
  }
  const avgTemp = nTemp > 0 ? sumTemp / nTemp : 0;
  const avgFreeze = nFreeze > 0 ? sumFreeze / nFreeze : 9999;
  if (avgFreeze < baseElev) return "chuva";
  if (avgTemp > 0) return "úmida";
  if (freshSnow > 5 && avgTemp < -3) return "pó";
  return "batida";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtOni(v: number): string {
  return (v >= 0 ? "+" : "") + v.toFixed(1);
}

const MONTH_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// ── Component ─────────────────────────────────────────────────────────────────

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
        depth: (h.snow_depth[i] ?? 0) * 100,
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

  // Snow quality timeline — next 10 days (2.3, forecast mode only)
  const qualTimeline = useMemo(() => {
    if (mode !== "forecast" || !row.forecast) return [];
    const today = new Date().toISOString().slice(0, 10);
    return Array.from({ length: 10 }, (_, i) => {
      const d = new Date(today + "T12:00:00Z");
      d.setDate(d.getDate() + i);
      const day = d.toISOString().slice(0, 10);
      return {
        day,
        label: `${d.getUTCDate()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
        quality: dayQuality(day, row.forecast!.hourly, resort.baseElevation),
      };
    });
  }, [mode, row.forecast, resort.baseElevation]);

  // Top-3 ENSO analog years (2.5) — pure computation, always available
  const analogYears = useMemo(() => {
    return ONI_HISTORY
      .map(({ year, oni }) => ({
        year,
        oni: Math.round(oni * 10) / 10,
        weight: Math.round(analogWeight(oni, CURRENT_ONI) * 100),
        base: Math.round(historicalSample(resort.id, year, oni)),
      }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3);
  }, [resort.id]);

  const phase = ensoPhase(CURRENT_ONI);
  const currentYear = new Date().getFullYear();

  // Adaptive season open/close window (3.6) — fetched per selected resort, fails
  // soft: on any network/data gap the section simply doesn't render.
  const [timing, setTiming] = useState<SeasonTiming | null>(null);
  useEffect(() => {
    let cancelled = false;
    setTiming(null);
    const today = new Date().toISOString().slice(0, 10);
    const targetYear = Number(targetDate.slice(0, 4));
    getSeasonTiming(resort, today, targetYear, CURRENT_ONI)
      .then((t) => { if (!cancelled) setTiming(t); })
      .catch(() => { /* fail soft */ });
    return () => { cancelled = true; };
  }, [resort, targetDate]);

  // Live webcams (5.2) — fail soft: no key / no camera / API down ⇒ empty.
  const [webcams, setWebcams] = useState<Webcam[]>([]);
  useEffect(() => {
    let cancelled = false;
    setWebcams([]);
    fetchWebcams(resort.lat, resort.lon)
      .then((w) => { if (!cancelled) setWebcams(w); })
      .catch(() => { /* fail soft */ });
    return () => { cancelled = true; };
  }, [resort]);

  const targetMonthLabel = MONTH_PT[Number(targetDate.slice(5, 7)) - 1];
  const inSeasonRange = ["Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov"].includes(targetMonthLabel);

  return (
    <div className="glass" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
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

      {/* Snow quality timeline (2.3) */}
      {qualTimeline.length > 0 && (
        <div>
          <div style={sectionLabel}>qualidade da neve · próximos 10 dias</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
            {qualTimeline.map(({ day, label, quality }) => (
              <div key={day} style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                padding: "6px 7px", borderRadius: 8, background: Q_BG[quality], minWidth: 38,
              }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--faint)" }}>
                  {label}
                </span>
                <span style={{ fontSize: 14, color: Q_COLOR[quality], lineHeight: 1 }}>
                  {Q_ICON[quality]}
                </span>
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 9, color: Q_COLOR[quality],
                  letterSpacing: "0.01em",
                }}>
                  {quality}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metrics */}
      <p style={{ margin: 0, fontSize: 13.5, color: "var(--muted)", lineHeight: 1.55 }}>
        {row.result.reasoning}
      </p>
      <div style={metricsGrid}>
        {mode === "forecast" && row.freshSnowCm != null && (
          <Metric label="Neve fresca (72h)" value={`${row.freshSnowCm} cm`} hot={row.freshSnowCm >= 20} />
        )}
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

      {/* Analog years (2.5) */}
      <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
        <div style={sectionLabel}>
          anos análogos · {phase.label} {currentYear}
        </div>
        {analogYears.length >= 2 && (
          <p style={{ margin: "6px 0 10px", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>
            {`Este ${phase.label} (${phase.strength}) mais se parece com ${analogYears[0].year} (ONI ${fmtOni(analogYears[0].oni)}) e ${analogYears[1].year} (ONI ${fmtOni(analogYears[1].oni)}).`}
          </p>
        )}
        <div style={{ display: "flex", gap: 6 }}>
          {analogYears.map(({ year, oni, weight, base }) => (
            <div key={year} style={{
              flex: 1, background: "var(--stone-soft)", borderRadius: 10, padding: "9px 11px",
            }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 500, color: "var(--ink)" }}>
                {year}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--faint)", marginTop: 2 }}>
                ONI {fmtOni(oni)} · {weight}% peso
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--cyan)", marginTop: 5 }}>
                ~{base} cm
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Adaptive season window (3.6) — omitted entirely when data is unavailable */}
      {timing && (timing.open || timing.close) && (
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          <div style={sectionLabel}>temporada · janela provável {timing.targetYear}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {timing.open && <TimingRow label="Abertura" proj={timing.open} year={timing.targetYear} kind="open" />}
            {timing.close && <TimingRow label="Fechamento" proj={timing.close} year={timing.targetYear} kind="close" />}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--faint)", marginTop: 8 }}>
            tendência ERA5 · {(timing.open ?? timing.close)!.nYears} invernos · Theil-Sen
          </div>
        </div>
      )}

      {/* Live webcams (5.2) — hidden entirely when there's nothing to show */}
      {(webcams.length > 0 || resort.webcamUrl) && (
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          <div style={sectionLabel}>câmeras ao vivo</div>
          {webcams.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              {webcams.map((cam) => (
                <a
                  key={cam.id}
                  href={cam.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={cam.title}
                  style={webcamCard}
                >
                  <img src={cam.thumb} alt={cam.title} style={webcamImg} loading="lazy" />
                  <span style={webcamTitle}>{cam.title}</span>
                </a>
              ))}
            </div>
          )}
          {resort.webcamUrl && (
            <a
              href={resort.webcamUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "inline-block", marginTop: 8, fontSize: 13, color: "var(--cyan)" }}
            >
              Câmera oficial do resort →
            </a>
          )}
          {webcams.length > 0 && (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--faint)", marginTop: 8 }}>
              câmeras via{" "}
              <a href="https://www.windy.com/webcams" target="_blank" rel="noopener noreferrer"
                style={{ color: "var(--faint)", textDecoration: "underline" }}>
                Windy.com
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Season-window row (3.6) ────────────────────────────────────────────────────

function fmtDoy(year: number, doy: number): string {
  const d = doyToDate(year, Math.round(doy));
  return `${d.getUTCDate()} ${MONTH_PT[d.getUTCMonth()].toLowerCase()}`;
}

function trendNote(slopePerDecade: number, kind: "open" | "close"): string {
  const days = Math.abs(slopePerDecade);
  if (days < 1) return "estável na década";
  const dir = slopePerDecade > 0 ? "mais tarde" : "mais cedo";
  const verb = kind === "open" ? "abrindo" : "fechando";
  return `vem ${verb} ~${Math.round(days)} dias ${dir} por década`;
}

function TimingRow({
  label, proj, year, kind,
}: {
  label: string; proj: SeasonProjection; year: number; kind: "open" | "close";
}) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
      <span style={{ fontSize: 12.5, color: "var(--muted)", minWidth: 78 }}>{label} provável</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--cyan)" }}>
        {fmtDoy(year, proj.lowDoy)} – {fmtDoy(year, proj.highDoy)}
      </span>
      <span style={{ fontSize: 11.5, color: "var(--faint)" }}>{trendNote(proj.slopePerDecade, kind)}</span>
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

const sectionLabel: CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em",
  color: "var(--faint)", textTransform: "uppercase",
};
const metricsGrid: CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))", gap: 8,
};
const webcamCard: CSSProperties = {
  display: "flex", flexDirection: "column", gap: 4, textDecoration: "none",
  width: 120, flexShrink: 0,
};
const webcamImg: CSSProperties = {
  width: 120, height: 80, objectFit: "cover", borderRadius: 10,
  border: "1px solid var(--line)", background: "var(--stone-soft)",
};
const webcamTitle: CSSProperties = {
  fontSize: 11, color: "var(--muted)", lineHeight: 1.3,
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};
