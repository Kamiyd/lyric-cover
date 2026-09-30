import * as React from "react";
import { useToolcraftSelector } from "./use-toolcraft";

/** Editor content stays in viewport space and follows the space beside the controls panel. */
export function WorkspaceOverlay({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const panelState = useToolcraftSelector(state => state.panels.controls);
  const [insets, setInsets] = React.useState({ left: 0, right: 0 });
  React.useLayoutEffect(() => {
    const root = ref.current?.parentElement;
    if (!root) return;
    const panel = root.querySelector<HTMLElement>("[data-toolcraft-controls-panel-shell]");
    const measure = () => {
      const view = root.getBoundingClientRect();
      const side = panel?.getBoundingClientRect();
      let left = 0, right = 0;
      if (side && side.width > 0 && side.height >= view.height * 0.5) {
        if (side.left - view.left >= view.right - side.right) right = Math.max(0, view.right - side.left);
        else left = Math.max(0, side.right - view.left);
      }
      setInsets(old => old.left === left && old.right === right ? old : { left, right });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    if (panel) observer.observe(panel);
    const settled = window.setTimeout(measure, 400);
    return () => { observer.disconnect(); window.clearTimeout(settled); };
  }, [panelState]);
  return <div ref={ref} data-toolcraft-workspace-overlay="" className="pointer-events-none absolute inset-y-0 z-20 grid place-items-center" style={insets}>{children}</div>;
}
