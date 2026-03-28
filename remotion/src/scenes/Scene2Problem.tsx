import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

const problems = [
  { emoji: "📋", text: "Serviços anotados no papel" },
  { emoji: "💸", text: "Sem controle financeiro" },
  { emoji: "📱", text: "Clientes esperando resposta" },
  { emoji: "🗓️", text: "Manutenções esquecidas" },
];

export const Scene2Problem = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleSpring = spring({ frame, fps, config: { damping: 20 } });
  const shakeX = frame > 25 && frame < 40 ? Math.sin(frame * 1.5) * 3 : 0;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 70 }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ fontFamily: "sans-serif", fontSize: 18, fontWeight: 600, color: "#EF4444", opacity: interpolate(titleSpring, [0, 1], [0, 1]), marginBottom: 14, letterSpacing: 2, textTransform: "uppercase" }}>
          ⚠️ O problema
        </div>
        <h2 style={{
          fontFamily: "sans-serif", fontSize: 42, fontWeight: 800, color: "#E8EAF0", lineHeight: 1.2,
          opacity: interpolate(titleSpring, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(titleSpring, [0, 1], [20, 0])}px)`,
        }}>
          Você está no{" "}
          <span style={{ color: "#EF4444", transform: `translateX(${shakeX}px)`, display: "inline-block" }}>controle</span>
          {" "}ou no <span style={{ color: "#EF4444" }}>caos</span>?
        </h2>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%" }}>
        {problems.map((p, i) => {
          const cardSpring = spring({ frame: frame - 20 - i * 10, fps, config: { damping: 15 } });
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 16, padding: "18px 24px", borderRadius: 14,
              background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)",
              opacity: interpolate(cardSpring, [0, 1], [0, 1]),
              transform: `translateX(${interpolate(cardSpring, [0, 1], [50, 0])}px)`,
            }}>
              <span style={{ fontSize: 30 }}>{p.emoji}</span>
              <span style={{ fontFamily: "sans-serif", fontSize: 20, fontWeight: 600, color: "#E8EAF0" }}>{p.text}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
