import { bind, play, setEnabled, setVolume } from "cuelume";

import type { WeaveCue } from "./weave-cues";

/** The library's maximum; its cues are mixed quietly, so anything lower is hard to hear. */
const VOLUME = 1;
const lastPlayedAt = new Map<string, number>();
let bound = false;

/** Browsers keep audio silent until the page has been used; cues before that are dropped. */
function pageHasBeenUsed(): boolean {
  return typeof navigator === "undefined" || (navigator.userActivation?.hasBeenActive ?? true);
}

/** Applies the Sound preference and wires the `data-cuelume-*` attributes once. */
export function configureWeaveSound(enabled: boolean): void {
  if (!bound) {
    bind();
    setVolume(VOLUME);
    bound = true;
  }
  setEnabled(enabled);
}

export function playWeaveCue(cue: WeaveCue | null): void {
  if (!cue || !pageHasBeenUsed()) return;
  if (cue.throttleMs !== undefined) {
    const now = performance.now();
    if (now - (lastPlayedAt.get(cue.name) ?? Number.NEGATIVE_INFINITY) < cue.throttleMs) return;
    lastPlayedAt.set(cue.name, now);
  }
  play(cue.name, cue.options);
}
