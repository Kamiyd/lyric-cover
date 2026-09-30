import {
  defineToolcraftDiscreteFixtureAdapter,
  defineToolcraftFixtureAdapter,
  type ToolcraftEnvelopePerformanceConfig,
} from "@/toolcraft/runtime";

import { WEAVE_DENSITY } from "./weave-params";

/** Density is glyphs per row; the glyph count grows with its square. */
export const weaveWorkloadEnvelope = {
  dimensions: [
    {
      batchMax: WEAVE_DENSITY.max,
      defaultValue: WEAVE_DENSITY.defaultValue,
      id: "weave-density",
      interactiveMax: WEAVE_DENSITY.max,
      mapping: "direct",
      source: {
        kind: "schema-target",
        target: "weave.density",
        workloadBoundary: "maximum",
      },
      unit: "glyphs-per-row",
    },
    {
      batchMax: 8_192,
      customMappingReason: "The image resolution option maps to its exact numeric export long edge.",
      defaultValue: 4_096,
      id: "export-long-edge",
      mapping: "custom",
      source: {
        kind: "schema-target",
        target: "export.image.resolution",
      },
      unit: "pixels",
    },
    {
      batchMax: 67_108_864,
      defaultValue: 16_777_216,
      id: "export-pixels",
      mapping: "direct",
      source: {
        inputs: ["export-long-edge"],
        kind: "derived",
      },
      unit: "pixels",
    },
  ],
} satisfies ToolcraftEnvelopePerformanceConfig["workloadEnvelope"];

const densityFixture = defineToolcraftFixtureAdapter<number>({
  apply: (value) => value,
  dimensionId: "weave-density",
  observe: (value) => value,
});

const exportLongEdgeFixture = defineToolcraftDiscreteFixtureAdapter({
  dimensionId: "export-long-edge",
  domain: {
    kind: "schema-options",
    optionValues: ["2k", "4k", "8k"],
    target: "export.image.resolution",
  },
  entries: [
    { appliedValue: "2k", value: 2_048 },
    { appliedValue: "4k", value: 4_096 },
    { appliedValue: "8k", value: 8_192 },
  ],
});

const exportPixelFixture = defineToolcraftDiscreteFixtureAdapter({
  dimensionId: "export-pixels",
  domain: {
    attestation:
      "Export pixels are bounded by the long edge squared for every aspect ratio; the square default canvas reaches that bound for each of the three resolution options.",
    inputs: ["export-long-edge"],
    kind: "derived",
  },
  entries: [
    { appliedValue: "2k", value: 4_194_304 },
    { appliedValue: "4k", value: 16_777_216 },
    { appliedValue: "8k", value: 67_108_864 },
  ],
});

export const weaveFixtureAdapters = {
  dimensions: {
    "export-long-edge": exportLongEdgeFixture,
    "export-pixels": exportPixelFixture,
    "weave-density": densityFixture,
  },
};
