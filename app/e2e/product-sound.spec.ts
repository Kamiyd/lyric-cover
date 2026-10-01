import type { Page } from "@playwright/test";

import { field, openWovenCover } from "./lyric-weave-support";
import { expect, test } from "./toolcraft-product-test";

/** Counts the sound sources the page starts, so a test can tell whether a cue actually played. */
async function countSoundSources(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const counter = { started: 0 };
    (window as unknown as { __sounds: typeof counter }).__sounds = counter;
    for (const node of [OscillatorNode, AudioBufferSourceNode]) {
      const start = node.prototype.start;
      node.prototype.start = function patchedStart(this: AudioScheduledSourceNode, ...args: [number?]) {
        counter.started += 1;
        return start.apply(this, args);
      } as typeof start;
    }
  });
}

const soundsStarted = (page: Page) =>
  page.evaluate(() => (window as unknown as { __sounds: { started: number } }).__sounds.started);

test("browser: main remains silent during controls, typing, generation and reload", async ({ page }) => {
  await countSoundSources(page);
  await openWovenCover(page);
  const mute = page.getByRole("button", { name: /^(Mute sounds|Turn sounds on)$/u });
  await expect(mute).toHaveCount(0);
  await field(page, "weave.toneSize").getByRole("switch").click();
  await field(page, "weave.font").getByRole("button", { exact: true, name: "Serif" }).click();
  await field(page, "song.lyrics").locator("textarea").pressSequentially(" test");
  await page.getByRole("button", { name: "Zoom out" }).click();
  await page.waitForTimeout(700);
  expect(await soundsStarted(page)).toBe(0);
  await page.reload();
  await expect(mute).toHaveCount(0);
  await field(page, "weave.toneSize").getByRole("switch").click();
  await page.waitForTimeout(400);
  expect(await soundsStarted(page)).toBe(0);
});
