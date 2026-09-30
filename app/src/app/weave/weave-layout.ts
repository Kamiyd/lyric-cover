import { weaveCharacters } from "../song/lyrics-text";
import type { WeaveGlyphParams } from "./weave-params";

export type SamplePixels = Readonly<{
  height: number;
  pixels: Uint8ClampedArray;
  width: number;
}>;

/** One glyph per cell, flattened into typed arrays so tens of thousands stay cheap. Only the first `count` entries are used. */
export type WeaveLayout = Readonly<{
  chars: readonly string[];
  color: Uint32Array;
  count: number;
  fontSize: number;
  height: number;
  size: Float32Array;
  width: number;
  x: Float32Array;
  y: Float32Array;
}>;

export const EMPTY_WEAVE_LAYOUT: WeaveLayout = Object.freeze({
  chars: [],
  color: new Uint32Array(0),
  count: 0,
  fontSize: 0,
  height: 0,
  size: new Float32Array(0),
  width: 0,
  x: new Float32Array(0),
  y: new Float32Array(0),
});

export type MeasureGlyph = (glyph: string) => number;

/**
 * Lays the lyric characters row by row across the cover. Each glyph samples the average cover
 * colour in a box under its centre, boosts saturation, and — with tone sizing — grows with
 * brightness (or with darkness on a light background) so the cover reads from a distance.
 */
export function layoutWeave(
  sample: SamplePixels,
  params: WeaveGlyphParams,
  measure: MeasureGlyph,
): WeaveLayout {
  const glyphs = weaveCharacters(params.lyrics, params.compact);
  const { height, pixels, width } = sample;
  if (glyphs.length === 0 || width <= 0 || height <= 0) return EMPTY_WEAVE_LAYOUT;

  const fontSize = width / params.density;
  const lineHeight = fontSize;
  const rows = Math.ceil(height / lineHeight);
  const radius = fontSize * 0.45;
  const step = Math.max(1, (radius / 2) | 0);
  const widths = new Map<string, number>();
  // Each glyph advances at least half a font size, so this bounds the number of cells.
  const capacity = Math.ceil(rows * (width / (fontSize * 0.5) + 1));
  const chars: string[] = [];
  const x = new Float32Array(capacity);
  const y = new Float32Array(capacity);
  const size = new Float32Array(capacity);
  const color = new Uint32Array(capacity);
  let count = 0;
  let cursor = 0;

  for (let row = 0; row < rows; row += 1) {
    const centreY = row * lineHeight + lineHeight / 2;
    let left = 0;
    while (left < width) {
      const glyph = glyphs[cursor % glyphs.length];
      cursor += 1;
      let glyphWidth = widths.get(glyph);
      if (glyphWidth === undefined) {
        glyphWidth = measure(glyph) || fontSize * 0.5;
        widths.set(glyph, glyphWidth);
      }
      if (glyph !== " ") {
        const centreX = left + glyphWidth / 2;
        const x0 = Math.max(0, (centreX - radius) | 0);
        const x1 = Math.min(width - 1, (centreX + radius) | 0);
        const y0 = Math.max(0, (centreY - radius) | 0);
        const y1 = Math.min(height - 1, (centreY + radius) | 0);
        let red = 0;
        let green = 0;
        let blue = 0;
        let samples = 0;
        for (let sy = y0; sy <= y1; sy += step) {
          for (let sx = x0; sx <= x1; sx += step) {
            const index = (sy * width + sx) * 4;
            red += pixels[index];
            green += pixels[index + 1];
            blue += pixels[index + 2];
            samples += 1;
          }
        }
        if (samples > 0) {
          red /= samples;
          green /= samples;
          blue /= samples;
          const mean = (red + green + blue) / 3;
          const boosted = (value: number) =>
            Math.max(0, Math.min(255, mean + (value - mean) * params.saturation));
          const r = boosted(red);
          const g = boosted(green);
          const b = boosted(blue);
          const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
          const glyphSize = params.toneSize
            ? fontSize *
              (params.lightBackground ? 1.12 - 0.62 * luminance : 0.5 + 0.62 * luminance)
            : fontSize;
          if (count >= capacity) break;
          chars.push(glyph);
          x[count] = left + (glyphWidth - (glyphSize / fontSize) * glyphWidth) / 2;
          y[count] = centreY;
          size[count] = glyphSize;
          const brighten = (value: number) => Math.min(255, value * params.brightness) | 0;
          color[count] = (brighten(r) << 16) | (brighten(g) << 8) | brighten(b);
          count += 1;
        }
      }
      left += glyphWidth;
    }
  }

  return {
    chars,
    color,
    count,
    fontSize,
    height,
    size,
    width,
    x,
    y,
  };
}
