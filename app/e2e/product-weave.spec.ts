import type { Page } from "@playwright/test";
import { expect, test } from "./toolcraft-product-test";
import { dragSlider, field, openWovenCover, setSliderValue, waitForWeave, weaveCanvas } from "./lyric-weave-support";
import { expectToolcraftProductObservableToChange } from "./product-observable-helpers";

async function glyphLuminance(page: Page): Promise<number> {
  return weaveCanvas(page).evaluate(node => {
    const canvas = node as HTMLCanvasElement;
    const pixels = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    let total = 0;
    let alpha = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      total += (0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]) * pixels[i + 3];
      alpha += pixels[i + 3];
    }
    return total / alpha;
  });
}

test("browser acceptance: brightness drag brightens glyphs live", async ({ page }) => {
  const session = await openWovenCover(page);
  const brightness = field(page, "weave.brightness");
  await expect(brightness.locator('input[type="range"]')).toHaveValue("100");
  await brightness.locator('[data-slot="slider"]').scrollIntoViewIfNeeded();
  const saturationBox = await field(page, "weave.saturation").locator('[data-slot="slider"]').boundingBox();
  const brightnessBox = await brightness.locator('[data-slot="slider"]').boundingBox();
  expect(brightnessBox!.y).toBeGreaterThan(saturationBox!.y);
  const baseline = await glyphLuminance(page);
  await expectToolcraftProductObservableToChange(session, session.controlAction("weave.brightness", async () => {
    await dragSlider(page, brightness, 0.8, async () => {
      await expect.poll(async () => Number(await brightness.locator('input[type="range"]').inputValue())).toBeGreaterThan(100);
      await expect.poll(() => glyphLuminance(page)).toBeGreaterThan(baseline + 10);
    });
  }), { requirementId: "weave.brightness", selector: "canvas[data-weave-canvas]" });
  await setSliderValue(page, "weave.brightness", "Text brightness", 50);
  await waitForWeave(page);
  await expect.poll(() => glyphLuminance(page)).toBeLessThan(baseline - 10);
  await page.getByRole("button", { name: "Reset Weave section", exact: true }).click();
  await expect(brightness.locator('input[type="range"]')).toHaveValue("100");
  await waitForWeave(page);
  await expect.poll(() => glyphLuminance(page)).toBeCloseTo(baseline, 0);
});
