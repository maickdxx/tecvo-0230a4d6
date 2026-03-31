import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";

// ~42s audio → 1260 frames at 30fps
export const RemotionRoot = () => (
  <Composition
    id="main"
    component={MainVideo}
    durationInFrames={1260}
    fps={30}
    width={1080}
    height={1920}
  />
);
