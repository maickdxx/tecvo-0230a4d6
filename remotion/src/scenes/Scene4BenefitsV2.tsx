import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

export const Scene4BenefitsV2 = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleSpring = spring({ frame, fps, config: { damping: 20 } });

  const stats = [
    { value: "3h", label: "economizadas\npor dia", delay: 20, color: "#2547D0", accent: "rgba(37,71,208,0.15)" },
    { value: "100%", label: "digital\nsem papel", delay: 45, color: "#10B981", accent: "rgba(16,185,129,0.15)" },
    { value: "2x", label: "mais clientes\natendidos", delay: 70, color: "#F59E0B", accent: "rgba(245,158,11,0.15)" },
  ];

  // Animated counter effect for numbers
  const testimonialSpring = spring({ frame: frame - 120, fps, config: { damping: 15 } });

  // Decorative animated ring
  const ringRotation = frame * 0.2;
  const ringScale = interpolate(
    spring({ frame: frame - 10, fps, config: { damping: 15, stiffness: 60 } }),
    [0, 1], [0, 1]
  );

  return (
    <AbsoluteFill>
      {/* Decorative ring */}
      <div style={{
        position: "absolute",
        top: "50%", left: "50%",
        width: 700, height: 700,
        border: "1px solid rgba(37,71,208,0.08)",
        borderRadius: "50%",
        transform: `translate(-50%, -50%) rotate(${ringRotation}deg) scale(${ringScale})`,
      }}>
        {/* Dot on ring */}
        <div style={{
          position: "absolute", top: -5, left: "50%",
          width: 10, height: 10, borderRadius: "50%",
          background: "#2547D0", marginLeft: -5,
        }} />
      </div>

      <div style={{
        position: "absolute",
        top: "50%", left: "50%",
        width: 500, height: 500,
        border: "1px solid rgba(245,158,11,0.06)",
        borderRadius: "50%",
        transform: `translate(-50%, -50%) rotate(${-ringRotation * 0.7}deg) scale(${ringScale})`,
      }} />

      {/* Title */}
      <div style={{
        position: "absolute", top: 160, left: 70, right: 70, textAlign: "center",
        opacity: interpolate(titleSpring, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(titleSpring, [0, 1], [25, 0])}px)`,
      }}>
        <div style={{
          fontFamily: "sans-serif", fontSize: 50, fontWeight: 800,
          color: "#F0F2F8", lineHeight: 1.2, letterSpacing: -1,
        }}>
          Os resultados vieram{"\n"}rápido.
        </div>
      </div>

      {/* Stats - vertical stack with large numbers */}
      <div style={{
        position: "absolute", top: 400, left: 70, right: 70,
        display: "flex", flexDirection: "column", gap: 50,
      }}>
        {stats.map((s, i) => {
          const sp = spring({ frame: frame - s.delay, fps, config: { damping: 12, stiffness: 90 } });

          // Number counter animation
          const counterProgress = interpolate(sp, [0, 1], [0, 1]);

          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 30,
              opacity: interpolate(sp, [0, 1], [0, 1]),
              transform: `translateX(${interpolate(sp, [0, 1], [100, 0])}px)`,
            }}>
              {/* Number with glow */}
              <div style={{ position: "relative", minWidth: 220, textAlign: "right" }}>
                {/* Glow behind number */}
                <div style={{
                  position: "absolute", inset: -20,
                  background: s.accent,
                  borderRadius: "50%",
                  filter: "blur(30px)",
                  opacity: counterProgress,
                }} />
                <div style={{
                  position: "relative",
                  fontFamily: "sans-serif", fontSize: 100, fontWeight: 900,
                  color: s.color, letterSpacing: -4,
                  textShadow: `0 0 40px ${s.color}40`,
                }}>
                  {s.value}
                </div>
              </div>

              {/* Label */}
              <div style={{
                fontFamily: "sans-serif", fontSize: 30, fontWeight: 400,
                color: "rgba(240,242,248,0.6)", lineHeight: 1.3,
                whiteSpace: "pre-line",
              }}>
                {s.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom testimonial */}
      <div style={{
        position: "absolute", bottom: 130, left: 70, right: 70, textAlign: "center",
        opacity: interpolate(testimonialSpring, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(testimonialSpring, [0, 1], [20, 0])}px)`,
      }}>
        <div style={{
          fontFamily: "sans-serif", fontSize: 28, fontWeight: 400,
          fontStyle: "italic", color: "rgba(240,242,248,0.4)", lineHeight: 1.5,
        }}>
          "Hoje consigo gerenciar tudo{"\n"}pelo celular, de qualquer lugar."
        </div>
        <div style={{
          width: 50, height: 3, borderRadius: 2,
          background: "rgba(37,71,208,0.3)",
          margin: "20px auto 0",
        }} />
      </div>
    </AbsoluteFill>
  );
};
