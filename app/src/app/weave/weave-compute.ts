import { weaveCharacters } from "../song/lyrics-text";
import { createScratchCanvas, getScratchContext, type CoverSample } from "./cover-sample";
import { ensureWeaveFonts, weaveFontFamily } from "./weave-fonts";
import { EMPTY_WEAVE_LAYOUT, layoutWeave, type WeaveLayout } from "./weave-layout";
import type { WeaveGlyphParams } from "./weave-params";

/** The cache key shared by the preview and export for the glyph layout pass. */
export function weaveLayoutCacheInput(sample: CoverSample | null, glyphs: WeaveGlyphParams) {
  return {
    "background.tone": glyphs.lightBackground,
    "cover-sample": sample,
    "song.lyrics": glyphs.lyrics,
    "weave.compact": glyphs.compact,
    "weave.density": glyphs.density,
    "weave.font": glyphs.font,
    "weave.saturation": glyphs.saturation,
    "weave.toneSize": glyphs.toneSize,
  } as const;
}

export async function computeWeaveLayout(
  sample: CoverSample | null,
  glyphs: WeaveGlyphParams,
): Promise<WeaveLayout> {
  if (!sample || glyphs.lyrics.trim().length === 0) return EMPTY_WEAVE_LAYOUT;
  const family = weaveFontFamily(glyphs.font);
  await ensureWeaveFonts(glyphs.font, weaveCharacters(glyphs.lyrics, glyphs.compact).join(""));
  const fontSize = sample.width / glyphs.density;
  const measureContext = getScratchContext(createScratchCanvas(8, 8));
  measureContext.font = `900 ${fontSize}px ${family}`;
  return layoutWeave(sample, glyphs, (glyph) => measureContext.measureText(glyph).width);
}
