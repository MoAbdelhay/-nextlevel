import React from "react";
import { Composition } from "remotion";
import { MoujIntro } from "./MoujIntro";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="MoujIntro"
    component={MoujIntro}
    durationInFrames={150}
    fps={30}
    width={1920}
    height={1080}
    defaultProps={{ tagline: "Real Estate Marketing", taglineAr: "تسويق عقاري" }}
  />
);
