import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

// Scene 1: "Antes da Tecvo, meu dia era um caos total..."
export const ContentScene1 = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleSpring = spring({ frame: frame - 10, fps, config: { damping: 18, stiffness: 120 } });
  const titleScale = interpolate(titleSpring, [0, 1], [1.2, 1]);

  // Chaos elements
  const chaos1 = spring({ frame: frame - 90, fps, config: { damping: 15 } });
  const chaos2 = spring({ frame: frame - 120, fps, config: { damping: 15 } });
  const chaos3 = spring({ frame: frame - 150, fps, config: { damping: 15 } });
  const paper1Y = Math.sin(frame * 0.03) * 15;
  const paper2Y = Math.cos(frame * 0.025) * 12;
  const paper1Rot = Math.sin(frame * 0.02) * 8;
  const paper2Rot = Math.cos(frame * 0.018) * 10;

  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #0a0f1e 0%, #111827 100%)" }}>
      {/* Red ambient glow */}
      <div style={{
        position: "absolute", top: -80, right: -80,
        width: 400, height: 400, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(239,68,68,0.1) 0%, transparent 70%)",
      }} />

      {/* Big quote mark */}
      <div style={{
        position: "absolute", top: 60, left: 40,
        fontFamily: "Georgia, serif", fontSize: 180,
        color: "rgba(239,68,68,0.08)", lineHeight: 0.8,
        opacity: interpolate(titleSpring, [0, 1], [0, 1]),
      }}>"</div>

      {/* Title */}
      <div style={{
        position: "absolute", top: 120, left: 60, right: 60,
        opacity: interpolate(titleSpring, [0, 1], [0, 1]),
        transform: `scale(${titleScale})`,
      }}>
        <div style={{
          fontFamily: "sans-serif", fontSize: 52, fontWeight: 800,
          color: "#F0F2F8", lineHeight: 1.3, letterSpacing: -1,
        }}>
          Antes da Tecvo,{"\n"}meu dia era um{"\n"}
          <span style={{ color: "#EF4444" }}>caos total.</span>
        </div>
      </div>

      {/* Floating chaos papers */}
      <div style={{
        position: "absolute", top: 480, left: 60,
        opacity: interpolate(chaos1, [0, 1], [0, 0.6]),
        transform: `translateY(${paper1Y}px) rotate(${paper1Rot}deg) scale(${interpolate(chaos1, [0, 1], [0.5, 1])})`,
      }}>
        <div style={{
          width: 150, height: 90, borderRadius: 12,
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
          padding: 14,
        }}>
          <div style={{ width: 90, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.15)", marginBottom: 7 }} />
          <div style={{ width: 70, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.1)", marginBottom: 7 }} />
          <div style={{ width: 50, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.08)" }} />
        </div>
      </div>

      <div style={{
        position: "absolute", top: 520, right: 50,
        opacity: interpolate(chaos2, [0, 1], [0, 0.5]),
        transform: `translateY(${paper2Y}px) rotate(${paper2Rot}deg)`,
      }}>
        <div style={{
          width: 130, height: 80, borderRadius: 12,
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)",
          padding: 12,
        }}>
          <div style={{ width: 80, height: 5, borderRadius: 3, background: "rgba(239,68,68,0.2)", marginBottom: 7 }} />
          <div style={{ width: 60, height: 5, borderRadius: 3, background: "rgba(239,68,68,0.15)" }} />
        </div>
      </div>

      <div style={{
        position: "absolute", top: 680, left: "50%",
        opacity: interpolate(chaos3, [0, 1], [0, 0.4]),
        transform: `translateX(-50%) rotate(${-paper1Rot * 0.7}deg)`,
      }}>
        <div style={{ fontFamily: "sans-serif", fontSize: 36, color: "rgba(239,68,68,0.3)" }}>📋 📞 😤</div>
      </div>
    </AbsoluteFill>
  );
};
