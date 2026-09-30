import { describe, expect, it } from "vitest";

import { cueForExportSettled, cueForValueChange, cueForWovenCover } from "./weave-cues";

const base = {
  "caption.artist": "",
  "caption.enabled": true,
  "caption.fade": false,
  "caption.title": "",
  "song.language": "cn",
  "song.lyrics": "",
  "song.pick": null,
  "weave.compact": true,
  "weave.density": 84,
  "weave.font": "sans",
  "weave.saturation": 1.3,
  "weave.toneSize": true,
  "weave.underlay": 0,
} as const;

describe("interface sounds", () => {
  it("interface sounds follow the job each control does", () => {
    // Nothing tracked changed: silence.
    expect(cueForValueChange(base, { ...base })).toBeNull();
    expect(cueForValueChange(base, { ...base, "appearance.background": "#FFFFFF" })).toBeNull();

    // Switches snap, and turning one off plays it backwards.
    expect(cueForValueChange(base, { ...base, "caption.fade": true })).toEqual({
      name: "toggle",
      options: { direction: "forward" },
    });
    expect(cueForValueChange(base, { ...base, "weave.toneSize": false })).toEqual({
      name: "toggle",
      options: { direction: "back" },
    });

    // Choices are a detent that rises for a later option and falls for an earlier one.
    expect(cueForValueChange(base, { ...base, "weave.font": "serif" })?.options?.direction).toBe("forward");
    expect(
      cueForValueChange({ ...base, "song.language": "en" }, { ...base, "song.language": "tw" }),
    ).toEqual({ name: "select", options: { direction: "back" } });

    // Slider steps are quiet, directional and rate-limited for drags.
    expect(cueForValueChange(base, { ...base, "weave.density": 90 })).toEqual({
      name: "select",
      options: { direction: "forward" },
      throttleMs: 70,
    });
    expect(cueForValueChange(base, { ...base, "weave.saturation": 1 })?.options?.direction).toBe("back");

    // Text edits are keystrokes; removing text is a delete.
    expect(cueForValueChange(base, { ...base, "caption.title": "旅" })).toEqual({
      name: "type",
      options: { key: "printable" },
      throttleMs: 40,
    });
    expect(
      cueForValueChange({ ...base, "song.lyrics": "旅行" }, { ...base, "song.lyrics": "旅" })?.options?.key,
    ).toBe("delete");
  });

  it("a picked song and a reset each play one cue", () => {
    const picked = {
      ...base,
      "caption.artist": "陈绮贞",
      "caption.title": "旅行的意义",
      "song.lyrics": "举头望明月",
      "song.pick": { trackId: 1 },
    };
    // Picking fills four fields at once but is one choice.
    expect(cueForValueChange(base, picked)).toEqual({ name: "select" });
    // Reset clears them all: one soft close, not a burst of keystrokes.
    expect(cueForValueChange(picked, base)).toEqual({ name: "close" });
  });

  it("a cover announces itself once when it has finished weaving", () => {
    expect(cueForWovenCover("loading", "upload:1", null)).toBeNull();
    expect(cueForWovenCover("weaving", "upload:1", null)).toBeNull();
    expect(cueForWovenCover("ready", "upload:1", null)).toEqual({ name: "ready" });
    // A re-weave of the same cover (density, font…) stays silent.
    expect(cueForWovenCover("ready", "upload:1", "upload:1")).toBeNull();
    expect(cueForWovenCover("ready", "upload:2", "upload:1")).toEqual({ name: "ready" });
    expect(cueForWovenCover("empty", null, "upload:1")).toBeNull();
  });

  it("a settled export plays success only after the download was handed over", () => {
    expect(cueForExportSettled({ phase: "idle" }, { phase: "running", progress: 0 })).toBeNull();
    expect(cueForExportSettled({ phase: "running", progress: 0.75 }, { phase: "running", progress: 0.9 })).toBeNull();
    expect(cueForExportSettled({ phase: "running", progress: 1 }, { phase: "idle" })).toEqual({ name: "success" });
    expect(cueForExportSettled({ phase: "running", progress: 0.75 }, { phase: "idle" })).toEqual({ name: "error" });
  });
});
