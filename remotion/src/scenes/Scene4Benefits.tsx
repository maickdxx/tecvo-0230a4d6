import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

const benefits = [
  { icon: "✅", text: "Mais organização" },
  { icon: "📈", text: "Mais produtividade" },
  { icon: "💰", text: "Mais lucro" },
  { icon: "🔄", text: "Clientes que voltam" },
];

export const Scene4Benefits = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleSpring = spring({ frame, fps, config: { damping: 18 } });
  const counterVal = Math.round(interpolate(frame, [30, 80], [0, 10], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 60 }}>
      <div style={{ textAlign: "center", marginBottom: 60 }}>
        <div style={{
          fontFamily: "sans-serif", fontSize: 180, fontWeight: 900, color: "#2547D0", lineHeight: 1,
          opacity: interpolate(titleSpring, [0, 1], [0, 1]),
          transform: `scale(${interpolate(titleSpring, [0, 1], [0.7, 1])})`,
        }}>
          {counterVal}x
        </div>
        <p style={{
          fontFamily: "sans-serif", fontSize: 32, color: "rgba(232,234,240,0.7)", fontWeight: 500, marginTop: 10,
          opacity: interpolate(frame, [35, 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}>
          mais eficiência na gestão
        </p>
      </div>

      <h3 style={{ fontFamily: "sans-serif", fontSize: 48, fontWeight: 800, color: "#E8EAF0", marginBottom: 30, textAlign: "center", opacity: interpolate(titleSpring, [0, 1], [0, 1]) }}>
        Resultado <span style={{ color: "#22C55E" }}>real</span>
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%" }}>
        {benefits.map((b, i) => {
          const itemSpring = spring({ frame: frame - 25 - i * 8, fps, config: { damping: 16 } });
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 20, padding: "22px 28px", borderRadius: 16,
              background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.1)",
              opacity: interpolate(itemSpring, [0, 1], [0, 1]),
              transform: `translateX(${interpolate(itemSpring, [0, 1], [40, 0])}px)`,
            }}>
              <span style={{ fontSize: 36 }}>{b.icon}</span>
              <span style={{ fontFamily: "sans-serif", fontSize: 30, fontWeight: 600, color: "#E8EAF0" }}>{b.text}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
