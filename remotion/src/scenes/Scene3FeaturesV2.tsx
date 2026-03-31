import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";

export const Scene3FeaturesV2 = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Dashboard reveal with 3D perspective
  const dashReveal = spring({ frame: frame - 15, fps, config: { damping: 18, stiffness: 70, mass: 1.2 } });
  const dashRotateX = interpolate(dashReveal, [0, 1], [25, 0]);
  const dashScale = interpolate(dashReveal, [0, 1], [0.7, 1]);
  const dashY = interpolate(dashReveal, [0, 1], [100, 0]);

  // Title
  const titleSpring = spring({ frame, fps, config: { damping: 20 } });

  // Feature cards - orbit-like entrance
  const features = [
    { icon: "📅", title: "Agenda inteligente", desc: "Agendamentos automáticos com notificação", delay: 60, color: "#2547D0" },
    { icon: "👥", title: "Gestão de clientes", desc: "Histórico completo em um clique", delay: 80, color: "#3B82F6" },
    { icon: "📊", title: "Financeiro integrado", desc: "Receitas, despesas e relatórios", delay: 100, color: "#F59E0B" },
    { icon: "📱", title: "Ordens de serviço", desc: "Do orçamento ao laudo técnico", delay: 120, color: "#10B981" },
  ];

  // Glow behind dashboard
  const glowPulse = Math.sin(frame * 0.04) * 0.3 + 0.7;

  // Decorative tech grid lines
  const gridProgress = interpolate(frame, [0, 60], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      {/* Accent glow behind dashboard */}
      <div style={{
        position: "absolute",
        top: 280, left: "50%",
        transform: "translateX(-50%)",
        width: 800, height: 500,
        borderRadius: "50%",
        background: `radial-gradient(ellipse, rgba(37,71,208,${glowPulse * 0.2}) 0%, transparent 60%)`,
        filter: "blur(40px)",
      }} />

      {/* Title */}
      <div style={{
        position: "absolute", top: 100, left: 70, right: 70,
        opacity: interpolate(titleSpring, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(titleSpring, [0, 1], [25, 0])}px)`,
      }}>
        <div style={{
          fontFamily: "sans-serif", fontSize: 48, fontWeight: 800,
          color: "#F0F2F8", lineHeight: 1.2, letterSpacing: -1,
        }}>
          Aí descobri a Tecvo...
        </div>
        <div style={{
          fontFamily: "sans-serif", fontSize: 32, fontWeight: 500,
          color: "#2547D0", marginTop: 10,
          opacity: interpolate(
            spring({ frame: frame - 15, fps, config: { damping: 18 } }),
            [0, 1], [0, 1]
          ),
        }}>
          E tudo mudou.
        </div>
      </div>

      {/* Dashboard with 3D perspective reveal */}
      <div style={{
        position: "absolute", top: 260, left: "50%",
        transform: `translateX(-50%) perspective(1200px) rotateX(${dashRotateX}deg) scale(${dashScale}) translateY(${dashY}px)`,
        opacity: interpolate(dashReveal, [0, 0.3], [0, 1]),
        transformOrigin: "center top",
      }}>
        {/* Screen glow */}
        <div style={{
          position: "absolute", inset: -20,
          borderRadius: 36,
          background: "rgba(37,71,208,0.08)",
          filter: "blur(20px)",
        }} />

        {/* Dashboard frame */}
        <div style={{
          borderRadius: 24,
          overflow: "hidden",
          border: "2px solid rgba(37,71,208,0.3)",
          boxShadow: "0 20px 80px rgba(0,0,0,0.5), 0 0 40px rgba(37,71,208,0.15)",
        }}>
          <Img
            src={staticFile("images/dashboard.png")}
            style={{ width: 850, height: 520, objectFit: "cover" }}
          />
        </div>

        {/* Scanning line effect */}
        {frame > 20 && frame < 100 && (
          <div style={{
            position: "absolute",
            left: 0, right: 0,
            top: interpolate(frame - 20, [0, 80], [0, 520], { extrapolateRight: "clamp" }),
            height: 3,
            background: "linear-gradient(90deg, transparent, rgba(37,71,208,0.6), transparent)",
            filter: "blur(1px)",
          }} />
        )}
      </div>

      {/* Feature cards - 2x2 grid */}
      <div style={{
        position: "absolute", bottom: 80, left: 40, right: 40,
        display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center",
      }}>
        {features.map((f, i) => {
          const s = spring({ frame: frame - f.delay, fps, config: { damping: 14, stiffness: 100 } });
          const enterAngle = (i * 90) * (Math.PI / 180);
          const startX = Math.cos(enterAngle) * 200;
          const startY = Math.sin(enterAngle) * 200;

          return (
            <div key={i} style={{
              width: 470,
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${f.color}33`,
              borderRadius: 20, padding: "22px 24px",
              opacity: interpolate(s, [0, 1], [0, 1]),
              transform: `translate(${interpolate(s, [0, 1], [startX, 0])}px, ${interpolate(s, [0, 1], [startY, 0])}px)`,
              display: "flex", alignItems: "center", gap: 16,
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 14,
                background: `${f.color}18`,
                border: `1px solid ${f.color}30`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 30, flexShrink: 0,
              }}>
                {f.icon}
              </div>
              <div>
                <div style={{
                  fontFamily: "sans-serif", fontSize: 26, fontWeight: 700, color: "#F0F2F8",
                }}>
                  {f.title}
                </div>
                <div style={{
                  fontFamily: "sans-serif", fontSize: 18, fontWeight: 400,
                  color: "rgba(240,242,248,0.45)", marginTop: 2,
                }}>
                  {f.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
