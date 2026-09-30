import * as React from "react";
import { useToolcraftExportOwner, useToolcraftSelector } from "@/toolcraft/runtime/react";
import { useToolcraftUiSound } from "@/toolcraft/ui";

import {
  cueForExportSettled,
  cueForValueChange,
  cueForWovenCover,
  SLOW_COVER_CUE,
  SLOW_COVER_MS,
  type WeaveSoundState,
} from "./weave-cues";
import { configureWeaveSound, playWeaveCue } from "./weave-sound-player";

/**
 * Interface sounds for the weave: control changes, a finished cover, a slow cover and a settled
 * export. Buttons the runtime owns carry `data-cuelume-tap` and are wired by `bind()`.
 */
export function useWeaveSounds(coverKey: string | null, state: WeaveSoundState): void {
  const { enabled } = useToolcraftUiSound();
  const values = useToolcraftSelector((current) => current.values);
  const exportOwner = useToolcraftExportOwner();
  const exportStatus = React.useSyncExternalStore(
    exportOwner.subscribe,
    exportOwner.getStatus,
    exportOwner.getStatus,
  );

  const wasEnabled = React.useRef(enabled);
  React.useEffect(() => {
    configureWeaveSound(enabled);
    // Turning sound back on confirms itself; the first render stays quiet.
    if (enabled && !wasEnabled.current) playWeaveCue({ name: "toggle" });
    wasEnabled.current = enabled;
  }, [enabled]);

  const previousValues = React.useRef(values);
  React.useEffect(() => {
    const cue = cueForValueChange(previousValues.current, values);
    previousValues.current = values;
    playWeaveCue(cue);
  }, [values]);

  const announcedCover = React.useRef<string | null>(null);
  React.useEffect(() => {
    const cue = cueForWovenCover(state, coverKey, announcedCover.current);
    if (cue) announcedCover.current = coverKey;
    if (coverKey === null) announcedCover.current = null;
    playWeaveCue(cue);
  }, [coverKey, state]);

  React.useEffect(() => {
    if (state !== "loading") return;
    const timer = setTimeout(() => playWeaveCue(SLOW_COVER_CUE), SLOW_COVER_MS);
    return () => clearTimeout(timer);
  }, [state]);

  const previousExport = React.useRef(exportStatus);
  React.useEffect(() => {
    const cue = cueForExportSettled(previousExport.current, exportStatus);
    previousExport.current = exportStatus;
    playWeaveCue(cue);
  }, [exportStatus]);
}
