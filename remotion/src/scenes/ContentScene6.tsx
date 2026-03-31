import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

// Scene 6: "Se você é técnico... experimenta a Tecvo"
export const ContentScene6 = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const ctaSpring = spring({ frame: frame - 10, fps, config: { damping: 18, stiffness: 120 } });
  const ctaScale = interpolate(ctaSpring, [0, 1], [1.3, 1]);

  const logoSpring = spring({ frame: frame - 60, fps, config: { damping: 12, stiffness: 100 } });
  const logoPulse = Math.sin(frame * 0.08) * 0.05 + 1;

  const vidaSpring = spring({ frame: frame - 120, fps, config: { damping: 14 } });

  const ringScale = interpolate(frame, [60, 180], [0.8, 1.1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ringOpacity = Math.sin(frame * 0.04) * 0.2 + 0.3;

  // Particles
  const particles = Array.from({ length: 10 }, (_, i) => {
    const angle = (i / 10) * Math.PI * 2;
    const burstSpring = spring({ frame: frame - 65, fps, config: { damping: 20 } });
    const radius = interpolate(burstSpring, [0, 1], [0, 100 + (i % 3) * 40]);
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      opacity: interpolate(burstSpring, [0, 0.5, 1], [0, 1, 0.3]),
      size: 3 + (i % 3) * 2,
    };
  });

  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #0a0f1e 0%, #0c1a2e 50%, #0a0f1e 100%)" }}>
      <div style={{
        position: "absolute", top: "30%", left: "50%", transform: "translate(-50%, -50%)",
        width: 400, height: 400, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(37,71,208,0.12) 0%, transparent 70%)",
      }} />

      {/* CTA text */}
      <div style={{
        position: "absolute", top: 100, left: 40, right: 40, textAlign: "center",
        opacity: interpolate(ctaSpring, [0, 1], [0, 1]),
        transform: `scale(${ctaScale})`,
      }}>
        <div style={{
          fontFamily: "sans-serif", fontSize: 42, fontWeight: 800,
          color: "#F0F2F8", lineHeight: 1.35,
        }}>
          Se você é técnico,{"\n"}
          <span style={{ color: "#F59E0B" }}>experimenta a Tecvo.</span>
        </div>
      </div>

      {/* Glowing ring */}
      <div style={{
        position: "absolute", top: "38%", left: "50%",
        transform: `translate(-50%, -50%) scale(${ringScale})`,
        width: 240, height: 240, borderRadius: "50%",
        border: `2px solid rgba(37,71,208,${ringOpacity})`,
        boxShadow: `0 0 35px rgba(37,71,208,${ringOpacity * 0.5})`,
      }} />

      {/* Tecvo logo */}
      <div style={{
        position: "absolute", top: "38%", left: "50%",
        transform: `translate(-50%, -50%) scale(${interpolate(logoSpring, [0, 1], [0.3, logoPulse])})`,
        opacity: interpolate(logoSpring, [0, 1], [0, 1]),
      }}>
        <div style={{
          background: "linear-gradient(135deg, #2547D0, #1a3ab5)",
          borderRadius: 24, padding: "22px 48px",
          boxShadow: "0 0 70px rgba(37,71,208,0.4)",
        }}>
          <span style={{ fontFamily: "sans-serif", fontSize: 50, fontWeight: 900, color: "white", letterSpacing: 4 }}>TECVO</span>
        </div>
      </div>

      {/* Particles */}
      {particles.map((p, i) => (
        <div key={i} style={{
          position: "absolute", top: `calc(38% + ${p.y}px)`, left: `calc(50% + ${p.x}px)`,
          width: p.size, height: p.size, borderRadius: "50%",
          background: i % 2 === 0 ? "#2547D0" : "#F59E0B",
          opacity: p.opacity,
        }} />
      ))}

      {/* "Vai mudar tua vida" */}
      <div style={{
        position: "absolute", top: "58%", left: 40, right: 40, textAlign: "center",
        opacity: interpolate(vidaSpring, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(vidaSpring, [0, 1], [20, 0])}px)`,
      }}>
        <div style={{
          fontFamily: "sans-serif", fontSize: 32, fontWeight: 600,
          color: "rgba(240,242,248,0.7)", lineHeight: 1.5,
        }}>
          Sério, vai mudar tua vida{"\n"}como mudou a minha.
        </div>
      </div>

      {/* Website */}
      <div style={{
        position: "absolute", bottom: 260, left: "50%", transform: "translateX(-50%)",
        opacity: interpolate(vidaSpring, [0, 1], [0, 0.7]),
        fontFamily: "sans-serif", fontSize: 20, fontWeight: 500,
        color: "rgba(255,255,255,0.4)", letterSpacing: 2,
      }}>
        tecvo.com.br
      </div>
    </AbsoluteFill>
  );
};
