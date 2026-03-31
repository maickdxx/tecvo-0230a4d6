import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";
import { SceneBurnout } from "./scenes/SceneBurnout";

export const RemotionRoot = () => (
  <>
    <Composition
      id="main"
      component={MainVideo}
      durationInFrames={750}
      fps={30}
      width={1080}
      height={1920}
    />
    <Composition
      id="reels-burnout"
      component={SceneBurnout}
      durationInFrames={300} // 10 seconds
      fps={30}
      width={1080}
      height={1920}
    />
  </>
);
