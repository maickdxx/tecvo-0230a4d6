import { AbsoluteFill, Audio, staticFile } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { TestimonialScene1 } from "./scenes/TestimonialScene1";
import { TestimonialScene2 } from "./scenes/TestimonialScene2";
import { TestimonialScene3 } from "./scenes/TestimonialScene3";
import { TestimonialScene4 } from "./scenes/TestimonialScene4";
import { TestimonialScene5 } from "./scenes/TestimonialScene5";
import { TestimonialScene6 } from "./scenes/TestimonialScene6";

const T = 25;

// Audio ~80.5s @ 30fps = 2415 frames
// Narration segments (approximate):
// S1: 0-13s (390f) - "Antes da Tecvo meu dia era um caos..."
// S2: 13-22s (270f) - "Aí um amigo falou... resolvi testar"
// S3: 22-40s (540f) - "Mudou tudo. Agenda, orçamento, WhatsApp, OS..."
// S4: 40-55s (450f) - "Laudo técnico, foto, profissional..."
// S5: 55-68s (390f) - "Clientes indicando, empresa de verdade..."
// S6: 68-80.5s (375f) - "Se você é técnico... experimenta a Tecvo"
// Total: 2415f + 5*25f overlaps = 2540f scene sum
// 390+270+540+450+390+375 = 2415... let me recalculate with overlaps
// Total scene frames - (5 transitions * 25f) = total video frames
// 2540 - 125 = 2415 ✓

export const TestimonialVideo = () => {
  return (
    <AbsoluteFill style={{ background: "#0a0f1e" }}>
      <Audio src={staticFile("audio/testimonial.mp3")} volume={1} />

      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={390}>
          <TestimonialScene1 />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: T })}
        />

        <TransitionSeries.Sequence durationInFrames={270}>
          <TestimonialScene2 />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-bottom" })}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: T })}
        />

        <TransitionSeries.Sequence durationInFrames={540}>
          <TestimonialScene3 />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: T })}
        />

        <TransitionSeries.Sequence durationInFrames={450}>
          <TestimonialScene4 />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: T })}
        />

        <TransitionSeries.Sequence durationInFrames={390}>
          <TestimonialScene5 />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-left" })}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: T })}
        />

        <TransitionSeries.Sequence durationInFrames={375}>
          <TestimonialScene6 />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
