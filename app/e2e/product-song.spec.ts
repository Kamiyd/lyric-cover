import { readToolcraftBrowserObservation } from "./browser-proof-session";
import { expectToolcraftMediaLifecycle } from "./browser-state-evidence-helpers";
import {
  COVER_FILE_NAME,
  LYRICS,
  field,
  fillLyrics,
  openApp,
  quadrantCoverPng,
  readGlyphCount,
  uploadCover,
  waitForWeave,
} from "./lyric-weave-support";
import { expectToolcraftSegmentedControlCellsPreservePadding } from "./performance-control-layout-helpers";
import { expectToolcraftProductObservableToChange } from "./product-observable-helpers";
import { expect, test } from "./toolcraft-product-test";
import type { Page } from "@playwright/test";

const searchInput = (page: Page) => page.locator("[data-song-search] input");
const resultRow = (page: Page, index: number) => page.locator(`[data-result-index="${index}"]`);
const captionTitle = (page: Page) => field(page, "caption.title").locator("input");
const artboardSize = (page: Page) =>
  page.locator("[data-toolcraft-editable-canvas]").evaluate((node) => ({
    height: Number.parseFloat((node as HTMLElement).style.height),
    width: Number.parseFloat((node as HTMLElement).style.width),
  }));

/** After a language switch the list re-searches first, so Enter is retried until the pick lands. */
async function pickUntilTitle(page: Page, title: string): Promise<void> {
  await expect(async () => {
    await searchInput(page).press("Enter");
    await expect(captionTitle(page)).toHaveValue(title, { timeout: 1_000 });
  }).toPass();
}

async function searchAndPick(page: Page, expectedFirstTitle: string): Promise<void> {
  await expect(resultRow(page, 0)).toContainText(expectedFirstTitle);
  await searchInput(page).focus();
  await page.keyboard.press("ArrowDown");
  await expect(resultRow(page, 1)).toHaveAttribute("data-active", "true");
  await page.keyboard.press("ArrowUp");
  await expect(resultRow(page, 0)).toHaveAttribute("data-active", "true");
  await page.keyboard.press("Enter");
  await expect(resultRow(page, 0)).toHaveAttribute("aria-pressed", "true");
}

test("browser acceptance: song search pick weaves the picked cover", async ({ page }) => {
  const session = await openApp(page);
  expect(await readGlyphCount(page)).toBe(0);

  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction("song.pick", async () => {
      await searchInput(page).fill("旅行的意义");
      await searchAndPick(page, "旅行的意义");
      await waitForWeave(page);
    }),
    { requirementId: "song.search" },
  );

  await expect(captionTitle(page)).toHaveValue("旅行的意义");
  await expect(field(page, "caption.artist").locator("input")).toHaveValue("陈绮贞");
  await expect(field(page, "song.lyrics").locator("textarea")).toHaveValue(/举头望明月/u);
  await expect(page.locator("[data-song-search-status]")).toContainText("旅行的意义");
});

test("browser acceptance: language changes the picked caption script", async ({ page }) => {
  const session = await openApp(page);
  await searchInput(page).fill("旅行的意义");
  await searchAndPick(page, "旅行的意义");
  await waitForWeave(page);
  await expect(captionTitle(page)).toHaveValue("旅行的意义");

  await expectToolcraftSegmentedControlCellsPreservePadding(page, "Language", {
    requirementId: "song.language",
    target: "song.language",
  });

  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction("song.language", async (control) => {
      await control.getByRole("button", { exact: true, name: "繁體" }).click();
      await pickUntilTitle(page, "旅行的意義");
    }),
    { requirementId: "song.language" },
  );
  await expect(field(page, "song.lyrics").locator("textarea")).toHaveValue(/舉頭望明月/u);

  await field(page, "song.language").getByRole("button", { exact: true, name: "English" }).click();
  await pickUntilTitle(page, "The Meaning of Travel");
  await expect(field(page, "caption.artist").locator("input")).toHaveValue("Cheer Chen");

  await field(page, "song.language").getByRole("button", { exact: true, name: "简体" }).click();
  await pickUntilTitle(page, "旅行的意义");
});

test("browser acceptance: cover upload, transform, remove and reset", async ({ page }) => {
  const session = await openApp(page);
  await fillLyrics(page, LYRICS);

  // Which cover colour sits in each canvas quadrant ("-" = nothing drawn), plus the listed files.
  const lifecycle = session.observe((root) => {
    const colors: Record<string, readonly number[]> = {
      B: [90, 110, 180],
      G: [100, 180, 110],
      R: [200, 120, 110],
      Y: [200, 190, 100],
    };
    const canvas = root.querySelector<HTMLCanvasElement>("canvas[data-weave-canvas]");
    const context = canvas?.getContext("2d");
    const tone = (fx: number, fy: number): string => {
      if (!canvas || !context || canvas.width < 8) return "-";
      const size = Math.round(canvas.width * 0.12);
      const data = context.getImageData(
        Math.round(canvas.width * fx - size / 2),
        Math.round(canvas.height * fy - size / 2),
        size,
        size,
      ).data;
      let red = 0;
      let green = 0;
      let blue = 0;
      let weight = 0;
      for (let index = 0; index < data.length; index += 4) {
        const alpha = data[index + 3];
        red += data[index] * alpha;
        green += data[index + 1] * alpha;
        blue += data[index + 2] * alpha;
        weight += alpha;
      }
      if (weight === 0) return "-";
      const mean = [red / weight, green / weight, blue / weight];
      let best = "-";
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const [name, rgb] of Object.entries(colors)) {
        const distance = rgb.reduce((sum, value, channel) => sum + (value - mean[channel]) ** 2, 0);
        if (distance < bestDistance) {
          best = name;
          bestDistance = distance;
        }
      }
      return best;
    };
    return {
      itemIds: [
        ...root.querySelectorAll<HTMLImageElement>(
          '[data-toolcraft-control-target="source.cover"] [data-slot="file-upload-single-preview"] img',
        ),
      ].map((image) => image.alt),
      outputSignature: `${tone(0.25, 0.25)}${tone(0.75, 0.25)}/${tone(0.25, 0.7)}${tone(0.75, 0.7)}`,
    };
  });
  const read = () => readToolcraftBrowserObservation(lifecycle);
  const expectSignature = (signature: string, itemIds: readonly string[]) =>
    expect.poll(read, { message: `The woven cover should read ${signature}.` }).toEqual({
      itemIds,
      outputSignature: signature,
    });

  // Upload: the canvas takes the landscape cover's own ratio, so nothing is cropped.
  await expectToolcraftMediaLifecycle(
    lifecycle,
    session.controlAction("source.cover", async (control) => {
      await control
        .locator('input[type="file"]')
        .setInputFiles({ buffer: quadrantCoverPng(), mimeType: "image/png", name: COVER_FILE_NAME });
    }),
    { itemIds: [COVER_FILE_NAME], outputSignature: "RB/GY" },
    { requirementId: "source.cover" },
  );
  await expect.poll(() => artboardSize(page)).toEqual({ height: 675, width: 1080 });

  // Rotate and flip change the woven pixels; a quarter turn also turns the canvas.
  await page.getByRole("button", { name: "90° Right" }).click();
  await expectSignature("GR/YB", [COVER_FILE_NAME]);
  await expect.poll(() => artboardSize(page)).toEqual({ height: 1080, width: 675 });
  await page.getByRole("button", { name: "Flip horizontal" }).click();
  await expectSignature("YB/GR", [COVER_FILE_NAME]);
  await page.getByRole("button", { name: "Flip vertical" }).click();
  await expectSignature("BY/RG", [COVER_FILE_NAME]);

  // Remove clears the preview and the canvas.
  await page.getByRole("button", { name: `Remove ${COVER_FILE_NAME}` }).click();
  await expectSignature("--/--", []);
  expect(await readGlyphCount(page)).toBe(0);
  await expect.poll(() => artboardSize(page)).toEqual({ height: 1080, width: 1080 });

  // Reset restores the empty default after a second upload.
  await uploadCover(page);
  await expectSignature("RB/GY", [COVER_FILE_NAME]);
  await page.getByRole("button", { name: "Reset controls" }).click();
  await expectSignature("--/--", []);
  await expect(field(page, "song.lyrics").locator("textarea")).toHaveValue("");
});

/** Painted pixel count and mean opacity of a small box at frame position (x, y) on a 1080×675 cover. */
function readCoverBox(page: Page, xUnits: number, yUnits: number) {
  return page.locator("canvas[data-weave-canvas]").evaluate(
    (node, [fx, fy]) => {
      const canvas = node as HTMLCanvasElement;
      const size = 24;
      const data = canvas
        .getContext("2d")!
        .getImageData(Math.round(canvas.width * fx) - size / 2, Math.round(canvas.height * fy) - size / 2, size, size).data;
      let painted = 0;
      let alpha = 0;
      for (let index = 3; index < data.length; index += 4) {
        if (data[index] > 0) painted += 1;
        alpha += data[index];
      }
      return { alpha: alpha / (size * size), aspect: canvas.width / canvas.height, painted };
    },
    [xUnits / 1080, yUnits / 675] as const,
  );
}

test("browser acceptance: canvas follows the cover ratio and the caption sits inside it", async ({ page }) => {
  const session = await openApp(page);
  await fillLyrics(page, LYRICS);
  expect(await artboardSize(page)).toEqual({ height: 1080, width: 1080 });
  for (const target of ["canvas.aspectRatio", "canvas.size.width", "canvas.size.height", "canvas.infinity"]) {
    await expect(field(page, target)).toHaveCount(0);
  }

  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction("source.cover", async () => {
      await uploadCover(page);
      await waitForWeave(page);
    }),
    { requirementId: "output.cover-frame" },
  );
  // A 160×100 cover gives a 1080×675 canvas: long edge 1080, short edge by the cover's ratio.
  await expect.poll(() => artboardSize(page)).toEqual({ height: 675, width: 1080 });
  const middle = await readCoverBox(page, 540, 300);
  expect(middle.aspect).toBeCloseTo(1080 / 675, 2);
  expect((await readCoverBox(page, 540, 655)).painted).toBeGreaterThan(0); // no caption: woven to the edge
  const aboveStrip = await readCoverBox(page, 540, 560);

  // A caption keeps the canvas at the cover's ratio and takes a solid 92-unit strip at the bottom.
  await captionTitle(page).fill("旅行的意义");
  await captionTitle(page).blur();
  await expect.poll(async () => (await readCoverBox(page, 540, 655)).painted).toBe(0);
  expect(await artboardSize(page)).toEqual({ height: 675, width: 1080 });
  expect((await readCoverBox(page, 540, 560)).alpha).toBeCloseTo(aboveStrip.alpha, 0); // unchanged right above the strip
  expect((await readCoverBox(page, 90, 631)).painted).toBeGreaterThan(0); // the title text

  // Turning the caption off brings the whole cover back.
  await field(page, "caption.enabled").getByRole("switch").click();
  await expect.poll(async () => (await readCoverBox(page, 540, 655)).painted).toBeGreaterThan(0);
  expect(await artboardSize(page)).toEqual({ height: 675, width: 1080 });
});

test("browser acceptance: soft fade replaces the solid caption strip", async ({ page }) => {
  const session = await openApp(page);
  await fillLyrics(page, LYRICS);
  await uploadCover(page);
  await captionTitle(page).fill("旅行的意义");
  await captionTitle(page).blur();
  await waitForWeave(page);
  const middle = await readCoverBox(page, 540, 300);
  const solidEdge = await readCoverBox(page, 540, 530); // solid strip: full strength up to the cut
  expect(solidEdge.painted).toBeGreaterThan(0);

  const states: string[] = [];
  await page.locator("canvas[data-weave-canvas]").evaluate((canvas) => {
    const seen = ((window as unknown as { __states: string[] }).__states = [] as string[]);
    new MutationObserver(() => seen.push(canvas.getAttribute("data-weave-state") ?? "")).observe(canvas, {
      attributeFilter: ["data-weave-state"],
      attributes: true,
    });
  });

  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction("caption.fade", async (control) => {
      await control.getByRole("switch").click();
    }),
    { requirementId: "caption.fade" },
  );
  const fading = await readCoverBox(page, 540, 530);
  expect(fading.painted).toBeGreaterThan(0);
  expect(fading.alpha).toBeLessThan(solidEdge.alpha * 0.8); // rows above the caption are fainter
  expect((await readCoverBox(page, 540, 300)).alpha).toBeCloseTo(middle.alpha, 0); // untouched higher up
  expect((await readCoverBox(page, 540, 655)).painted).toBe(0); // gone under the caption
  expect((await readCoverBox(page, 90, 631)).painted).toBeGreaterThan(0); // the title text

  await field(page, "caption.fade").getByRole("switch").click();
  await expect.poll(async () => (await readCoverBox(page, 540, 530)).alpha).toBeCloseTo(solidEdge.alpha, 0);

  // Switching styles only recomposes: the glyphs are never woven again.
  states.push(...(await page.evaluate(() => (window as unknown as { __states: string[] }).__states)));
  expect(states).toEqual([]);
});
