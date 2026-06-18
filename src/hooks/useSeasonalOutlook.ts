import { useEffect, useMemo, useState } from "react";
import { RESORTS } from "../data/resorts";
import { computeSeasonalScore, type SeasonalResult } from "../engine/seasonalScore";
import {
  fetchForecast, summarizeForecast, windRiskLevel,
  type ForecastResponse, type WindRisk,
} from "../data/forecastClient";
import { leadDaysTo, forecastSdForLead } from "../data/liveRefine";

export type DataMode = "forecast" | "seasonal";

export interface OutlookRow {
  resort: (typeof RESORTS)[number];
  mode: DataMode;
  rank: number;
  /** Unified 0–100 score used for ranking. Always from the same engine. */
  score: number;
  /** The continuous engine output, present in both modes. */
  result: SeasonalResult;
  // forecast-window only (drives the 16-day chart + fresh-snow metric)
  forecast?: ForecastResponse;
  freshSnowCm?: number;
  /** Max wind over next 3 days — only set when leadDays ≤ 10 (2.2). */
  windRisk?: WindRisk;
}

export function useSeasonalOutlook(targetDate: string, region: string | null) {
  const leadDays = leadDaysTo(targetDate);
  const mode: DataMode = leadDays <= 15 ? "forecast" : "seasonal";

  const resorts = useMemo(
    () => (region ? RESORTS.filter((r) => r.region === region) : RESORTS),
    [region]
  );

  const [rows, setRows] = useState<OutlookRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setProgress(0);
    setRows([]);

    const run = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const out: Omit<OutlookRow, "rank">[] = [];

      for (let i = 0; i < resorts.length; i++) {
        if (cancelled) return;
        const resort = resorts[i];

        // Inside the 16-day window, the real forecast joins the engine as one
        // more estimator (it doesn't replace the formula). Network failure just
        // falls back to the pure seasonal estimate for that resort.
        let forecast: ForecastResponse | undefined;
        let forecastBase: number | undefined;
        let freshSnowCm: number | undefined;
        if (mode === "forecast") {
          try {
            forecast = await fetchForecast(resort.lat, resort.lon, resort.id, targetDate);
            const summary = summarizeForecast(forecast.hourly, targetDate);
            forecastBase = summary.baseDepthCm;
            freshSnowCm = summary.freshSnowCm;
          } catch {
            forecast = undefined;
          }
        }

        const result = computeSeasonalScore(resort, {
          targetDate,
          ...(forecastBase != null
            ? { forecastBase, forecastSd: forecastSdForLead(leadDays) }
            : {}),
        });

        // Wind risk: max windspeed_10m over next 72 h, only shown ≤10 days out.
        const windRisk: WindRisk | undefined =
          (mode === "forecast" && forecast && leadDays <= 10)
            ? windRiskLevel(forecast.hourly, today)
            : undefined;

        out.push({ resort, mode, score: result.score, result, forecast, freshSnowCm, windRisk });

        if (!cancelled) setProgress((i + 1) / resorts.length);
      }

      if (cancelled) return;

      const sorted = out
        .sort((a, b) => b.score - a.score)
        .map((r, i) => ({ ...r, rank: i + 1 }));

      setRows(sorted);
      setLoading(false);
    };

    run().catch(() => setLoading(false));
    return () => { cancelled = true; };
  }, [targetDate, mode, resorts]);

  return { rows, loading, progress, mode, leadDays };
}
