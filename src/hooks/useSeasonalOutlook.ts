import { useEffect, useMemo, useState } from "react";
import { RESORTS } from "../data/resorts";
import { computeSeasonalScore, type SeasonalResult } from "../engine/seasonalScore";
import { fetchForecast, clearForecastCache, type ForecastResponse } from "../data/forecastClient";
import { computeScore, DEFAULT_WEIGHTS, type ScoreBreakdown } from "../scoring/score";
import { leadDaysTo } from "../data/liveRefine";

export type DataMode = "forecast" | "seasonal";

export interface OutlookRow {
  resort: (typeof RESORTS)[number];
  mode: DataMode;
  rank: number;
  /** Unified 0–100 score used for ranking, regardless of mode. */
  score: number;
  // seasonal-only
  result?: SeasonalResult;
  // forecast-only
  breakdown?: ScoreBreakdown;
  forecast?: ForecastResponse;
}

export function useSeasonalOutlook(targetDate: string, region: string | null) {
  const leadDays = leadDaysTo(targetDate);
  const mode: DataMode = leadDays <= 15 ? "forecast" : "seasonal";
  const today = new Date().toISOString().slice(0, 10);

  const resorts = useMemo(
    () => (region ? RESORTS.filter((r) => r.region === region) : RESORTS),
    [region]
  );

  const [rows, setRows] = useState<OutlookRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;
    clearForecastCache();
    setLoading(true);
    setProgress(0);
    setRows([]);

    const run = async () => {
      const out: Omit<OutlookRow, "rank">[] = [];

      for (let i = 0; i < resorts.length; i++) {
        if (cancelled) return;
        const resort = resorts[i];

        if (mode === "forecast") {
          try {
            const forecast = await fetchForecast(resort.lat, resort.lon, resort.id);
            const breakdown = computeScore(resort, targetDate, forecast.hourly, DEFAULT_WEIGHTS, today);
            out.push({ resort, mode, score: breakdown.total, breakdown, forecast });
          } catch {
            // skip on network failure
          }
        } else {
          const result = computeSeasonalScore(resort, { targetDate });
          out.push({ resort, mode, score: result.score, result });
        }

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
  }, [targetDate, mode, resorts, today]);

  return { rows, loading, progress, mode, leadDays };
}
