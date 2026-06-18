// Item 5.2 — live webcams via the Windy Webcams API (v3).
//
// The API key lives in VITE_WINDY_WEBCAMS_KEY. With no key, no nearby camera, or
// any network error, every function returns an empty list — the UI then simply
// hides the section. Nothing here can break the app.

const KEY = import.meta.env.VITE_WINDY_WEBCAMS_KEY;
const BASE = "https://api.windy.com/webcams/api/v3/webcams";

export interface Webcam {
  id: string;
  title: string;
  /** Thumbnail/preview still image URL. */
  thumb: string;
  /** Link to the live feed / Windy detail page (with attribution). */
  link: string;
}

/** True when a key is configured — lets the UI decide whether to even try. */
export const hasWebcamKey = (): boolean => !!KEY;

export async function fetchWebcams(
  lat: number, lon: number, radiusKm = 25, limit = 3
): Promise<Webcam[]> {
  if (!KEY || typeof fetch === "undefined") return [];
  try {
    const url = `${BASE}?nearby=${lat},${lon},${radiusKm}&limit=${limit}&include=images,urls`;
    const res = await fetch(url, { headers: { "x-windy-api-key": KEY } });
    if (!res.ok) return [];
    const json = await res.json();
    const list: unknown[] = json?.webcams ?? [];
    return list
      .map((raw): Webcam => {
        const w = raw as {
          webcamId?: number | string; id?: number | string; title?: string;
          images?: { current?: { preview?: string; thumbnail?: string }; daylight?: { preview?: string } };
          urls?: { detail?: string; provider?: string };
        };
        const wid = String(w.webcamId ?? w.id ?? "");
        return {
          id: wid,
          title: w.title ?? "Webcam",
          thumb: w.images?.current?.preview ?? w.images?.current?.thumbnail
            ?? w.images?.daylight?.preview ?? "",
          link: w.urls?.detail ?? (wid ? `https://www.windy.com/webcams/${wid}` : "https://www.windy.com/webcams"),
        };
      })
      .filter((w) => w.thumb); // drop entries with no usable image
  } catch {
    return [];
  }
}
