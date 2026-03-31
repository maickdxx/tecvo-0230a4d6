import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

// Scene 4: "Laudo técnico na hora, tiro foto, profissional demais..."
export const ContentScene4 = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const phoneSpring = spring({ frame: frame - 10, fps, config: { damping: 16, stiffness: 80 } });
  const phoneScale = interpolate(phoneSpring, [0, 1], [0.7, 1]);

  const check1 = spring({ frame: frame - 50, fps, config: { damping: 12 } });
  const check2 = spring({ frame: frame - 80, fps, config: { damping: 12 } });
  const check3 = spring({ frame: frame - 110, fps, config: { damping: 12 } });
  const photo = spring({ frame: frame - 150, fps, config: { damping: 14 } });
  const stampSpring = spring({ frame: frame - 230, fps, config: { damping: 8, stiffness: 150 } });
  const stampScale = interpolate(stampSpring, [0, 1], [3, 1]);
  const stampRot = interpolate(stampSpring, [0, 1], [-15, -5]);

  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #0f172a 0%, #0c1524 100%)" }}>
      <div style={{
        position: "absolute", top: "25%", right: -80,
        width: 350, height: 350, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)",
      }} />

      {/* Title */}
      <div style={{
        position: "absolute", top: 80, left: 50, right: 50,
        opacity: interpolate(phoneSpring, [0, 1], [0, 1]),
      }}>
        <div style={{
          fontFamily: "sans-serif", fontSize: 42, fontWeight: 800,
          color: "#F0F2F8", lineHeight: 1.3,
        }}>
          Laudo técnico{"\n"}<span style={{ color: "#10B981" }}>na hora.</span>
        </div>
      </div>

      {/* Phone mockup */}
      <div style={{
        position: "absolute", top: 250, left: "50%",
        transform: `translateX(-50%) scale(${phoneScale})`,
        opacity: interpolate(phoneSpring, [0, 1], [0, 1]),
      }}>
        <div style={{
          width: 360, borderRadius: 28,
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
          padding: 20, boxShadow: "0 16px 50px rgba(0,0,0,0.4)",
        }}>
          <div style={{
            background: "rgba(37,71,208,0.15)", borderRadius: 14,
            padding: "14px 18px", marginBottom: 14,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{ fontSize: 24 }}>📋</div>
            <div>
              <div style={{ fontFamily: "sans-serif", fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>Laudo Técnico</div>
              <div style={{ fontFamily: "sans-serif", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>OS #2847 • HVAC</div>
            </div>
          </div>

          {[
            { text: "Verificação do compressor", s: check1 },
            { text: "Limpeza dos filtros", s: check2 },
            { text: "Teste de temperatura", s: check3 },
          ].map((item, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px", marginBottom: 6,
              opacity: interpolate(item.s, [0, 1], [0, 1]),
              transform: `translateX(${interpolate(item.s, [0, 1], [25, 0])}px)`,
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: 6,
                background: interpolate(item.s, [0, 1], [0, 1]) > 0.8 ? "#10B981" : "rgba(255,255,255,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, color: "white",
              }}>✓</div>
              <span style={{ fontFamily: "sans-serif", fontSize: 16, color: "#cbd5e1" }}>{item.text}</span>
            </div>
          ))}

          <div style={{
            marginTop: 10, borderRadius: 14, overflow: "hidden",
            opacity: interpolate(photo, [0, 1], [0, 1]),
            transform: `scale(${interpolate(photo, [0, 1], [0.9, 1])})`,
          }}>
            <div style={{
              height: 100, background: "linear-gradient(135deg, rgba(37,71,208,0.1), rgba(16,185,129,0.1))",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            }}>
              <span style={{ fontSize: 30 }}>📸</span>
              <span style={{ fontFamily: "sans-serif", fontSize: 16, color: "#94a3b8" }}>Foto anexada</span>
            </div>
          </div>
        </div>
      </div>

      {/* PROFISSIONAL stamp */}
      <div style={{
        position: "absolute", top: 340, right: 30,
        opacity: interpolate(stampSpring, [0, 1], [0, 1]),
        transform: `scale(${stampScale}) rotate(${stampRot}deg)`,
      }}>
        <div style={{
          border: "3px solid #10B981", borderRadius: 10, padding: "6px 16px",
          fontFamily: "sans-serif", fontSize: 18, fontWeight: 900,
          color: "#10B981", letterSpacing: 3,
        }}>PROFISSIONAL</div>
      </div>
    </AbsoluteFill>
  );
};
