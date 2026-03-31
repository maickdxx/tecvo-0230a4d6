import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

// "Aí um amigo meu falou: cara, experimenta a Tecvo..."
export const TestimonialScene2 = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const camX = Math.sin(frame * 0.006) * 5;

  // Phone mockup entrance
  const phoneSpring = spring({ frame: frame - 10, fps, config: { damping: 18, stiffness: 100 } });
  const phoneY = interpolate(phoneSpring, [0, 1], [200, 0]);

  // Chat bubble
  const bubble1 = spring({ frame: frame - 40, fps, config: { damping: 14 } });
  const bubble2 = spring({ frame: frame - 70, fps, config: { damping: 14 } });

  // Tecvo logo glow
  const logoSpring = spring({ frame: frame - 120, fps, config: { damping: 12, stiffness: 80 } });
  const logoPulse = Math.sin(frame * 0.06) * 0.15 + 0.85;

  // Thinking emoji
  const thinkSpring = spring({ frame: frame - 160, fps, config: { damping: 10 } });

  // "Resolvi testar" text
  const testSpring = spring({ frame: frame - 200, fps, config: { damping: 20, stiffness: 120 } });

  return (
    <AbsoluteFill style={{
      background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
      transform: `translateX(${camX}px)`,
    }}>
      {/* Ambient glow */}
      <div style={{
        position: "absolute", top: "40%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: 400, height: 400, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(37,71,208,0.1) 0%, transparent 70%)",
      }} />

      {/* Title */}
      <div style={{
        position: "absolute", top: 120, left: 60, right: 60,
        fontFamily: "sans-serif", fontSize: 44, fontWeight: 700,
        color: "#94a3b8", lineHeight: 1.4,
        opacity: interpolate(phoneSpring, [0, 1], [0, 1]),
      }}>
        Um amigo disse...
      </div>

      {/* Chat bubbles */}
      <div style={{
        position: "absolute", top: 260, left: 60, right: 60,
      }}>
        {/* Friend's message */}
        <div style={{
          opacity: interpolate(bubble1, [0, 1], [0, 1]),
          transform: `translateX(${interpolate(bubble1, [0, 1], [-40, 0])}px)`,
          marginBottom: 20,
        }}>
          <div style={{
            background: "rgba(255,255,255,0.08)",
            borderRadius: "24px 24px 24px 4px",
            padding: "24px 32px", maxWidth: 500,
            fontFamily: "sans-serif", fontSize: 32, fontWeight: 500,
            color: "#e2e8f0", lineHeight: 1.5,
          }}>
            Cara, experimenta a{" "}
            <span style={{ color: "#2547D0", fontWeight: 700 }}>Tecvo</span>.
            {"\n"}Mudou meu trabalho todo.
          </div>
          <div style={{
            fontFamily: "sans-serif", fontSize: 16, color: "rgba(255,255,255,0.3)",
            marginTop: 6, marginLeft: 16,
          }}>
            Amigo técnico • 14:32
          </div>
        </div>

        {/* Carlos response */}
        <div style={{
          opacity: interpolate(bubble2, [0, 1], [0, 1]),
          transform: `translateX(${interpolate(bubble2, [0, 1], [40, 0])}px)`,
          display: "flex", flexDirection: "column", alignItems: "flex-end",
        }}>
          <div style={{
            background: "rgba(37,71,208,0.2)",
            border: "1px solid rgba(37,71,208,0.3)",
            borderRadius: "24px 24px 4px 24px",
            padding: "24px 32px", maxWidth: 500,
            fontFamily: "sans-serif", fontSize: 32, fontWeight: 500,
            color: "#e2e8f0", lineHeight: 1.5,
          }}>
            Ah, mais um sisteminha...{"\n"}🤔 Mas vou testar.
          </div>
          <div style={{
            fontFamily: "sans-serif", fontSize: 16, color: "rgba(255,255,255,0.3)",
            marginTop: 6, marginRight: 16,
          }}>
            Carlos • 14:35
          </div>
        </div>
      </div>

      {/* Tecvo logo appearance */}
      <div style={{
        position: "absolute", bottom: 250, left: "50%",
        transform: `translateX(-50%) scale(${interpolate(logoSpring, [0, 1], [0.5, logoPulse])})`,
        opacity: interpolate(logoSpring, [0, 1], [0, 1]),
      }}>
        <div style={{
          background: "linear-gradient(135deg, #2547D0, #1a3ab5)",
          borderRadius: 24, padding: "20px 50px",
          boxShadow: "0 0 60px rgba(37,71,208,0.3)",
        }}>
          <span style={{
            fontFamily: "sans-serif", fontSize: 48, fontWeight: 900,
            color: "white", letterSpacing: 3,
          }}>TECVO</span>
        </div>
      </div>

      {/* "Resolvi testar" */}
      <div style={{
        position: "absolute", bottom: 140, left: "50%",
        transform: `translateX(-50%) translateY(${interpolate(testSpring, [0, 1], [30, 0])}px)`,
        opacity: interpolate(testSpring, [0, 1], [0, 1]),
        fontFamily: "sans-serif", fontSize: 36, fontWeight: 600,
        color: "#F59E0B",
      }}>
        Resolvi testar ✨
      </div>
    </AbsoluteFill>
  );
};
