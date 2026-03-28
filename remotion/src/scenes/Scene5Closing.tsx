import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

export const Scene5Closing = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo
  const logoSpring = spring({ frame, fps, config: { damping: 12, stiffness: 80 } });

  // Tagline
  const tagSpring = spring({ frame: frame - 15, fps, config: { damping: 18 } });

  // URL
  const urlOpacity = interpolate(frame, [40, 55], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Pulsing glow
  const glowPulse = Math.sin(frame * 0.06) * 0.3 + 0.7;

  // Accent particles
  const particles = Array.from({ length: 6 }, (_, i) => ({
    x: 960 + Math.cos(frame * 0.02 + i * 1.05) * (200 + i * 60),
    y: 540 + Math.sin(frame * 0.025 + i * 0.8) * (150 + i * 40),
    size: 4 + i * 2,
    opacity: 0.15 + Math.sin(frame * 0.03 + i) * 0.1,
  }));

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      {/* Glow behind logo */}
      <div
        style={{
          position: "absolute",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(37,71,208,0.2) 0%, transparent 70%)",
          opacity: glowPulse,
        }}
      />

      {/* Floating particles */}
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            background: "#2547D0",
            opacity: p.opacity,
          }}
        />
      ))}

      <div style={{ textAlign: "center", zIndex: 1 }}>
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
            marginBottom: 40,
            opacity: interpolate(logoSpring, [0, 1], [0, 1]),
            transform: `scale(${interpolate(logoSpring, [0, 1], [0.5, 1])})`,
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 20,
              background: "#2547D0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 60px rgba(37,71,208,0.4)",
            }}
          >
            <span style={{ color: "white", fontWeight: 900, fontSize: 42, fontFamily: "sans-serif" }}>T</span>
          </div>
          <span style={{ fontFamily: "sans-serif", fontWeight: 800, fontSize: 64, color: "#E8EAF0", letterSpacing: -1 }}>
            tecvo
          </span>
        </div>

        {/* Tagline */}
        <p
          style={{
            fontFamily: "sans-serif",
            fontSize: 32,
            fontWeight: 500,
            color: "rgba(232,234,240,0.7)",
            opacity: interpolate(tagSpring, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(tagSpring, [0, 1], [20, 0])}px)`,
            marginBottom: 30,
          }}
        >
          Gestão inteligente para empresas de climatização
        </p>

        {/* URL */}
        <div
          style={{
            fontFamily: "sans-serif",
            fontSize: 24,
            fontWeight: 600,
            color: "#2547D0",
            opacity: urlOpacity,
            letterSpacing: 1,
          }}
        >
          tecvo.com.br
        </div>
      </div>
    </AbsoluteFill>
  );
};
