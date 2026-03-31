import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";

// 150 + 140 + 160 + 140 + 160 = 750, minus 4 transitions * 15 = 60 → 690
export const RemotionRoot = () => (
  <Composition
    id="main"
    component={MainVideo}
    durationInFrames={690}
    fps={30}
    width={1080}
    height={1920}
  />
);
