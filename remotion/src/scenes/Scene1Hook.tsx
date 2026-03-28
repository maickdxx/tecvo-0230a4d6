import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

export const Scene1Hook = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo/brand bar
  const barScale = spring({ frame, fps, config: { damping: 15, stiffness: 120 } });
  const barWidth = interpolate(barScale, [0, 1], [0, 120]);

  // Title words stagger
  const title1 = spring({ frame: frame - 10, fps, config: { damping: 18 } });
  const title2 = spring({ frame: frame - 18, fps, config: { damping: 18 } });
  const title3 = spring({ frame: frame - 26, fps, config: { damping: 18 } });

  // Subtitle
  const subOpacity = interpolate(frame, [40, 55], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const subY = interpolate(frame, [40, 55], [20, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Accent line
  const lineWidth = interpolate(frame, [50, 75], [0, 400], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Floating badge
  const badgeSpring = spring({ frame: frame - 60, fps, config: { damping: 12 } });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      {/* Accent bar top-left */}
      <div
        style={{
          position: "absolute",
          top: 80,
          left: 120,
          width: barWidth,
          height: 4,
          background: "#2547D0",
          borderRadius: 2,
        }}
      />

      <div style={{ textAlign: "center", maxWidth: 1400 }}>
        {/* Main title */}
        <div style={{ display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
          {[
            { text: "Sua empresa de", spring: title1, color: "#E8EAF0" },
            { text: "climatização", spring: title2, color: "#2547D0" },
            { text: "no controle total.", spring: title3, color: "#E8EAF0" },
          ].map((item, i) => (
            <span
              key={i}
              style={{
                fontFamily: "sans-serif",
                fontSize: 72,
                fontWeight: 800,
                color: item.color,
                opacity: interpolate(item.spring, [0, 1], [0, 1]),
                transform: `translateY(${interpolate(item.spring, [0, 1], [40, 0])}px)`,
                letterSpacing: -2,
              }}
            >
              {item.text}
            </span>
          ))}
        </div>

        {/* Accent line */}
        <div
          style={{
            width: lineWidth,
            height: 3,
            background: "linear-gradient(90deg, #2547D0, rgba(37,71,208,0.2))",
            margin: "30px auto",
            borderRadius: 2,
          }}
        />

        {/* Subtitle */}
        <p
          style={{
            fontFamily: "sans-serif",
            fontSize: 28,
            color: "rgba(232,234,240,0.6)",
            fontWeight: 400,
            opacity: subOpacity,
            transform: `translateY(${subY}px)`,
            letterSpacing: 1,
          }}
        >
          Gestão completa para técnicos e empresas de ar-condicionado
        </p>
      </div>

      {/* Brand badge */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          right: 120,
          display: "flex",
          alignItems: "center",
          gap: 12,
          opacity: interpolate(badgeSpring, [0, 1], [0, 1]),
          transform: `scale(${interpolate(badgeSpring, [0, 1], [0.8, 1])})`,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "#2547D0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ color: "white", fontWeight: 900, fontSize: 20, fontFamily: "sans-serif" }}>T</span>
        </div>
        <span style={{ color: "#E8EAF0", fontFamily: "sans-serif", fontWeight: 700, fontSize: 22 }}>
          tecvo
        </span>
      </div>
    </AbsoluteFill>
  );
};
