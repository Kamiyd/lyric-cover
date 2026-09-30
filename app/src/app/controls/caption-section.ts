import type { ToolcraftControlSchema } from "@/toolcraft/runtime";

import { WEAVE_TARGETS } from "../weave/weave-params";

const whenCaptionOn = {
  all: [{ equals: true, target: WEAVE_TARGETS.captionEnabled }],
  mode: "conditional",
} as const;

export const captionSection = {
  controls: {
    enabled: {
      applicability: { mode: "always" },
      defaultValue: true,
      description: "Adds a strip with the song title and artist along the bottom of the output.",
      label: "Show strip",
      performanceReason: "The caption strip recomposes over the cached glyph raster.",
      performanceRole: "responsiveness",
      target: WEAVE_TARGETS.captionEnabled,
      type: "switch",
    },
    title: {
      applicability: whenCaptionOn,
      commitMode: "content",
      defaultValue: "",
      label: "Title",
      performanceReason: "Title edits only recompose the caption strip.",
      performanceRole: "responsiveness",
      target: WEAVE_TARGETS.title,
      textValueKind: "single-line",
      type: "text",
    },
    artist: {
      applicability: whenCaptionOn,
      commitMode: "content",
      defaultValue: "",
      label: "Artist",
      performanceReason: "Artist edits only recompose the caption strip.",
      performanceRole: "responsiveness",
      target: WEAVE_TARGETS.artist,
      textValueKind: "single-line",
      type: "text",
    },
    fade: {
      applicability: whenCaptionOn,
      defaultValue: false,
      description:
        "Off: a solid strip under the title. On: the lyrics fade out softly into the background instead.",
      label: "Soft fade",
      performanceReason: "The strip edge is recomposed over the cached glyph raster.",
      performanceRole: "responsiveness",
      target: WEAVE_TARGETS.captionFade,
      type: "switch",
    },
  } satisfies Record<string, ToolcraftControlSchema>,
  id: "caption",
  title: "Caption",
};
