import { describe, it, expect } from "vitest";
import { RESORTS } from "../data/resorts";
import { computeSeasonalScore } from "./seasonalScore";
import { forecastSdForLead } from "../data/liveRefine";

const byId = (id: string) => RESORTS.find((r) => r.id === id)!;

describe("seasonal engine", () => {
  it("ranks high windward, El-Niño-favored resorts above low/leeward ones", () => {
    const valle = computeSeasonalScore(byId("valle-nevado"));
    const chapelco = computeSeasonalScore(byId("chapelco"));
    expect(valle.score).toBeGreaterThan(chapelco.score);
    expect(valle.tone).toBe("good");
  });

  it("the confidence band collapses once a 16-day forecast enters", () => {
    const seasonalOnly = computeSeasonalScore(byId("valle-nevado"));
    const withForecast = computeSeasonalScore(byId("valle-nevado"), {
      forecastBase: 210,
      forecastSd: 8,
    });
    expect(withForecast.sd).toBeLessThan(seasonalOnly.sd);
    expect(withForecast.high - withForecast.low).toBeLessThan(
      seasonalOnly.high - seasonalOnly.low
    );
  });

  it("a warm anomaly hurts an exposed low base more than a high one", () => {
    // Same expected snow amount, but Chillán's base sits below the snow line.
    const chillan = computeSeasonalScore(byId("nevados-chillan"));
    const valle = computeSeasonalScore(byId("valle-nevado"));
    expect(chillan.rainExposure).toBeGreaterThan(valle.rainExposure);
    expect(chillan.qual).toBeLessThan(valle.qual);
  });

  it("high-variance resorts read as variable, not falsely confident", () => {
    const chillan = computeSeasonalScore(byId("nevados-chillan"));
    expect(["média", "baixa"]).toContain(chillan.confidence);
  });

  it("produces a defensible Andes ranking under the current El Niño", () => {
    const ranked = RESORTS.map((r) => ({ id: r.id, s: computeSeasonalScore(r).score }))
      .sort((a, b) => b.s - a.s)
      .map((x) => x.id);
    expect(ranked.slice(0, 2).sort()).toEqual(["portillo", "valle-nevado"].sort());
    expect(ranked.indexOf("valle-nevado")).toBeLessThan(ranked.indexOf("nevados-chillan"));
  });

  it("is continuous across the 16-day edge even when the forecast disagrees", () => {
    const v = byId("valle-nevado");
    const at = (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() + days);
      return d.toISOString().slice(0, 10);
    };
    const date17 = at(17); // pure seasonal (beyond the forecast window)
    const date15 = at(15); // forecast enters the same engine as one estimator

    const seasonal17 = computeSeasonalScore(v, { targetDate: date17 });
    // The hard case: Open-Meteo's point snow_depth is far THINNER than the
    // climatological base (e.g. 15 cm vs ~160 cm in early July). With a flat
    // tight σ this would crater the score and recreate the day-16 jump. The
    // lead-scaled σ keeps the edge smooth — the forecast barely perturbs the
    // estimate at lead 15 and only collapses the band as the day approaches.
    const forecast15 = computeSeasonalScore(v, {
      targetDate: date15,
      forecastBase: 15,
      forecastSd: forecastSdForLead(15),
    });

    expect(Math.abs(forecast15.score - seasonal17.score)).toBeLessThan(20);
    expect(forecast15.sd).toBeLessThan(seasonal17.sd);

    // ...and near term the forecast dominates and the band genuinely collapses.
    const forecast2 = computeSeasonalScore(v, {
      targetDate: at(2),
      forecastBase: 15,
      forecastSd: forecastSdForLead(2),
    });
    expect(forecast2.sd).toBeLessThan(forecast15.sd);
  });

  // ── Bloco 3 Parte A: the multi-term fusion ──────────────────────────────────

  it("disagrees with history when the current season is dry (anchor term)", () => {
    // Valle Nevado: history + El Niño both say "good year". But if THIS season is
    // running very dry, the anchor must drag the score below the no-anchor case —
    // the model disagreeing with the historical record is the whole point of 3.2.
    const v = byId("valle-nevado");
    const opts = { targetDate: "2026-08-15", leadDays: 5 };
    const withoutAnchor = computeSeasonalScore(v, opts);
    const withDryAnchor = computeSeasonalScore(v, { ...opts, currentAnomalyCm: -90 });

    expect(withDryAnchor.expectedBase).toBeLessThan(withoutAnchor.expectedBase);
    expect(withDryAnchor.score).toBeLessThan(withoutAnchor.score);
  });

  it("the current-state anomaly decays with lead time (near weighs more than far)", () => {
    const v = byId("valle-nevado");
    const common = { targetDate: "2026-08-15", currentAnomalyCm: 60 };
    const near = computeSeasonalScore(v, { ...common, leadDays: 7 });
    const far = computeSeasonalScore(v, { ...common, leadDays: 90 });
    // Same positive anomaly lifts the estimate more when the date is close.
    expect(near.expectedBase).toBeGreaterThan(far.expectedBase);
  });

  it("uses a real ERA5 historical base as a fusion term when provided", () => {
    const v = byId("valle-nevado");
    const real = computeSeasonalScore(v, { targetDate: "2026-08-15", historicalBase: { mean: 250, sd: 6 } });
    const synth = computeSeasonalScore(v, { targetDate: "2026-08-15" });
    // A much deeper real history pulls the expected base above the synthetic one.
    expect(real.expectedBase).toBeGreaterThan(synth.expectedBase);
    expect(real.sources.some((s) => s.includes("ERA5"))).toBe(true);
    // ...but it is only a TERM: the analog still tempers it, so it doesn't reach 250.
    expect(real.expectedBase).toBeLessThan(250);
  });

  it("varies by date: August peak beats June ramp-up beats October melt", () => {
    const v = byId("valle-nevado");
    const june = computeSeasonalScore(v, { targetDate: "2026-06-15" });
    const august = computeSeasonalScore(v, { targetDate: "2026-08-15" });
    const october = computeSeasonalScore(v, { targetDate: "2026-10-15" });
    // Base depth follows the season curve
    expect(august.expectedBase).toBeGreaterThan(june.expectedBase);
    expect(june.expectedBase).toBeGreaterThan(october.expectedBase);
    // Scores must differ across the season (the bug was identical numbers)
    expect(august.score).not.toBe(october.score);
    // October's higher snow line raises rain exposure vs deep winter
    expect(october.expectedSnowLine).toBeGreaterThan(august.expectedSnowLine);
  });
});
