import { useState, useEffect, useMemo, Fragment, type CSSProperties } from "react";
import logoIcon from "./assets/logo-icon.png";
import { RESORTS, REGIONS } from "./data/resorts";
import { zonesOf, isDateInSeason, seasonDateBounds, seasonLabel, peakDefaultDate } from "./data/seasons";
import { useSeasonalOutlook } from "./hooks/useSeasonalOutlook";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { ResortOutlookCard } from "./components/ResortOutlookCard";
import { EnsoBanner } from "./components/EnsoBanner";
import { ResortMap } from "./components/ResortMap";
import { DetailPanel } from "./components/DetailPanel";
import { SmartRecommendation } from "./components/SmartRecommendation";
import { WindowRanking, computeWindowScores } from "./components/WindowRanking";

const today = new Date().toISOString().slice(0, 10);

const inputStyle: CSSProperties = {
  fontFamily: "inherit", fontSize: 15, color: "var(--ink)", background: "var(--surface-2)",
  border: "1px solid var(--line-strong)", borderRadius: 10, padding: "10px 12px", cursor: "pointer",
};
const inputSmStyle: CSSProperties = {
  ...inputStyle, fontSize: 13, padding: "7px 10px",
};

function horizonLabel(leadDays: number, mode: "forecast" | "seasonal"): string {
  if (leadDays < 0) return "data no passado";
  if (mode === "forecast") return `${leadDays} dias à frente · previsão real Open-Meteo`;
  const weeks = Math.round(leadDays / 7);
  return `~${weeks} semanas à frente · modelo sazonal (ENSO + climatologia)`;
}

export default function App() {
  // Item 1.5: open on the climatological peak (~15 Aug), not "today".
  const [targetDate, setTargetDate] = useState(() => peakDefaultDate(today));
  const [region, setRegion] = useState<string | null>(null);
  const { rows, loading, progress, mode, leadDays } = useSeasonalOutlook(targetDate, region);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isMobile = useMediaQuery("(max-width: 860px)");

  // Window finder state (2.1)
  const [windowFrom, setWindowFrom] = useState("");
  const [windowTo, setWindowTo] = useState("");

  // Item 1.3: the selectable window + in-season check follow the season config of
  // whichever resorts are currently visible (the region filter), never hardcoded.
  const visibleResorts = useMemo(
    () => (region ? RESORTS.filter((r) => r.region === region) : RESORTS),
    [region]
  );
  const zones = useMemo(() => zonesOf(visibleResorts), [visibleResorts]);
  const bounds = useMemo(() => seasonDateBounds(zones, today), [zones]);
  const inSeason = isDateInSeason(targetDate, zones);

  // Window ranking (2.1) — pure computation, no network
  const windowRows = useMemo(
    () => (windowFrom && windowTo && windowFrom <= windowTo
      ? computeWindowScores(visibleResorts, windowFrom, windowTo)
      : []),
    [visibleResorts, windowFrom, windowTo]
  );

  // Selection rules differ by layout:
  //  - desktop: the side panel always shows something → default to #1
  //  - mobile: start collapsed (clean list); tapping opens, re-tapping closes
  useEffect(() => {
    if (rows.length === 0) { setSelectedId(null); return; }
    if (selectedId && !rows.some((r) => r.resort.id === selectedId)) {
      setSelectedId(null); // drop a selection that left the list (e.g. region filter)
      return;
    }
    if (!isMobile && !selectedId) setSelectedId(rows[0].resort.id);
  }, [rows, selectedId, isMobile]);

  const selected = rows.find((r) => r.resort.id === selectedId) ?? null;

  const list = loading && rows.length === 0
    ? Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="glass skeleton" style={{ height: 74 }} />
      ))
    : rows.map((row) => {
        const isSel = row.resort.id === selectedId;
        const card = (
          <ResortOutlookCard
            row={row}
            selected={isSel}
            onSelect={() => setSelectedId(isMobile && isSel ? null : row.resort.id)}
          />
        );
        // Mobile: detail opens inline right under the tapped card (accordion)
        if (isMobile) {
          return (
            <Fragment key={row.resort.id}>
              {card}
              {isSel && selected && <DetailPanel row={selected} targetDate={targetDate} />}
            </Fragment>
          );
        }
        return <Fragment key={row.resort.id}>{card}</Fragment>;
      });

  const mapBlock = (
    <div className="glass" style={{ height: isMobile ? 280 : 380, padding: 6, overflow: "hidden" }}>
      <ResortMap rows={rows} selectedId={selectedId} onSelect={setSelectedId} />
    </div>
  );

  // Content above the list (shared between mobile/desktop): recommendation + window ranking
  const aboveList = inSeason && (
    <>
      {!loading && rows.length > 0 && <SmartRecommendation rows={rows} />}
      {windowRows.length > 0 && (
        <WindowRanking rows={windowRows} from={windowFrom} to={windowTo} />
      )}
    </>
  );

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? "26px 14px 56px" : "40px 24px 70px" }}>
      {/* Header */}
      <header style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img
                src={logoIcon}
                alt="Powder Window"
                style={{
                  height: isMobile ? 46 : 58, width: "auto",
                  mixBlendMode: "screen",
                  filter: "drop-shadow(0 0 14px rgba(56,189,248,0.25))",
                }}
              />
              <div>
                <h1 style={{ fontFamily: "var(--font-display)", fontSize: isMobile ? 27 : 36, fontWeight: 700, letterSpacing: "-0.02em", margin: 0, lineHeight: 1 }}>
                  Powder Window
                </h1>
                <p style={{ margin: "5px 0 0", color: "var(--muted)", fontSize: isMobile ? 12.5 : 14 }}>
                  Real snow data. Better days.
                </p>
              </div>
            </div>
          </div>
          <div style={{
            display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
            width: isMobile ? "100%" : undefined,
          }}>
            <input
              type="date" value={targetDate} min={bounds.min} max={bounds.max}
              onChange={(e) => e.target.value && setTargetDate(e.target.value)}
              style={{ ...inputStyle, flex: isMobile ? "1 1 140px" : undefined }}
            />
            <select
              value={region ?? ""} onChange={(e) => setRegion(e.target.value || null)}
              style={{ ...inputStyle, flex: isMobile ? "1 1 140px" : undefined }}
            >
              <option value="">Todas as regiões</option>
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>

        {inSeason && (
          <>
            {/* Mode status line */}
            <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 11px", borderRadius: 999,
                fontFamily: "var(--font-mono)", fontSize: 11.5,
                background: mode === "forecast" ? "var(--blue-soft)" : "var(--amber-soft)",
                color: mode === "forecast" ? "var(--blue-ink)" : "var(--amber-ink)",
              }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: "currentColor",
                  animation: loading ? "pulse 1s infinite" : undefined }} />
                {mode === "forecast" ? "PREVISÃO REAL" : "MODELO SAZONAL"}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--faint)" }}>
                {horizonLabel(leadDays, mode)}
                {loading && ` · carregando ${Math.round(progress * 100)}%`}
              </span>
            </div>

            {/* Window finder (2.1) */}
            <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--faint)" }}>
                janela
              </span>
              <input
                type="date" value={windowFrom}
                min={bounds.min} max={windowTo || bounds.max}
                onChange={(e) => setWindowFrom(e.target.value)}
                style={{ ...inputSmStyle, flex: isMobile ? "1 1 120px" : undefined }}
              />
              <span style={{ color: "var(--faint)", fontSize: 13 }}>–</span>
              <input
                type="date" value={windowTo}
                min={windowFrom || bounds.min} max={bounds.max}
                onChange={(e) => setWindowTo(e.target.value)}
                style={{ ...inputSmStyle, flex: isMobile ? "1 1 120px" : undefined }}
              />
              {(windowFrom || windowTo) && (
                <button
                  onClick={() => { setWindowFrom(""); setWindowTo(""); }}
                  style={{
                    fontFamily: "inherit", fontSize: 12, cursor: "pointer",
                    color: "var(--faint)", background: "transparent",
                    border: "1px solid var(--line)", borderRadius: 8, padding: "5px 9px",
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </>
        )}
      </header>

      {!inSeason ? (
        <OutOfSeason
          zones={zones}
          isMobile={isMobile}
          onGoToPeak={() => setTargetDate(peakDefaultDate(today))}
        />
      ) : (
        <>
          {mode === "seasonal" && (
            <div style={{ marginBottom: 16 }}><EnsoBanner /></div>
          )}

          {isMobile ? (
            /* Mobile: single column — map on top, list with inline detail */
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {mapBlock}
              {!loading && (
                <p style={{ margin: "0 2px", fontSize: 12, color: "var(--faint)" }}>
                  Toque num destino — no mapa ou na lista — para ver o detalhe.
                </p>
              )}
              {aboveList}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{list}</div>
            </div>
          ) : (
            /* Desktop: list left, sticky map + detail right */
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.05fr)", gap: 18, alignItems: "start" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {aboveList}
                {list}
              </div>
              <div style={{ position: "sticky", top: 18, display: "flex", flexDirection: "column", gap: 18 }}>
                {mapBlock}
                {selected && <DetailPanel row={selected} targetDate={targetDate} />}
              </div>
            </div>
          )}
        </>
      )}

      <footer style={{ marginTop: 34, paddingTop: 18, borderTop: "1px solid var(--line)", fontSize: 12.5, color: "var(--faint)", lineHeight: 1.6 }}>
        <strong style={{ fontWeight: 600, color: "var(--muted)" }}>Como a nota é calculada.</strong>{" "}
        Dentro dos 16 dias: dados reais do Open-Meteo (neve fresca em 72h, base, temperatura, linha de neve).
        Além dos 16 dias: modelo sazonal — climatologia dos últimos 5 anos + análogo de ENSO (histórico
        re-ponderado por anos similares ao atual) escalados pela curva da temporada, de modo que cada data
        do inverno produz um resultado diferente. Banda larga = menor confiança.
      </footer>
    </div>
  );
}

function OutOfSeason({
  zones, isMobile, onGoToPeak,
}: {
  zones: string[];
  isMobile: boolean;
  onGoToPeak: () => void;
}) {
  return (
    <div
      className="glass"
      style={{
        padding: isMobile ? "36px 22px" : "60px 40px",
        textAlign: "center",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
      }}
    >
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 11.5, letterSpacing: "0.12em",
        color: "var(--cyan-bright)", background: "var(--cyan-soft)",
        padding: "4px 12px", borderRadius: 999,
      }}>
        FORA DE TEMPORADA
      </span>
      <h2 style={{
        margin: 0, fontFamily: "var(--font-display)", fontWeight: 700,
        fontSize: isMobile ? 22 : 28, letterSpacing: "-0.01em", color: "var(--ink)",
      }}>
        Sem neve esquiável nesta data
      </h2>
      <p style={{ margin: 0, maxWidth: 460, color: "var(--muted)", fontSize: 14.5, lineHeight: 1.6 }}>
        A janela de inverno vai de <strong style={{ color: "var(--ink)" }}>{seasonLabel(zones)}</strong>.
        Fora dela não há outlook de neve a mostrar — preferimos dizer isso a exibir notas zeradas.
      </p>
      <button
        onClick={onGoToPeak}
        style={{
          fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer",
          color: "var(--bg)", background: "var(--cyan)",
          border: "none", borderRadius: 10, padding: "10px 18px", marginTop: 4,
        }}
      >
        Ir para o pico da temporada (15 de agosto)
      </button>
    </div>
  );
}
