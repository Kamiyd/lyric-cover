import { fetchJson, RemoteUnavailableError, type FetchLike } from "./remote-json";
import type { SongLanguage, SongSearchOutcome, SongSearchResult } from "./song-types";

/**
 * iTunes has no China music store. TW/HK stores return Chinese (traditional) names, the US
 * store returns English names. Later stores are fallbacks when the first returns nothing.
 */
export const ITUNES_STORES: Readonly<Record<SongLanguage, readonly string[]>> = {
  cn: ["tw", "hk", "us"],
  en: ["us", "sg", "tw"],
  tw: ["tw", "hk", "us"],
};

const SEARCH_LIMIT = 12;

type ItunesTrack = Readonly<{
  artistName?: unknown;
  artworkUrl100?: unknown;
  collectionName?: unknown;
  trackId?: unknown;
  trackName?: unknown;
  trackTimeMillis?: unknown;
}>;

/** iTunes artwork URLs encode their size; 1200×1200 keeps sampling detail for a 1080 frame. */
export function toLargeArtworkUrl(url: string, edge = 1200): string {
  return url.replace(/\/\d+x\d+bb\./u, `/${edge}x${edge}bb.`);
}

function readTrack(value: unknown): SongSearchResult | null {
  if (typeof value !== "object" || value === null) return null;
  const track = value as ItunesTrack;
  if (
    typeof track.trackId !== "number" ||
    typeof track.trackName !== "string" ||
    typeof track.artistName !== "string" ||
    typeof track.artworkUrl100 !== "string" ||
    !track.artworkUrl100.startsWith("https://")
  ) {
    return null;
  }
  return {
    album: typeof track.collectionName === "string" ? track.collectionName : "",
    artist: track.artistName,
    artworkUrl: toLargeArtworkUrl(track.artworkUrl100),
    durationMs: typeof track.trackTimeMillis === "number" ? track.trackTimeMillis : 0,
    thumbnailUrl: track.artworkUrl100,
    title: track.trackName,
    trackId: track.trackId,
  };
}

function readResults(payload: unknown): readonly SongSearchResult[] {
  if (typeof payload !== "object" || payload === null) return [];
  const results = (payload as { results?: unknown }).results;
  if (!Array.isArray(results)) return [];
  return results.flatMap((entry) => {
    const track = readTrack(entry);
    return track ? [track] : [];
  });
}

export function buildItunesSearchUrl(term: string, store: string): string {
  const query = new URLSearchParams({
    country: store,
    entity: "song",
    limit: String(SEARCH_LIMIT),
    term,
  });
  return `https://itunes.apple.com/search?${query.toString()}`;
}

export async function searchItunesSongs(
  term: string,
  language: SongLanguage,
  options: Readonly<{ fetch?: FetchLike; signal?: AbortSignal }> = {},
): Promise<SongSearchOutcome> {
  const stores = ITUNES_STORES[language];
  let unreachable = 0;
  for (const store of stores) {
    try {
      const payload = await fetchJson(buildItunesSearchUrl(term, store), {
        fetch: options.fetch,
        retries: 2,
        signal: options.signal,
      });
      const results = readResults(payload);
      if (results.length > 0) return { kind: "results", results, store };
    } catch (error) {
      if (options.signal?.aborted) throw error;
      if (!(error instanceof RemoteUnavailableError)) throw error;
      unreachable += 1;
    }
  }
  return unreachable === stores.length ? { kind: "unreachable" } : { kind: "empty" };
}

/** Same trackId in another store gives the song's names in that store's language. */
export async function lookupItunesSong(
  trackId: number,
  store: string,
  options: Readonly<{ fetch?: FetchLike; signal?: AbortSignal }> = {},
): Promise<SongSearchResult | null> {
  const query = new URLSearchParams({ country: store, id: String(trackId) });
  try {
    const payload = await fetchJson(`https://itunes.apple.com/lookup?${query.toString()}`, {
      fetch: options.fetch,
      retries: 2,
      signal: options.signal,
    });
    return readResults(payload)[0] ?? null;
  } catch (error) {
    if (options.signal?.aborted) throw error;
    return null;
  }
}
