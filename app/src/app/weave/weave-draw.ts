import { COVER_LONG_EDGE, drawCoverFit, type CoverFrameSize, type CoverImage } from "./cover-sample";
import { CAPTION_ARTIST_FAMILY } from "./weave-fonts";
import type { WeaveLayout } from "./weave-layout";
import type { WeaveCaptionParams } from "./weave-params";

type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function toCss(color: number): string {
  return `rgb(${(color >> 16) & 255},${(color >> 8) & 255},${color & 255})`;
}

/** Where the weave fades out above the caption: fully visible at `from`, gone by `to` (frame y). */
export type WeaveFade = Readonly<{ from: number; to: number }>;

/** Opacity of the weave at frame row `y`: 1 above the fade, easing down to 0 at its end. */
export function fadeOpacity(fade: WeaveFade | null, y: number): number {
  if (!fade || y <= fade.from) return 1;
  if (y >= fade.to) return 0;
  const t = (y - fade.from) / (fade.to - fade.from);
  return 1 - t * t * (3 - 2 * t);
}

/** Draws glyphs [from, to) in frame units. The font is only reassigned when the size changes. */
export function drawGlyphs(
  context: Context2D,
  layout: WeaveLayout,
  family: string,
  from = 0,
  to = layout.count,
): void {
  context.textBaseline = "middle";
  context.textAlign = "left";
  let currentSize = -1;
  const fonts = new Map<number, string>();
  for (let index = from; index < to; index += 1) {
    const size = layout.size[index];
    if (size !== currentSize) {
      let font = fonts.get(size);
      if (font === undefined) {
        font = `900 ${size}px ${family}`;
        fonts.set(size, font);
      }
      context.font = font;
      currentSize = size;
    }
    context.fillStyle = toCss(layout.color[index]);
    context.fillText(layout.chars[index], layout.x[index], layout.y[index]);
  }
}

/**
 * Draws glyphs [from, to) row by row; rows inside `fade` are fainter and rows past its end are
 * skipped, so the weave dissolves under the caption.
 */
export function drawFadedGlyphs(
  context: Context2D,
  layout: WeaveLayout,
  family: string,
  from: number,
  to: number,
  fade: WeaveFade | null,
): void {
  if (!fade) {
    drawGlyphs(context, layout, family, from, to);
    return;
  }
  let rowStart = from;
  while (rowStart < to) {
    const y = layout.y[rowStart];
    let rowEnd = rowStart + 1;
    while (rowEnd < to && layout.y[rowEnd] === y) rowEnd += 1;
    const opacity = fadeOpacity(fade, y);
    if (opacity > 0) {
      context.globalAlpha = opacity;
      drawGlyphs(context, layout, family, rowStart, rowEnd);
    }
    rowStart = rowEnd;
  }
  context.globalAlpha = 1;
}

/** The first glyph row the fade can touch; rows are `rowHeight` tall and start at y = 0. */
export function fadeStartRow(fade: WeaveFade, rowHeight: number): number {
  return Math.max(0, Math.floor(fade.from / rowHeight) * rowHeight);
}

/** Draws the cover under the glyphs; inside `fade` each glyph row of it is fainter. */
export function drawUnderlay(
  context: Context2D,
  cover: CoverImage | null,
  width: number,
  height: number,
  alpha: number,
  fade: WeaveFade | null = null,
  rowHeight = height,
): void {
  if (!cover || alpha <= 0) return;
  const solidHeight = fade ? Math.min(height, fadeStartRow(fade, rowHeight)) : height;
  context.save();
  context.beginPath();
  context.rect(0, 0, width, solidHeight);
  context.clip();
  context.globalAlpha = alpha;
  drawCoverFit(context, cover, width, height);
  context.restore();
  if (!fade) return;
  for (let top = solidHeight; top < Math.min(height, fade.to); top += rowHeight) {
    const opacity = fadeOpacity(fade, top + rowHeight / 2);
    if (opacity <= 0) continue;
    context.save();
    context.beginPath();
    context.rect(0, top, width, rowHeight);
    context.clip();
    context.globalAlpha = alpha * opacity;
    drawCoverFit(context, cover, width, height);
    context.restore();
  }
}

/** Height of the caption band at the bottom of the cover, 0 when there is nothing to show. */
export function captionBandHeight(width: number, caption: WeaveCaptionParams): number {
  return caption.enabled && (caption.title || caption.artist) ? Math.round(width * 0.085) : 0;
}

/**
 * With Soft fade on, the weave dissolves into the background over the bottom of the cover so
 * the caption reads clearly without a hard strip: it starts fading 2.6 bands up and is gone
 * just above the text. Null for a solid strip or no caption.
 */
export function captionFade(
  width: number,
  height: number,
  caption: WeaveCaptionParams,
): WeaveFade | null {
  const band = captionBandHeight(width, caption);
  return band === 0 || !caption.fade ? null : { from: height - band * 2.6, to: height - band * 0.8 };
}

/** How much of the cover shows the weave: a solid caption strip cuts it off at the band. */
export function weaveVisibleHeight(width: number, height: number, caption: WeaveCaptionParams): number {
  return caption.fade ? height : height - captionBandHeight(width, caption);
}

/** The canvas frame is the cover frame itself (a square when there is no cover). */
export function weaveFrameSize(cover: CoverFrameSize | null): CoverFrameSize {
  return cover
    ? { height: cover.height, width: cover.width }
    : { height: COVER_LONG_EDGE, width: COVER_LONG_EDGE };
}

/** Draws the caption in the strip, or over the faded edge, at the bottom of the cover. */
export function drawCaption(
  context: Context2D,
  width: number,
  height: number,
  caption: WeaveCaptionParams,
  titleFamily: string,
): void {
  const band = captionBandHeight(width, caption);
  if (band === 0) return;
  const padding = width * 0.035;
  const centreY = height - band * 0.48;
  context.save();
  context.fillStyle = caption.textColor;
  context.textBaseline = "middle";
  if (caption.title) {
    context.textAlign = "left";
    context.font = `900 ${band * 0.36}px ${titleFamily}`;
    context.fillText(`《${caption.title}》`, padding * 0.6, centreY, width * 0.68);
  }
  if (caption.artist) {
    context.textAlign = "right";
    context.font = `500 ${band * 0.26}px ${CAPTION_ARTIST_FAMILY}`;
    context.fillText(caption.artist, width - padding, centreY, width * 0.3);
  }
  context.restore();
}
