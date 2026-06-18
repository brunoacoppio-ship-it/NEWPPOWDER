# Powder Window — Snow Forecast Intelligence

Professional ski conditions dashboard. Ranks ski resorts by predicted snow quality for any target date, learning from every search.

## Highlights

- **Live forecasts** from Open-Meteo (free, no API key)
- **Composite 0–100 score**: fresh snow + base depth + snow quality + above-snowline terrain + confidence
- **Self-feeding cache**: every search persists to localStorage — the dataset grows with usage; works offline against cached data
- **Interactive map** linked to the ranked list (hover/select sync)
- **Detail panel** with cumulative snow chart + elevation profile
- **Adjustable weights** with live re-ranking
- **Best nearby date** suggestion within ±5 days
- **Region filter**, search counter, cache age indicator, beyond-forecast warning

## Run locally

```bash
cd powder-window
npm install
npm run dev       # http://localhost:5173 (hot-reload dev)
npm run build     # production bundle in dist/
npm run preview   # serve the built bundle locally
npm run test      # Vitest unit tests
```

## Sharing on your local network

```bash
npm run build
npm run preview -- --host
```

Vite prints a Network URL like `http://192.168.x.x:4173/` — open that on any phone/laptop on the same Wi-Fi.

## Deploying

The output in `dist/` is fully static. Drop it on any host:

- **Vercel / Netlify**: connect the repo or drag-drop the `dist/` folder
- **GitHub Pages**: push `dist/` to a `gh-pages` branch
- **Cloudflare Pages / S3 / nginx**: copy `dist/*` to your web root

No backend or env vars required — the browser calls Open-Meteo directly.

## How the score works

```
score = 100 × confidence × (
  0.40 × freshSnow      +
  0.20 × baseDepth      +
  0.25 × snowQuality    +
  0.15 × aboveSnowline
)
```

- **freshSnow** — 72h snow accumulation, normalized 0–50 cm → 0–1
- **baseDepth** — snow depth on target date, 0–150 cm → 0–1
- **snowQuality** — `qualityTemp × (1 − rainExposure)` where rainExposure is the fraction of vertical below freezing level
- **aboveSnowline** — fraction of vertical above freezing level
- **confidence** — 1.0 within 3 days, decays linearly to 0.6 at 16 days

Weights are adjustable at runtime via the **⚖ Weights** panel.

## Adding more resorts

Edit [`src/data/resorts.ts`](src/data/resorts.ts):

```ts
{
  id: "my-resort",
  name: "My Resort",
  country: "US",           // ISO 2-letter code
  region: "North America", // used by the region filter
  lat: 39.5,
  lon: -106.1,
  baseElevation: 2500,     // meters
  topElevation: 3900,      // meters
}
```

If the country flag is new, add it to `COUNTRY_FLAGS`.

## Cache behavior

- All forecasts persist in `localStorage` under `powder-window:forecasts:v1`
- TTL is 1 hour — after that, a network refresh runs; stale cache is used as fallback if the network fails
- Search counter persists in `powder-window:search-count`
- Hit the **⟲** button in the header to clear all cached data
