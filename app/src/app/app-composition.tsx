import { composeToolcraftApp } from "@/toolcraft/runtime/react";

import { appSchema } from "./app-schema";
import { songSearchControlType } from "./controls/song-section";
import { SongSearchControl } from "./song/song-search-control";
import { WeaveCanvas } from "./weave/weave-canvas";
import { weaveExportRenderer, weaveSceneBoundsProvider } from "./weave/weave-export";
import { weavePipelineRegistration } from "./weave/weave-pipeline";

export const appComposition = composeToolcraftApp(appSchema, {
  controls: { renderers: { [songSearchControlType]: SongSearchControl } },
  renderer: { pipelineRegistration: weavePipelineRegistration },
  scene: {
    canvasContent: <WeaveCanvas />,
    rasterFrameRenderer: weaveExportRenderer,
    renderDefaultCanvasMedia: false,
    sceneBoundsProvider: weaveSceneBoundsProvider,
  },
});
