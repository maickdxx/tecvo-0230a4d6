import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

// Scene 5: "Clientes começaram a me indicar... empresa de verdade"
export const ContentScene5 = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const chartSpring = spring({ frame: frame - 10, fps, config: { damping: 20 } });
  const arrowProgress = interpolate(frame, [20, 120], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const clients = [
    { delay: 50, x: 100, y: 350 },
    { delay: 75, x: 260, y: 310 },
    { delay: 100, x: 420, y: 340 },
    { delay: 125, x: 600, y: 300 },
    { delay: 150, x: 780, y: 330 },
  ];

  const empresaSpring = spring({ frame: frame - 180, fps, config: { damping: 16, stiffness: 120 } });
  const empresaScale = interpolate(empresaSpring, [0, 1], [1.3, 1]);

  const num1 = spring({ frame: frame - 230, fps, config: { damping: 14 } });
  const num2 = spring({ frame: frame - 260, fps, config: { damping: 14 } });
  const num3 = spring({ frame: frame - 290, fps, config: { damping: 14 } });

  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #0a1628 0%, #111d30 100%)" }}>
      <div style={{
        position: "absolute", top: -40, left: "50%", transform: "translateX(-50%)",
        width: 500, height: 350, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)",
      }} />

      <div style={{
        position: "absolute", top: 80, left: 50, right: 50,
        opacity: interpolate(chartSpring, [0, 1], [0, 1]),
      }}>
        <div style={{
          fontFamily: "sans-serif", fontSize: 44, fontWeight: 800,
          color: "#F0F2F8", lineHeight: 1.3,
        }}>
          Clientes começaram{"\n"}a <span style={{ color: "#F59E0B" }}>me indicar.</span>
        </div>
      </div>

      {/* Growth chart */}
      <div style={{
        position: "absolute", top: 250, left: 50, right: 50, height: 160,
        opacity: interpolate(chartSpring, [0, 1], [0, 1]),
      }}>
        <svg width="960" height="160" viewBox="0 0 960 160">
          {[0, 40, 80, 120].map(y => (
            <line key={y} x1="0" y1={y} x2="960" y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          ))}
          <path d="M 0 140 Q 200 130, 300 115 Q 500 80, 650 55 Q 800 25, 960 8" fill="none" stroke="#F59E0B" strokeWidth="3" strokeDasharray="1400" strokeDashoffset={interpolate(arrowProgress, [0, 1], [1400, 0])} />
          <path d="M 0 140 Q 200 130, 300 115 Q 500 80, 650 55 Q 800 25, 960 8 L 960 160 L 0 160 Z" fill="url(#goldGrad5)" opacity={arrowProgress * 0.25} />
          <defs>
            <linearGradient id="goldGrad5" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Client avatars */}
      {clients.map((c, i) => {
        const s = spring({ frame: frame - c.delay, fps, config: { damping: 10, stiffness: 120 } });
        return (
          <div key={i} style={{
            position: "absolute", top: c.y, left: c.x,
            transform: `scale(${interpolate(s, [0, 1], [0, 1])})`,
            opacity: interpolate(s, [0, 1], [0, 1]),
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              background: `linear-gradient(135deg, hsl(${200 + i * 30}, 70%, 50%), hsl(${220 + i * 30}, 70%, 40%))`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)", fontSize: 20,
            }}>👤</div>
            <div style={{
              position: "absolute", top: -8, right: -8, fontSize: 16,
              transform: `scale(${interpolate(s, [0.5, 1], [0, 1], { extrapolateLeft: "clamp" })})`,
            }}>👍</div>
          </div>
        );
      })}

      {/* "Empresa de verdade" */}
      <div style={{
        position: "absolute", top: 540, left: 50, right: 50, textAlign: "center",
        opacity: interpolate(empresaSpring, [0, 1], [0, 1]),
        transform: `scale(${empresaScale})`,
      }}>
        <div style={{
          fontFamily: "sans-serif", fontSize: 46, fontWeight: 900, color: "white", lineHeight: 1.3,
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
        position: "absolute", bottom: 250, left: 30, right: 30,
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
            transform: `translateY(${interpolate(item.s, [0, 1], [25, 0])}px)`,
          }}>
            <div style={{ fontFamily: "sans-serif", fontSize: 42, fontWeight: 900, color: item.color }}>{item.value}</div>
            <div style={{ fontFamily: "sans-serif", fontSize: 16, fontWeight: 500, color: "rgba(255,255,255,0.5)", marginTop: 3 }}>{item.label}</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
