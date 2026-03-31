import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

// "Laudo técnico ali na hora, tiro foto, cliente recebe tudo certinho. Profissional demais."
export const TestimonialScene4 = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const camX = Math.sin(frame * 0.005) * 5;

  // Phone mockup with report
  const phoneSpring = spring({ frame: frame - 10, fps, config: { damping: 16, stiffness: 80, mass: 1.2 } });
  const phoneScale = interpolate(phoneSpring, [0, 1], [0.7, 1]);

  // Report elements
  const check1 = spring({ frame: frame - 60, fps, config: { damping: 12 } });
  const check2 = spring({ frame: frame - 90, fps, config: { damping: 12 } });
  const check3 = spring({ frame: frame - 120, fps, config: { damping: 12 } });
  const photo = spring({ frame: frame - 160, fps, config: { damping: 14 } });

  // "Profissional" stamp
  const stampSpring = spring({ frame: frame - 250, fps, config: { damping: 8, stiffness: 150 } });
  const stampScale = interpolate(stampSpring, [0, 1], [3, 1]);
  const stampRotation = interpolate(stampSpring, [0, 1], [-15, -5]);

  // Client notification
  const notifSpring = spring({ frame: frame - 320, fps, config: { damping: 15 } });

  // Stars
  const stars = spring({ frame: frame - 370, fps, config: { damping: 10 } });

  return (
    <AbsoluteFill style={{
      background: "linear-gradient(180deg, #0f172a 0%, #0c1524 100%)",
      transform: `translateX(${camX}px)`,
    }}>
      {/* Green ambient glow */}
      <div style={{
        position: "absolute", top: "30%", right: -100,
        width: 400, height: 400, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)",
      }} />

      {/* Title */}
      <div style={{
        position: "absolute", top: 100, left: 60, right: 60,
        opacity: interpolate(phoneSpring, [0, 1], [0, 1]),
      }}>
        <div style={{
          fontFamily: "sans-serif", fontSize: 46, fontWeight: 800,
          color: "#F0F2F8", lineHeight: 1.3,
        }}>
          Laudo técnico{"\n"}
          <span style={{ color: "#10B981" }}>na hora.</span>
        </div>
      </div>

      {/* Phone mockup with report */}
      <div style={{
        position: "absolute", top: 300, left: "50%",
        transform: `translateX(-50%) scale(${phoneScale})`,
        opacity: interpolate(phoneSpring, [0, 1], [0, 1]),
      }}>
        <div style={{
          width: 380, borderRadius: 32,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
        }}>
          {/* Report header */}
          <div style={{
            background: "rgba(37,71,208,0.15)", borderRadius: 16,
            padding: "16px 20px", marginBottom: 16,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{ fontSize: 28 }}>📋</div>
            <div>
              <div style={{ fontFamily: "sans-serif", fontSize: 18, fontWeight: 700, color: "#e2e8f0" }}>
                Laudo Técnico
              </div>
              <div style={{ fontFamily: "sans-serif", fontSize: 14, color: "rgba(255,255,255,0.5)" }}>
                OS #2847 • Manutenção HVAC
              </div>
            </div>
          </div>

          {/* Checklist items */}
          {[
            { text: "Verificação do compressor", s: check1 },
            { text: "Limpeza dos filtros", s: check2 },
            { text: "Teste de temperatura", s: check3 },
          ].map((item, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 16px", marginBottom: 8,
              opacity: interpolate(item.s, [0, 1], [0, 1]),
              transform: `translateX(${interpolate(item.s, [0, 1], [30, 0])}px)`,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: interpolate(item.s, [0, 1], [0, 1]) > 0.8 ? "#10B981" : "rgba(255,255,255,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, color: "white",
                transform: `scale(${interpolate(item.s, [0.7, 1], [0, 1], { extrapolateLeft: "clamp" })})`,
              }}>✓</div>
              <span style={{ fontFamily: "sans-serif", fontSize: 18, color: "#cbd5e1" }}>
                {item.text}
              </span>
            </div>
          ))}

          {/* Photo placeholder */}
          <div style={{
            marginTop: 12, borderRadius: 16, overflow: "hidden",
            opacity: interpolate(photo, [0, 1], [0, 1]),
            transform: `scale(${interpolate(photo, [0, 1], [0.9, 1])})`,
          }}>
            <div style={{
              height: 120, background: "linear-gradient(135deg, rgba(37,71,208,0.1), rgba(16,185,129,0.1))",
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: 12,
            }}>
              <span style={{ fontSize: 36 }}>📸</span>
              <span style={{ fontFamily: "sans-serif", fontSize: 18, color: "#94a3b8" }}>
                Foto do serviço anexada
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* "PROFISSIONAL" stamp */}
      <div style={{
        position: "absolute", top: 380, right: 40,
        opacity: interpolate(stampSpring, [0, 1], [0, 1]),
        transform: `scale(${stampScale}) rotate(${stampRotation}deg)`,
      }}>
        <div style={{
          border: "3px solid #10B981",
          borderRadius: 12, padding: "8px 20px",
          fontFamily: "sans-serif", fontSize: 22, fontWeight: 900,
          color: "#10B981", letterSpacing: 3,
        }}>
          PROFISSIONAL
        </div>
      </div>

      {/* Client notification */}
      <div style={{
        position: "absolute", bottom: 160, left: 60, right: 60,
        opacity: interpolate(notifSpring, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(notifSpring, [0, 1], [30, 0])}px)`,
      }}>
        <div style={{
          background: "rgba(16,185,129,0.1)",
          border: "1px solid rgba(16,185,129,0.2)",
          borderRadius: 20, padding: "18px 24px",
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{ fontSize: 28 }}>✅</div>
          <div style={{ fontFamily: "sans-serif", fontSize: 22, color: "#a7f3d0", fontWeight: 500 }}>
            Cliente recebeu o laudo completo
          </div>
        </div>
      </div>

      {/* Stars rating */}
      <div style={{
        position: "absolute", bottom: 80, left: "50%",
        transform: `translateX(-50%) scale(${interpolate(stars, [0, 1], [0.5, 1])})`,
        opacity: interpolate(stars, [0, 1], [0, 1]),
        display: "flex", gap: 8,
      }}>
        {[0, 1, 2, 3, 4].map(i => {
          const starDelay = spring({ frame: frame - 375 - i * 8, fps, config: { damping: 8 } });
          return (
            <span key={i} style={{
              fontSize: 36,
              transform: `scale(${interpolate(starDelay, [0, 1], [0, 1])})`,
              filter: `brightness(${interpolate(starDelay, [0, 1], [0.5, 1.2])})`,
            }}>⭐</span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
