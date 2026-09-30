import type { ToolcraftControlSchema } from "@/toolcraft/runtime";

import { WEAVE_DEFAULT_BACKGROUND, WEAVE_TARGETS } from "../weave/weave-params";

/** Authored Background source pair; runtime moves it into Setup beside Infinity canvas. */
export const backgroundSection = {
  controls: {
    includeBackground: {
      applicability: { mode: "always" },
      defaultValue: true,
      description: "Fills the preview and PNG behind the glyphs. Off exports a transparent PNG.",
      label: "Include",
      performanceReason: "The runtime background changes fill only; glyph output is unchanged.",
      performanceRole: "responsiveness",
      target: "export.includeBackground",
      type: "switch",
    },
    background: {
      applicability: { mode: "always" },
      defaultValue: WEAVE_DEFAULT_BACKGROUND,
      description: "A light background inverts tone sizing so dark cover areas get larger glyphs.",
      label: false,
      performanceReason: "Crossing between dark and light backgrounds re-weaves once with inverted tone sizing.",
      performanceRole: "responsiveness",
      target: WEAVE_TARGETS.background,
      type: "color",
    },
  } satisfies Record<string, ToolcraftControlSchema>,
  id: "background",
  layoutGroups: [
    {
      columns: 2,
      controls: ["includeBackground", "background"],
      layout: "inline",
    },
  ] as const,
  title: "Background",
};
