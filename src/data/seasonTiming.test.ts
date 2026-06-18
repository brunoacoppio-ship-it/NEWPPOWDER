import { describe, it, expect } from "vitest";
import {
  theilSen, projectSeasonEvent, reconstructSeason, median, doyToDate,
  type YearValue,
} from "./seasonTiming";

describe("season timing (item 3.6)", () => {
  it("Theil-Sen recovers a known slope and shrugs off an outlier year", () => {
    const clean: YearValue[] = [
      { x: 2000, y: 100 }, { x: 2001, y: 102 }, { x: 2002, y: 104 },
      { x: 2003, y: 106 }, { x: 2004, y: 108 },
    ];
    expect(theilSen(clean).slope).toBeCloseTo(2, 6);

    // One freak year (a huge late opening) must not move the robust slope.
    const withOutlier: YearValue[] = [...clean, { x: 2005, y: 320 }];
    expect(theilSen(withOutlier).slope).toBeCloseTo(2, 1);
  });

  it("projects a LATER date than the historical median when the trend delays", () => {
    // Openings drifting ~0.5 day/yr later over 15 years.
    const series: YearValue[] = [];
    for (let i = 0; i < 15; i++) series.push({ x: 2010 + i, y: 160 + 0.5 * i });

    const proj = projectSeasonEvent(series, 2026)!;
    const medY = median(series.map((p) => p.y));

    expect(proj.predictedDoy).toBeGreaterThan(medY);
    expect(proj.slopePerDecade).toBeCloseTo(5, 6); // 0.5/yr × 10
    // It's a window, not a point.
    expect(proj.highDoy).toBeGreaterThan(proj.lowDoy);
  });

  it("returns null with too few years (fail-soft for thin data)", () => {
    expect(projectSeasonEvent([{ x: 2020, y: 100 }, { x: 2021, y: 101 }], 2026)).toBeNull();
  });

  it("reconstructs open/close day-of-year from a daily depth series", () => {
    // Synthesize 2020: base climbs past 40 cm around DOY 160 and melts out by 280.
    const daily = new Map<string, number>();
    const iso = (doy: number) => doyToDate(2020, doy).toISOString().slice(0, 10);
    for (let doy = 1; doy <= 366; doy++) {
      const cm = doy >= 160 && doy <= 280 ? 80 : 5; // clearly skiable in the window
      daily.set(iso(doy), cm);
    }
    const { open, close } = reconstructSeason(daily, [2020]);

    expect(open).toHaveLength(1);
    expect(close).toHaveLength(1);
    expect(open[0].y).toBe(160);   // first day of the 5-day ≥40 run
    expect(close[0].y).toBe(280);  // last day ≥40
  });

  it("contributes no point for a year that never reaches a skiable base", () => {
    const daily = new Map<string, number>();
    const iso = (doy: number) => doyToDate(2019, doy).toISOString().slice(0, 10);
    for (let doy = 1; doy <= 365; doy++) daily.set(iso(doy), 10); // never ≥40
    const { open, close } = reconstructSeason(daily, [2019]);
    expect(open).toHaveLength(0);
    expect(close).toHaveLength(0);
  });
});
