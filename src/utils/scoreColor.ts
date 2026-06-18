// Score → brand color ramp. Stays inside the identity palette: bright cyan for
// prime, descending the cyan→blue gradient, then slate neutral for low scores.
// No green/rose — score is encoded by brightness, not by leaving the palette.
export function scoreColor(score: number): string {
  const s = Math.max(0, Math.min(100, score));
  if (s >= 70) return "#5be2ff"; // cyan-bright — prime
  if (s >= 55) return "#2dd4f8"; // cyan — good
  if (s >= 40) return "#2a7fde"; // blue — fair
  if (s >= 25) return "#8da0bd"; // neutral slate — marginal
  return "#5e6e8c";              // faint slate — poor
}

export function scoreLabel(score: number): string {
  if (score >= 70) return "Excelente";
  if (score >= 55) return "Bom";
  if (score >= 40) return "Razoável";
  if (score >= 25) return "Marginal";
  return "Fraco";
}
