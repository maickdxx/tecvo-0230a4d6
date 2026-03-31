import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";

export const Scene1HookV2 = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Dramatic opening - lens flare burst
  const burstScale = interpolate(frame, [0, 15], [0, 8], { extrapolateRight: "clamp" });
  const burstOpacity = interpolate(frame, [0, 5, 15, 40], [0, 0.6, 0.3, 0], { extrapolateRight: "clamp" });

  // Main title - dramatic typewriter with scale
  const titleReveal = spring({ frame: frame - 20, fps, config: { damping: 25, stiffness: 120 } });
  const titleScale = interpolate(titleReveal, [0, 1], [1.3, 1]);
  
  // Horizontal accent line
  const lineWidth = interpolate(
    spring({ frame: frame - 35, fps, config: { damping: 30, stiffness: 100 } }),
    [0, 1], [0, 400]
  );

  // Subtitle stagger
  const sub1 = spring({ frame: frame - 50, fps, config: { damping: 18 } });
  const sub2 = spring({ frame: frame - 65, fps, config: { damping: 18 } });

  // Technician cinematic entrance - slide + fade from bottom
  const techEntrance = spring({ frame: frame - 90, fps, config: { damping: 14, stiffness: 60, mass: 1.5 } });
  const techY = interpolate(techEntrance, [0, 1], [300, 0]);
  const techOpacity = interpolate(techEntrance, [0, 0.3], [0, 1]);

  // Name badge with glow
  const badgeSpring = spring({ frame: frame - 130, fps, config: { damping: 12, stiffness: 100 } });

  // Subtle camera drift
  const camX = Math.sin(frame * 0.008) * 8;
  const camY = Math.cos(frame * 0.006) * 5;

  // Breathing on technician
  const breathe = Math.sin(frame * 0.05) * 4;

  // Pulsing ring around badge
  const ringPulse = Math.sin(frame * 0.06) * 0.3 + 0.7;

  return (
    <AbsoluteFill style={{ transform: `translate(${camX}px, ${camY}px)` }}>
      {/* Opening burst */}
      <div style={{
        position: "absolute",
        top: "50%", left: "50%",
        width: 100, height: 100,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(245,158,11,0.8) 0%, rgba(37,71,208,0.3) 50%, transparent 70%)",
        transform: `translate(-50%, -50%) scale(${burstScale})`,
        opacity: burstOpacity,
      }} />

      {/* Quote mark - oversized decorative */}
      <div style={{
        position: "absolute",
        top: 120, left: 60,
        fontFamily: "Georgia, serif",
        fontSize: 300,
        fontWeight: 700,
        color: "rgba(37,71,208,0.06)",
        lineHeight: 1,
        transform: `translateY(${interpolate(titleReveal, [0, 1], [-50, 0])}px)`,
        opacity: interpolate(titleReveal, [0, 1], [0, 1]),
      }}>
        "
      </div>

      {/* Main title block */}
      <div style={{
        position: "absolute",
        top: 200, left: 70, right: 70,
        transform: `scale(${titleScale})`,
        opacity: interpolate(titleReveal, [0, 1], [0, 1]),
      }}>
        <div style={{
          fontFamily: "sans-serif",
          fontSize: 62,
          fontWeight: 800,
          color: "#F0F2F8",
          lineHeight: 1.25,
          letterSpacing: -2,
        }}>
          Eu era daqueles que{"\n"}anotava tudo no papel...
        </div>
      </div>

      {/* Accent line */}
      <div style={{
        position: "absolute",
        top: 440, left: 70,
        width: lineWidth,
        height: 4,
        borderRadius: 2,
        background: "linear-gradient(90deg, #F59E0B, rgba(245,158,11,0.2))",
      }} />

      {/* Subtitle */}
      <div style={{
        position: "absolute",
        top: 470, left: 70, right: 70,
      }}>
        <div style={{
          fontFamily: "sans-serif",
          fontSize: 36,
          fontWeight: 400,
          color: "rgba(240,242,248,0.5)",
          lineHeight: 1.5,
          opacity: interpolate(sub1, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(sub1, [0, 1], [25, 0])}px)`,
        }}>
          Até conhecer a Tecvo.
        </div>
        <div style={{
          fontFamily: "sans-serif",
          fontSize: 28,
          fontWeight: 500,
          color: "#2547D0",
          marginTop: 12,
          opacity: interpolate(sub2, [0, 1], [0, 1]),
          transform: `translateX(${interpolate(sub2, [0, 1], [-30, 0])}px)`,
        }}>
          E tudo mudou.
        </div>
      </div>

      {/* Technician */}
      <div style={{
        position: "absolute",
        bottom: -20,
        left: "50%",
        transform: `translateX(-50%) translateY(${techY + breathe}px)`,
        opacity: techOpacity,
      }}>
        <Img
          src={staticFile("images/technician.png")}
          style={{ width: 580, height: 580, objectFit: "contain" }}
        />

        {/* Glowing ring behind badge */}
        <div style={{
          position: "absolute",
          bottom: 130,
          left: "50%",
          transform: `translateX(-50%) scale(${interpolate(badgeSpring, [0, 1], [0, 1])})`,
          width: 280, height: 70,
          borderRadius: 35,
          background: `rgba(37,71,208,${ringPulse * 0.2})`,
          filter: "blur(15px)",
        }} />

        {/* Name badge */}
        <div style={{
          position: "absolute",
          bottom: 130,
          left: "50%",
          transform: `translateX(-50%) scale(${interpolate(badgeSpring, [0, 1], [0.6, 1])})`,
          opacity: interpolate(badgeSpring, [0, 1], [0, 1]),
          background: "linear-gradient(135deg, #2547D0, #1a3ab5)",
          borderRadius: 20,
          padding: "14px 32px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          boxShadow: "0 8px 32px rgba(37,71,208,0.4)",
        }}>
          <span style={{ fontFamily: "sans-serif", fontSize: 26, fontWeight: 700, color: "white" }}>
            Carlos Silva
          </span>
          <span style={{
            fontFamily: "sans-serif", fontSize: 20, fontWeight: 400,
            color: "rgba(255,255,255,0.65)",
          }}>
            Técnico HVAC
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
