// Oceanic Niño Index (ONI), JJA season — the Southern-Hemisphere ski winter.
// Positive = El Niño (favors central Chilean Andes), negative = La Niña.
// Historical values are approximate seasonal means; current is this year's state.

export interface OniYear {
  year: number;
  oni: number;
}

export const ONI_HISTORY: OniYear[] = [
  { year: 2000, oni: -0.6 }, { year: 2001, oni: -0.1 }, { year: 2002, oni: 0.9 },
  { year: 2003, oni: 0.2 }, { year: 2004, oni: 0.6 }, { year: 2005, oni: 0.2 },
  { year: 2006, oni: 0.1 }, { year: 2007, oni: -0.3 }, { year: 2008, oni: -0.4 },
  { year: 2009, oni: 0.5 }, { year: 2010, oni: -0.6 }, { year: 2011, oni: -0.4 },
  { year: 2012, oni: 0.3 }, { year: 2013, oni: -0.4 }, { year: 2014, oni: 0.0 },
  { year: 2015, oni: 1.2 }, { year: 2016, oni: -0.2 }, { year: 2017, oni: 0.1 },
  { year: 2018, oni: 0.1 }, { year: 2019, oni: 0.5 }, { year: 2020, oni: -0.4 },
  { year: 2021, oni: -0.5 }, { year: 2022, oni: -0.9 }, { year: 2023, oni: 0.8 },
  { year: 2024, oni: 0.1 }, { year: 2025, oni: -0.2 },
];

/** Current-year ENSO state for the upcoming winter. */
export const CURRENT_ONI = 1.3; // moderate-to-strong El Niño, 2026

/** Kernel bandwidth for analog weighting (in ONI units). */
const TAU = 0.5;

/** Gaussian similarity weight between a historical year and the current state. */
export function analogWeight(oni: number, current: number = CURRENT_ONI): number {
  const d = oni - current;
  return Math.exp(-(d * d) / (2 * TAU * TAU));
}

export function ensoPhase(oni: number = CURRENT_ONI): {
  label: string;
  strength: string;
} {
  const a = Math.abs(oni);
  const strength = a < 0.5 ? "fraco" : a < 1.0 ? "moderado" : a < 1.5 ? "moderado a forte" : "forte";
  if (oni >= 0.5) return { label: "El Niño", strength };
  if (oni <= -0.5) return { label: "La Niña", strength };
  return { label: "Neutro", strength: "" };
}
