import type {
  ToolcraftProductExportRenderer,
  ToolcraftProductSceneBoundsProvider,
  ToolcraftSceneRect,
} from "@/toolcraft/runtime";

import { decodeCoverBitmap, sampleCover } from "./cover-sample";
import { resolveCoverSource } from "./cover-source";
import { computeWeaveLayout, weaveLayoutCacheInput } from "./weave-compute";
import { captionFade, drawCaption, drawFadedGlyphs, drawUnderlay, weaveVisibleHeight } from "./weave-draw";
import { ensureWeaveFonts, weaveFontFamily } from "./weave-fonts";
import { readWeaveParams, WEAVE_TARGETS, WEAVE_EXPORT_BASE_NAME, weaveExportBaseName } from "./weave-params";
import { coverSamplePass, exportRenderPass, weaveLayoutPass } from "./weave-pipeline";

/**
 * The product frame is the saved canvas rectangle, centred on the world origin. The preview
 * keeps that rectangle equal to the cover frame (see WeaveCanvas).
 */
export function getWeaveSceneRect(size: Readonly<{ height: number; width: number }>): ToolcraftSceneRect {
  return { height: size.height, width: size.width, x: -size.width / 2, y: -size.height / 2 };
}

export const weaveSceneBoundsProvider: ToolcraftProductSceneBoundsProvider = ({ state }) =>
  resolveCoverSource(state.mediaAssets, state.values) && String(state.values[WEAVE_TARGETS.lyrics] ?? "").trim()
    ? [getWeaveSceneRect(state.canvas.size)]
    : [];

const EXPORT_GLYPH_BATCH = 128;
const EXPORT_SLICE_MS = 32;

/** Hidden pages throttle timers to about a second, so pausing there would stall the export. */
function pageIsVisible(): boolean {
  return typeof document !== "undefined" && !document.hidden;
}

function pause(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), 0);
  });
}

export class CoverNotReadyError extends Error {
  constructor() {
    super("The uploaded cover is still loading. Try exporting again in a moment.");
    this.name = "CoverNotReadyError";
  }
}

/**
 * Re-weaves the frame in scene units at export resolution. The cover sample and glyph layout
 * are requested with the preview's cache keys, so an export after the preview settles reuses
 * them instead of recomputing; a remote cover can be fetched again, an upload cannot.
 */
export const weaveExportRenderer: ToolcraftProductExportRenderer = {
  baseFileName: WEAVE_EXPORT_BASE_NAME,
  getBaseFileName: (state) => weaveExportBaseName(state.values),
  async renderFrame({ context, frame, rendererPipeline, signal, state }) {
    if (!rendererPipeline) throw new Error("Lyric Cover export requires its renderer pipeline.");
    const params = readWeaveParams(state.values);
    const source = resolveCoverSource(state.mediaAssets, state.values);
    const sample = await rendererPipeline.runPass(
      coverSamplePass,
      { "cover.source": source?.key ?? null },
      async () => {
        if (!source) return null;
        if (source.kind === "upload") throw new CoverNotReadyError();
        const bitmap = await decodeCoverBitmap(source.url, signal);
        return sampleCover({ bitmap, transform: source.transform });
      },
    );
    signal.throwIfAborted();
    const layout = await rendererPipeline.runPass(
      weaveLayoutPass,
      weaveLayoutCacheInput(sample, params.glyphs),
      () => computeWeaveLayout(sample, params.glyphs),
    );
    signal.throwIfAborted();
    if (layout.count === 0) return;
    await ensureWeaveFonts(
      params.glyphs.font,
      "",
      `${params.caption.title}${params.caption.artist}`,
    );
    signal.throwIfAborted();
    await rendererPipeline.runPass(exportRenderPass, undefined, async () => {
      const family = weaveFontFamily(params.glyphs.font);
      // Let the Export button show its busy state before the heavy drawing starts.
      await pause();
      context.save();
      context.translate(frame.x, frame.y);
      context.save();
      context.beginPath();
      context.rect(0, 0, layout.width, weaveVisibleHeight(layout.width, layout.height, params.caption));
      context.clip();
      const fade = captionFade(layout.width, layout.height, params.caption);
      drawUnderlay(
        context,
        sample?.cover ?? null,
        layout.width,
        layout.height,
        params.underlay,
        fade,
        layout.fontSize,
      );
      // Large exports draw for seconds; pausing between slices keeps the interface responsive.
      let sliceStarted = performance.now();
      for (let start = 0; start < layout.count; start += EXPORT_GLYPH_BATCH) {
        drawFadedGlyphs(context, layout, family, start, Math.min(layout.count, start + EXPORT_GLYPH_BATCH), fade);
        if (pageIsVisible() && performance.now() - sliceStarted >= EXPORT_SLICE_MS) {
          await pause();
          signal.throwIfAborted();
          sliceStarted = performance.now();
        }
      }
      context.restore();
      drawCaption(context, layout.width, layout.height, params.caption, family);
      context.restore();
    });
  },
};
