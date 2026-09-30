import type { Page } from "@playwright/test";

import { expectToolcraftAcceptanceOutcome } from "./browser-acceptance-outcome-helpers";
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

test("browser acceptance: interface sounds play and the mute button silences them", async ({ page }) => {
  await countSoundSources(page);
  const session = await openWovenCover(page);
  const mute = page.getByRole("button", { name: /^(Mute sounds|Turn sounds on)$/u });
  await expect(mute).toHaveAccessibleName("Mute sounds");

  // A switch plays its cue.
  const toneSizing = field(page, "weave.toneSize").getByRole("switch");
  const beforeToggle = await soundsStarted(page);
  await toneSizing.click();
  await expect.poll(() => soundsStarted(page)).toBeGreaterThan(beforeToggle);

  // Muting silences control cues and toolbar taps alike.
  await expectToolcraftAcceptanceOutcome(
    () => mute.getAttribute("aria-label"),
    session.targetAction("interface.sound", async () => {
      await mute.click();
      await expect(mute).toHaveAccessibleName("Turn sounds on");
    }),
    { evidenceType: "command-side-effect", requirementId: "interface.sound" },
  );
  await page.waitForTimeout(300); // let the click's own tap finish starting
  const whileMuted = await soundsStarted(page);
  await toneSizing.click();
  await field(page, "weave.font").getByRole("button", { exact: true, name: "Serif" }).click();
  await page.getByRole("button", { name: "Zoom out" }).click();
  await page.waitForTimeout(400);
  expect(await soundsStarted(page)).toBe(whileMuted);

  // The preference is the app's own and survives a reload.
  await page.reload();
  await expect(mute).toHaveAccessibleName("Turn sounds on");
  await field(page, "weave.toneSize").getByRole("switch").click();
  await page.waitForTimeout(400);
  expect(await soundsStarted(page)).toBe(0);

  // Turning sound back on confirms itself with a cue.
  await mute.click();
  await expect(mute).toHaveAccessibleName("Mute sounds");
  await expect.poll(() => soundsStarted(page)).toBeGreaterThan(0);
});
