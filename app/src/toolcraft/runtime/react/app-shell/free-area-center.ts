/**
 * Horizontal viewport offset that centres the canvas in the area beside the controls panel
 * rather than in the whole window. A hidden, collapsed or undocked-short panel is ignored.
 */
export function getFreeAreaCenterOffsetX(): number {
  const viewport = document.querySelector<HTMLElement>('[data-slot="toolcraft-runtime-canvas"]');
  const panel = document.querySelector<HTMLElement>("[data-toolcraft-controls-panel-shell]");
  if (!viewport || !panel) return 0;
  const view = viewport.getBoundingClientRect();
  const side = panel.getBoundingClientRect();
  if (side.width === 0 || side.height < view.height * 0.5) return 0;
  const leftGap = Math.max(0, side.left - view.left);
  const rightGap = Math.max(0, view.right - side.right);
  const [start, end] = leftGap >= rightGap ? [view.left, side.left] : [side.right, view.right];
  if (end - start < 160) return 0;
  return Math.round((start + end) / 2 - (view.left + view.width / 2));
}

