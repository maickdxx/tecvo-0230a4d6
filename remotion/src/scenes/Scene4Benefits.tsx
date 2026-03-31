import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

export const Scene4Benefits = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const quoteSpring = spring({ frame, fps, config: { damping: 18 } });

  const stats = [
    { value: "3h", label: "economizadas por dia", delay: 20, color: "#2547D0" },
    { value: "100%", label: "digital, sem papel", delay: 40, color: "#3B82F6" },
    { value: "2x", label: "mais clientes atendidos", delay: 60, color: "#F59E0B" },
  ];

  const testimonialSpring = spring({ frame: frame - 80, fps, config: { damping: 15 } });
  const float1 = Math.sin(frame * 0.03) * 15;
  const float2 = Math.cos(frame * 0.025) * 12;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 60 }}>
      <div style={{
        position: "absolute", top: 100, left: 80,
        width: 120, height: 120, borderRadius: "50%",
        border: "2px solid rgba(37,71,208,0.15)",
        transform: `translateY(${float1}px)`,
      }} />
      <div style={{
        position: "absolute", bottom: 200, right: 100,
        width: 80, height: 80, borderRadius: "50%",
        background: "rgba(245,158,11,0.08)",
        transform: `translateY(${float2}px)`,
      }} />

      <div style={{
        position: "absolute", top: 140, textAlign: "center", width: "100%",
        opacity: interpolate(quoteSpring, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(quoteSpring, [0, 1], [20, 0])}px)`,
      }}>
        <div style={{ fontFamily: "sans-serif", fontSize: 46, fontWeight: 700, color: "#E8EAF0" }}>
          "Os resultados vieram rápido."
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 40, marginTop: 40 }}>
        {stats.map((s, i) => {
          const sp = spring({ frame: frame - s.delay, fps, config: { damping: 12, stiffness: 100 } });
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 30,
              opacity: interpolate(sp, [0, 1], [0, 1]),
              transform: `translateX(${interpolate(sp, [0, 1], [80, 0])}px)`,
            }}>
              <div style={{
                minWidth: 200, textAlign: "right",
                fontFamily: "sans-serif", fontSize: 90, fontWeight: 900,
                color: s.color, letterSpacing: -3,
              }}>
                {s.value}
              </div>
              <div style={{ fontFamily: "sans-serif", fontSize: 34, fontWeight: 400, color: "rgba(232,234,240,0.7)" }}>
                {s.label}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        position: "absolute", bottom: 120, left: 80, right: 80, textAlign: "center",
        opacity: interpolate(testimonialSpring, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(testimonialSpring, [0, 1], [20, 0])}px)`,
      }}>
        <div style={{
          fontFamily: "sans-serif", fontSize: 30, fontWeight: 400,
          fontStyle: "italic", color: "rgba(232,234,240,0.5)", lineHeight: 1.5,
        }}>
          "Hoje consigo gerenciar tudo{"\n"}pelo celular, de qualquer lugar."
        </div>
      </div>
    </AbsoluteFill>
  );
};
