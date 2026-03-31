import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Img, Sequence } from "remotion";
import { ContentScene1 } from "./scenes/ContentScene1";
import { ContentScene2 } from "./scenes/ContentScene2";
import { ContentScene3 } from "./scenes/ContentScene3";
import { ContentScene4 } from "./scenes/ContentScene4";
import { ContentScene5 } from "./scenes/ContentScene5";
import { ContentScene6 } from "./scenes/ContentScene6";

const TOTAL_FRAMES = 2415;

type SceneKey = "chaos" | "friend" | "workflow" | "report" | "referrals" | "cta";

type Beat = {
  from: number;
  to: number;
  text: string;
  scene: SceneKey;
};

const SCENE_COMPONENTS = {
  chaos: ContentScene1,
  friend: ContentScene2,
  workflow: ContentScene3,
  report: ContentScene4,
  referrals: ContentScene5,
  cta: ContentScene6,
} as const;

// Single source of truth:
// The same timeline drives BOTH the active subtitle and the scene shown behind it.
// Timings are based on the actual narration pauses detected from the generated audio.
const BEATS: Beat[] = [
  { from: 29, to: 136, text: "Olha, eu vou ser sincero contigo.", scene: "chaos" },
  { from: 136, to: 314, text: "Antes da Tecvo, meu dia era um caos total.", scene: "chaos" },
  { from: 314, to: 405, text: "Cliente ligando, WhatsApp lotado, papel pra tudo que é lado.", scene: "chaos" },

  { from: 405, to: 561, text: "Aí um amigo meu falou: cara, experimenta a Tecvo.", scene: "friend" },
  { from: 561, to: 685, text: "Eu pensei: ah, mais um sisteminha... mas resolvi testar.", scene: "friend" },

  { from: 685, to: 903, text: "E mano, mudou tudo. Agenda organizada, os serviços do dia aparecem certinho.", scene: "workflow" },
  { from: 903, to: 1100, text: "Orçamento? Faço em dois minutos.", scene: "workflow" },
  { from: 1100, to: 1233, text: "Mando pelo WhatsApp e já vira OS automática.", scene: "workflow" },

  { from: 1233, to: 1521, text: "E o laudo técnico? Ali na hora, eu tiro foto.", scene: "report" },
  { from: 1521, to: 1648, text: "O cliente recebe tudo certinho no celular.", scene: "report" },
  { from: 1648, to: 1756, text: "Profissional demais, mano.", scene: "report" },

  { from: 1756, to: 1899, text: "Meus clientes começaram a me indicar mais.", scene: "referrals" },
  { from: 1899, to: 2063, text: "Porque agora eu pareço uma empresa de verdade.", scene: "referrals" },

  { from: 2063, to: 2250, text: "Se você é técnico e tá naquela correria, sem controle de nada...", scene: "cta" },
  { from: 2250, to: 2308, text: "Experimenta a Tecvo.", scene: "cta" },
  { from: 2308, to: TOTAL_FRAMES, text: "Sério, vai mudar tua vida como mudou a minha.", scene: "cta" },
];

const getBeatIndex = (frame: number) => {
  const index = BEATS.findIndex((beat) => frame >= beat.from && frame < beat.to);
  if (index !== -1) return index;
  if (frame < BEATS[0].from) return 0;
  return BEATS.length - 1;
};

const getSceneWindow = (beatIndex: number) => {
  const currentScene = BEATS[beatIndex].scene;

  let startIndex = beatIndex;
  while (startIndex > 0 && BEATS[startIndex - 1].scene === currentScene) {
    startIndex -= 1;
  }

  let endIndex = beatIndex;
  while (endIndex < BEATS.length - 1 && BEATS[endIndex + 1].scene === currentScene) {
    endIndex += 1;
  }

  return {
    scene: currentScene,
    from: startIndex === 0 ? 0 : BEATS[startIndex].from,
    to: endIndex === BEATS.length - 1 ? TOTAL_FRAMES : BEATS[endIndex].to,
  };
};

export const TestimonialVideo = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const beatIndex = getBeatIndex(frame);
  const activeBeat = BEATS.find((beat) => frame >= beat.from && frame < beat.to) ?? null;
  const sceneWindow = getSceneWindow(beatIndex);
  const ActiveScene = SCENE_COMPONENTS[sceneWindow.scene];

  const techEntrance = spring({ frame: frame - 5, fps, config: { damping: 18, stiffness: 60 } });
  const techY = interpolate(techEntrance, [0, 1], [200, 0]);
  const breathe = Math.sin(frame * 0.04) * 3;
  const headTilt = Math.sin(frame * 0.02) * 1.5;
  const badgeSpring = spring({ frame: frame - 40, fps, config: { damping: 14 } });
  const talkPulse = Math.sin(frame * 0.3) * 0.5 + 0.5;

  const subtitleOpacity = activeBeat
    ? interpolate(
        frame,
        [activeBeat.from, activeBeat.from + 6, activeBeat.to - 6, activeBeat.to],
        [0, 1, 1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      )
    : 0;

  const subtitleY = activeBeat
    ? interpolate(frame, [activeBeat.from, activeBeat.from + 8], [16, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  return (
    <AbsoluteFill style={{ background: "#0a0f1e" }}>
      <Audio src={staticFile("audio/testimonial.mp3")} volume={1} />

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1200,
          overflow: "hidden",
        }}
      >
        <Sequence from={sceneWindow.from} durationInFrames={sceneWindow.to - sceneWindow.from}>
          <ActiveScene />
        </Sequence>
      </div>

      <div
        style={{
          position: "absolute",
          top: 1000,
          left: 0,
          right: 0,
          height: 250,
          background: "linear-gradient(180deg, transparent 0%, #0a0f1eee 50%, #0a0f1e 100%)",
          zIndex: 5,
        }}
      />

      <div
        style={{
          position: "absolute",
          bottom: -30,
          left: "50%",
          transform: `translateX(-50%) translateY(${techY + breathe}px) rotate(${headTilt}deg)`,
          opacity: interpolate(techEntrance, [0, 0.3], [0, 1]),
          zIndex: 10,
        }}
      >
        <Img
          src={staticFile("images/technician-office.png")}
          style={{ width: 700, height: 700, objectFit: "contain" }}
        />

        <div
          style={{
            position: "absolute",
            bottom: 200,
            left: "50%",
            transform: `translateX(-50%) scale(${interpolate(badgeSpring, [0, 1], [0.5, 1])})`,
            opacity: interpolate(badgeSpring, [0, 1], [0, 1]),
            background: "linear-gradient(135deg, #1e3a5f, #1a3050)",
            borderRadius: 18,
            padding: "10px 24px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            boxShadow: "0 6px 24px rgba(0,0,0,0.5)",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ fontFamily: "sans-serif", fontSize: 22, fontWeight: 700, color: "white" }}>
            Carlos Silva
          </span>
          <span style={{ fontFamily: "sans-serif", fontSize: 16, fontWeight: 400, color: "rgba(255,255,255,0.6)" }}>
            Técnico HVAC
          </span>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 245,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: 4,
            alignItems: "flex-end",
          }}
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                width: 4,
                borderRadius: 2,
                background: "#2547D0",
                height: 8 + Math.sin(frame * 0.4 + i * 1.2) * 8,
                opacity: 0.6 + talkPulse * 0.4,
              }}
            />
          ))}
        </div>
      </div>

      {activeBeat ? (
        <div
          style={{
            position: "absolute",
            bottom: 520,
            left: 40,
            right: 40,
            zIndex: 15,
            opacity: subtitleOpacity,
            transform: `translateY(${subtitleY}px)`,
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "inline-block",
              background: "rgba(0,0,0,0.75)",
              borderRadius: 16,
              padding: "14px 28px",
              maxWidth: "90%",
            }}
          >
            <span
              style={{
                fontFamily: "sans-serif",
                fontSize: 34,
                fontWeight: 700,
                color: "white",
                lineHeight: 1.4,
                textShadow: "0 2px 8px rgba(0,0,0,0.5)",
              }}
            >
              {activeBeat.text}
            </span>
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
