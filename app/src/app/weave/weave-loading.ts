/**
 * Sweeps the loading band across the empty canvas until the returned stop function is called.
 * People who ask for reduced motion keep the static band from the stylesheet.
 */
export function startLoadingSweep(canvas: HTMLCanvasElement): () => void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => undefined;
  const animation = canvas.animate(
    [{ backgroundPosition: "140% 0" }, { backgroundPosition: "-140% 0" }],
    { duration: 1300, easing: "ease-in-out", iterations: Number.POSITIVE_INFINITY },
  );
  return () => animation.cancel();
}
