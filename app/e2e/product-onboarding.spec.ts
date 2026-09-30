import { expect, test } from "./toolcraft-product-test";
import { field, mockRemoteServices, quadrantCoverPng, waitForWeave } from "./lyric-weave-support";

const guide = '[data-empty-canvas-guide]';

test("browser: empty canvas guides search, upload and lyrics without touching the artwork", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await mockRemoteServices(page);
  await page.goto("/");
  await expect(page.locator(guide)).toBeVisible();
  await expect(page.locator("[data-toolcraft-finite-background-layer]")).toHaveCount(0);
  await expect(page).toHaveTitle("Lyric Cover");
  await page.getByRole("button", { name: "Find a song", exact: true }).click();
  await expect(page.locator('[data-song-search] input')).toBeFocused();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Upload a cover", exact: true }).click();
  await (await chooser).setFiles({ name: "cover.png", mimeType: "image/png", buffer: quadrantCoverPng(120, 120) });
  await expect(page.locator(guide).getByText("Add lyrics", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Add lyrics", exact: true }).click();
  const lyrics = field(page, "song.lyrics").locator("textarea");
  await expect(lyrics).toBeFocused();
  await lyrics.fill("A little light across the water");
  await waitForWeave(page);
  await expect(page.getByText("55%", { exact: true })).toBeVisible();
  await expect(page.locator("[data-toolcraft-finite-background-layer]")).toBeVisible();
  await expect(page.locator(guide)).toHaveCount(0);
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.getByText("65%", { exact: true })).toBeVisible();
  await lyrics.fill("Another little light across the water");
  await waitForWeave(page);
  await expect(page.getByText("65%", { exact: true })).toBeVisible();
  await page.reload();
  await waitForWeave(page);
  await expect(page.getByText("65%", { exact: true })).toBeVisible();
  await expect(page.locator("[data-toolcraft-finite-background-layer]")).toBeVisible();
  await expect(page.locator(guide)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("browser: the example loads The Meaning of Travel and undo restores the guide", async ({ page }) => {
  await mockRemoteServices(page);
  await page.goto("/");
  await field(page, "song.language").getByRole("button", { name: "English", exact: true }).click();
  await page.getByRole("button", { name: "Try an example · The Meaning of Travel", exact: true }).click();
  await waitForWeave(page);
  await expect(page.getByText("55%", { exact: true })).toBeVisible();
  await expect(page.locator("[data-toolcraft-finite-background-layer]")).toBeVisible();
  await expect(field(page, "caption.title").locator("input")).toHaveValue("旅行的意义");
  await expect(field(page, "song.language").getByRole("button", { name: "简体", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(field(page, "song.lyrics").locator("textarea")).toHaveValue(/举头望明月/u);
  await expect(page.locator(guide)).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(guide)).toBeVisible();
  await expect(page.locator("[data-toolcraft-finite-background-layer]")).toHaveCount(0);
  await expect(field(page, "song.language").getByRole("button", { name: "English", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("browser: an unavailable example keeps the guide usable and supports retry", async ({ page }) => {
  await mockRemoteServices(page);
  let fail = true;
  await page.route("https://itunes.apple.com/**", route => fail ? route.fulfill({ json: { results: [] }, headers: { "access-control-allow-origin": "*" } }) : route.fallback());
  await page.goto("/");
  const example = page.getByRole("button", { name: "Try an example · The Meaning of Travel", exact: true });
  await example.click();
  await expect(page.locator(guide).getByRole("status")).toContainText("unavailable");
  await expect(example).toBeEnabled();
  fail = false;
  await example.click();
  await waitForWeave(page);
  await expect(page.getByText("55%", { exact: true })).toBeVisible();
  await expect(page.locator("[data-toolcraft-finite-background-layer]")).toBeVisible();
  await expect(page.locator(guide)).toHaveCount(0);
});

test("browser: the guide uses the interface language and both themes", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await mockRemoteServices(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "language", { value: "zh-CN", configurable: true });
  });
  await page.goto("/");
  await expect(page.locator(guide).getByText("开始制作", { exact: true })).toBeVisible();
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await page.screenshot({ path: "/tmp/lyric-cover-onboarding-dark.png" });
  await page.locator('button:has([data-icon="theme-light"])').click();
  await page.mouse.move(20, 20);
  await expect(page.locator(guide)).toHaveCSS("color", "oklch(0.145 0 0)");
  await expect(page.locator(guide)).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await page.screenshot({ path: "/tmp/lyric-cover-onboarding-light.png" });
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(page.getByRole("button", { name: "搜索一首歌", exact: true })).toBeVisible();
  const box = await page.locator(guide).boundingBox();
  const panel = await page.locator('[data-toolcraft-controls-panel-shell]').boundingBox();
  expect(box!.x + box!.width).toBeLessThan(panel!.x);
});
