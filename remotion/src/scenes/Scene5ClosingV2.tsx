import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";

export const Scene5ClosingV2 = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Dramatic logo entrance
  const logoSpring = spring({ frame: frame - 10, fps, config: { damping: 10, stiffness: 80, mass: 1.5 } });
  const logoScale = interpolate(logoSpring, [0, 1], [0, 1]);
  const logoRotation = interpolate(logoSpring, [0, 1], [-15, 0]);

  // Tagline
  const tagSpring = spring({ frame: frame - 35, fps, config: { damping: 18 } });

  // CTA button with glow
  const ctaSpring = spring({ frame: frame - 55, fps, config: { damping: 14 } });

  // Testimonial
  const testSpring = spring({ frame: frame - 75, fps, config: { damping: 16 } });

  // Animated glow rays
  const rayAngle = frame * 0.4;
  const rayOpacity = interpolate(logoSpring, [0, 1], [0, 0.15]);

  // Pulsing CTA glow
  const ctaPulse = Math.sin(frame * 0.08) * 0.4 + 0.6;

  // Ambient particle burst on logo entrance
  const burstProgress = interpolate(frame, [10, 40], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      {/* Radial glow */}
      <div style={{
        position: "absolute",
        width: 1000, height: 1000,
        borderRadius: "50%",
        background: `radial-gradient(circle, rgba(37,71,208,${ctaPulse * 0.12}) 0%, transparent 50%)`,
        filter: "blur(20px)",
      }} />

      {/* Rotating ray burst */}
      {[0, 30, 60, 90, 120, 150].map((angle) => (
        <div key={angle} style={{
          position: "absolute",
          width: 2, height: 500,
          background: `linear-gradient(180deg, rgba(37,71,208,${rayOpacity}) 0%, transparent 100%)`,
          transform: `rotate(${angle + rayAngle}deg)`,
          transformOrigin: "center center",
        }} />
      ))}

      {/* Burst particles */}
      {burstProgress > 0 && burstProgress < 1 && Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const dist = burstProgress * 300;
        return (
          <div key={i} style={{
            position: "absolute",
            width: 6, height: 6, borderRadius: "50%",
            background: i % 2 === 0 ? "#2547D0" : "#F59E0B",
            transform: `translate(${Math.cos(a) * dist}px, ${Math.sin(a) * dist}px)`,
            opacity: 1 - burstProgress,
          }} />
        );
      })}

      {/* Logo group */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 25,
        transform: `scale(${logoScale}) rotate(${logoRotation}deg)`,
        opacity: interpolate(logoSpring, [0, 0.3], [0, 1]),
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* Logo icon */}
          <div style={{
            width: 90, height: 90, borderRadius: 22,
            background: "linear-gradient(135deg, #2547D0, #1a3ab5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 12px 40px rgba(37,71,208,0.5)",
          }}>
            <span style={{
              color: "white", fontWeight: 900, fontSize: 50, fontFamily: "sans-serif",
            }}>T</span>
          </div>
          {/* Logo text */}
          <span style={{
            fontFamily: "sans-serif", fontWeight: 800, fontSize: 72,
            color: "#F0F2F8", letterSpacing: -2,
          }}>
            tecvo
          </span>
        </div>
      </div>

      {/* Tagline */}
      <div style={{
        marginTop: 30, textAlign: "center",
        opacity: interpolate(tagSpring, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(tagSpring, [0, 1], [20, 0])}px)`,
      }}>
        <div style={{
          fontFamily: "sans-serif", fontSize: 34, fontWeight: 500,
          color: "rgba(240,242,248,0.7)", lineHeight: 1.4,
        }}>
          A gestão que o técnico{"\n"}merecia.
        </div>
      </div>

      {/* CTA */}
      <div style={{
        marginTop: 50,
        opacity: interpolate(ctaSpring, [0, 1], [0, 1]),
        transform: `scale(${interpolate(ctaSpring, [0, 1], [0.8, 1])})`,
      }}>
        {/* CTA glow */}
        <div style={{
          position: "absolute", inset: -15,
          borderRadius: 35,
          background: `rgba(37,71,208,${ctaPulse * 0.25})`,
          filter: "blur(20px)",
        }} />
        <div style={{
          position: "relative",
          background: "linear-gradient(135deg, #2547D0, #1a3ab5)",
          borderRadius: 24, padding: "22px 65px",
          boxShadow: "0 8px 30px rgba(37,71,208,0.4)",
        }}>
          <span style={{
            fontFamily: "sans-serif", fontSize: 34, fontWeight: 700, color: "white",
          }}>
            tecvo.com.br
          </span>
        </div>
      </div>

      {/* Bottom testimonial */}
      <div style={{
        position: "absolute", bottom: 90,
        display: "flex", alignItems: "center", gap: 18,
        opacity: interpolate(testSpring, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(testSpring, [0, 1], [30, 0])}px)`,
      }}>
        <Img
          src={staticFile("images/technician.png")}
          style={{ width: 80, height: 80, objectFit: "contain", borderRadius: 40 }}
        />
        <div>
          <div style={{
            fontFamily: "sans-serif", fontSize: 24, fontWeight: 400,
            color: "rgba(240,242,248,0.5)", fontStyle: "italic",
          }}>
            "Recomendo para todo técnico."
          </div>
          <div style={{
            fontFamily: "sans-serif", fontSize: 20, fontWeight: 600,
            color: "#2547D0", marginTop: 4,
          }}>
            — Carlos Silva, Técnico HVAC
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
