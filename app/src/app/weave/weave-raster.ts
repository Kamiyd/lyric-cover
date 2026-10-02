import { createScratchCanvas, getScratchContext, type CoverImage } from "./cover-sample";
import {
  captionFade,
  drawCaption,
  drawGlyphs,
  drawUnderlay,
  fadeOpacity,
  fadeStartRow,
  type WeaveFade,
  weaveVisibleHeight,
} from "./weave-draw";
import type { WeaveLayout } from "./weave-layout";
import type { WeaveCaptionParams } from "./weave-params";
import type { WeaveRaster } from "./weave-pipeline";

const RASTER_SLICE_MS = 12;
const GLYPH_BATCH = 256;

export type WeaveRasterRequest = Readonly<{
  backingHeight: number;
  backingWidth: number;
  cover: CoverImage | null;
  family: string;
  layout: WeaveLayout;
  /**
   * Whether the preview still wants this weave. Checked at every pause: a superseded weave stops
   * there instead of finishing, so a slider drag does not queue one full weave per step.
   */
  isWanted?: () => boolean;
  /** Called before each pause with the partly drawn backing, so the preview can weave in. */
  onSlice?: (partial: OffscreenCanvas, drawn: number) => void;
  underlay: number;
}>;

/** The rejection of a weave that a newer request replaced before it finished. */
export class WeaveSupersededError extends Error {
  constructor() {
    super("A newer weave replaced this one.");
    this.name = "AbortError";
  }
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), 0);
  });
}

/** Draws the glyphs into an off-screen backing in ~12 ms slices so the editor stays responsive. */
export async function rasterizeWeave(request: WeaveRasterRequest): Promise<WeaveRaster | null> {
  const { backingHeight, backingWidth, cover, family, isWanted, layout, onSlice, underlay } = request;
  if (layout.count === 0 || backingWidth <= 0 || backingHeight <= 0) return null;
  if (isWanted && !isWanted()) throw new WeaveSupersededError();
  const canvas = createScratchCanvas(backingWidth, backingHeight);
  const context = getScratchContext(canvas);
  const scale = backingWidth / layout.width;
  context.setTransform(scale, 0, 0, scale, 0, 0);
  drawUnderlay(context, cover, layout.width, layout.height, underlay);
  let sliceStarted = performance.now();
  for (let start = 0; start < layout.count; start += GLYPH_BATCH) {
    drawGlyphs(context, layout, family, start, Math.min(layout.count, start + GLYPH_BATCH));
    // Hidden pages throttle timers to ~1 s, so only yield while someone is watching.
    if (!document.hidden && performance.now() - sliceStarted >= RASTER_SLICE_MS) {
      onSlice?.(canvas, Math.min(layout.count, start + GLYPH_BATCH));
      await yieldToBrowser();
      if (isWanted && !isWanted()) throw new WeaveSupersededError();
      sliceStarted = performance.now();
    }
  }
  return { backingHeight, backingWidth, bitmap: canvas.transferToImageBitmap() };
}

function toBackingRow(y: number, scale: number, height: number): number {
  return Math.min(height, Math.round(y * scale));
}

/**
 * Copies the woven rows above `untilY` (frame units) from the full-strength raster onto the
 * visible canvas. Under a caption each glyph row is copied fainter, which is the fade: it is
 * applied here, not in the raster, so showing or hiding the caption never re-draws the glyphs.
 */
function blitWeaveRows(
  context: CanvasRenderingContext2D,
  source: ImageBitmap | OffscreenCanvas,
  layout: WeaveLayout,
  fade: WeaveFade | null,
  untilY: number,
): void {
  const width = source.width;
  const height = source.height;
  const scale = width / layout.width;
  const solidEnd = fade ? Math.min(untilY, fadeStartRow(fade, layout.fontSize)) : untilY;
  const solidPixels = toBackingRow(solidEnd, scale, height);
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = 1;
  if (solidPixels > 0) {
    context.drawImage(source, 0, 0, width, solidPixels, 0, 0, width, solidPixels);
  }
  if (!fade) return;
  for (let top = solidEnd; top < Math.min(untilY, fade.to); top += layout.fontSize) {
    const opacity = fadeOpacity(fade, top + layout.fontSize / 2);
    const from = toBackingRow(top, scale, height);
    const rows = toBackingRow(Math.min(untilY, top + layout.fontSize), scale, height) - from;
    if (opacity > 0 && rows > 0) {
      context.globalAlpha = opacity;
      context.drawImage(source, 0, from, width, rows, 0, from, width, rows);
    }
  }
  context.globalAlpha = 1;
}

export type WeaveProgressRequest = Readonly<{
  canvas: HTMLCanvasElement;
  caption: WeaveCaptionParams;
  drawn: number;
  layout: WeaveLayout;
  partial: OffscreenCanvas;
}>;

/**
 * Shows the rows woven so far. The previous image stays below the writing row, so a re-weave
 * wipes in from the top instead of blanking the canvas; a frame of a new size starts empty.
 */
export function paintWeaveProgress(request: WeaveProgressRequest): void {
  const { canvas, drawn, layout, partial } = request;
  if (drawn <= 0 || layout.count === 0) return;
  if (canvas.width !== partial.width || canvas.height !== partial.height) {
    canvas.width = partial.width;
    canvas.height = partial.height;
  }
  const context = canvas.getContext("2d");
  if (!context) return;
  const writingRowBottom =
    drawn >= layout.count ? layout.height : layout.y[drawn - 1] + layout.fontSize * 0.6;
  const visible = weaveVisibleHeight(layout.width, layout.height, request.caption);
  const untilY = Math.min(visible, writingRowBottom);
  const rows = Math.min(partial.height, Math.ceil((untilY * partial.width) / layout.width));
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, rows);
  blitWeaveRows(context, partial, layout, captionFade(layout.width, layout.height, request.caption), untilY);
}

/** Empties the visible canvas, e.g. when another cover is about to be woven. */
export function clearWeaveCanvas(canvas: HTMLCanvasElement): void {
  canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
}

export type WeaveComposeRequest = Readonly<{
  caption: WeaveCaptionParams;
  captionFamily: string;
  canvas: HTMLCanvasElement;
  fallbackHeight: number;
  fallbackWidth: number;
  layout: WeaveLayout | null;
  raster: WeaveRaster | null;
}>;

/**
 * Paints the cached cover raster, cut by the solid strip or faded under the caption, and the
 * caption text onto the visible canvas; returns the glyph count.
 */
export function composeWeave(request: WeaveComposeRequest): number {
  const { canvas, caption, layout, raster } = request;
  if (!raster || !layout || layout.count === 0) {
    canvas.width = Math.max(1, request.fallbackWidth);
    canvas.height = Math.max(1, request.fallbackHeight);
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    return 0;
  }
  const scale = raster.backingWidth / layout.width;
  canvas.width = raster.backingWidth;
  canvas.height = raster.backingHeight;
  const context = canvas.getContext("2d");
  if (!context) return 0;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  blitWeaveRows(
    context,
    raster.bitmap,
    layout,
    captionFade(layout.width, layout.height, caption),
    weaveVisibleHeight(layout.width, layout.height, caption),
  );
  context.setTransform(scale, 0, 0, scale, 0, 0);
  drawCaption(context, layout.width, layout.height, caption, request.captionFamily);
  return layout.count;
}
