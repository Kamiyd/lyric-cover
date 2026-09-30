import type { PlayOptions, SoundName } from "cuelume";

import { WEAVE_TARGETS } from "../weave/weave-params";

/** One interface sound: which cue, how it is shaped, and how often it may repeat. */
export type WeaveCue = Readonly<{
  name: SoundName;
  options?: PlayOptions;
  /** Minimum gap before the same cue may play again, for drags and fast typing. */
  throttleMs?: number;
}>;

type Values = Readonly<Record<string, unknown>>;

const SWITCH_TARGETS: readonly string[] = [
  WEAVE_TARGETS.toneSize,
  WEAVE_TARGETS.compact,
  WEAVE_TARGETS.captionEnabled,
  WEAVE_TARGETS.captionFade,
  "export.includeBackground",
];

/** Option order gives the direction: a later option rises, an earlier one falls. */
const CHOICE_TARGETS: Readonly<Record<string, readonly unknown[]>> = {
  [WEAVE_TARGETS.font]: ["sans", "serif"],
  [WEAVE_TARGETS.language]: ["cn", "tw", "en"],
  "canvas.workspaceBackground": [],
  "export.image.format": ["png", "jpg"],
  "export.image.resolution": ["2k", "4k", "8k"],
};

const SLIDER_TARGETS: readonly string[] = [
  WEAVE_TARGETS.density,
  WEAVE_TARGETS.saturation,
  WEAVE_TARGETS.brightness,
  WEAVE_TARGETS.underlay,
  "canvas.renderScale",
];

const TEXT_TARGETS: readonly string[] = [WEAVE_TARGETS.lyrics, WEAVE_TARGETS.title, WEAVE_TARGETS.artist];

const TRACKED_TARGETS: readonly string[] = [
  WEAVE_TARGETS.pick,
  ...SWITCH_TARGETS,
  ...Object.keys(CHOICE_TARGETS),
  ...SLIDER_TARGETS,
  ...TEXT_TARGETS,
];

function direction(forward: boolean): "back" | "forward" {
  return forward ? "forward" : "back";
}

/**
 * The cue for a change of control values, picked by the job the control does: a snap for
 * switches, a detent for choices and slider steps, a keystroke for text, and one cue for a
 * picked song or a reset instead of one per field they fill.
 */
export function cueForValueChange(previous: Values, next: Values): WeaveCue | null {
  const changed = TRACKED_TARGETS.filter((target) => !Object.is(previous[target], next[target]));
  if (changed.length === 0) return null;
  const pick = next[WEAVE_TARGETS.pick];
  if (changed.includes(WEAVE_TARGETS.pick) && pick !== null && pick !== undefined) {
    return { name: "select" };
  }
  if (changed.length > 2) return { name: "close" };

  const target = changed[0];
  const before = previous[target];
  const after = next[target];
  if (SWITCH_TARGETS.includes(target)) {
    return { name: "toggle", options: { direction: direction(after === true) } };
  }
  if (target in CHOICE_TARGETS) {
    const order = CHOICE_TARGETS[target];
    return {
      name: "select",
      options: { direction: direction(order.indexOf(after) >= order.indexOf(before)) },
    };
  }
  if (SLIDER_TARGETS.includes(target)) {
    return {
      name: "select",
      options: { direction: direction(Number(after) >= Number(before)) },
      throttleMs: 70,
    };
  }
  if (TEXT_TARGETS.includes(target)) {
    const grew = String(after ?? "").length >= String(before ?? "").length;
    return { name: "type", options: { key: grew ? "printable" : "delete" }, throttleMs: 40 };
  }
  return null;
}

export type WeaveSoundState = "empty" | "loading" | "ready" | "weaving";

/** A cover that has just finished weaving announces itself once; re-weaves stay silent. */
export function cueForWovenCover(
  state: WeaveSoundState,
  coverKey: string | null,
  announcedKey: string | null,
): WeaveCue | null {
  return state === "ready" && coverKey !== null && coverKey !== announcedKey ? { name: "ready" } : null;
}

/** How long a cover may stay pending before the wait itself gets a quiet cue. */
export const SLOW_COVER_MS = 600;
export const SLOW_COVER_CUE: WeaveCue = { name: "loading" };

export type ExportSoundStatus = Readonly<{ phase: string; progress?: number }>;

/** When an export settles: success once the download was handed over, otherwise an error. */
export function cueForExportSettled(previous: ExportSoundStatus, next: ExportSoundStatus): WeaveCue | null {
  if (previous.phase !== "running" || next.phase !== "idle") return null;
  return (previous.progress ?? 0) >= 1 ? { name: "success" } : { name: "error" };
}
