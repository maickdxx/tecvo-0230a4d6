import { AbsoluteFill, Audio, staticFile } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { Scene1Hook } from "./scenes/Scene1Hook";
import { Scene2Problem } from "./scenes/Scene2Problem";
import { Scene3Features } from "./scenes/Scene3Features";
import { Scene4Benefits } from "./scenes/Scene4Benefits";
import { Scene5Closing } from "./scenes/Scene5Closing";
import { PersistentBackground } from "./components/PersistentBackground";

const TRANSITION = 20;

export const MainVideo = () => {
  return (
    <AbsoluteFill>
      <PersistentBackground />
      <Audio src={staticFile("audio/narration.mp3")} volume={1} />
      {/* Scene durations aligned to narration segments:
          S1 0-8s (250f) | S2 8-17s (280f) | S3 17-28s (340f) | S4 28-36s (260f) | S5 36-42s (210f)
          Total with 4x20f transitions: 1340-80 = 1260f */}
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={250}>
          <Scene1Hook />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-left" })}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: TRANSITION })}
        />
        <TransitionSeries.Sequence durationInFrames={280}>
          <Scene2Problem />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: TRANSITION })}
        />
        <TransitionSeries.Sequence durationInFrames={340}>
          <Scene3Features />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: TRANSITION })}
        />
        <TransitionSeries.Sequence durationInFrames={260}>
          <Scene4Benefits />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: TRANSITION })}
        />
        <TransitionSeries.Sequence durationInFrames={210}>
          <Scene5Closing />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
