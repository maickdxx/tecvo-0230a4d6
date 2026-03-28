import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

const features = [
  { icon: "📋", title: "Ordens de Serviço", desc: "Crie, agende e acompanhe\ncada serviço em tempo real", color: "#2547D0" },
  { icon: "💬", title: "WhatsApp Integrado", desc: "Atenda seus clientes\ndiretamente pelo sistema", color: "#25D366" },
  { icon: "💰", title: "Controle Financeiro", desc: "Receitas, despesas e\nfluxo de caixa completo", color: "#F59E0B" },
];

export const Scene3Features = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleSpring = spring({ frame, fps, config: { damping: 20 } });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 60 }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ fontFamily: "sans-serif", fontSize: 15, fontWeight: 600, color: "#2547D0", letterSpacing: 3, textTransform: "uppercase", opacity: interpolate(titleSpring, [0, 1], [0, 1]), marginBottom: 10 }}>
          ✦ Funcionalidades
        </div>
        <h2 style={{ fontFamily: "sans-serif", fontSize: 40, fontWeight: 800, color: "#E8EAF0", opacity: interpolate(titleSpring, [0, 1], [0, 1]), transform: `translateY(${interpolate(titleSpring, [0, 1], [15, 0])}px)` }}>
          Tudo em um <span style={{ color: "#2547D0" }}>só lugar</span>
        </h2>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%" }}>
        {features.map((f, i) => {
          const cardSpring = spring({ frame: frame - 20 - i * 12, fps, config: { damping: 14 } });
          const floatY = Math.sin((frame + i * 20) * 0.04) * 3;
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 20, padding: "24px 28px", borderRadius: 18,
              background: "rgba(255,255,255,0.03)", border: `1px solid ${f.color}22`,
              opacity: interpolate(cardSpring, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(cardSpring, [0, 1], [40, 0]) + floatY}px)`,
            }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: `${f.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0 }}>
                {f.icon}
              </div>
              <div>
                <h3 style={{ fontFamily: "sans-serif", fontSize: 22, fontWeight: 700, color: "#E8EAF0", marginBottom: 4 }}>{f.title}</h3>
                <p style={{ fontFamily: "sans-serif", fontSize: 15, color: "rgba(232,234,240,0.5)", lineHeight: 1.4, whiteSpace: "pre-line" }}>{f.desc}</p>
              </div>
              <div style={{ position: "absolute", right: 28, width: interpolate(cardSpring, [0, 1], [0, 50]), height: 2, background: f.color, borderRadius: 1, opacity: 0.5 }} />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
