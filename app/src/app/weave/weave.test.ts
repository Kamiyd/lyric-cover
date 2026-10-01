import { describe, expect, it } from "vitest";

import { readRenderScale } from "./weave-canvas";
import { coverFrameSize } from "./cover-sample";
import {
  captionBandHeight,
  captionFade,
  drawCaption,
  drawFadedGlyphs,
  drawGlyphs,
  drawUnderlay,
  fadeOpacity,
  weaveFrameSize,
  weaveVisibleHeight,
} from "./weave-draw";
import { getWeaveSceneRect } from "./weave-export";
import { weaveFontFamily } from "./weave-fonts";
import { layoutWeave, type SamplePixels } from "./weave-layout";
import { hexLuminance, readWeaveParams, weaveExportBaseName } from "./weave-params";
import { weavePipelineRegistration } from "./weave-pipeline";

/** A 100×100 cover: left half bright red, right half dark blue. */
function splitCover(): SamplePixels {
  const width = 100;
  const height = 100;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (x < 50) {
        pixels.set([230, 40, 40, 255], i);
      } else {
        pixels.set([20, 30, 90, 255], i);
      }
    }
  }
  return { height, pixels, width };
}

function glyphParams(overrides: Partial<ReturnType<typeof readWeaveParams>["glyphs"]> = {}) {
  return { ...readWeaveParams({ "song.lyrics": "一二三" }).glyphs, density: 10, ...overrides };
}

const measureSquare = (fontSize: number) => () => fontSize;

type Recorded = { call: string; args: unknown[] };

function recordingContext(log: Recorded[]) {
  const context: Record<string, unknown> = {
    globalAlpha: 1,
    beginPath: () => log.push({ args: [], call: "beginPath" }),
    clip: () => log.push({ args: [], call: "clip" }),
    drawImage: (...args: unknown[]) => log.push({ args, call: "drawImage" }),
    fillRect: (...args: unknown[]) => log.push({ args, call: "fillRect" }),
    fillText: (...args: unknown[]) => log.push({ args: [...args, context.font, context.fillStyle], call: "fillText" }),
    rect: (...args: unknown[]) => log.push({ args, call: "rect" }),
    restore: () => log.push({ args: [], call: "restore" }),
    rotate: () => undefined,
    save: () => log.push({ args: [context.globalAlpha], call: "save" }),
    scale: () => undefined,
    translate: () => undefined,
  };
  return context as unknown as CanvasRenderingContext2D;
}

describe("weave layout", () => {
  it("lyrics become the glyph sequence", () => {
    const layout = layoutWeave(splitCover(), glyphParams(), measureSquare(10));
    expect(layout.chars.slice(0, 4)).toEqual(["一", "二", "三", "一"]);
    expect(layoutWeave(splitCover(), glyphParams({ lyrics: "" }), measureSquare(10)).count).toBe(0);
  });

  it("density sets glyphs per row", () => {
    expect(layoutWeave(splitCover(), glyphParams({ density: 10 }), measureSquare(10)).count).toBe(100);
    expect(layoutWeave(splitCover(), glyphParams({ density: 20 }), measureSquare(5)).count).toBe(400);
  });

  it("saturation pushes glyph colours away from grey", () => {
    const low = layoutWeave(splitCover(), glyphParams({ saturation: 0.6 }), measureSquare(10));
    const high = layoutWeave(splitCover(), glyphParams({ saturation: 2 }), measureSquare(10));
    const red = (color: number) => (color >> 16) & 255;
    expect(red(high.color[0])).toBeGreaterThan(red(low.color[0]));
  });

  it("brightness scales glyph colours without changing glyph sizes", () => {
    const sample = splitCover();
    const normal = layoutWeave(sample, glyphParams({ saturation: 1, brightness: 1 }), measureSquare(10));
    const dim = layoutWeave(sample, glyphParams({ saturation: 1, brightness: 0.5 }), measureSquare(10));
    const bright = layoutWeave(sample, glyphParams({ saturation: 1, brightness: 2 }), measureSquare(10));
    expect(normal.color[0]).toBe((230 << 16) | (40 << 8) | 40);
    expect(dim.color[0]).toBe((115 << 16) | (20 << 8) | 20);
    expect(bright.color[0]).toBe((255 << 16) | (80 << 8) | 80);
    expect(dim.size).toEqual(normal.size);
    expect(bright.x).toEqual(normal.x);
    expect(layoutWeave(sample, glyphParams({ brightness: 0 }), measureSquare(10)).color.every(value => value === 0)).toBe(true);
    expect(readWeaveParams({}).glyphs.brightness).toBe(1);
    expect(readWeaveParams({ "weave.brightness": 150 }).glyphs.brightness).toBe(1.5);
  });

  it("tone sizing scales glyphs with cover brightness", () => {
    const sized = layoutWeave(splitCover(), glyphParams({ toneSize: true }), measureSquare(10));
    const flat = layoutWeave(splitCover(), glyphParams({ toneSize: false }), measureSquare(10));
    expect(sized.size[0]).not.toBe(sized.size[9]);
    expect(flat.size[0]).toBe(10);
    expect(flat.size[9]).toBe(10);
  });

  it("light background inverts tone sizing", () => {
    expect(hexLuminance("#F1EDE4")).toBeGreaterThan(0.4);
    const dark = layoutWeave(splitCover(), glyphParams({ lightBackground: false }), measureSquare(10));
    const light = layoutWeave(splitCover(), glyphParams({ lightBackground: true }), measureSquare(10));
    // The dark-blue right half grows on a light background and shrinks on a dark one.
    expect(light.size[9]).toBeGreaterThan(dark.size[9]);
    expect(readWeaveParams({ "appearance.background": "#F1EDE4" }).glyphs.lightBackground).toBe(true);
  });
});

describe("weave drawing", () => {
  it("font switches the glyph family", () => {
    expect(weaveFontFamily("sans")).toContain("Noto Sans SC");
    expect(weaveFontFamily("serif")).toContain("Noto Serif SC");
    const log: Recorded[] = [];
    const layout = layoutWeave(splitCover(), glyphParams(), measureSquare(10));
    drawGlyphs(recordingContext(log), layout, weaveFontFamily("serif"), 0, 1);
    expect(String(log.find((entry) => entry.call === "fillText")?.args[3])).toContain("Noto Serif SC");
  });

  it("cover underlay shows the cover beneath the glyphs", () => {
    expect(readWeaveParams({ "weave.underlay": 25 }).underlay).toBe(0.25);
    const log: Recorded[] = [];
    const cover = {
      bitmap: { height: 10, width: 10 } as ImageBitmap,
      transform: { flipHorizontal: false, flipVertical: false, rotationDeg: 0 } as const,
    };
    drawUnderlay(recordingContext(log), cover, 100, 100, 0.25);
    expect(log.some((entry) => entry.call === "drawImage")).toBe(true);
    const none: Recorded[] = [];
    drawUnderlay(recordingContext(none), cover, 100, 100, 0);
    expect(none).toEqual([]);
  });

  it("caption switch adds and removes the title strip", () => {
    const on = readWeaveParams({ "caption.enabled": true, "caption.title": "旅行的意义" }).caption;
    const off = readWeaveParams({ "caption.enabled": false, "caption.title": "旅行的意义" }).caption;
    expect(captionBandHeight(1000, on)).toBe(85);
    expect(captionBandHeight(1000, off)).toBe(0);
  });

  it("caption title is drawn in the strip", () => {
    const log: Recorded[] = [];
    const caption = readWeaveParams({ "caption.title": "旅行的意义" }).caption;
    drawCaption(recordingContext(log), 1000, 1000, caption, weaveFontFamily("sans"));
    expect(log.find((entry) => entry.call === "fillText")?.args[0]).toBe("旅行的意义");
  });

  it("caption artist is drawn in the strip", () => {
    const log: Recorded[] = [];
    const caption = readWeaveParams({ "caption.artist": "陈绮贞" }).caption;
    drawCaption(recordingContext(log), 1000, 1000, caption, weaveFontFamily("sans"));
    expect(log.find((entry) => entry.call === "fillText")?.args[0]).toBe("陈绮贞");
  });

  it("background inclusion controls preview and PNG transparency", () => {
    // The product never paints a background: runtime owns it, so Background off leaves alpha.
    const log: Recorded[] = [];
    const layout = layoutWeave(splitCover(), glyphParams(), measureSquare(10));
    drawGlyphs(recordingContext(log), layout, weaveFontFamily("sans"));
    drawCaption(recordingContext(log), 100, 100, readWeaveParams({ "caption.title": "T" }).caption, "serif");
    expect(log.some((entry) => entry.call === "fillRect")).toBe(false);
  });
});

describe("weave scene", () => {
  it("weave canvas uses the selected backing pixels", () => {
    expect(readRenderScale(1)).toBe(1);
    expect(readRenderScale(1.5)).toBe(1.5);
    expect(readRenderScale(undefined)).toBe(2);
    expect(readRenderScale(4)).toBe(2);
  });

  it("weave scene bounds follow the saved canvas size", () => {
    expect(getWeaveSceneRect({ height: 800, width: 1200 })).toEqual({ height: 800, width: 1200, x: -600, y: -400 });
  });

  it("canvas frame follows the cover and the caption sits inside it", () => {
    // Long edge 1080, short edge by the cover's own ratio; a quarter turn swaps them.
    expect(coverFrameSize({ height: 1000, width: 1600 }, 0)).toEqual({ height: 675, width: 1080 });
    expect(coverFrameSize({ height: 1000, width: 1600 }, 90)).toEqual({ height: 1080, width: 675 });
    expect(coverFrameSize({ height: 600, width: 600 }, 180)).toEqual({ height: 1080, width: 1080 });

    // The caption never changes the frame: it sits inside the cover.
    const cover = { height: 1080, width: 1080 };
    expect(weaveFrameSize(cover)).toEqual(cover);
    expect(weaveFrameSize(null)).toEqual({ height: 1080, width: 1080 });

    const titled = readWeaveParams({ "caption.title": "旅行的意义" }).caption;
    const log: Recorded[] = [];
    drawCaption(recordingContext(log), 1080, 1080, titled, weaveFontFamily("sans"));
    const y = Number(log.find((entry) => entry.call === "fillText")?.args[2]);
    expect(y).toBeGreaterThan(1080 - 92);
    expect(y).toBeLessThan(1080);
  });

  it("soft fade switches the caption between a solid strip and a faded edge", () => {
    const solid = readWeaveParams({ "caption.title": "旅行的意义" }).caption;
    const soft = readWeaveParams({ "caption.fade": true, "caption.title": "旅行的意义" }).caption;
    const hidden = readWeaveParams({ "caption.enabled": false, "caption.fade": true, "caption.title": "旅行" }).caption;
    expect(solid.fade).toBe(false);

    // Solid (the default): the weave is cut at the 92-unit strip and nothing fades.
    expect(weaveVisibleHeight(1080, 1080, solid)).toBe(1080 - 92);
    expect(captionFade(1080, 1080, solid)).toBeNull();

    // Soft fade: the whole cover stays in play and the glyph rows above the caption grow fainter.
    expect(weaveVisibleHeight(1080, 1080, soft)).toBe(1080);
    const fade = captionFade(1080, 1080, soft);
    expect(fade).toEqual({ from: 1080 - 92 * 2.6, to: 1080 - 92 * 0.8 });
    expect(fadeOpacity(fade, 500)).toBe(1);
    expect(fadeOpacity(fade, (fade!.from + fade!.to) / 2)).toBeCloseTo(0.5, 5);
    expect(fadeOpacity(fade, 1060)).toBe(0);
    expect(fadeOpacity(null, 1060)).toBe(1);

    // No caption: neither a strip nor a fade.
    expect(weaveVisibleHeight(1080, 1080, hidden)).toBe(1080);
    expect(captionFade(1080, 1080, hidden)).toBeNull();

    // Glyph rows past the end of the fade are not drawn.
    const layout = layoutWeave(splitCover(), glyphParams(), measureSquare(10));
    const faded: Recorded[] = [];
    drawFadedGlyphs(recordingContext(faded), layout, weaveFontFamily("sans"), 0, layout.count, { from: 40, to: 80 });
    const texts = faded.filter((entry) => entry.call === "fillText");
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.length).toBeLessThan(100);
    expect(Math.max(...texts.map((entry) => Number(entry.args[2])))).toBeLessThan(80);
  });

  it("export is named after the song and artist in the chosen language", () => {
    expect(weaveExportBaseName({ "caption.artist": "陈绮贞", "caption.title": "旅行的意义" })).toBe("旅行的意义-陈绮贞");
    expect(weaveExportBaseName({ "caption.artist": "陳綺貞", "caption.title": "旅行的意義" })).toBe("旅行的意義-陳綺貞");
    expect(weaveExportBaseName({ "caption.title": " The Meaning of Travel " })).toBe("The Meaning of Travel");
    expect(weaveExportBaseName({ "caption.artist": "Cheer Chen" })).toBe("Cheer Chen");
    expect(weaveExportBaseName({})).toBe("lyric-cover");
  });

  it("canvas pan moves the woven frame", () => {
    const pan = weavePipelineRegistration.interactionInvalidation.find(
      (entry) => entry.interaction === "viewport-drag",
    );
    expect(pan?.invalidates).toEqual([]);
  });

  it("canvas zoom scales the woven frame", () => {
    const zoom = weavePipelineRegistration.interactionInvalidation.find(
      (entry) => entry.interaction === "viewport-zoom",
    );
    expect(zoom?.invalidates).toEqual([]);
  });

  it("caption edits only recompose the strip", () => {
    // The fade under the caption is applied while composing, so showing, hiding or editing
    // the caption never re-samples, re-lays or re-draws the glyphs.
    const caption = weavePipelineRegistration.interactionInvalidation.find((entry) =>
      entry.targets.includes("caption.title"),
    );
    expect(caption?.invalidates).toEqual(["caption-compose"]);
    expect(caption?.mustNotInvalidate).toEqual(["cover-sample", "weave-layout", "weave-raster"]);
  });
});
