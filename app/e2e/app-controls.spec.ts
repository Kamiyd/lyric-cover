import fs from "node:fs/promises";

import { expect, test } from "./toolcraft-product-test";

import {
  exportImage,
  field,
  openApp,
  openWovenCover,
  readGlyphCount,
  setSliderValue,
  waitForWeave,
} from "./lyric-weave-support";

test("browser: searching and picking a song weaves its cover with caption and lyrics", async ({ page }) => {
  await openApp(page);
  expect(await readGlyphCount(page)).toBe(0);

  await page.locator("[data-song-search] input").fill("旅行的意义");
  await expect(page.locator('[data-result-index="0"]')).toContainText("旅行的意义");
  await page.locator("[data-song-search] input").press("Enter");

  await waitForWeave(page);
  await expect(field(page, "caption.title").locator("input")).toHaveValue("旅行的意义");
  await expect(field(page, "caption.artist").locator("input")).toHaveValue("陈绮贞");
  await expect(field(page, "song.lyrics").locator("textarea")).toHaveValue(/举头望明月/u);

  // The download is named after the song and artist, in the language that was picked.
  expect((await exportImage(page)).suggestedFilename()).toBe("旅行的意义-陈绮贞.png");
});

test("browser: an uploaded cover with pasted lyrics weaves, re-weaves on density and exports a PNG", async ({
  page,
}) => {
  await openWovenCover(page);
  const glyphs = await readGlyphCount(page);

  await setSliderValue(page, "weave.density", "Density", 40);
  await expect.poll(() => readGlyphCount(page)).toBeLessThan(glyphs);
  await waitForWeave(page);

  // While the export runs, the button turns into a disabled "Exporting…" so it is not clicked twice.
  const exportButton = page.locator('[data-slot="toolcraft-panel-sticky-actions"] button');
  await exportButton.evaluate((button) => {
    const seen = (window as unknown as { __exportBusy: string[] }).__exportBusy = [] as string[];
    new MutationObserver(() => {
      if (button.getAttribute("data-busy") === "true") {
        seen.push(`${button.textContent}|${(button as HTMLButtonElement).disabled}`);
      }
    }).observe(button, { attributes: true, characterData: true, childList: true, subtree: true });
  });
  const download = await exportImage(page);
  expect(download.suggestedFilename()).toBe("lyric-cover.png"); // no caption: the generic name
  expect(await page.evaluate(() => (window as unknown as { __exportBusy: string[] }).__exportBusy)).toContain(
    "Exporting…|true",
  );
  await expect(exportButton).toHaveText("Export PNG");
  await expect(exportButton).toBeEnabled();
  const bytes = await fs.readFile((await download.path())!);
  expect([...bytes.subarray(1, 4)].map((byte) => String.fromCharCode(byte)).join("")).toBe("PNG");
  // The export keeps the 160×100 cover's ratio: nothing is cropped to a fixed canvas shape.
  expect(bytes.readUInt32BE(16) / bytes.readUInt32BE(20)).toBeCloseTo(1.6, 2);
  expect(bytes.readUInt32BE(16)).toBeGreaterThanOrEqual(2048);
  expect(bytes.byteLength).toBeGreaterThan(50_000);
});
