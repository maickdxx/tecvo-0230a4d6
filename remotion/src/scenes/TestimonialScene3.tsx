import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";

// "Mudou tudo. Agenda organizada, orçamento em 2 min, WhatsApp, OS automática..."
export const TestimonialScene3 = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const camY = Math.sin(frame * 0.004) * 4;

  // "Mudou tudo" title
  const titleSpring = spring({ frame: frame - 5, fps, config: { damping: 18, stiffness: 120 } });
  const titleScale = interpolate(titleSpring, [0, 1], [1.4, 1]);

  // Feature cards staggered
  const features = [
    { icon: "📅", label: "Agenda\nOrganizada", delay: 60, color: "#3B82F6" },
    { icon: "📋", label: "Serviços\ndo Dia", delay: 120, color: "#10B981" },
    { icon: "💰", label: "Orçamento\nem 2 min", delay: 180, color: "#F59E0B" },
    { icon: "💬", label: "Envia pelo\nWhatsApp", delay: 240, color: "#22C55E" },
    { icon: "🔄", label: "Vira OS\nAutomático", delay: 300, color: "#8B5CF6" },
  ];

  // Dashboard mockup
  const dashSpring = spring({ frame: frame - 350, fps, config: { damping: 15, stiffness: 80 } });
  const dashY = interpolate(dashSpring, [0, 1], [300, 0]);

  // Scan line effect
  const scanY = interpolate(frame % 200, [0, 200], [-50, 1970], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{
      background: "linear-gradient(180deg, #0a1628 0%, #0f1d32 100%)",
      transform: `translateY(${camY}px)`,
    }}>
      {/* Scan line */}
      <div style={{
        position: "absolute", left: 0, right: 0,
        top: scanY, height: 2,
        background: "linear-gradient(90deg, transparent, rgba(37,71,208,0.15), transparent)",
      }} />

      {/* Title */}
      <div style={{
        position: "absolute", top: 100, left: 60, right: 60,
        opacity: interpolate(titleSpring, [0, 1], [0, 1]),
        transform: `scale(${titleScale})`,
      }}>
        <div style={{
          fontFamily: "sans-serif", fontSize: 58, fontWeight: 900,
          color: "#F0F2F8", lineHeight: 1.2, letterSpacing: -2,
        }}>
          E mano,{"\n"}
          <span style={{
            background: "linear-gradient(90deg, #2547D0, #3B82F6)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>mudou tudo.</span>
        </div>
      </div>

      {/* Feature cards */}
      <div style={{
        position: "absolute", top: 320, left: 40, right: 40,
        display: "flex", flexWrap: "wrap", gap: 20,
        justifyContent: "center",
      }}>
        {features.map((f, i) => {
          const s = spring({ frame: frame - f.delay, fps, config: { damping: 14, stiffness: 100 } });
          const float = Math.sin((frame + i * 30) * 0.04) * 5;
          return (
            <div key={i} style={{
              width: i < 3 ? "calc(33% - 14px)" : "calc(50% - 10px)",
              opacity: interpolate(s, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(s, [0, 1], [60, float])}px) scale(${interpolate(s, [0, 1], [0.8, 1])})`,
            }}>
              <div style={{
                background: `linear-gradient(135deg, ${f.color}15, ${f.color}08)`,
                border: `1px solid ${f.color}30`,
                borderRadius: 20, padding: "28px 16px",
                textAlign: "center",
              }}>
                <div style={{ fontSize: 44, marginBottom: 10 }}>{f.icon}</div>
                <div style={{
                  fontFamily: "sans-serif", fontSize: 22, fontWeight: 600,
                  color: "#e2e8f0", lineHeight: 1.3, whiteSpace: "pre-line",
                }}>
                  {f.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dashboard screenshot */}
      <div style={{
        position: "absolute", bottom: 40, left: 40, right: 40,
        opacity: interpolate(dashSpring, [0, 1], [0, 1]),
        transform: `translateY(${dashY}px) perspective(800px) rotateX(5deg)`,
        borderRadius: 20, overflow: "hidden",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      }}>
        <Img src={staticFile("images/dashboard.png")}
          style={{ width: "100%", height: 400, objectFit: "cover", objectPosition: "top" }} />
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(180deg, transparent 50%, rgba(10,22,40,0.9) 100%)",
        }} />
      </div>
    </AbsoluteFill>
  );
};
