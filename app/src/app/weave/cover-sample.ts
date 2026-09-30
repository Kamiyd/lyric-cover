export type CoverTransform = Readonly<{
  flipHorizontal: boolean;
  flipVertical: boolean;
  rotationDeg: 0 | 90 | 180 | 270;
}>;

export const IDENTITY_COVER_TRANSFORM: CoverTransform = Object.freeze({
  flipHorizontal: false,
  flipVertical: false,
  rotationDeg: 0,
});

export type CoverImage = Readonly<{
  bitmap: ImageBitmap;
  transform: CoverTransform;
}>;

/** The cover's long edge in frame units; the short edge follows the cover's own aspect ratio. */
export const COVER_LONG_EDGE = 1080;

export type CoverFrameSize = Readonly<{ height: number; width: number }>;

/** The uncropped cover frame: the rotated cover scaled so its long edge is COVER_LONG_EDGE. */
export function coverFrameSize(
  source: Readonly<{ height: number; width: number }>,
  rotationDeg: CoverTransform["rotationDeg"],
): CoverFrameSize {
  const quarterTurn = rotationDeg === 90 || rotationDeg === 270;
  const width = Math.max(1, quarterTurn ? source.height : source.width);
  const height = Math.max(1, quarterTurn ? source.width : source.height);
  const scale = COVER_LONG_EDGE / Math.max(width, height);
  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
}

/** Cover pixels at the cover frame size, in frame units. */
export type CoverSample = Readonly<{
  cover: CoverImage;
  height: number;
  pixels: Uint8ClampedArray;
  width: number;
}>;

export function createScratchCanvas(width: number, height: number): OffscreenCanvas {
  return new OffscreenCanvas(Math.max(1, width), Math.max(1, height));
}

export function getScratchContext(canvas: OffscreenCanvas): OffscreenCanvasRenderingContext2D {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Lyric Cover needs a 2D canvas context.");
  return context;
}

export async function decodeCoverBitmap(url: string, signal?: AbortSignal): Promise<ImageBitmap> {
  const response = await fetch(url, { mode: "cors", signal });
  if (!response.ok) throw new Error(`The cover image could not be loaded (HTTP ${response.status}).`);
  const blob = await response.blob();
  signal?.throwIfAborted();
  return createImageBitmap(blob);
}

/**
 * Draws the cover filling a width × height box, honouring the runtime image rotate/flip
 * transform. The box has the cover's own aspect ratio, so nothing is cropped. Coordinates are
 * frame units with the origin at the box's top left.
 */
export function drawCoverFit(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cover: CoverImage,
  width: number,
  height: number,
): void {
  const { bitmap, transform } = cover;
  const quarterTurn = transform.rotationDeg === 90 || transform.rotationDeg === 270;
  const sourceWidth = quarterTurn ? bitmap.height : bitmap.width;
  const sourceHeight = quarterTurn ? bitmap.width : bitmap.height;
  if (sourceWidth <= 0 || sourceHeight <= 0) return;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  context.save();
  context.beginPath();
  context.rect(0, 0, width, height);
  context.clip();
  context.translate(width / 2, height / 2);
  context.rotate((transform.rotationDeg * Math.PI) / 180);
  context.scale(
    (transform.flipHorizontal ? -1 : 1) * scale,
    (transform.flipVertical ? -1 : 1) * scale,
  );
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  context.restore();
}

export function sampleCover(cover: CoverImage): CoverSample {
  const { height: sampleHeight, width: sampleWidth } = coverFrameSize(
    cover.bitmap,
    cover.transform.rotationDeg,
  );
  const canvas = createScratchCanvas(sampleWidth, sampleHeight);
  const context = getScratchContext(canvas);
  drawCoverFit(context, cover, sampleWidth, sampleHeight);
  return {
    cover,
    height: sampleHeight,
    pixels: context.getImageData(0, 0, sampleWidth, sampleHeight).data,
    width: sampleWidth,
  };
}
