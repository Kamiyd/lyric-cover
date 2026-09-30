import {
  registerToolcraftRendererPipeline,
  type ToolcraftRendererPipelinePassContract,
} from "@/toolcraft/runtime";

import type { CoverSample } from "./cover-sample";
import type { WeaveLayout } from "./weave-layout";

/** Glyphs and underlay at backing resolution; the caption strip is composed on top of it. */
export type WeaveRaster = Readonly<{
  backingHeight: number;
  backingWidth: number;
  bitmap: ImageBitmap;
}>;

type WeavePasses = {
  "caption-compose": ToolcraftRendererPipelinePassContract<number>;
  "cover-sample": ToolcraftRendererPipelinePassContract<CoverSample | null>;
  "export-render": ToolcraftRendererPipelinePassContract<void>;
  "weave-layout": ToolcraftRendererPipelinePassContract<WeaveLayout>;
  "weave-raster": ToolcraftRendererPipelinePassContract<WeaveRaster | null>;
};

const coverFrame = {
  kind: "intrinsic",
  reason:
    "The woven cover is defined by the cover frame: the cover fills exactly that rectangle at its own aspect ratio and every glyph cell and the caption lie inside it.",
} as const;

const glyphPasses = ["weave-layout", "weave-raster", "caption-compose"] as const;
const previewPasses = ["cover-sample", ...glyphPasses] as const;

export const weavePipelineRegistration = registerToolcraftRendererPipeline<WeavePasses>()({
  interactionInvalidation: [
    { interaction: "initial-render", invalidates: previewPasses, targets: ["canvas.initial-render"] },
    { interaction: "media-import", invalidates: previewPasses, targets: ["source.cover"] },
    { interaction: "control-change", invalidates: previewPasses, targets: ["song.pick"] },
    {
      interaction: "control-change",
      invalidates: glyphPasses,
      mustNotInvalidate: ["cover-sample"],
      targets: ["song.lyrics", "weave.font", "weave.toneSize", "weave.compact", "appearance.background"],
    },
    {
      interaction: "control-drag",
      invalidates: glyphPasses,
      mustNotInvalidate: ["cover-sample"],
      targets: ["weave.density", "weave.saturation", "weave.brightness"],
    },
    {
      interaction: "control-drag",
      invalidates: ["weave-raster", "caption-compose"],
      mustNotInvalidate: ["cover-sample", "weave-layout"],
      targets: ["weave.underlay"],
    },
    {
      interaction: "control-change",
      invalidates: ["caption-compose"],
      mustNotInvalidate: ["cover-sample", "weave-layout", "weave-raster"],
      targets: ["caption.enabled", "caption.title", "caption.artist", "caption.fade"],
    },
    {
      interaction: "control-change",
      invalidates: ["weave-raster", "caption-compose"],
      mustNotInvalidate: ["cover-sample", "weave-layout"],
      targets: ["canvas.renderScale"],
    },
    {
      interaction: "control-change",
      invalidates: [],
      mustNotInvalidate: previewPasses,
      targets: ["export.includeBackground", "song.language"],
    },
    { interaction: "viewport-drag", invalidates: [], mustNotInvalidate: previewPasses, targets: ["canvas.viewport.offset"] },
    { interaction: "viewport-zoom", invalidates: [], mustNotInvalidate: previewPasses, targets: ["canvas.viewport.zoom"] },
    {
      interaction: "export",
      invalidates: ["export-render"],
      mustNotInvalidate: previewPasses,
      targets: ["actions.output"],
    },
  ],
  passes: [
    {
      cacheKey: ["cover.source"],
      cost: { dimensions: [], frequency: "discrete", relationship: "constant" },
      id: "cover-sample",
      inputs: ["source.cover", "song.pick"],
      invalidatedBy: ["source.cover", "song.pick"],
      kind: "decode",
      lifecycle: { cache: "memoized", resourceScope: "source" },
      output: "intermediate",
      quality: "full",
      runsOn: "main",
      sceneBounds: coverFrame,
    },
    {
      cacheKey: [
        "cover-sample",
        "song.lyrics",
        "weave.density",
        "weave.saturation",
        "weave.brightness",
        "weave.font",
        "weave.toneSize",
        "weave.compact",
        "background.tone",
      ],
      cost: { dimensions: ["weave-density"], frequency: "interaction", relationship: "quadratic" },
      id: "weave-layout",
      inputs: [
        "cover-sample",
        "song.lyrics",
        "weave.density",
        "weave.saturation",
        "weave.brightness",
        "weave.font",
        "weave.toneSize",
        "weave.compact",
        "appearance.background",
      ],
      invalidatedBy: [
        "cover-sample",
        "song.lyrics",
        "weave.density",
        "weave.saturation",
        "weave.brightness",
        "weave.font",
        "weave.toneSize",
        "weave.compact",
        "appearance.background",
      ],
      kind: "text-layout",
      lifecycle: { cache: "memoized", resourceScope: "interaction" },
      output: "intermediate",
      quality: "full",
      runsOn: "main",
      sceneBounds: coverFrame,
    },
    {
      cacheKey: ["weave-layout", "weave.underlay", "canvas.backing.width", "canvas.backing.height"],
      cost: { dimensions: ["weave-density"], frequency: "interaction", relationship: "quadratic" },
      id: "weave-raster",
      inputs: ["weave-layout", "weave.underlay", "canvas.backing.width", "canvas.backing.height"],
      invalidatedBy: ["weave-layout", "weave.underlay", "canvas.backing.width", "canvas.backing.height"],
      kind: "rasterize",
      lifecycle: { cache: "memoized", resourceScope: "interaction" },
      output: "intermediate",
      quality: "retina",
      runsOn: "main",
      sceneBounds: coverFrame,
    },
    {
      cost: { dimensions: [], frequency: "interaction", relationship: "constant" },
      id: "caption-compose",
      inputs: ["weave-raster", "caption.enabled", "caption.title", "caption.artist", "caption.fade", "appearance.background"],
      invalidatedBy: ["weave-raster", "caption.enabled", "caption.title", "caption.artist", "caption.fade", "appearance.background"],
      kind: "composite",
      lifecycle: { cache: "none", resourceScope: "call" },
      output: "preview",
      quality: "retina",
      runsOn: "main",
      sceneBounds: coverFrame,
    },
    {
      cost: { dimensions: ["weave-density", "export-pixels"], frequency: "batch", relationship: "product" },
      id: "export-render",
      inputs: ["cover-sample", "weave-layout", "weave.underlay", "caption.enabled", "caption.title", "caption.artist", "caption.fade"],
      invalidatedBy: ["cover-sample", "weave-layout", "weave.underlay", "caption.enabled", "caption.title", "caption.artist", "caption.fade"],
      kind: "export",
      lifecycle: { cache: "none", resourceScope: "call" },
      output: "export",
      quality: "export",
      runsOn: "main",
    },
  ],
  runtimeId: "lyric-weave-v1",
});

export const coverSamplePass = weavePipelineRegistration.getPass("cover-sample");
export const weaveLayoutPass = weavePipelineRegistration.getPass("weave-layout");
export const weaveRasterPass = weavePipelineRegistration.getPass("weave-raster");
export const captionComposePass = weavePipelineRegistration.getPass("caption-compose");
export const exportRenderPass = weavePipelineRegistration.getPass("export-render");
