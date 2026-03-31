import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

export const CinematicBackground = () => {
  const frame = useCurrentFrame();

  // Slow-drifting gradient orbs
  const orb1X = Math.sin(frame * 0.008) * 120;
  const orb1Y = Math.cos(frame * 0.006) * 80;
  const orb2X = Math.cos(frame * 0.01) * 100;
  const orb2Y = Math.sin(frame * 0.007) * 90;
  const orb3X = Math.sin(frame * 0.005 + 2) * 150;
  const orb3Y = Math.cos(frame * 0.009 + 1) * 70;

  // Slow global hue shift for depth
  const hueShift = interpolate(frame, [0, 1260], [0, 15]);

  // Grain overlay intensity
  const grainSeed = frame * 7919;

  return (
    <AbsoluteFill>
      {/* Deep dark base */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(170deg, 
            hsl(${225 + hueShift}, 60%, 5%) 0%, 
            hsl(${230 + hueShift}, 55%, 3%) 50%, 
            hsl(${220 + hueShift}, 65%, 4%) 100%)`,
        }}
      />

      {/* Primary orb - large, blue */}
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(37,71,208,0.18) 0%, rgba(37,71,208,0.04) 40%, transparent 70%)",
          top: -200 + orb1Y,
          left: -300 + orb1X,
          filter: "blur(40px)",
        }}
      />

      {/* Secondary orb - amber accent */}
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(245,158,11,0.1) 0%, rgba(245,158,11,0.02) 40%, transparent 70%)",
          bottom: 200 + orb2Y,
          right: -100 + orb2X,
          filter: "blur(50px)",
        }}
      />

      {/* Tertiary orb - deep purple */}
      <div
        style={{
          position: "absolute",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,72,208,0.08) 0%, transparent 60%)",
          top: 800 + orb3Y,
          left: 300 + orb3X,
          filter: "blur(60px)",
        }}
      />

      {/* Subtle diagonal lines texture */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.025,
          backgroundImage: `repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 40px,
            rgba(255,255,255,0.5) 40px,
            rgba(255,255,255,0.5) 41px
          )`,
          backgroundPosition: `${frame * 0.15}px ${frame * 0.15}px`,
        }}
      />

      {/* Top vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(0,0,0,0.4) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
