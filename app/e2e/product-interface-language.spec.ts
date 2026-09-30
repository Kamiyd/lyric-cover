import { expect, test } from "./toolcraft-product-test";
import { createToolcraftBrowserProofSession } from "./browser-proof-session";
import { expectToolcraftAcceptanceOutcome } from "./browser-acceptance-outcome-helpers";

const field = (target: string) => `[data-toolcraft-control-target="${target}"]`;

test("browser acceptance: interface language switches and survives reload", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://fonts.googleapis.com/**", (route) => route.fulfill({ contentType: "text/css", body: "" }));
  await page.goto("/");
  const language = page.locator("[data-ui-language-switch]");
  await expect(language).toBeVisible();
  await expect(language).toHaveText("中");
  await expect(page.locator('[data-panel-type="controls"]').locator('[data-ui-language-switch]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Toggle Interface section", exact: true })).toHaveCount(0);
  await page.route("https://itunes.apple.com/search?**", (route) => route.fulfill({ json: {
    results: [{ trackId: 99, trackName: "Background", artistName: "Artist", collectionName: "Settings", artworkUrl100: "https://example.com/cover.png" }],
  } }));
  await page.route("https://example.com/cover.png", (route) => route.abort());
  const lyrics = page.locator(field("song.lyrics")).locator("textarea");
  await lyrics.fill("Background Lyrics Settings 歌词测试");
  await page.locator(field("caption.title")).locator("input").fill("Song Title 歌曲名");
  await page.locator(field("source.cover")).locator('input[type="file"]').setInputFiles({
    name: "cover.png", mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAL0lEQVR4nO3OIQEAAAgDMFJSipr0gBg3E/Ornb6kEhAQEBAQEBAQEBAQEBAQSAceEkoQpnldQhEAAAAASUVORK5CYII=", "base64"),
  });
  const canvas = page.locator("canvas[data-weave-canvas]");
  await expect.poll(async () => Number(await canvas.getAttribute("data-glyph-count"))).toBeGreaterThan(0);
  const artwork = await canvas.evaluate((node: HTMLCanvasElement) => node.toDataURL());
  const session = await createToolcraftBrowserProofSession(page);
  await expectToolcraftAcceptanceOutcome(
    () => page.locator("html").getAttribute("lang"),
    session.targetAction("interface.language", async () => {
      await language.click();
      // The product name is the same in both languages; only the interface copy is translated.
      await expect(page).toHaveTitle("Lyric Cover");
      await expect(language).toHaveText("EN");
      await expect(page.getByRole("button", { name: "导出 PNG", exact: true })).toBeVisible();
    }),
    { evidenceType: "command-side-effect", requirementId: "interface.language" },
  );
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByPlaceholder("歌曲或歌手")).toBeVisible();
  await expect(lyrics).toHaveValue("Background Lyrics Settings 歌词测试");
  await page.getByPlaceholder("歌曲或歌手").fill("Background");
  await expect(page.locator("[data-song-search-status]")).toHaveText("1 个结果 · ↑↓ 选择，回车确认");
  await expect(page.locator("[data-result-index]")).toContainText("Background");
  await expect(page.locator("[data-result-index]")).toContainText("Artist · Settings");
  await expect(page.locator(field("song.language")).getByRole("button", { name: "简体" })).toHaveAttribute("aria-pressed", "true");
  expect(await canvas.evaluate((node: HTMLCanvasElement) => node.toDataURL())).toBe(artwork);
  // Exercise a React unmount/remount while translated; no DOM nodes may be replaced by localization.
  await page.getByRole("button", { name: "展开或收起底部题注", exact: true }).click();
  await page.getByRole("button", { name: "展开或收起底部题注", exact: true }).click();
  await expect(page.locator(field("caption.title")).locator("input")).toHaveValue("Song Title 歌曲名");
  await language.click();
  await expect(page).toHaveTitle("Lyric Cover");
  await expect(language).toHaveText("中");
  await expect(page.getByRole("button", { name: "Export PNG", exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("Song or artist")).toHaveValue("Background");
  await expect(page.locator("[data-song-search-status]")).toHaveText("1 results · ↑↓ to choose, Enter to pick");
  await language.click();
  await expect(page).toHaveTitle("Lyric Cover");
  // Runtime persistence is asynchronous; inspect its committed snapshot before reloading.
  await expect.poll(() => page.evaluate(() => Object.values(localStorage).some((value) => {
    return value === "zh-CN";
  }))).toBe(true);
  await page.reload();
  await expect(page).toHaveTitle("Lyric Cover");
  await expect(lyrics).toHaveValue("Background Lyrics Settings 歌词测试");
  await expect(language).toHaveAttribute("aria-label", "Switch to English");
  await expect.poll(async () => Number(await canvas.getAttribute("data-glyph-count"))).toBeGreaterThan(0);
  expect(await canvas.evaluate((node: HTMLCanvasElement) => node.toDataURL())).toBe(artwork);
  // A newly opened export popup and a dynamic action label use the current language.
  await page.getByRole("combobox", { name: "PNG", exact: true }).click();
  await page.getByRole("option", { name: "JPG", exact: true }).click();
  await expect(page.getByRole("button", { name: "导出 JPG", exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "JPG", exact: true }).click();
  await page.getByRole("option", { name: "PNG", exact: true }).click();
  await expect(page.getByRole("button", { name: "导出 PNG", exact: true })).toBeVisible();
  await expect(page.getByRole("option", { name: "PNG", exact: true })).toBeHidden();
  await page.screenshot({ path: ".toolcraft/browser-artifacts/interface-language.png" });
  expect(errors).toEqual([]);
});
