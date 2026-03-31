import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";

export const Scene1Hook = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Technician slides in from bottom
  const techY = interpolate(
    spring({ frame, fps, config: { damping: 18, stiffness: 80 } }),
    [0, 1], [400, 0]
  );
  const techOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  // Speech bubble appears
  const bubbleSpring = spring({ frame: frame - 25, fps, config: { damping: 12, stiffness: 100 } });
  const bubbleScale = interpolate(bubbleSpring, [0, 1], [0, 1]);
  const bubbleOpacity = interpolate(bubbleSpring, [0, 0.3], [0, 1]);

  // Name tag
  const nameSpring = spring({ frame: frame - 40, fps, config: { damping: 20 } });

  // Subtle breathing animation on technician
  const breathe = Math.sin(frame * 0.06) * 3;

  // Text lines stagger
  const line1 = spring({ frame: frame - 30, fps, config: { damping: 18 } });
  const line2 = spring({ frame: frame - 45, fps, config: { damping: 18 } });

  // Warm gradient bg overlay
  const gradientShift = Math.sin(frame * 0.015) * 10;

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center" }}>
      {/* Warm office light overlay */}
      <div style={{
        position: "absolute",
        top: 0, right: 0,
        width: 600, height: 600,
        borderRadius: "50%",
        background: `radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)`,
        transform: `translate(${gradientShift}px, ${-gradientShift}px)`,
      }} />

      {/* Speech bubble */}
      <div style={{
        position: "absolute",
        top: 180,
        left: 80,
        right: 80,
        opacity: bubbleOpacity,
        transform: `scale(${bubbleScale})`,
        transformOrigin: "bottom center",
      }}>
        <div style={{
          background: "rgba(37,71,208,0.12)",
          border: "1px solid rgba(37,71,208,0.25)",
          borderRadius: 32,
          padding: "50px 55px",
          position: "relative",
        }}>
          <div style={{
            fontFamily: "sans-serif",
            fontSize: 52,
            fontWeight: 700,
            color: "#E8EAF0",
            lineHeight: 1.35,
            opacity: interpolate(line1, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(line1, [0, 1], [20, 0])}px)`,
          }}>
            "Eu era daqueles que{"\n"}anotava tudo no papel..."
          </div>
          <div style={{
            fontFamily: "sans-serif",
            fontSize: 36,
            fontWeight: 400,
            color: "rgba(232,234,240,0.6)",
            marginTop: 20,
            opacity: interpolate(line2, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(line2, [0, 1], [15, 0])}px)`,
          }}>
            Até conhecer a Tecvo.
          </div>
          {/* Bubble tail */}
          <div style={{
            position: "absolute",
            bottom: -20,
            left: "50%",
            marginLeft: -20,
            width: 0, height: 0,
            borderLeft: "20px solid transparent",
            borderRight: "20px solid transparent",
            borderTop: "20px solid rgba(37,71,208,0.12)",
          }} />
        </div>
      </div>

      {/* Technician image */}
      <div style={{
        position: "relative",
        transform: `translateY(${techY + breathe}px)`,
        opacity: techOpacity,
        marginBottom: -20,
      }}>
        <Img src={staticFile("images/technician.png")} style={{ width: 550, height: 550, objectFit: "contain" }} />
        
        {/* Name tag */}
        <div style={{
          position: "absolute",
          bottom: 120,
          left: "50%",
          transform: `translateX(-50%) scale(${interpolate(nameSpring, [0, 1], [0.8, 1])})`,
          opacity: interpolate(nameSpring, [0, 1], [0, 1]),
          background: "#2547D0",
          borderRadius: 16,
          padding: "12px 30px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          <span style={{ fontFamily: "sans-serif", fontSize: 28, fontWeight: 700, color: "white" }}>
            Carlos Silva
          </span>
          <span style={{ fontFamily: "sans-serif", fontSize: 22, fontWeight: 400, color: "rgba(255,255,255,0.7)" }}>
            • Técnico HVAC
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
