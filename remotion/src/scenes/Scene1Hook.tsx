import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

export const Scene1Hook = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const barScale = spring({ frame, fps, config: { damping: 15, stiffness: 120 } });
  const barWidth = interpolate(barScale, [0, 1], [0, 120]);

  const title1 = spring({ frame: frame - 10, fps, config: { damping: 18 } });
  const title2 = spring({ frame: frame - 20, fps, config: { damping: 18 } });
  const title3 = spring({ frame: frame - 30, fps, config: { damping: 18 } });

  const subOpacity = interpolate(frame, [45, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const subY = interpolate(frame, [45, 60], [15, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const lineWidth = interpolate(frame, [55, 75], [0, 300], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const badgeSpring = spring({ frame: frame - 65, fps, config: { damping: 12 } });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 60 }}>
      <div style={{ position: "absolute", top: 80, left: 60, width: barWidth, height: 4, background: "#2547D0", borderRadius: 2 }} />

      <div style={{ textAlign: "center" }}>
        {[
          { text: "Sua empresa de", spring: title1, color: "#E8EAF0" },
          { text: "climatização", spring: title2, color: "#2547D0" },
          { text: "no controle total.", spring: title3, color: "#E8EAF0" },
        ].map((item, i) => (
          <div
            key={i}
            style={{
              fontFamily: "sans-serif",
              fontSize: 78,
              fontWeight: 800,
              color: item.color,
              opacity: interpolate(item.spring, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(item.spring, [0, 1], [30, 0])}px)`,
              letterSpacing: -2,
              lineHeight: 1.15,
            }}
          >
            {item.text}
          </div>
        ))}

        <div style={{ width: lineWidth, height: 4, background: "linear-gradient(90deg, #2547D0, rgba(37,71,208,0.2))", margin: "40px auto", borderRadius: 2 }} />

        <p style={{ fontFamily: "sans-serif", fontSize: 34, color: "rgba(232,234,240,0.6)", fontWeight: 400, opacity: subOpacity, transform: `translateY(${subY}px)`, letterSpacing: 0.5, lineHeight: 1.4 }}>
          Gestão completa para técnicos e{"\n"}empresas de ar-condicionado
        </p>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 100,
          display: "flex",
          alignItems: "center",
          gap: 14,
          opacity: interpolate(badgeSpring, [0, 1], [0, 1]),
          transform: `scale(${interpolate(badgeSpring, [0, 1], [0.8, 1])})`,
        }}
      >
        <div style={{ width: 52, height: 52, borderRadius: 13, background: "#2547D0", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "white", fontWeight: 900, fontSize: 26, fontFamily: "sans-serif" }}>T</span>
        </div>
        <span style={{ color: "#E8EAF0", fontFamily: "sans-serif", fontWeight: 700, fontSize: 30 }}>tecvo</span>
      </div>
    </AbsoluteFill>
  );
};
