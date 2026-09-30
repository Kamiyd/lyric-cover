import { deflateSync } from "node:zlib";

import { expect, type Locator, type Page } from "@playwright/test";

import {
  createToolcraftBrowserProofSession,
  type ToolcraftBrowserProofSession,
} from "./browser-proof-session";

type Rgb = readonly [number, number, number];

/**
 * Cover colours. Every channel sits within a factor of two of the colour's mean, so the
 * renderer's saturation maths at 1.0 returns the channel exactly and pixels can be compared
 * without tolerance.
 */
export const COVER_COLORS = {
  B: [90, 110, 180],
  G: [100, 180, 110],
  R: [200, 120, 110],
  Y: [200, 190, 100],
} as const satisfies Record<string, Rgb>;

export const COVER_FILE_NAME = "quadrant-cover.png";
export const LYRICS = "举头望明月，低头思故乡\n床前明月光，疑是地上霜";
export const OTHER_LYRICS = "白日依山尽，黄河入海流\n欲穷千里目，更上一层楼";
export const DEFAULT_BACKGROUND_RGBA = [11, 11, 11, 255] as const;

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
}

/** Encodes an opaque RGB PNG without colour-profile chunks so browsers decode it exactly. */
export function encodePng(width: number, height: number, pixelAt: (x: number, y: number) => Rgb): Buffer {
  const rows = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (1 + width * 3);
    for (let x = 0; x < width; x += 1) {
      rows.set(pixelAt(x, y), rowStart + 1 + x * 3);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(rows)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Red | blue over green | yellow, so every rotation and flip gives a distinct picture. */
export function quadrantCoverPng(width = 160, height = 100): Buffer {
  return encodePng(width, height, (x, y) => {
    const left = x < width / 2;
    if (y < height / 2) return left ? COVER_COLORS.R : COVER_COLORS.B;
    return left ? COVER_COLORS.G : COVER_COLORS.Y;
  });
}

const CORS = { "access-control-allow-origin": "*" } as const;

const TRACKS = {
  en: [
    { artist: "Cheer Chen", title: "The Meaning of Travel" },
    { artist: "Cheer Chen", title: "The Sun" },
  ],
  zh: [
    { artist: "陳綺貞", title: "旅行的意義" },
    { artist: "陳綺貞", title: "太陽" },
  ],
} as const;

function itunesPayload(store: string | null) {
  const names = store === "us" || store === "sg" ? TRACKS.en : TRACKS.zh;
  return {
    results: names.map((track, index) => ({
      artistName: track.artist,
      artworkUrl100: `https://is1-ssl.mzstatic.com/image/thumb/cover-${index}/100x100bb.jpg`,
      collectionName: "華麗的冒險",
      trackId: 9001 + index,
      trackName: track.title,
      trackTimeMillis: 221_000,
    })),
  };
}

/** Deterministic stand-ins for iTunes, its artwork CDN, LRCLIB and the web-font stylesheet. */
export async function mockRemoteServices(page: Page): Promise<void> {
  await page.route("https://fonts.googleapis.com/**", (route) =>
    route.fulfill({ body: "", contentType: "text/css", headers: CORS }),
  );
  await page.route("https://itunes.apple.com/**", (route) =>
    route.fulfill({
      headers: CORS,
      json: itunesPayload(new URL(route.request().url()).searchParams.get("country")),
    }),
  );
  await page.route("https://is1-ssl.mzstatic.com/**", (route) =>
    route.fulfill({ body: quadrantCoverPng(120, 120), contentType: "image/png", headers: CORS }),
  );
  await page.route("https://lrclib.net/api/**", (route) =>
    route.request().url().includes("/api/get")
      ? route.fulfill({
          headers: CORS,
          json: { duration: 221, plainLyrics: "舉頭望明月\n低頭思故鄉\n疑是地上霜" },
        })
      : route.fulfill({ headers: CORS, json: [] }),
  );
}

export function field(page: Page, target: string): Locator {
  return page.locator(`[data-toolcraft-control-target="${target}"]`);
}

export function weaveCanvas(page: Page): Locator {
  return page.locator("canvas[data-weave-canvas]");
}

export async function readGlyphCount(page: Page): Promise<number> {
  return Number(await weaveCanvas(page).getAttribute("data-glyph-count"));
}

/** Waits until the weave has finished drawing (not merely started weaving in). */
export async function waitForWeave(page: Page): Promise<void> {
  await expect(weaveCanvas(page), "The weave should finish rendering glyphs.").toHaveAttribute(
    "data-weave-state",
    "ready",
  );
  expect(await readGlyphCount(page)).toBeGreaterThan(0);
}

/** A cheap fingerprint of the visible weave canvas, for "changed while dragging" checks. */
export async function readCanvasFingerprint(page: Page): Promise<string> {
  return weaveCanvas(page).evaluate((node) => {
    const canvas = node as HTMLCanvasElement;
    const probe = document.createElement("canvas");
    probe.width = 48;
    probe.height = 48;
    const context = probe.getContext("2d");
    if (!context || canvas.width === 0) return "empty";
    context.drawImage(canvas, 0, 0, 48, 48);
    let hash = 0;
    for (const value of context.getImageData(0, 0, 48, 48).data) {
      hash = (hash * 31 + value) >>> 0;
    }
    return `${canvas.width}x${canvas.height}:${hash}`;
  });
}

export async function fillLyrics(page: Page, text: string): Promise<void> {
  const textarea = field(page, "song.lyrics").locator("textarea");
  await textarea.fill(text);
  await textarea.blur();
}

export async function uploadCover(page: Page, buffer = quadrantCoverPng()): Promise<void> {
  await field(page, "source.cover")
    .locator('input[type="file"]')
    .setInputFiles({ buffer, mimeType: "image/png", name: COVER_FILE_NAME });
}

/** Types an exact number into a slider through its editable value label. */
export async function setSliderValue(page: Page, target: string, label: string, value: number): Promise<void> {
  const control = field(page, target);
  await control.getByRole("button", { name: `Edit ${label} value` }).click();
  const editor = control.getByRole("textbox", { name: `${label} value` });
  await editor.fill(String(value));
  await editor.press("Enter");
  await expect(control.locator('input[type="range"]')).toHaveValue(String(value));
}

/**
 * Drags a slider thumb to `ratio` of its track and runs `whileHeld` before releasing, so a test
 * can prove the value and the canvas already changed during the drag.
 */
export async function dragSlider(
  page: Page,
  control: Locator,
  ratio: number,
  whileHeld: () => Promise<void>,
): Promise<void> {
  const track = control.locator('[data-slot="slider"]');
  await track.scrollIntoViewIfNeeded();
  const trackBox = await track.boundingBox();
  const thumbBox = await control.locator('[data-slot="slider-thumb"]').boundingBox();
  if (!trackBox || !thumbBox) throw new Error("The slider could not be measured.");
  const y = thumbBox.y + thumbBox.height / 2;
  await page.mouse.move(thumbBox.x + thumbBox.width / 2, y);
  await page.mouse.down();
  try {
    await page.mouse.move(trackBox.x + trackBox.width * ratio, y, { steps: 8 });
    await whileHeld();
  } finally {
    await page.mouse.up();
  }
}

export async function setSwitch(control: Locator, checked: boolean): Promise<void> {
  const toggle = control.getByRole("switch");
  if ((await toggle.getAttribute("aria-checked")) !== String(checked)) await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", String(checked));
}

/** Opens the app with mocked services and returns a proof session on a blank workspace. */
export async function openApp(page: Page): Promise<ToolcraftBrowserProofSession> {
  await mockRemoteServices(page);
  await page.goto("/");
  return createToolcraftBrowserProofSession(page);
}

/** Opens the app, pastes lyrics and uploads the quadrant cover, then waits for the weave. */
export async function openWovenCover(
  page: Page,
  options: Readonly<{ lyrics?: string }> = {},
): Promise<ToolcraftBrowserProofSession> {
  const session = await openApp(page);
  await fillLyrics(page, options.lyrics ?? LYRICS);
  await uploadCover(page);
  await waitForWeave(page);
  return session;
}

/**
 * Makes the weave a flat copy of the cover: saturation 1 keeps glyph colours equal to the
 * cover's, and a full underlay fills the gaps between glyphs with the same colours.
 */
export async function flattenWeave(page: Page): Promise<void> {
  await setSliderValue(page, "weave.saturation", "Saturation", 1);
  await setSliderValue(page, "weave.underlay", "Cover underlay", 100);
  await waitForWeave(page);
}

export async function exportImage(page: Page) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /^Export (PNG|JPG)$/u }).click(),
  ]);
  return download;
}

export async function selectOption(page: Page, target: string, optionName: string): Promise<void> {
  await field(page, target).getByRole("combobox").click();
  await page.getByRole("option", { exact: true, name: optionName }).click();
}
