import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

const particles = Array.from({ length: 25 }, (_, i) => ({
  x: (i * 137.5) % 1080,
  y: (i * 89.3) % 1920,
  size: 2 + (i % 4) * 1.5,
  speed: 0.3 + (i % 5) * 0.15,
  phase: i * 0.7,
  opacity: 0.15 + (i % 3) * 0.1,
}));

export const FloatingParticles = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {particles.map((p, i) => {
        const y = (p.y - frame * p.speed * 2) % 1920;
        const x = p.x + Math.sin(frame * 0.015 + p.phase) * 30;
        const pulse = Math.sin(frame * 0.04 + p.phase) * 0.5 + 0.5;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y < 0 ? y + 1920 : y,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              background: i % 3 === 0 ? "#F59E0B" : "#2547D0",
              opacity: p.opacity * pulse,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
