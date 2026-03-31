import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";

export const Scene5Closing = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoSpring = spring({ frame: frame - 5, fps, config: { damping: 12, stiffness: 80 } });
  const tagSpring = spring({ frame: frame - 25, fps, config: { damping: 18 } });
  const ctaSpring = spring({ frame: frame - 45, fps, config: { damping: 15 } });
  const quoteSpring = spring({ frame: frame - 65, fps, config: { damping: 18 } });
  const techSpring = spring({ frame: frame - 55, fps, config: { damping: 14 } });
  const pulse = Math.sin(frame * 0.05) * 0.15 + 0.85;
  const rayRotate = frame * 0.3;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{
        position: "absolute", width: 800, height: 800, borderRadius: "50%",
        background: `radial-gradient(circle, rgba(37,71,208,${pulse * 0.12}) 0%, transparent 60%)`,
      }} />

      {[0, 45, 90, 135].map((angle) => (
        <div key={angle} style={{
          position: "absolute", width: 3, height: 300,
          background: "linear-gradient(180deg, rgba(37,71,208,0.08) 0%, transparent 100%)",
          transform: `rotate(${angle + rayRotate}deg)`, transformOrigin: "center center", opacity: 0.5,
        }} />
      ))}

      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 30,
        transform: `scale(${interpolate(logoSpring, [0, 1], [0.5, 1])})`,
        opacity: interpolate(logoSpring, [0, 1], [0, 1]),
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{
            width: 80, height: 80, borderRadius: 20, background: "#2547D0",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ color: "white", fontWeight: 900, fontSize: 44, fontFamily: "sans-serif" }}>T</span>
          </div>
          <span style={{ fontFamily: "sans-serif", fontWeight: 800, fontSize: 64, color: "#E8EAF0", letterSpacing: -1 }}>
            tecvo
          </span>
        </div>
      </div>

      <div style={{
        marginTop: 25, textAlign: "center",
        opacity: interpolate(tagSpring, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(tagSpring, [0, 1], [15, 0])}px)`,
      }}>
        <div style={{
          fontFamily: "sans-serif", fontSize: 38, fontWeight: 600,
          color: "rgba(232,234,240,0.8)", lineHeight: 1.4,
        }}>
          Gestão completa para empresas{"\n"}de climatização
        </div>
      </div>

      <div style={{
        marginTop: 50,
        opacity: interpolate(ctaSpring, [0, 1], [0, 1]),
        transform: `scale(${interpolate(ctaSpring, [0, 1], [0.9, 1])})`,
      }}>
        <div style={{ background: "#2547D0", borderRadius: 24, padding: "22px 60px" }}>
          <span style={{ fontFamily: "sans-serif", fontSize: 34, fontWeight: 700, color: "white" }}>
            tecvo.com.br
          </span>
        </div>
      </div>

      <div style={{
        position: "absolute", bottom: 80,
        display: "flex", alignItems: "center", gap: 20,
        opacity: interpolate(techSpring, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(techSpring, [0, 1], [30, 0])}px)`,
      }}>
        <Img src={staticFile("images/technician.png")} style={{ width: 100, height: 100, objectFit: "contain", borderRadius: 50 }} />
        <div style={{ opacity: interpolate(quoteSpring, [0, 1], [0, 1]) }}>
          <div style={{ fontFamily: "sans-serif", fontSize: 26, fontWeight: 400, color: "rgba(232,234,240,0.6)", fontStyle: "italic" }}>
            "Recomendo para todo técnico."
          </div>
          <div style={{ fontFamily: "sans-serif", fontSize: 22, fontWeight: 600, color: "#2547D0", marginTop: 4 }}>
            — Carlos Silva
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
