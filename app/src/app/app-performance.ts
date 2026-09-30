import {
  defineToolcraftPerformance,
  deriveToolcraftPerformancePaths,
  type ToolcraftEnvelopePerformanceConfig,
  type ToolcraftPerformanceScenario,
} from "@/toolcraft/runtime";

import { appSchema } from "./app-schema";
import { weavePipelineRegistration } from "./weave/weave-pipeline";
import { weaveFixtureAdapters, weaveWorkloadEnvelope } from "./weave/weave-workload";

const basePerformance = defineToolcraftPerformance({
  fixtureAdapters: weaveFixtureAdapters,
  rendererPipeline: weavePipelineRegistration,
  rendererStrategy: "canvas-2d",
  rendererTechnique: {
    exportRenderer: "canvas-2d",
    fidelityRisks: [
      "Preview and export must lay out the same glyph grid; both use the same cover sample and layout cache keys.",
      "Web fonts load per unicode-range subset; a glyph missing from the loaded subsets falls back to the system CJK family.",
    ],
    intentionalRasterizationReason:
      "The product is a raster of tens of thousands of coloured glyphs sampled from a raster cover.",
    layers: [
      {
        content: ["text"],
        exportMode: "included",
        id: "wovenCover",
        kind: "product-foreground",
        primitiveCount: "high",
        renderer: "canvas-2d",
        uiSelector: "canvas[data-weave-canvas]",
      },
    ],
    performanceRisks: [
      "Glyph count grows with the square of Density; layout and raster are time-sliced but still cost tens of milliseconds per change at the maximum.",
    ],
    previewRenderer: "canvas-2d",
    productRepresentation: "pixel",
    rendererStrategy: "canvas-2d",
    sourceRepresentation: "image-media",
    whyNotAlternativeStrategies: [
      "DOM or SVG text would create tens of thousands of nodes and cannot export a raster at 8K.",
      "WebGL would need a glyph atlas per font and size, trading exact font rendering for speed the product does not need.",
    ],
  },
  scenarios: [],
  usesCustomRenderer: true,
  workloadEnvelope: weaveWorkloadEnvelope,
} satisfies ToolcraftEnvelopePerformanceConfig);

function locatorFor(path: Readonly<{ interaction: string; targets: readonly string[] }>) {
  const target = path.targets[0] ?? "";
  if (target.startsWith("canvas.viewport") || target === "canvas.initial-render") return {};
  return { uiSelector: `[data-toolcraft-control-target="${target}"]` };
}

function createScenarios(performance: ToolcraftEnvelopePerformanceConfig): ToolcraftPerformanceScenario[] {
  return deriveToolcraftPerformancePaths(appSchema, performance).map((path): ToolcraftPerformanceScenario => {
    const common = {
      automated: true,
      automatedTestName: `perf: lyric weave ${path.id}`,
      browser: true,
      browserTestName: `browser perf: lyric weave ${path.id}`,
      coversTargets: path.targets,
      expectedObservable: `The ${path.interaction} path keeps the woven cover at full backing quality.`,
      fixture: "uploaded cover with lyrics",
      id: `weave-${path.id}`,
      pathId: path.id,
      ...(path.targets.length === 1 ? { target: path.targets[0] } : {}),
    };
    if (path.interaction === "export") {
      return {
        ...common,
        actionValue: "export.png",
        completionEvidence: "download",
        controlLabel: "Export PNG",
        interaction: "export",
      };
    }
    return { ...common, ...locatorFor(path), interaction: path.interaction };
  });
}

export const appPerformance = defineToolcraftPerformance({
  ...basePerformance,
  scenarios: createScenarios(basePerformance),
});

export { weavePipelineRegistration as appRendererPipelineRegistration };
