import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

// Scene 2: "Aí um amigo falou: cara, experimenta a Tecvo..."
export const ContentScene2 = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bubble1 = spring({ frame: frame - 20, fps, config: { damping: 14 } });
  const bubble2 = spring({ frame: frame - 60, fps, config: { damping: 14 } });
  const logoSpring = spring({ frame: frame - 140, fps, config: { damping: 12, stiffness: 80 } });
  const logoPulse = Math.sin(frame * 0.06) * 0.1 + 0.9;

  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)" }}>
      <div style={{
        position: "absolute", top: "35%", left: "50%", transform: "translate(-50%, -50%)",
        width: 350, height: 350, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(37,71,208,0.1) 0%, transparent 70%)",
      }} />

      <div style={{
        position: "absolute", top: 80, left: 60,
        fontFamily: "sans-serif", fontSize: 40, fontWeight: 700,
        color: "#94a3b8", opacity: interpolate(bubble1, [0, 1], [0, 1]),
      }}>Um amigo disse...</div>

      {/* Chat bubbles */}
      <div style={{ position: "absolute", top: 200, left: 50, right: 50 }}>
        <div style={{
          opacity: interpolate(bubble1, [0, 1], [0, 1]),
          transform: `translateX(${interpolate(bubble1, [0, 1], [-30, 0])}px)`,
          marginBottom: 16,
        }}>
          <div style={{
            background: "rgba(255,255,255,0.08)", borderRadius: "22px 22px 22px 4px",
            padding: "20px 28px", maxWidth: 450,
            fontFamily: "sans-serif", fontSize: 28, fontWeight: 500,
            color: "#e2e8f0", lineHeight: 1.4,
          }}>
            Cara, experimenta a <span style={{ color: "#2547D0", fontWeight: 700 }}>Tecvo</span>.{"\n"}Mudou meu trabalho todo.
          </div>
          <div style={{ fontFamily: "sans-serif", fontSize: 14, color: "rgba(255,255,255,0.3)", marginTop: 5, marginLeft: 14 }}>
            Amigo técnico • 14:32
          </div>
        </div>

        <div style={{
          opacity: interpolate(bubble2, [0, 1], [0, 1]),
          transform: `translateX(${interpolate(bubble2, [0, 1], [30, 0])}px)`,
          display: "flex", flexDirection: "column", alignItems: "flex-end",
        }}>
          <div style={{
            background: "rgba(37,71,208,0.2)", border: "1px solid rgba(37,71,208,0.3)",
            borderRadius: "22px 22px 4px 22px", padding: "20px 28px", maxWidth: 450,
            fontFamily: "sans-serif", fontSize: 28, fontWeight: 500,
            color: "#e2e8f0", lineHeight: 1.4,
          }}>
            Ah, mais um sisteminha...{"\n"}🤔 Mas vou testar.
          </div>
          <div style={{ fontFamily: "sans-serif", fontSize: 14, color: "rgba(255,255,255,0.3)", marginTop: 5, marginRight: 14 }}>
            Carlos • 14:35
          </div>
        </div>
      </div>

      {/* Tecvo logo */}
      <div style={{
        position: "absolute", bottom: 280, left: "50%",
        transform: `translateX(-50%) scale(${interpolate(logoSpring, [0, 1], [0.4, logoPulse])})`,
        opacity: interpolate(logoSpring, [0, 1], [0, 1]),
      }}>
        <div style={{
          background: "linear-gradient(135deg, #2547D0, #1a3ab5)",
          borderRadius: 22, padding: "18px 44px",
          boxShadow: "0 0 50px rgba(37,71,208,0.3)",
        }}>
          <span style={{ fontFamily: "sans-serif", fontSize: 42, fontWeight: 900, color: "white", letterSpacing: 3 }}>
            TECVO
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
