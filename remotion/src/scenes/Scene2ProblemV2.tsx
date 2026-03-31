import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";

export const Scene2ProblemV2 = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Background desk slow zoom + dark overlay
  const deskScale = interpolate(frame, [0, 280], [1, 1.25], { extrapolateRight: "clamp" });
  const deskBlur = interpolate(frame, [0, 30], [0, 3], { extrapolateRight: "clamp" });
  const overlayDarken = interpolate(frame, [0, 30], [0.7, 0.88], { extrapolateRight: "clamp" });

  // Title with dramatic reveal
  const titleSpring = spring({ frame: frame - 5, fps, config: { damping: 22, stiffness: 100 } });

  // Pain points with dramatic stagger - cards slide from alternating sides
  const problems = [
    { emoji: "📋", text: "Agendas perdidas", sub: "Clientes esquecidos", delay: 25, fromLeft: true },
    { emoji: "📞", text: "Sem retorno", sub: "Reclamações constantes", delay: 45, fromLeft: false },
    { emoji: "💸", text: "Financeiro no papel", sub: "Dinheiro descontrolado", delay: 65, fromLeft: true },
    { emoji: "⏰", text: "Horas desperdiçadas", sub: "Produtividade zero", delay: 85, fromLeft: false },
  ];

  // Giant X that crashes in
  const xFrame = frame - 140;
  const xSpring = spring({ frame: xFrame, fps, config: { damping: 8, stiffness: 200 } });
  const xScale = interpolate(xSpring, [0, 1], [5, 1]);
  const xRotation = interpolate(xSpring, [0, 1], [180, 12]);
  const xOpacity = interpolate(xFrame, [0, 5], [0, 0.35], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Red pulse when X appears
  const redFlash = xFrame > 0 ? Math.max(0, 1 - xFrame / 15) * 0.15 : 0;

  // Shake effect on X impact
  const shake = xFrame > 0 && xFrame < 10
    ? Math.sin(xFrame * 15) * interpolate(xFrame, [0, 10], [8, 0], { extrapolateRight: "clamp" })
    : 0;

  return (
    <AbsoluteFill style={{ transform: `translateX(${shake}px)` }}>
      {/* Background image with slow zoom */}
      <div style={{
        position: "absolute", inset: -50,
        transform: `scale(${deskScale})`,
        filter: `blur(${deskBlur}px)`,
      }}>
        <Img src={staticFile("images/messy-desk.png")} style={{ width: "110%", height: "110%", objectFit: "cover" }} />
      </div>

      {/* Dark overlay with red tint */}
      <div style={{
        position: "absolute", inset: 0,
        background: `linear-gradient(180deg, rgba(10,14,26,${overlayDarken}) 0%, rgba(10,14,26,${overlayDarken + 0.05}) 100%)`,
      }} />

      {/* Red flash overlay */}
      <div style={{
        position: "absolute", inset: 0,
        background: `rgba(220,38,38,${redFlash})`,
      }} />

      {/* Title */}
      <div style={{
        position: "absolute", top: 140, left: 70, right: 70,
        opacity: interpolate(titleSpring, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(titleSpring, [0, 1], [30, 0])}px)`,
      }}>
        <div style={{
          fontFamily: "sans-serif", fontSize: 52, fontWeight: 800,
          color: "#F0F2F8", lineHeight: 1.2, letterSpacing: -1,
        }}>
          Meu dia era assim...
        </div>
        <div style={{
          width: 60, height: 4, borderRadius: 2,
          background: "#EF4444", marginTop: 24,
        }} />
      </div>

      {/* Problem cards */}
      <div style={{
        position: "absolute", top: 340, left: 50, right: 50,
        display: "flex", flexDirection: "column", gap: 30,
      }}>
        {problems.map((p, i) => {
          const s = spring({ frame: frame - p.delay, fps, config: { damping: 15, stiffness: 90 } });
          const startX = p.fromLeft ? -400 : 400;
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 20,
              opacity: interpolate(s, [0, 1], [0, 1]),
              transform: `translateX(${interpolate(s, [0, 1], [startX, 0])}px)`,
            }}>
              {/* Emoji circle */}
              <div style={{
                width: 75, height: 75, borderRadius: "50%",
                background: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 36, flexShrink: 0,
              }}>
                {p.emoji}
              </div>

              {/* Text card */}
              <div style={{
                flex: 1,
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: 20, padding: "20px 28px",
              }}>
                <div style={{
                  fontFamily: "sans-serif", fontSize: 34, fontWeight: 700, color: "#F0F2F8",
                }}>
                  {p.text}
                </div>
                <div style={{
                  fontFamily: "sans-serif", fontSize: 22, fontWeight: 400,
                  color: "rgba(239,68,68,0.6)", marginTop: 4,
                }}>
                  {p.sub}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Giant X */}
      <div style={{
        position: "absolute",
        bottom: 100, right: 60,
        fontFamily: "sans-serif", fontSize: 250, fontWeight: 900,
        color: "rgba(239,68,68,0.3)",
        transform: `scale(${xScale}) rotate(${xRotation}deg)`,
        opacity: xOpacity,
        textShadow: "0 0 60px rgba(239,68,68,0.3)",
      }}>
        ✕
      </div>

      {/* Bottom quote */}
      <div style={{
        position: "absolute", bottom: 120, left: 70, right: 70,
        opacity: interpolate(
          spring({ frame: frame - 180, fps, config: { damping: 18 } }),
          [0, 1], [0, 1]
        ),
      }}>
        <div style={{
          fontFamily: "sans-serif", fontSize: 26, fontWeight: 400,
          fontStyle: "italic", color: "rgba(240,242,248,0.35)", textAlign: "center",
        }}>
          "Eu sabia que precisava mudar..."
        </div>
      </div>
    </AbsoluteFill>
  );
};
