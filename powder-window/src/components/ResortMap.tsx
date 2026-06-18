import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import { useEffect } from "react";
import type { OutlookRow } from "../hooks/useSeasonalOutlook";
import { scoreColor } from "../utils/scoreColor";

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

export function ResortMap({
  rows, selectedId, onSelect,
}: {
  rows: OutlookRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const selected = rows.find((r) => r.resort.id === selectedId) ?? null;

  return (
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
  );
}
