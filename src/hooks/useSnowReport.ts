import { useEffect, useState } from "react";
import type { SnowReport } from "../data/snowReport";

/**
 * Live trail/lift status from the serverless scraper (Bloco 6). Fail-soft: if the
 * endpoint is unavailable (e.g. local `vite` dev without functions) it resolves to
 * null and the UI shows the soft fallback. The edge cache (s-maxage=3600) means the
 * official site is hit at most once an hour regardless of how many users call this.
 */
export function useSnowReport(resortId: string) {
  const [report, setReport] = useState<SnowReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setReport(null);
    fetch(`/api/snow-report?resort=${encodeURIComponent(resortId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: SnowReport | null) => { if (!cancelled) setReport(d); })
      .catch(() => { if (!cancelled) setReport(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [resortId]);

  return { report, loading };
}
