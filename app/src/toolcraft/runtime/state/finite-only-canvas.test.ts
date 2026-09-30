import { expect, it } from "vitest";
import { defineToolcraft } from "../schema/define-toolcraft";
import { createToolcraftState } from "./create-template-state";

it("restores saved infinite canvases as finite when infinity is disabled", () => {
  const schema = defineToolcraft({
    base: {
      identity: { id: "finite-only-test", title: "Finite only" },
      canvas: { enabled: true, sizing: { mode: "editable-output", allowInfinite: false } },
      panels: {},
    },
    modules: [],
  });
  const state = createToolcraftState(schema, {
    canvas: { mode: "infinite", size: { width: 800, height: 600, unit: "px" }, zoom: 37 },
  });
  expect(state.canvas.mode).toBe("finite");
  expect(state.canvas.size).toEqual({ width: 800, height: 600, unit: "px" });
  expect(state.canvas.zoom).toBe(37);
});
