import { describe, it, expect } from "vitest";
import { RESORTS } from "../data/resorts";
import { computeSeasonalScore } from "./seasonalScore";

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
