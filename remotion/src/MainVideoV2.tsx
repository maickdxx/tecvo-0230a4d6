import { AbsoluteFill, Audio, staticFile } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { Scene1HookV2 } from "./scenes/Scene1HookV2";
import { Scene2ProblemV2 } from "./scenes/Scene2ProblemV2";
import { Scene3FeaturesV2 } from "./scenes/Scene3FeaturesV2";
import { Scene4BenefitsV2 } from "./scenes/Scene4BenefitsV2";
import { Scene5ClosingV2 } from "./scenes/Scene5ClosingV2";
import { CinematicBackground } from "./components/CinematicBackground";
import { FloatingParticles } from "./components/FloatingParticles";

const T = 25; // transition duration

// Narration ~42s @30fps = 1260 total frames
// Scene durations (accounting for 4 transitions of 25f each = 100f overlap):
// Total visual = 1260 + 100 = 1360f across 5 scenes
// S1: 0-8s hook = 240f
// S2: 8-17s problems = 270f  
// S3: 17-28s features = 330f
// S4: 28-36s benefits = 260f
// S5: 36-42s closing = 260f
// Sum: 1360f - 4*25f overlap = 1260f ✓

export const MainVideoV2 = () => {
  return (
    <AbsoluteFill>
      {/* Persistent cinematic background */}
      <CinematicBackground />

      {/* Audio track */}
      <Audio src={staticFile("audio/narration.mp3")} volume={1} />

      {/* Scene sequence with premium transitions */}
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={240}>
          <Scene1HookV2 />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-bottom" })}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: T })}
        />

        <TransitionSeries.Sequence durationInFrames={270}>
          <Scene2ProblemV2 />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: T })}
        />

        <TransitionSeries.Sequence durationInFrames={330}>
          <Scene3FeaturesV2 />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: T })}
        />

        <TransitionSeries.Sequence durationInFrames={260}>
          <Scene4BenefitsV2 />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: T })}
        />

        <TransitionSeries.Sequence durationInFrames={260}>
          <Scene5ClosingV2 />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      {/* Floating particles on top */}
      <FloatingParticles />
    </AbsoluteFill>
  );
};
