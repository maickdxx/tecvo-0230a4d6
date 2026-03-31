import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";

export const Scene2Problem = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const deskScale = interpolate(frame, [0, 150], [1, 1.15], { extrapolateRight: "clamp" });
  const deskOpacity = interpolate(frame, [0, 20], [0, 0.5], { extrapolateRight: "clamp" });

  const problems = [
    { text: "📋 Agendas perdidas", delay: 15 },
    { text: "📞 Clientes sem retorno", delay: 30 },
    { text: "💸 Financeiro no papel", delay: 45 },
    { text: "⏰ Horas desperdiçadas", delay: 60 },
  ];

  const xAppear = spring({ frame: frame - 80, fps, config: { damping: 10 } });
  const quoteSpring = spring({ frame: frame - 5, fps, config: { damping: 18 } });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 60 }}>
      <div style={{
        position: "absolute", inset: 0,
        opacity: deskOpacity,
        transform: `scale(${deskScale})`,
      }}>
        <Img src={staticFile("images/messy-desk.png")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(10,14,26,0.85) 0%, rgba(10,14,26,0.95) 100%)" }} />
      </div>

      <div style={{
        position: "absolute", top: 120, left: 80, right: 80,
        opacity: interpolate(quoteSpring, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(quoteSpring, [0, 1], [20, 0])}px)`,
      }}>
        <div style={{ fontFamily: "sans-serif", fontSize: 48, fontWeight: 700, color: "#E8EAF0", lineHeight: 1.3 }}>
          "Meu dia era assim..."
        </div>
        <div style={{ width: 80, height: 4, background: "#F59E0B", borderRadius: 2, marginTop: 20 }} />
      </div>

      <div style={{
        position: "absolute", top: 350, left: 80, right: 80,
        display: "flex", flexDirection: "column", gap: 28,
      }}>
        {problems.map((p, i) => {
          const s = spring({ frame: frame - p.delay, fps, config: { damping: 15, stiffness: 100 } });
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 20,
              opacity: interpolate(s, [0, 1], [0, 1]),
              transform: `translateX(${interpolate(s, [0, 1], [-60, 0])}px)`,
            }}>
              <div style={{
                background: "rgba(239,68,68,0.15)",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 20, padding: "22px 35px", flex: 1,
              }}>
                <span style={{ fontFamily: "sans-serif", fontSize: 38, color: "#E8EAF0", fontWeight: 500 }}>{p.text}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        position: "absolute", bottom: 120, right: 100,
        opacity: interpolate(xAppear, [0, 1], [0, 0.6]),
        transform: `scale(${interpolate(xAppear, [0, 1], [3, 1])}) rotate(${interpolate(xAppear, [0, 1], [45, 0])}deg)`,
        fontFamily: "sans-serif", fontSize: 200, fontWeight: 900, color: "rgba(239,68,68,0.25)",
      }}>
        ✕
      </div>
    </AbsoluteFill>
  );
};
