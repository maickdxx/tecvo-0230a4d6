import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";

export const Scene3Features = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const dashSpring = spring({ frame: frame - 10, fps, config: { damping: 15, stiffness: 80 } });
  const dashScale = interpolate(dashSpring, [0, 1], [0.85, 1]);
  const dashOpacity = interpolate(dashSpring, [0, 1], [0, 1]);

  const quoteSpring = spring({ frame, fps, config: { damping: 18 } });

  const features = [
    { icon: "📅", title: "Agenda inteligente", desc: "Agendamentos automáticos", delay: 40 },
    { icon: "👥", title: "Gestão de clientes", desc: "Histórico completo", delay: 55 },
    { icon: "📊", title: "Financeiro integrado", desc: "Receitas e despesas", delay: 70 },
    { icon: "📱", title: "Ordens de serviço", desc: "Do orçamento ao laudo", delay: 85 },
  ];

  const glowPulse = Math.sin(frame * 0.04) * 0.3 + 0.7;

  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", padding: 60 }}>
      <div style={{
        position: "absolute", top: 100, left: "50%",
        transform: "translateX(-50%)", width: 700, height: 500,
        borderRadius: "50%",
        background: `radial-gradient(circle, rgba(37,71,208,${glowPulse * 0.15}) 0%, transparent 70%)`,
      }} />

      <div style={{
        marginTop: 60, textAlign: "center", marginBottom: 40,
        opacity: interpolate(quoteSpring, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(quoteSpring, [0, 1], [20, 0])}px)`,
      }}>
        <div style={{ fontFamily: "sans-serif", fontSize: 46, fontWeight: 700, color: "#E8EAF0", lineHeight: 1.3 }}>
          "Aí descobri a Tecvo..."
        </div>
        <div style={{ fontFamily: "sans-serif", fontSize: 30, fontWeight: 400, color: "#2547D0", marginTop: 12 }}>
          E tudo mudou.
        </div>
      </div>

      <div style={{ transform: `scale(${dashScale})`, opacity: dashOpacity, marginBottom: 30 }}>
        <Img src={staticFile("images/dashboard.png")} style={{ width: 750, height: 500, objectFit: "contain", borderRadius: 24 }} />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, justifyContent: "center", maxWidth: 900 }}>
        {features.map((f, i) => {
          const s = spring({ frame: frame - f.delay, fps, config: { damping: 14 } });
          return (
            <div key={i} style={{
              width: 420, background: "rgba(37,71,208,0.1)",
              border: "1px solid rgba(37,71,208,0.2)", borderRadius: 20,
              padding: "24px 28px",
              opacity: interpolate(s, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(s, [0, 1], [30, 0])}px)`,
              display: "flex", alignItems: "center", gap: 18,
            }}>
              <span style={{ fontSize: 42 }}>{f.icon}</span>
              <div>
                <div style={{ fontFamily: "sans-serif", fontSize: 28, fontWeight: 700, color: "#E8EAF0" }}>{f.title}</div>
                <div style={{ fontFamily: "sans-serif", fontSize: 22, fontWeight: 400, color: "rgba(232,234,240,0.5)" }}>{f.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
