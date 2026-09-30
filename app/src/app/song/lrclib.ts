import { cleanSongTitle, tidyLyrics } from "./lyrics-text";
import { fetchJson, type FetchLike } from "./remote-json";
import type { LyricsOutcome } from "./song-types";

/** A LRCLIB match further than this from the iTunes duration is probably another recording. */
const MAX_DURATION_GAP_SECONDS = 20;

type LrclibRecord = Readonly<{
  duration?: unknown;
  instrumental?: unknown;
  plainLyrics?: unknown;
  syncedLyrics?: unknown;
}>;

export type LyricsQuery = Readonly<{
  album: string;
  artist: string;
  durationMs: number;
  title: string;
}>;

function asRecord(value: unknown): LrclibRecord | null {
  return typeof value === "object" && value !== null ? (value as LrclibRecord) : null;
}

function hasContent(record: LrclibRecord | null): record is LrclibRecord {
  return (
    record !== null &&
    (record.instrumental === true ||
      (typeof record.plainLyrics === "string" && record.plainLyrics.trim().length > 0) ||
      (typeof record.syncedLyrics === "string" && record.syncedLyrics.trim().length > 0))
  );
}

function toOutcome(record: LrclibRecord): LyricsOutcome {
  if (record.instrumental === true) return { kind: "instrumental" };
  const text = tidyLyrics(
    typeof record.plainLyrics === "string" ? record.plainLyrics : null,
    typeof record.syncedLyrics === "string" ? record.syncedLyrics : null,
  );
  return text ? { kind: "lyrics", text } : { kind: "missing" };
}

export async function fetchLrclibLyrics(
  query: LyricsQuery,
  options: Readonly<{ fetch?: FetchLike; retryDelayMs?: number; signal?: AbortSignal }> = {},
): Promise<LyricsOutcome> {
  const title = cleanSongTitle(query.title);
  const durationSeconds = Math.round(query.durationMs / 1000);
  const request = (path: string, params: Record<string, string>) =>
    fetchJson(`https://lrclib.net/api/${path}?${new URLSearchParams(params).toString()}`, {
      fetch: options.fetch,
      retryDelayMs: options.retryDelayMs,
      signal: options.signal,
    });

  if (durationSeconds > 0) {
    const exact = asRecord(
      await request("get", {
        album_name: query.album,
        artist_name: query.artist,
        duration: String(durationSeconds),
        track_name: title,
      }),
    );
    if (hasContent(exact)) return toOutcome(exact);
  }

  const searches: Record<string, string>[] = [
    { artist_name: query.artist, track_name: title },
    { q: `${title} ${query.artist}` },
    { q: title },
  ];
  for (const params of searches) {
    const payload = await request("search", params);
    const candidates = (Array.isArray(payload) ? payload : [])
      .map(asRecord)
      .filter(hasContent)
      .sort(
        (left, right) =>
          Math.abs(Number(left.duration ?? 0) - durationSeconds) -
          Math.abs(Number(right.duration ?? 0) - durationSeconds),
      );
    const best = candidates[0];
    if (
      best &&
      (durationSeconds === 0 ||
        Math.abs(Number(best.duration ?? 0) - durationSeconds) < MAX_DURATION_GAP_SECONDS)
    ) {
      return toOutcome(best);
    }
  }
  return { kind: "missing" };
}
