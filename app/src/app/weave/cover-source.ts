import type { ToolcraftMediaAsset } from "@/toolcraft/runtime";

import { readPickedSong } from "../song/song-types";
import { IDENTITY_COVER_TRANSFORM, type CoverTransform } from "./cover-sample";
import { WEAVE_TARGETS } from "./weave-params";

type ReadyImageAsset = Extract<ToolcraftMediaAsset, { assetKind: "image" }> & {
  lifecycle: "ready";
};

export type CoverSourceRef =
  | Readonly<{ key: string; kind: "upload"; mediaId: string; transform: CoverTransform }>
  | Readonly<{ key: string; kind: "remote"; transform: CoverTransform; url: string }>;

export function getUploadedCovers(mediaAssets: readonly ToolcraftMediaAsset[]): readonly ReadyImageAsset[] {
  return mediaAssets.filter(
    (asset): asset is ReadyImageAsset =>
      asset.assetKind === "image" &&
      asset.sourceTarget === WEAVE_TARGETS.cover &&
      asset.lifecycle === "ready",
  );
}

function readTransform(asset: ReadyImageAsset): CoverTransform {
  return {
    flipHorizontal: asset.transform?.flipHorizontal === true,
    flipVertical: asset.transform?.flipVertical === true,
    rotationDeg: asset.transform?.rotationDeg ?? 0,
  };
}

/**
 * An uploaded cover wins over the searched one (picking a search result removes uploads, so
 * the latest user action decides). The key is derived from state only, so preview and export
 * address the same memoized cover sample.
 */
export function resolveCoverSource(
  mediaAssets: readonly ToolcraftMediaAsset[],
  values: Readonly<Record<string, unknown>>,
): CoverSourceRef | null {
  const upload = getUploadedCovers(mediaAssets)[0];
  if (upload) {
    const transform = readTransform(upload);
    return {
      key: `upload:${upload.id}:${upload.resourceRef}:${transform.rotationDeg}:${transform.flipHorizontal ? 1 : 0}${transform.flipVertical ? 1 : 0}`,
      kind: "upload",
      mediaId: upload.id,
      transform,
    };
  }
  const picked = readPickedSong(values[WEAVE_TARGETS.pick]);
  return picked
    ? {
        key: `remote:${picked.artworkUrl}`,
        kind: "remote",
        transform: IDENTITY_COVER_TRANSFORM,
        url: picked.artworkUrl,
      }
    : null;
}
