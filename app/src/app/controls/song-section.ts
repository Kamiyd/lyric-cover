import {
  defineToolcraftCustomControlType,
  type ToolcraftControlSchema,
} from "@/toolcraft/runtime";

import { WEAVE_TARGETS } from "../weave/weave-params";

export const songSearchControlType = defineToolcraftCustomControlType("songSearch");

export const songSection = {
  controls: {
    // Language comes first: it decides which store is searched and which script a pick uses.
    language: {
      applicability: { mode: "always" },
      defaultValue: "cn",
      description:
        "Chooses the iTunes store for search results: 简体 and 繁體 use Chinese store names (简体 converted from traditional), English uses the US store.",
      label: "Language",
      options: [
        { label: "简体", value: "cn" },
        { label: "繁體", value: "tw" },
        { label: "English", value: "en" },
      ],
      orderRole: "mode",
      performanceReason: "Language only changes the search request and the names applied on the next pick.",
      performanceRole: "responsiveness",
      target: WEAVE_TARGETS.language,
      type: "segmented",
    },
    search: {
      applicability: { mode: "always" },
      defaultValue: null,
      description:
        "Searches iTunes for the song. Picking a result sets the cover, caption and lyrics (from LRCLIB) in one step and replaces an uploaded cover.",
      label: "Search",
      orderRole: "primary",
      performanceReason: "Picking a song swaps the cover source and lyrics, which re-samples and re-weaves the output once.",
      performanceRole: "responsiveness",
      target: WEAVE_TARGETS.pick,
      type: songSearchControlType,
    },
  } satisfies Record<string, ToolcraftControlSchema>,
  id: "song",
  title: "Song",
};

export const songSourceSection = {
  controls: {
    cover: {
      applicability: { mode: "always" },
      assetKind: "image",
      description: "An uploaded cover replaces the searched cover.",
      label: "Cover",
      performanceReason: "A new cover is decoded and sampled once before the glyphs are re-woven.",
      performanceRole: "responsiveness",
      target: WEAVE_TARGETS.cover,
      type: "fileDrop",
    },
    lyrics: {
      applicability: { mode: "always" },
      defaultValue: "",
      label: "Lyrics",
      performanceReason: "Editing lyrics changes the glyph sequence and re-weaves the cover.",
      performanceRole: "responsiveness",
      target: WEAVE_TARGETS.lyrics,
      textValueKind: "multiline",
      type: "code",
    },
  } satisfies Record<string, ToolcraftControlSchema>,
  id: "song-source",
  title: "Cover & Lyrics",
};
