import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ToolcraftProductExportFrameContext } from "@/toolcraft/runtime";

import type { CoverSample } from "./cover-sample";
import { weaveExportRenderer } from "./weave-export";

class FakeOffscreenCanvas {
  constructor(
    readonly width: number,
    readonly height: number,
  ) {}
  getContext() {
    return { font: "", measureText: () => ({ width: 10 }) };
  }
}

const originalOffscreen = globalThis.OffscreenCanvas;

beforeEach(() => {
  globalThis.OffscreenCanvas = FakeOffscreenCanvas as unknown as typeof OffscreenCanvas;
});

afterEach(() => {
  globalThis.OffscreenCanvas = originalOffscreen;
});

function uniformSample(size: number): CoverSample {
  const pixels = new Uint8ClampedArray(size * size * 4).fill(200);
  return {
    cover: {
      bitmap: { height: size, width: size } as ImageBitmap,
      transform: { flipHorizontal: false, flipVertical: false, rotationDeg: 0 },
    },
    height: size,
    pixels,
    width: size,
  };
}

describe("weave export", () => {
  it("export re-weaves the frame at export resolution", async () => {
    const drawn: string[] = [];
    const translations: number[][] = [];
    const context = {
      clip: () => undefined,
      beginPath: () => undefined,
      fillStyle: "",
      fillText: (text: string) => drawn.push(text),
      font: "",
      rect: () => undefined,
      restore: () => undefined,
      save: () => undefined,
      textAlign: "left",
      textBaseline: "middle",
      translate: (x: number, y: number) => translations.push([x, y]),
    };
    const sample = uniformSample(100);
    const passes: string[] = [];
    const rendererPipeline = {
      runPass: async (pass: { id: string }, _input: unknown, work: () => unknown) => {
        passes.push(pass.id);
        return pass.id === "cover-sample" ? sample : work();
      },
    };
    await weaveExportRenderer.renderFrame({
      context,
      frame: { height: 100, width: 100, x: -50, y: -50 },
      pixelRatio: 1,
      rendererPipeline,
      signal: new AbortController().signal,
      state: {
        canvas: { mode: "finite", size: { height: 100, width: 100 } },
        mediaAssets: [],
        values: {
          "caption.title": "旅行的意义",
          "song.lyrics": "举头望明月",
          "song.pick": {
            album: "",
            artist: "陈绮贞",
            artworkUrl: "https://is1-ssl.mzstatic.com/a/1200x1200bb.jpg",
            durationMs: 0,
            store: "tw",
            title: "旅行的意义",
            trackId: 1,
          },
          "weave.density": 40,
        },
      },
      timeSeconds: 0,
      timelineProgress: 0,
    } as unknown as ToolcraftProductExportFrameContext);
    expect(passes).toEqual(["cover-sample", "weave-layout", "export-render"]);
    expect(translations[0]).toEqual([-50, -50]);
    expect(drawn.length).toBeGreaterThan(100);
    expect(drawn).toContain("旅行的意义");
  });
});
