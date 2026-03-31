import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";

// "Olha, eu vou ser sincero contigo. Antes da Tecvo, meu dia era um caos total..."
export const TestimonialScene1 = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const camX = Math.sin(frame * 0.005) * 6;
  const camY = Math.cos(frame * 0.004) * 4;

  // Technician entrance
  const techSpring = spring({ frame: frame - 5, fps, config: { damping: 14, stiffness: 60, mass: 1.5 } });
  const techY = interpolate(techSpring, [0, 1], [400, 0]);
  const techOpacity = interpolate(techSpring, [0, 0.3], [0, 1]);
  const breathe = Math.sin(frame * 0.05) * 3;

  // Name badge
  const badgeSpring = spring({ frame: frame - 50, fps, config: { damping: 12, stiffness: 100 } });

  // Quote text
  const quoteSpring = spring({ frame: frame - 30, fps, config: { damping: 20, stiffness: 120 } });
  const quoteScale = interpolate(quoteSpring, [0, 1], [1.2, 1]);

  // Chaos elements float in
  const chaos1 = spring({ frame: frame - 90, fps, config: { damping: 15 } });
  const chaos2 = spring({ frame: frame - 110, fps, config: { damping: 15 } });
  const chaos3 = spring({ frame: frame - 130, fps, config: { damping: 15 } });

  // Floating papers
  const paper1Y = Math.sin(frame * 0.03) * 15;
  const paper2Y = Math.cos(frame * 0.025) * 12;
  const paper1Rot = Math.sin(frame * 0.02) * 8;
  const paper2Rot = Math.cos(frame * 0.018) * 10;

  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #0a0f1e 0%, #111827 100%)", transform: `translate(${camX}px, ${camY}px)` }}>
      {/* Warm ambient glow */}
      <div style={{
        position: "absolute", top: -100, right: -100,
        width: 500, height: 500, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 70%)",
      }} />

      {/* Quote */}
      <div style={{
        position: "absolute", top: 160, left: 60, right: 60,
        opacity: interpolate(quoteSpring, [0, 1], [0, 1]),
        transform: `scale(${quoteScale})`,
      }}>
        <div style={{
          fontFamily: "Georgia, serif", fontSize: 200,
          color: "rgba(239,68,68,0.08)", lineHeight: 0.8,
          position: "absolute", top: -60, left: -20,
        }}>"</div>
        <div style={{
          fontFamily: "sans-serif", fontSize: 52, fontWeight: 800,
          color: "#F0F2F8", lineHeight: 1.3, letterSpacing: -1,
        }}>
          Antes da Tecvo,{"\n"}meu dia era um{"\n"}
          <span style={{ color: "#EF4444" }}>caos total.</span>
        </div>
      </div>

      {/* Chaos elements - floating papers */}
      <div style={{
        position: "absolute", top: 500, left: 80,
        opacity: interpolate(chaos1, [0, 1], [0, 0.6]),
        transform: `translateY(${paper1Y}px) rotate(${paper1Rot}deg) scale(${interpolate(chaos1, [0, 1], [0.5, 1])})`,
      }}>
        <div style={{
          width: 160, height: 100, borderRadius: 12,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          padding: 15,
        }}>
          <div style={{ width: 100, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.15)", marginBottom: 8 }} />
          <div style={{ width: 80, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.1)", marginBottom: 8 }} />
          <div style={{ width: 60, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)" }} />
        </div>
      </div>

      <div style={{
        position: "absolute", top: 550, right: 60,
        opacity: interpolate(chaos2, [0, 1], [0, 0.5]),
        transform: `translateY(${paper2Y}px) rotate(${paper2Rot}deg) scale(${interpolate(chaos2, [0, 1], [0.5, 1])})`,
      }}>
        <div style={{
          width: 140, height: 90, borderRadius: 12,
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.15)",
          padding: 12,
        }}>
          <div style={{ width: 90, height: 5, borderRadius: 3, background: "rgba(239,68,68,0.2)", marginBottom: 7 }} />
          <div style={{ width: 70, height: 5, borderRadius: 3, background: "rgba(239,68,68,0.15)" }} />
        </div>
      </div>

      <div style={{
        position: "absolute", top: 650, left: "50%",
        opacity: interpolate(chaos3, [0, 1], [0, 0.4]),
        transform: `translateX(-50%) rotate(${-paper1Rot * 0.7}deg)`,
      }}>
        <div style={{ fontFamily: "sans-serif", fontSize: 40, color: "rgba(239,68,68,0.3)" }}>📋 📞 😤</div>
      </div>

      {/* Technician */}
      <div style={{
        position: "absolute", bottom: -20, left: "50%",
        transform: `translateX(-50%) translateY(${techY + breathe}px)`,
        opacity: techOpacity,
      }}>
        <Img src={staticFile("images/technician.png")}
          style={{ width: 550, height: 550, objectFit: "contain" }} />

        {/* Name badge */}
        <div style={{
          position: "absolute", bottom: 120, left: "50%",
          transform: `translateX(-50%) scale(${interpolate(badgeSpring, [0, 1], [0.6, 1])})`,
          opacity: interpolate(badgeSpring, [0, 1], [0, 1]),
          background: "linear-gradient(135deg, #1e3a5f, #1a3050)",
          borderRadius: 18, padding: "12px 28px",
          display: "flex", alignItems: "center", gap: 10,
          boxShadow: "0 6px 24px rgba(0,0,0,0.4)",
        }}>
          <span style={{ fontFamily: "sans-serif", fontSize: 24, fontWeight: 700, color: "white" }}>
            Carlos Silva
          </span>
          <span style={{ fontFamily: "sans-serif", fontSize: 18, fontWeight: 400, color: "rgba(255,255,255,0.6)" }}>
            Técnico HVAC
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
