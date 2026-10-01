import {
  defineToolcraft,
  imageExportModule,
  mediaSourceModule,
} from "@/toolcraft/runtime";

import appDefaults from "./app-defaults.json" with { type: "json" };
import { appIdentity } from "./app-identity";
import { backgroundSection } from "./controls/background-section";
import { captionSection } from "./controls/caption-section";
import { songSection, songSourceSection } from "./controls/song-section";
import { weaveSection } from "./controls/weave-section";

export const appSchema = defineToolcraft({
  defaults: appDefaults,
  base: {
    canvas: {
      enabled: true,
      renderScale: true,
      size: { height: 1080, unit: "px", width: 1080 },
      sizing: { mode: "intrinsic-media" },
      upload: true,
    },
    identity: appIdentity,
    panels: {
      controls: {
        sections: [ songSection, songSourceSection, weaveSection, captionSection, backgroundSection],
        title: "Lyric Cover",
      },
    },
    toolbar: {
      language: true,
      sound: false,
      history: true,
      radar: true,
      theme: true,
      zoom: true,
    },
  },
  modules: [mediaSourceModule(), imageExportModule()],
});
