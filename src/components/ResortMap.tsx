import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import { useEffect, useState, type CSSProperties } from "react";
import type { OutlookRow } from "../hooks/useSeasonalOutlook";
import { scoreColor } from "../utils/scoreColor";

type Layer = "markers" | "accumulation";

function FlyToSelected({ row }: { row: OutlookRow | null }) {
  const map = useMap();
  useEffect(() => {
    if (row) map.flyTo([row.resort.lat, row.resort.lon], 7, { duration: 0.8 });
  }, [row, map]);
  return null;
}

// Leaflet renders grey tiles if the container resized while hidden/changed
// (e.g. switching between mobile and desktop layouts). Recompute on resize.
function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const fix = () => map.invalidateSize();
    fix();
    const t = setTimeout(fix, 250);
    window.addEventListener("resize", fix);
    return () => { clearTimeout(t); window.removeEventListener("resize", fix); };
  }, [map]);
  return null;
}

/**
 * Windy snow-accumulation embed centered on the central Andes. The 3d/7d selector
 * is best-effort: it nudges the Windy timeline start; the embed's own timeline
 * stays interactive, and an unrecognized value just falls back to "now".
 */
function windyUrl(horizonDays: 3 | 7): string {
  const cal = Math.floor((Date.now() + horizonDays * 86_400_000) / 1000); // unix s
  const p = new URLSearchParams({
    lat: "-34", lon: "-70", zoom: "6", level: "surface", overlay: "snowAccu",
    menu: "", message: "", marker: "", calendar: String(cal), pressure: "",
    type: "map", location: "coordinates", detail: "",
    metricWind: "default", metricTemp: "default", radarRange: "-1",
  });
  return `https://embed.windy.com/embed2.html?${p.toString()}`;
}

export function ResortMap({
  rows, selectedId, onSelect,
}: {
  rows: OutlookRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [layer, setLayer] = useState<Layer>("markers");
  const [horizon, setHorizon] = useState<3 | 7>(3);
  const selected = rows.find((r) => r.resort.id === selectedId) ?? null;

  return (
    <div style={{ position: "relative", height: "100%", width: "100%" }}>
      {/* Layer toggle (5.1) */}
      <div style={controlGroup}>
        <button
          onClick={() => setLayer("markers")}
          style={{ ...segBtn, ...(layer === "markers" ? segActive : null) }}
        >
          Marcadores
        </button>
        <button
          onClick={() => setLayer("accumulation")}
          style={{ ...segBtn, ...(layer === "accumulation" ? segActive : null) }}
        >
          Acumulação
        </button>
      </div>

      {/* Horizon selector — only meaningful for the Windy accumulation layer */}
      {layer === "accumulation" && (
        <div style={{ ...controlGroup, top: 48 }}>
          {([3, 7] as const).map((h) => (
            <button
              key={h}
              onClick={() => setHorizon(h)}
              style={{ ...segBtn, ...numFont, ...(horizon === h ? segActive : null) }}
            >
              {h}d
            </button>
          ))}
        </div>
      )}

      {layer === "markers" ? (
        <MapContainer
          center={[-37, -70.5]}
          zoom={4}
          style={{ height: "100%", width: "100%", borderRadius: 16 }}
          scrollWheelZoom
          attributionControl
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; OpenStreetMap &copy; CARTO'
          />
          {rows.map((row) => {
            const isSel = row.resort.id === selectedId;
            const color = scoreColor(row.score);
            const r = 7 + Math.min(row.score / 6, 12);
            return (
              <CircleMarker
                key={row.resort.id}
                center={[row.resort.lat, row.resort.lon]}
                radius={r}
                pathOptions={{
                  color: isSel ? "#ffffff" : color,
                  weight: isSel ? 3 : 1.5,
                  fillColor: color,
                  fillOpacity: isSel ? 0.95 : 0.65,
                }}
                eventHandlers={{ click: () => onSelect(row.resort.id) }}
              >
                <Tooltip direction="top" offset={[0, -4]}>
                  <div style={{ fontFamily: "var(--font-sans)" }}>
                    <strong>{row.resort.name}</strong> · {row.score}
                  </div>
                </Tooltip>
              </CircleMarker>
            );
          })}
          <FlyToSelected row={selected} />
          <InvalidateOnResize />
        </MapContainer>
      ) : (
        <>
          <iframe
            key={horizon}
            title="Acumulação de neve · Windy"
            src={windyUrl(horizon)}
            style={{ height: "100%", width: "100%", border: "none", borderRadius: 16, display: "block" }}
            loading="lazy"
          />
          <div style={windyCaption}>previsão Windy · linha do tempo interativa</div>
        </>
      )}
    </div>
  );
}

// ── controls (brand tokens; mono on the day numbers) ────────────────────────────

const controlGroup: CSSProperties = {
  position: "absolute", top: 10, right: 10, zIndex: 1000,
  display: "flex", gap: 4, padding: 3, borderRadius: 999,
  background: "rgba(5, 7, 13, 0.78)", border: "1px solid var(--line)",
  backdropFilter: "blur(8px)",
};
const segBtn: CSSProperties = {
  fontFamily: "inherit", fontSize: 11.5, cursor: "pointer",
  color: "var(--muted)", background: "transparent",
  border: "none", borderRadius: 999, padding: "4px 10px",
};
const segActive: CSSProperties = {
  color: "var(--bg)", background: "var(--cyan)", fontWeight: 600,
};
const numFont: CSSProperties = { fontFamily: "var(--font-mono)" };
const windyCaption: CSSProperties = {
  position: "absolute", left: 10, bottom: 10, zIndex: 1000,
  fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--faint)",
  background: "rgba(5, 7, 13, 0.78)", padding: "3px 8px", borderRadius: 8,
  pointerEvents: "none",
};
