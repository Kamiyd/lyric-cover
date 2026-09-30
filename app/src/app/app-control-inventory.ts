import type { ToolcraftControlSectionInventoryEntry } from "./acceptance/types";

export const appControlSectionInventory: readonly ToolcraftControlSectionInventoryEntry[] = [
  {
    entity: "Song source",
    entityId: "song-source",
    finiteSelectors: [
      {
        reason: "Language only changes which store names and script a pick applies; it adds no peer controls.",
        role: "parameter",
        target: "song.language",
      },
    ],
    groupingReason:
      "Search, its language, an uploaded cover and the lyrics together define which cover is woven with which text.",
    id: "song",
    splitReason:
      "Finding a song (search and its store language) is a separate task from supplying or editing the cover and lyrics by hand; each stage resets on its own.",
    targets: ["song.pick", "song.language"],
    title: "Song",
    workflowStage: "find",
  },
  {
    entity: "Song source",
    entityId: "song-source",
    finiteSelectors: [],
    groupingReason:
      "Search, its language, an uploaded cover and the lyrics together define which cover is woven with which text.",
    id: "song-source",
    splitReason:
      "Uploading a cover and editing lyrics directly is the manual path, reset independently of the search stage.",
    targets: ["source.cover", "song.lyrics"],
    title: "Cover & Lyrics",
    workflowStage: "supply",
  },
  {
    entity: "Glyph weave",
    entityId: "glyph-weave",
    finiteSelectors: [
      {
        reason: "Font changes glyph shapes and widths without changing which weave settings apply.",
        role: "parameter",
        target: "weave.font",
      },
      {
        reason: "Tone sizing changes glyph sizes without changing which weave settings apply.",
        role: "parameter",
        target: "weave.toneSize",
      },
      {
        reason: "Tight text changes the glyph sequence without changing which weave settings apply.",
        role: "parameter",
        target: "weave.compact",
      },
    ],
    groupingReason:
      "Density, colour, font, sizing, text flow and underlay all tune how the lyric glyphs render the cover.",
    id: "weave",
    targets: [
      "weave.density",
      "weave.saturation",
      "weave.font",
      "weave.toneSize",
      "weave.compact",
      "weave.underlay",
    ],
    title: "Weave",
  },
  {
    entity: "Caption strip",
    entityId: "caption-strip",
    finiteSelectors: [
      {
        affectedTargets: [],
        reason: "Caption decides whether the strip and its Title and Artist fields apply.",
        role: "branch",
        target: "caption.enabled",
      },
      {
        reason: "Soft fade chooses between a solid strip and a faded edge under the caption.",
        role: "parameter",
        target: "caption.fade",
      },
    ],
    groupingReason: "The caption switch and its title and artist text define one strip under the weave.",
    id: "caption",
    targets: ["caption.enabled", "caption.title", "caption.artist", "caption.fade"],
    title: "Caption",
  },
  {
    entity: "Output background",
    entityId: "output-background",
    finiteSelectors: [
      {
        affectedTargets: ["appearance.background"],
        reason: "Background inclusion determines whether its colour fills preview and PNG output.",
        role: "branch",
        target: "export.includeBackground",
      },
    ],
    groupingReason: "Inclusion and colour together define the fill behind the woven glyphs.",
    id: "background",
    targets: ["export.includeBackground", "appearance.background"],
    title: "Background",
  },
  {
    entity: "Image delivery",
    entityId: "image-delivery",
    finiteSelectors: [
      {
        reason: "Image format changes its own exported artifact encoding.",
        role: "parameter",
        target: "export.image.format",
      },
      {
        reason: "Image resolution changes its own exported artifact dimensions.",
        role: "parameter",
        target: "export.image.resolution",
      },
    ],
    groupingReason: "Format and resolution jointly configure the exported woven cover image.",
    id: "runtime.image-export",
    targets: ["export.image.format", "export.image.resolution"],
    title: "Image Export",
  },
];
