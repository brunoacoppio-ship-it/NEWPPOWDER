import { CURRENT_ONI, ensoPhase } from "../data/enso";

export function EnsoBanner() {
  const phase = ensoPhase(CURRENT_ONI);
  const favorable = CURRENT_ONI >= 0.5;
  return (
    <div
      className="glass"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 16px",
        borderColor: favorable ? "var(--glow-cyan)" : undefined,
      }}
    >
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 500,
        color: "var(--cyan-bright)", whiteSpace: "nowrap",
        background: "var(--favored-soft)", padding: "6px 10px", borderRadius: 8,
      }}>
        ONI {CURRENT_ONI > 0 ? "+" : ""}{CURRENT_ONI.toFixed(1)}
      </div>
      <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
        <strong style={{ fontWeight: 600, color: "var(--ink)" }}>{phase.label} {phase.strength}.</strong>{" "}
        Favorece os Andes centrais chilenos (mais rios atmosféricos) e eleva a linha de neve nas
        bases baixas — vantagem para barlavento e cota alta.
      </div>
    </div>
  );
}
