import * as React from "react";
import { flushSync } from "react-dom";
import { useToolcraftDispatch, useToolcraftSelector } from "./use-toolcraft";

/** Reveal and focus canonical controls; opening a file picker remains in the user gesture. */
export function useToolcraftControlNavigation() {
  const dispatch = useToolcraftDispatch();
  const sections = useToolcraftSelector(state => state.schema.panels.controls?.sections);
  return React.useCallback((target: string, pickFile = false) => {
    const section = sections?.find(section => Object.values(section.controls).some(control => control.target === target));
    flushSync(() => {
      dispatch({ type: "panels.update", panelId: "controls", patch: { hidden: false, collapsed: false } });
      if (section) dispatch({ type: "panels.setSectionCollapsed", sectionId: section.id, collapsed: false });
    });
    const root = document.querySelector('[data-slot="toolcraft-runtime-app"]');
    const field = root?.querySelector<HTMLElement>(`[data-toolcraft-control-target="${CSS.escape(target)}"]`);
    field?.scrollIntoView({ block: "nearest" });
    if (pickFile) field?.querySelector<HTMLInputElement>('input[type="file"]')?.click();
    else field?.querySelector<HTMLElement>('textarea, input:not([type="hidden"]), button')?.focus({ preventScroll: true });
  }, [dispatch, sections]);
}
