import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";

// "Meus clientes começaram a me indicar mais. Pareço uma empresa de verdade."
export const TestimonialScene5 = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const camX = Math.sin(frame * 0.005) * 4;

  // Growth chart animation
  const chartSpring = spring({ frame: frame - 10, fps, config: { damping: 20 } });

  // Client avatars popping in
  const clients = [
    { delay: 60, x: 120, y: 450 },
    { delay: 85, x: 300, y: 400 },
    { delay: 110, x: 480, y: 430 },
    { delay: 135, x: 680, y: 380 },
    { delay: 160, x: 860, y: 420 },
  ];

  // "Empresa de verdade" text
  const empresaSpring = spring({ frame: frame - 200, fps, config: { damping: 16, stiffness: 120 } });
  const empresaScale = interpolate(empresaSpring, [0, 1], [1.3, 1]);

  // Impact numbers
  const num1 = spring({ frame: frame - 250, fps, config: { damping: 14 } });
  const num2 = spring({ frame: frame - 280, fps, config: { damping: 14 } });
  const num3 = spring({ frame: frame - 310, fps, config: { damping: 14 } });

  // Growth arrow
  const arrowProgress = interpolate(frame, [20, 120], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{
      background: "linear-gradient(180deg, #0a1628 0%, #111d30 100%)",
      transform: `translateX(${camX}px)`,
    }}>
      {/* Gold glow */}
      <div style={{
        position: "absolute", top: -50, left: "50%",
        transform: "translateX(-50%)",
        width: 600, height: 400, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)",
      }} />

      {/* Title */}
      <div style={{
        position: "absolute", top: 100, left: 60, right: 60,
        opacity: interpolate(chartSpring, [0, 1], [0, 1]),
      }}>
        <div style={{
          fontFamily: "sans-serif", fontSize: 48, fontWeight: 800,
          color: "#F0F2F8", lineHeight: 1.3,
        }}>
          Clientes começaram{"\n"}a{" "}
          <span style={{ color: "#F59E0B" }}>me indicar.</span>
        </div>
      </div>

      {/* Growth chart */}
      <div style={{
        position: "absolute", top: 300, left: 60, right: 60,
        height: 200,
        opacity: interpolate(chartSpring, [0, 1], [0, 1]),
      }}>
        <svg width="960" height="200" viewBox="0 0 960 200">
          {/* Grid lines */}
          {[0, 50, 100, 150].map(y => (
            <line key={y} x1="0" y1={y} x2="960" y2={y}
              stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          ))}
          {/* Growth line */}
          <path
            d={`M 0 180 Q 200 170, 300 150 Q 500 100, 650 70 Q 800 30, 960 10`}
            fill="none" stroke="#F59E0B" strokeWidth="4"
            strokeDasharray="1500"
            strokeDashoffset={interpolate(arrowProgress, [0, 1], [1500, 0])}
          />
          {/* Glow under line */}
          <path
            d={`M 0 180 Q 200 170, 300 150 Q 500 100, 650 70 Q 800 30, 960 10 L 960 200 L 0 200 Z`}
            fill="url(#goldGrad)"
            opacity={arrowProgress * 0.3}
          />
          <defs>
            <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Client indicators */}
      {clients.map((c, i) => {
        const s = spring({ frame: frame - c.delay, fps, config: { damping: 10, stiffness: 120 } });
        return (
          <div key={i} style={{
            position: "absolute", top: c.y, left: c.x,
            transform: `scale(${interpolate(s, [0, 1], [0, 1])})`,
            opacity: interpolate(s, [0, 1], [0, 1]),
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: `linear-gradient(135deg, hsl(${200 + i * 30}, 70%, 50%), hsl(${220 + i * 30}, 70%, 40%))`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
              fontSize: 24,
            }}>
              👤
            </div>
            <div style={{
              position: "absolute", top: -8, right: -8,
              fontSize: 18,
              transform: `scale(${interpolate(s, [0.5, 1], [0, 1], { extrapolateLeft: "clamp" })})`,
            }}>👍</div>
          </div>
        );
      })}

      {/* "Empresa de verdade" */}
      <div style={{
        position: "absolute", top: 640, left: 60, right: 60,
        opacity: interpolate(empresaSpring, [0, 1], [0, 1]),
        transform: `scale(${empresaScale})`,
        textAlign: "center",
      }}>
        <div style={{
          fontFamily: "sans-serif", fontSize: 52, fontWeight: 900,
          color: "white", lineHeight: 1.3,
        }}>
          Pareço uma{"\n"}
          <span style={{
            background: "linear-gradient(90deg, #F59E0B, #EF4444)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>empresa de verdade.</span>
        </div>
      </div>

      {/* Impact numbers */}
      <div style={{
        position: "absolute", bottom: 120, left: 40, right: 40,
        display: "flex", justifyContent: "space-around",
      }}>
        {[
          { value: "3x", label: "Mais indicações", s: num1, color: "#3B82F6" },
          { value: "100%", label: "Organizado", s: num2, color: "#10B981" },
          { value: "0", label: "Papel", s: num3, color: "#F59E0B" },
        ].map((item, i) => (
          <div key={i} style={{
            textAlign: "center",
            opacity: interpolate(item.s, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(item.s, [0, 1], [30, 0])}px)`,
          }}>
            <div style={{
              fontFamily: "sans-serif", fontSize: 48, fontWeight: 900,
              color: item.color,
            }}>
              {item.value}
            </div>
            <div style={{
              fontFamily: "sans-serif", fontSize: 18, fontWeight: 500,
              color: "rgba(255,255,255,0.5)", marginTop: 4,
            }}>
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
