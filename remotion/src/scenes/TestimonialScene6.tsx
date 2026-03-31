import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";

// "Se você é técnico... experimenta a Tecvo. Vai mudar tua vida."
export const TestimonialScene6 = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Technician final appearance
  const techSpring = spring({ frame: frame - 5, fps, config: { damping: 16, stiffness: 70 } });
  const techY = interpolate(techSpring, [0, 1], [300, 0]);
  const breathe = Math.sin(frame * 0.05) * 3;

  // CTA text
  const ctaSpring = spring({ frame: frame - 40, fps, config: { damping: 18, stiffness: 120 } });
  const ctaScale = interpolate(ctaSpring, [0, 1], [1.3, 1]);

  // Tecvo logo
  const logoSpring = spring({ frame: frame - 80, fps, config: { damping: 12, stiffness: 100 } });
  const logoPulse = Math.sin(frame * 0.08) * 0.05 + 1;

  // "Vai mudar tua vida"
  const vidaSpring = spring({ frame: frame - 130, fps, config: { damping: 14 } });

  // Particle burst
  const particles = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI * 2;
    const burstSpring = spring({ frame: frame - 85, fps, config: { damping: 20 } });
    const radius = interpolate(burstSpring, [0, 1], [0, 120 + Math.random() * 80]);
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      opacity: interpolate(burstSpring, [0, 0.5, 1], [0, 1, 0.3]),
      size: 4 + (i % 3) * 3,
    };
  });

  // Glowing ring
  const ringScale = interpolate(frame, [80, 200], [0.8, 1.1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ringOpacity = Math.sin(frame * 0.04) * 0.2 + 0.3;

  return (
    <AbsoluteFill style={{
      background: "linear-gradient(180deg, #0a0f1e 0%, #0c1a2e 50%, #0a0f1e 100%)",
    }}>
      {/* Central glow */}
      <div style={{
        position: "absolute", top: "35%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: 500, height: 500, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(37,71,208,0.12) 0%, transparent 70%)",
      }} />

      {/* CTA text */}
      <div style={{
        position: "absolute", top: 130, left: 50, right: 50,
        textAlign: "center",
        opacity: interpolate(ctaSpring, [0, 1], [0, 1]),
        transform: `scale(${ctaScale})`,
      }}>
        <div style={{
          fontFamily: "sans-serif", fontSize: 46, fontWeight: 800,
          color: "#F0F2F8", lineHeight: 1.35,
        }}>
          Se você é técnico,{"\n"}
          <span style={{ color: "#F59E0B" }}>experimenta a Tecvo.</span>
        </div>
      </div>

      {/* Glowing ring */}
      <div style={{
        position: "absolute", top: "42%", left: "50%",
        transform: `translate(-50%, -50%) scale(${ringScale})`,
        width: 280, height: 280, borderRadius: "50%",
        border: `2px solid rgba(37,71,208,${ringOpacity})`,
        boxShadow: `0 0 40px rgba(37,71,208,${ringOpacity * 0.5})`,
      }} />

      {/* Tecvo logo */}
      <div style={{
        position: "absolute", top: "42%", left: "50%",
        transform: `translate(-50%, -50%) scale(${interpolate(logoSpring, [0, 1], [0.3, logoPulse])})`,
        opacity: interpolate(logoSpring, [0, 1], [0, 1]),
      }}>
        <div style={{
          background: "linear-gradient(135deg, #2547D0, #1a3ab5)",
          borderRadius: 28, padding: "26px 56px",
          boxShadow: "0 0 80px rgba(37,71,208,0.4)",
        }}>
          <span style={{
            fontFamily: "sans-serif", fontSize: 56, fontWeight: 900,
            color: "white", letterSpacing: 4,
          }}>TECVO</span>
        </div>
      </div>

      {/* Burst particles */}
      {particles.map((p, i) => (
        <div key={i} style={{
          position: "absolute",
          top: `calc(42% + ${p.y}px)`,
          left: `calc(50% + ${p.x}px)`,
          width: p.size, height: p.size,
          borderRadius: "50%",
          background: i % 2 === 0 ? "#2547D0" : "#F59E0B",
          opacity: p.opacity,
        }} />
      ))}

      {/* "Vai mudar tua vida" */}
      <div style={{
        position: "absolute", top: "62%", left: 50, right: 50,
        textAlign: "center",
        opacity: interpolate(vidaSpring, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(vidaSpring, [0, 1], [25, 0])}px)`,
      }}>
        <div style={{
          fontFamily: "sans-serif", fontSize: 36, fontWeight: 600,
          color: "rgba(240,242,248,0.7)", lineHeight: 1.5,
        }}>
          Sério, vai mudar tua vida{"\n"}como mudou a minha.
        </div>
      </div>

      {/* Technician */}
      <div style={{
        position: "absolute", bottom: -20, left: "50%",
        transform: `translateX(-50%) translateY(${techY + breathe}px)`,
        opacity: interpolate(techSpring, [0, 0.3], [0, 1]),
      }}>
        <Img src={staticFile("images/technician.png")}
          style={{ width: 500, height: 500, objectFit: "contain" }} />
      </div>

      {/* Website */}
      <div style={{
        position: "absolute", bottom: 60, left: "50%",
        transform: "translateX(-50%)",
        opacity: interpolate(vidaSpring, [0, 1], [0, 0.7]),
        fontFamily: "sans-serif", fontSize: 22, fontWeight: 500,
        color: "rgba(255,255,255,0.4)", letterSpacing: 2,
      }}>
        tecvo.com.br
      </div>
    </AbsoluteFill>
  );
};
