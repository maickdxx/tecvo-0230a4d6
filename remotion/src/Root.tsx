import { Composition } from "remotion";
import { MainVideoV2 } from "./MainVideoV2";

export const RemotionRoot = () => (
  <Composition
    id="main"
    component={MainVideoV2}
    durationInFrames={1260}
    fps={30}
    width={1080}
    height={1920}
  />
);
