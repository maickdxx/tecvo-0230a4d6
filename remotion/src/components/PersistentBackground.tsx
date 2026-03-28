import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

export const PersistentBackground = () => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 600], [0, 40]);
  const pulse = Math.sin(frame * 0.02) * 0.15 + 0.85;

  return (
    <AbsoluteFill style={{ background: "#0A0E1A" }}>
      <div
        style={{
          position: "absolute",
          width: 700,
          height: 700,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(37,71,208,0.12) 0%, transparent 70%)",
          top: -200 + drift * 0.5,
          left: -150 + Math.sin(frame * 0.01) * 20,
          opacity: pulse,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(37,71,208,0.08) 0%, transparent 70%)",
          bottom: -100 + Math.cos(frame * 0.015) * 15,
          right: -80 + drift * 0.3,
          opacity: pulse * 0.7,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(37,71,208,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(37,71,208,0.04) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          backgroundPosition: `${drift}px ${drift * 0.5}px`,
        }}
      />
    </AbsoluteFill>
  );
};
