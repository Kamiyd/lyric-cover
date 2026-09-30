import * as React from "react";
import {
  getFreeAreaCenterOffsetX,
  useToolcraftDispatch,
  useToolcraftMediaPresentationUrls,
  useToolcraftPipeline,
  useToolcraftPipelinePass,
  useToolcraftProductSceneFrame,
  useToolcraftSelector,
  useToolcraftValue,
} from "@/toolcraft/runtime/react";

import { useInterfaceLanguage } from "../i18n/use-interface-language";
import { decodeCoverBitmap, sampleCover } from "./cover-sample";
import { getUploadedCovers, resolveCoverSource } from "./cover-source";
import { computeWeaveLayout, weaveLayoutCacheInput } from "./weave-compute";
import { weaveFrameSize } from "./weave-draw";
import { ensureWeaveFonts, weaveFontFamily } from "./weave-fonts";
import { startLoadingSweep } from "./weave-loading";
import { readWeaveParams } from "./weave-params";
import {
  captionComposePass,
  coverSamplePass,
  weaveLayoutPass,
  weaveRasterPass,
  type WeaveRaster,
} from "./weave-pipeline";
import { clearWeaveCanvas, composeWeave, paintWeaveProgress, rasterizeWeave } from "./weave-raster";
import styles from "./weave-canvas.module.css";

export function readRenderScale(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(2, Math.max(1, value)) : 2;
}

export function WeaveCanvas(): React.JSX.Element {
  useInterfaceLanguage();
  const frame = useToolcraftProductSceneFrame();
  const values = useToolcraftSelector((state) => state.values);
  const mediaAssets = useToolcraftSelector((state) => state.mediaAssets);
  const canvasSize = useToolcraftSelector((state) => state.canvas.size);
  const canvasMode = useToolcraftSelector((state) => state.canvas.mode);
  const viewport = useToolcraftSelector((state) => state.canvas);
  const dispatch = useToolcraftDispatch();
  const renderScale = readRenderScale(useToolcraftValue("canvas.renderScale"));
  const coverAssets = React.useMemo(() => getUploadedCovers(mediaAssets), [mediaAssets]);
  const coverUrls = useToolcraftMediaPresentationUrls(coverAssets);
  const params = React.useMemo(() => readWeaveParams(values), [values]);
  const source = React.useMemo(() => resolveCoverSource(mediaAssets, values), [mediaAssets, values]);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const pipeline = useToolcraftPipeline();
  const [glyphCount, setGlyphCount] = React.useState(0);
  // Whether the canvas currently shows any weave (finished, in progress, or the previous one).
  const [painted, setPainted] = React.useState(false);
  const rasterRun = React.useRef(0);
  const [composed, setComposed] = React.useState<WeaveRaster | null>(null);
  const initialZoomApplied = React.useRef(Boolean(source && params.glyphs.lyrics.trim()));
  React.useLayoutEffect(() => {
    if (initialZoomApplied.current || !source || !params.glyphs.lyrics.trim()) return;
    initialZoomApplied.current = true;
    // Start fresh output at a comfortable scale; retain an already chosen viewport.
    if (viewport.zoom !== 100) return;
    dispatch({
      type: "canvas.setViewport",
      zoom: 55,
      offset: { x: getFreeAreaCenterOffsetX(), y: 0 },
    });
  }, [dispatch, source, params.glyphs.lyrics, viewport]);


  const frameWidth = frame.kind === "ready" ? frame.rect.width : 0;
  const frameHeight = frame.kind === "ready" ? frame.rect.height : 0;
  const devicePixelRatio = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const backingScale = devicePixelRatio * renderScale;
  const sourceUrl =
    source?.kind === "upload" ? (coverUrls.get(source.mediaId) ?? null) : (source?.url ?? null);
  const sourceKey = source && sourceUrl ? source.key : null;
  const transform = source?.transform ?? null;
  const family = weaveFontFamily(params.glyphs.font);

  const sampleState = useToolcraftPipelinePass(coverSamplePass, { "cover.source": sourceKey }, async () => {
    if (!sourceUrl || !transform) return null;
    const bitmap = await decodeCoverBitmap(sourceUrl);
    return sampleCover({ bitmap, transform });
  });
  const sample = sampleState.status === "success" ? sampleState.result : null;
  const backingWidth = Math.ceil((sample?.width ?? frameWidth) * backingScale);
  const backingHeight = Math.ceil((sample?.height ?? frameHeight) * backingScale);
  const caption = params.caption;

  // The canvas takes the cover's own aspect ratio. This is derived state, so it is applied
  // without a history entry; it waits for a pending cover instead of flashing.
  const coverSettled = sampleState.status === "success" && (source === null || sample !== null);
  const target = weaveFrameSize(sample);
  const targetWidth = target.width;
  const targetHeight = target.height;
  React.useEffect(() => {
    if (!coverSettled) return;
    if (canvasSize.width === targetWidth && canvasSize.height === targetHeight) return;
    dispatch({
      history: "skip",
      mode: canvasMode,
      size: { height: targetHeight, unit: "px", width: targetWidth },
      type: "canvas.applySettings",
    });
  }, [canvasMode, canvasSize.height, canvasSize.width, coverSettled, dispatch, targetHeight, targetWidth]);

  const layoutState = useToolcraftPipelinePass(
    weaveLayoutPass,
    weaveLayoutCacheInput(sample, params.glyphs),
    () => computeWeaveLayout(sample, params.glyphs),
  );
  const layout = layoutState.status === "success" ? layoutState.result : null;

  const rasterState = useToolcraftPipelinePass(
    weaveRasterPass,
    {
      "canvas.backing.height": backingHeight,
      "canvas.backing.width": backingWidth,
      "weave-layout": layout,
      "weave.underlay": params.underlay,
    },
    () => {
      if (!layout) return null;
      rasterRun.current += 1;
      const run = rasterRun.current;
      return rasterizeWeave({
        backingHeight,
        backingWidth,
        cover: sample?.cover ?? null,
        family,
        layout,
        // Only the newest weave paints its progress; superseded ones finish silently.
        onSlice: (partial, drawn) => {
          const canvas = canvasRef.current;
          if (!canvas || rasterRun.current !== run) return;
          paintWeaveProgress({ canvas, caption, drawn, layout, partial });
          setPainted(true);
        },
        underlay: params.underlay,
      });
    },
  );
  const raster = rasterState.status === "success" ? rasterState.result : null;
  const fallbackWidth = Math.ceil(frameWidth * backingScale);
  const fallbackHeight = Math.ceil(frameHeight * backingScale);
  // A cover is on its way (download, decode, layout or drawing): keep what is shown meanwhile.
  const busy =
    source !== null &&
    (sampleState.status === "pending" ||
      layoutState.status === "pending" ||
      rasterState.status === "pending" ||
      (sample === null && sampleState.status !== "error"));

  // Another cover starts from an empty frame, so the old one never lingers at the new shape.
  React.useEffect(() => {
    if (canvasRef.current) clearWeaveCanvas(canvasRef.current);
    setPainted(false);
    setGlyphCount(0);
  }, [sourceKey]);

  // The caption and the fade under it are composed over the cached raster, so showing, hiding
  // or editing the caption never re-lays or re-draws the glyphs.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pipeline || busy) return;
    let active = true;
    const run = async () => {
      await ensureWeaveFonts(params.glyphs.font, "", `《》${caption.title}${caption.artist}`);
      if (!active) return 0;
      return composeWeave({
        canvas,
        caption,
        captionFamily: family,
        fallbackHeight,
        fallbackWidth,
        layout,
        raster,
      });
    };
    pipeline.runPass(captionComposePass, undefined, run).then(
      (count) => {
        if (!active) return;
        setGlyphCount(count);
        setPainted(count > 0);
        setComposed(raster);
      },
      () => {
        if (active) setGlyphCount(0);
      },
    );
    return () => {
      active = false;
    };
  }, [busy, caption, fallbackHeight, fallbackWidth, family, layout, params.glyphs.font, pipeline, raster]);

  // The finished raster still has to be composed with the caption before the weave is ready.
  const inProgress = busy || (raster !== null && composed !== raster);
  const weaveState = inProgress ? (painted ? "weaving" : "loading") : glyphCount > 0 ? "ready" : "empty";
  const loading = weaveState === "loading";
  React.useEffect(() => {
    if (!loading || !canvasRef.current) return;
    return startLoadingSweep(canvasRef.current);
  }, [loading]);

  return (
    <canvas
      aria-hidden="true"
      className={styles.canvas}
      data-glyph-count={glyphCount}
      data-toolcraft-product-output=""
      data-weave-canvas=""
      data-weave-state={weaveState}
      ref={canvasRef}
    />
  );
}
