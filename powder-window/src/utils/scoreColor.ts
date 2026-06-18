// Score → color ramp (red → amber → cyan → bright blue) for markers and accents.
export function scoreColor(score: number): string {
  const s = Math.max(0, Math.min(100, score));
  if (s >= 70) return "#38bdf8"; // bright sky — prime
  if (s >= 55) return "#22d3ee"; // cyan — good
  if (s >= 40) return "#a3e635"; // lime — fair
  if (s >= 25) return "#fbbf24"; // amber — marginal
  return "#fb7185";              // rose — poor
}

export function scoreLabel(score: number): string {
  if (score >= 70) return "Excelente";
  if (score >= 55) return "Bom";
  if (score >= 40) return "Razoável";
  if (score >= 25) return "Marginal";
  return "Fraco";
}
