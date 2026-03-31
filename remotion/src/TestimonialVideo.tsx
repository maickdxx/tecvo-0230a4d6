import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Img, Sequence } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { wipe } from "@remotion/transitions/wipe";
import { slide } from "@remotion/transitions/slide";
import { ContentScene1 } from "./scenes/ContentScene1";
import { ContentScene2 } from "./scenes/ContentScene2";
import { ContentScene3 } from "./scenes/ContentScene3";
import { ContentScene4 } from "./scenes/ContentScene4";
import { ContentScene5 } from "./scenes/ContentScene5";
import { ContentScene6 } from "./scenes/ContentScene6";

const T = 20;

// Audio ~80.5s @ 30fps = 2415 frames
// Narration segments (synced to actual audio):
// S1: 0-13s    (0-390f)    "Olha, eu vou ser sincero... caos total..."
// S2: 13-22s   (390-660f)  "Aí um amigo falou... resolvi testar"
// S3: 22-40s   (660-1200f) "Mudou tudo. Agenda, orçamento, WhatsApp, OS..."
// S4: 40-55s   (1200-1650f)"Laudo técnico, foto, profissional..."
// S5: 55-68s   (1650-2040f)"Clientes indicando, empresa de verdade..."
// S6: 68-80.5s (2040-2415f)"Se você é técnico... experimenta a Tecvo"

// Subtitle segments - each line synced to ~3-4 seconds of narration
const SUBTITLES: { start: number; end: number; text: string }[] = [
  // S1: "Olha, eu vou ser sincero contigo..."
  { start: 0, end: 120, text: "Olha, eu vou ser sincero contigo." },
  { start: 120, end: 240, text: "Antes da Tecvo, meu dia era um caos total." },
  { start: 240, end: 390, text: "Cliente ligando, WhatsApp lotado, papel pra tudo que é lado..." },
  // S2: "Aí um amigo meu falou..."
  { start: 390, end: 510, text: "Aí um amigo meu falou: cara, experimenta a Tecvo." },
  { start: 510, end: 660, text: "Eu pensei: ah, mais um sisteminha... Mas resolvi testar." },
  // S3: "Mudou tudo..."
  { start: 660, end: 790, text: "E mano, mudou tudo." },
  { start: 790, end: 900, text: "Agenda organizada, os serviços do dia aparecem certinho." },
  { start: 900, end: 1050, text: "Orçamento? Faço em dois minutos, mando pelo WhatsApp." },
  { start: 1050, end: 1200, text: "E já vira OS automática." },
  // S4: "Laudo técnico..."
  { start: 1200, end: 1350, text: "E o laudo técnico? Ali na hora, tiro foto." },
  { start: 1350, end: 1500, text: "Cliente recebe tudo certinho no celular." },
  { start: 1500, end: 1650, text: "Profissional demais, mano." },
  // S5: "Clientes indicando..."
  { start: 1650, end: 1800, text: "Meus clientes começaram a me indicar mais." },
  { start: 1800, end: 1920, text: "Porque agora eu pareço uma empresa de verdade, sabe?" },
  { start: 1920, end: 2040, text: "Tudo organizado, tudo no sistema." },
  // S6: "Se você é técnico..."
  { start: 2040, end: 2170, text: "Se você é técnico e tá naquela correria, sem controle de nada..." },
  { start: 2170, end: 2300, text: "Experimenta a Tecvo." },
  { start: 2300, end: 2415, text: "Sério, vai mudar tua vida como mudou a minha." },
];

// Scene durations accounting for transitions
// Total frames = sum of durations - (num_transitions * T)
// 2415 = sum - 5*20 = sum - 100, so sum = 2515
const S1_DUR = 410;  // 0-13s + overlap
const S2_DUR = 290;  // 13-22s + overlap
const S3_DUR = 560;  // 22-40s + overlap
const S4_DUR = 470;  // 40-55s + overlap
const S5_DUR = 410;  // 55-68s + overlap
const S6_DUR = 375;  // 68-80.5s
// Sum: 410+290+560+470+410+375 = 2515, minus 5*20 = 2415 ✓

export const TestimonialVideo = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Find current subtitle
  const currentSub = SUBTITLES.find(s => frame >= s.start && frame < s.end);
  
  // Subtitle animation
  const subOpacity = currentSub
    ? interpolate(frame, [currentSub.start, currentSub.start + 8, currentSub.end - 8, currentSub.end], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0;
  const subY = currentSub
    ? interpolate(frame, [currentSub.start, currentSub.start + 10], [15, 0], { extrapolateRight: "clamp" })
    : 0;

  // Technician entrance
  const techEntrance = spring({ frame: frame - 5, fps, config: { damping: 18, stiffness: 60 } });
  const techY = interpolate(techEntrance, [0, 1], [200, 0]);

  // Subtle breathing/head movement
  const breathe = Math.sin(frame * 0.04) * 3;
  const headTilt = Math.sin(frame * 0.02) * 1.5;

  // Name badge
  const badgeSpring = spring({ frame: frame - 40, fps, config: { damping: 14 } });

  // Talking indicator pulse
  const talkPulse = Math.sin(frame * 0.3) * 0.5 + 0.5;

  return (
    <AbsoluteFill style={{ background: "#0a0f1e" }}>
      <Audio src={staticFile("audio/testimonial.mp3")} volume={1} />

      {/* Content scenes - upper portion */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 1200,
        overflow: "hidden",
      }}>
        <TransitionSeries>
          <TransitionSeries.Sequence durationInFrames={S1_DUR}>
            <ContentScene1 />
          </TransitionSeries.Sequence>

          <TransitionSeries.Transition
            presentation={fade()}
            timing={springTiming({ config: { damping: 200 }, durationInFrames: T })}
          />

          <TransitionSeries.Sequence durationInFrames={S2_DUR}>
            <ContentScene2 />
          </TransitionSeries.Sequence>

          <TransitionSeries.Transition
            presentation={wipe({ direction: "from-bottom" })}
            timing={springTiming({ config: { damping: 200 }, durationInFrames: T })}
          />

          <TransitionSeries.Sequence durationInFrames={S3_DUR}>
            <ContentScene3 />
          </TransitionSeries.Sequence>

          <TransitionSeries.Transition
            presentation={slide({ direction: "from-right" })}
            timing={springTiming({ config: { damping: 200 }, durationInFrames: T })}
          />

          <TransitionSeries.Sequence durationInFrames={S4_DUR}>
            <ContentScene4 />
          </TransitionSeries.Sequence>

          <TransitionSeries.Transition
            presentation={fade()}
            timing={springTiming({ config: { damping: 200 }, durationInFrames: T })}
          />

          <TransitionSeries.Sequence durationInFrames={S5_DUR}>
            <ContentScene5 />
          </TransitionSeries.Sequence>

          <TransitionSeries.Transition
            presentation={wipe({ direction: "from-left" })}
            timing={springTiming({ config: { damping: 200 }, durationInFrames: T })}
          />

          <TransitionSeries.Sequence durationInFrames={S6_DUR}>
            <ContentScene6 />
          </TransitionSeries.Sequence>
        </TransitionSeries>
      </div>

      {/* Gradient overlay between content and technician */}
      <div style={{
        position: "absolute", top: 1000, left: 0, right: 0, height: 250,
        background: "linear-gradient(180deg, transparent 0%, #0a0f1eee 50%, #0a0f1e 100%)",
        zIndex: 5,
      }} />

      {/* Technician - persistent at bottom */}
      <div style={{
        position: "absolute", bottom: -30, left: "50%",
        transform: `translateX(-50%) translateY(${techY + breathe}px) rotate(${headTilt}deg)`,
        opacity: interpolate(techEntrance, [0, 0.3], [0, 1]),
        zIndex: 10,
      }}>
        <Img
          src={staticFile("images/technician-office.png")}
          style={{ width: 700, height: 700, objectFit: "contain" }}
        />

        {/* Name badge */}
        <div style={{
          position: "absolute", bottom: 200, left: "50%",
          transform: `translateX(-50%) scale(${interpolate(badgeSpring, [0, 1], [0.5, 1])})`,
          opacity: interpolate(badgeSpring, [0, 1], [0, 1]),
          background: "linear-gradient(135deg, #1e3a5f, #1a3050)",
          borderRadius: 18, padding: "10px 24px",
          display: "flex", alignItems: "center", gap: 10,
          boxShadow: "0 6px 24px rgba(0,0,0,0.5)",
          whiteSpace: "nowrap",
        }}>
          <span style={{ fontFamily: "sans-serif", fontSize: 22, fontWeight: 700, color: "white" }}>
            Carlos Silva
          </span>
          <span style={{ fontFamily: "sans-serif", fontSize: 16, fontWeight: 400, color: "rgba(255,255,255,0.6)" }}>
            Técnico HVAC
          </span>
        </div>

        {/* Talking indicator */}
        <div style={{
          position: "absolute", bottom: 245, left: "50%",
          transform: "translateX(-50%)",
          display: "flex", gap: 4, alignItems: "flex-end",
        }}>
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} style={{
              width: 4, borderRadius: 2,
              background: "#2547D0",
              height: 8 + Math.sin(frame * 0.4 + i * 1.2) * 8,
              opacity: 0.6 + talkPulse * 0.4,
            }} />
          ))}
        </div>
      </div>

      {/* Subtitles - above technician */}
      {currentSub && (
        <div style={{
          position: "absolute",
          bottom: 520,
          left: 40, right: 40,
          zIndex: 15,
          opacity: subOpacity,
          transform: `translateY(${subY}px)`,
          textAlign: "center",
        }}>
          <div style={{
            display: "inline-block",
            background: "rgba(0,0,0,0.75)",
            borderRadius: 16,
            padding: "14px 28px",
            maxWidth: "90%",
          }}>
            <span style={{
              fontFamily: "sans-serif",
              fontSize: 34,
              fontWeight: 700,
              color: "white",
              lineHeight: 1.4,
              textShadow: "0 2px 8px rgba(0,0,0,0.5)",
            }}>
              {currentSub.text}
            </span>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
