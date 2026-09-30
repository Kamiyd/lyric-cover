import type { ToolcraftCommand } from "@/toolcraft/runtime";

import { WEAVE_TARGETS } from "../weave/weave-params";
import { getScriptConverter } from "./chinese-script";
import { searchItunesSongs } from "./itunes";
import { cleanSongTitle } from "./lyrics-text";
import { fetchLrclibLyrics } from "./lrclib";
import type { PickedSong, SongLanguage, SongSearchResult } from "./song-types";

export type SearchStatus =
  | Readonly<{ kind: "idle" }>
  | Readonly<{ kind: "busy"; message: string }>
  | Readonly<{ kind: "info"; message: string }>
  | Readonly<{ kind: "error"; message: string }>;

export type SongListing = Readonly<{
  language: SongLanguage;
  results: readonly SongSearchResult[];
  store: string;
  term: string;
}>;

export type SongSearchResponse = Readonly<{
  listing: SongListing | null;
  status: SearchStatus;
}>;

export async function runSongSearch(
  term: string,
  language: SongLanguage,
  signal: AbortSignal,
): Promise<SongSearchResponse> {
  try {
    const outcome = await searchItunesSongs(term, language, { signal });
    if (outcome.kind === "results") {
      return {
        listing: { language, results: outcome.results, store: outcome.store, term },
        status: {
          kind: "info",
          message: `${outcome.results.length} results · ↑↓ to choose, Enter to pick`,
        },
      };
    }
    return {
      listing: null,
      status: {
        kind: "error",
        message:
          outcome.kind === "unreachable"
            ? "iTunes is unreachable. Check the connection and try again."
            : "No songs found. Try the title alone.",
      },
    };
  } catch (error) {
    if (signal.aborted) throw error;
    return {
      listing: null,
      status: { kind: "error", message: error instanceof Error ? error.message : "Search failed." },
    };
  }
}

export type PickSongRequest = Readonly<{
  dispatch: (command: ToolcraftCommand) => void;
  language: SongLanguage;
  result: SongSearchResult;
  signal: AbortSignal;
  store: string;
  uploadIds: readonly string[];
}>;

/**
 * Applies a picked song in one history step: cover source, caption title and artist, and the
 * LRCLIB lyrics (empty when none are found). Uploaded covers are removed so the pick shows.
 */
export async function pickSong(request: PickSongRequest): Promise<SearchStatus | null> {
  const { result } = request;
  const [converter, lyrics] = await Promise.all([
    getScriptConverter(request.language),
    fetchLrclibLyrics(
      { album: result.album, artist: result.artist, durationMs: result.durationMs, title: result.title },
      { signal: request.signal },
    ).catch(() => null),
  ]);
  if (request.signal.aborted) return null;
  const song: PickedSong = {
    album: result.album,
    artist: result.artist,
    artworkUrl: result.artworkUrl,
    durationMs: result.durationMs,
    store: request.store,
    title: result.title,
    trackId: result.trackId,
  };
  for (const mediaId of request.uploadIds) {
    request.dispatch({ mediaId, type: "media.delete" });
  }
  const title = converter(cleanSongTitle(result.title));
  request.dispatch({
    label: "Pick song",
    type: "controls.apply",
    values: {
      [WEAVE_TARGETS.artist]: converter(result.artist),
      [WEAVE_TARGETS.lyrics]: lyrics?.kind === "lyrics" ? converter(lyrics.text) : "",
      [WEAVE_TARGETS.pick]: song,
      [WEAVE_TARGETS.title]: title,
    },
  });
  if (lyrics === null) {
    return { kind: "error", message: "LRCLIB is unreachable right now. Paste the lyrics or pick again." };
  }
  if (lyrics.kind === "instrumental") {
    return { kind: "info", message: "Instrumental — add your own words in Lyrics." };
  }
  if (lyrics.kind === "missing") {
    return { kind: "info", message: "No lyrics on LRCLIB for this song. Paste them in Lyrics." };
  }
  return { kind: "info", message: `Loaded ${title}` };
}
