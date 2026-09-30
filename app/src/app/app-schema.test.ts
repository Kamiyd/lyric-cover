import { describe, expect, it } from "vitest";

import { appAcceptance } from "./app-acceptance-data";
import { appSchema } from "./app-schema";

function productSectionTitles(): readonly string[] {
  return (appSchema.panels.controls?.sections ?? [])
    .map((section) => section.title ?? "")
    .filter((title) => ["Song", "Cover & Lyrics", "Weave", "Caption"].includes(title));
}

describe("appSchema", () => {
  it("declares production reload coverage for the generated product schema", () => {
    const row = appAcceptance.find((entry) => entry.id === "persistence.reload");
    expect(appSchema.persistence.storage).toBe("localStorage");
    expect(row?.persistenceCoverage).toBe("reload");
    expect(row?.persistenceSlices).toEqual(
      appSchema.persistence.storage === "localStorage" ? appSchema.persistence.include : [],
    );
    expect(appSchema.persistence.storage === "localStorage" && appSchema.persistence.include).toEqual(
      expect.arrayContaining(["canvas", "media", "panels", "values"]),
    );
  });

  it("orders the song, weave and caption sections after runtime setup", () => {
    expect(productSectionTitles()).toEqual(["Song", "Cover & Lyrics", "Weave", "Caption"]);
    expect(appSchema.panels.timeline).toBeUndefined();
    expect(appSchema.panels.layers).toBeUndefined();
  });

  it("starts empty with a square canvas sized by the cover", () => {
    expect(appSchema.canvas.sizing).toEqual({ mode: "intrinsic-media" });
    expect(appSchema.canvas.size).toMatchObject({ height: 1080, width: 1080 });
    const controls = (appSchema.panels.controls?.sections ?? []).flatMap((section) =>
      Object.values(section.controls),
    );
    const defaults = Object.fromEntries(
      controls.map((control) => [control.target, "defaultValue" in control ? control.defaultValue : undefined]),
    );
    expect(defaults["song.pick"]).toBeNull();
    expect(defaults["song.lyrics"]).toBe("");
    expect(defaults["caption.title"]).toBe("");
    expect(defaults["caption.artist"]).toBe("");
    expect(appSchema.media.defaultAssets).toEqual([]);
  });

  it("image format options remain selectable", () => {
    const format = (appSchema.panels.controls?.sections ?? [])
      .flatMap((section) => Object.values(section.controls))
      .find((control) => control.target === "export.image.format");
    expect(format && "options" in format ? (format.options ?? []).map((option) => option.value) : []).toEqual([
      "png",
      "jpg",
    ]);
  });

  it("image resolution options remain selectable", () => {
    const resolution = (appSchema.panels.controls?.sections ?? [])
      .flatMap((section) => Object.values(section.controls))
      .find((control) => control.target === "export.image.resolution");
    expect(
      resolution && "options" in resolution ? (resolution.options ?? []).map((option) => option.value) : [],
    ).toEqual(["2k", "4k", "8k"]);
  });
});
