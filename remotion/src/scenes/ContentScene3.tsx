import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";

// Scene 3: "Mudou tudo. Agenda, orçamento, WhatsApp, OS automática..."
export const ContentScene3 = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleSpring = spring({ frame: frame - 5, fps, config: { damping: 18, stiffness: 120 } });
  const titleScale = interpolate(titleSpring, [0, 1], [1.3, 1]);

  const features = [
    { icon: "📅", label: "Agenda\nOrganizada", delay: 50, color: "#3B82F6" },
    { icon: "📋", label: "Serviços\ndo Dia", delay: 100, color: "#10B981" },
    { icon: "💰", label: "Orçamento\nem 2 min", delay: 150, color: "#F59E0B" },
    { icon: "💬", label: "Envia pelo\nWhatsApp", delay: 200, color: "#22C55E" },
    { icon: "🔄", label: "Vira OS\nAutomático", delay: 250, color: "#8B5CF6" },
  ];

  const dashSpring = spring({ frame: frame - 320, fps, config: { damping: 15, stiffness: 80 } });
  const dashY = interpolate(dashSpring, [0, 1], [250, 0]);

  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #0a1628 0%, #0f1d32 100%)" }}>
      {/* Scan line */}
      <div style={{
        position: "absolute", left: 0, right: 0,
        top: interpolate(frame % 200, [0, 200], [-50, 1200], { extrapolateRight: "clamp" }),
        height: 2,
        background: "linear-gradient(90deg, transparent, rgba(37,71,208,0.15), transparent)",
      }} />

      {/* Title */}
      <div style={{
        position: "absolute", top: 80, left: 50, right: 50,
        opacity: interpolate(titleSpring, [0, 1], [0, 1]),
        transform: `scale(${titleScale})`,
      }}>
        <div style={{
          fontFamily: "sans-serif", fontSize: 50, fontWeight: 900,
          color: "#F0F2F8", lineHeight: 1.2, letterSpacing: -2,
        }}>
          E mano,{"\n"}
          <span style={{
            background: "linear-gradient(90deg, #2547D0, #3B82F6)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>mudou tudo.</span>
        </div>
      </div>

      {/* Feature cards */}
      <div style={{
        position: "absolute", top: 280, left: 30, right: 30,
        display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center",
      }}>
        {features.map((f, i) => {
          const s = spring({ frame: frame - f.delay, fps, config: { damping: 14, stiffness: 100 } });
          const float = Math.sin((frame + i * 30) * 0.04) * 4;
          return (
            <div key={i} style={{
              width: i < 3 ? "calc(33% - 12px)" : "calc(50% - 8px)",
              opacity: interpolate(s, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(s, [0, 1], [50, float])}px) scale(${interpolate(s, [0, 1], [0.8, 1])})`,
            }}>
              <div style={{
                background: `linear-gradient(135deg, ${f.color}15, ${f.color}08)`,
                border: `1px solid ${f.color}30`,
                borderRadius: 18, padding: "22px 14px", textAlign: "center",
              }}>
                <div style={{ fontSize: 38, marginBottom: 8 }}>{f.icon}</div>
                <div style={{
                  fontFamily: "sans-serif", fontSize: 18, fontWeight: 600,
                  color: "#e2e8f0", lineHeight: 1.3, whiteSpace: "pre-line",
                }}>{f.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dashboard screenshot */}
      <div style={{
        position: "absolute", bottom: 180, left: 30, right: 30,
        opacity: interpolate(dashSpring, [0, 1], [0, 1]),
        transform: `translateY(${dashY}px) perspective(800px) rotateX(5deg)`,
        borderRadius: 18, overflow: "hidden",
        boxShadow: "0 16px 50px rgba(0,0,0,0.5)",
      }}>
        <Img src={staticFile("images/dashboard.png")}
          style={{ width: "100%", height: 280, objectFit: "cover", objectPosition: "top" }} />
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(180deg, transparent 50%, rgba(10,22,40,0.9) 100%)",
        }} />
      </div>
    </AbsoluteFill>
  );
};
