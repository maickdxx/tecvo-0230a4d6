import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Sequence } from "remotion";

const features = [
  {
    icon: "📋",
    title: "Ordens de Serviço",
    desc: "Crie, agende e acompanhe\ncada serviço em tempo real",
    color: "#2547D0",
  },
  {
    icon: "💬",
    title: "WhatsApp Integrado",
    desc: "Atenda seus clientes\ndiretamente pelo sistema",
    color: "#25D366",
  },
  {
    icon: "💰",
    title: "Controle Financeiro",
    desc: "Receitas, despesas e\nfluxo de caixa completo",
    color: "#F59E0B",
  },
];

export const Scene3Features = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleSpring = spring({ frame, fps, config: { damping: 20 } });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 120px" }}>
      {/* Section title */}
      <div style={{ textAlign: "center", marginBottom: 60 }}>
        <div
          style={{
            fontFamily: "sans-serif",
            fontSize: 18,
            fontWeight: 600,
            color: "#2547D0",
            letterSpacing: 3,
            textTransform: "uppercase",
            opacity: interpolate(titleSpring, [0, 1], [0, 1]),
            marginBottom: 12,
          }}
        >
          ✦ Funcionalidades
        </div>
        <h2
          style={{
            fontFamily: "sans-serif",
            fontSize: 52,
            fontWeight: 800,
            color: "#E8EAF0",
            opacity: interpolate(titleSpring, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(titleSpring, [0, 1], [20, 0])}px)`,
          }}
        >
          Tudo em um <span style={{ color: "#2547D0" }}>só lugar</span>
        </h2>
      </div>

      {/* Feature cards */}
      <div style={{ display: "flex", gap: 40, justifyContent: "center" }}>
        {features.map((f, i) => {
          const cardSpring = spring({ frame: frame - 25 - i * 12, fps, config: { damping: 14 } });
          const floatY = Math.sin((frame + i * 20) * 0.04) * 4;
          return (
            <div
              key={i}
              style={{
                width: 420,
                padding: "48px 40px",
                borderRadius: 24,
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${f.color}22`,
                backdropFilter: undefined,
                opacity: interpolate(cardSpring, [0, 1], [0, 1]),
                transform: `translateY(${interpolate(cardSpring, [0, 1], [50, 0]) + floatY}px) scale(${interpolate(cardSpring, [0, 1], [0.9, 1])})`,
                textAlign: "center",
              }}
            >
              {/* Icon circle */}
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 20,
                  background: `${f.color}15`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 24px",
                  fontSize: 36,
                }}
              >
                {f.icon}
              </div>
              <h3
                style={{
                  fontFamily: "sans-serif",
                  fontSize: 26,
                  fontWeight: 700,
                  color: "#E8EAF0",
                  marginBottom: 12,
                }}
              >
                {f.title}
              </h3>
              <p
                style={{
                  fontFamily: "sans-serif",
                  fontSize: 18,
                  color: "rgba(232,234,240,0.5)",
                  lineHeight: 1.5,
                  whiteSpace: "pre-line",
                }}
              >
                {f.desc}
              </p>

              {/* Bottom accent line */}
              <div
                style={{
                  width: interpolate(cardSpring, [0, 1], [0, 80]),
                  height: 3,
                  background: f.color,
                  borderRadius: 2,
                  margin: "28px auto 0",
                  opacity: 0.6,
                }}
              />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
