export const SONG_LANGUAGES = ["cn", "tw", "en"] as const;

export type SongLanguage = (typeof SONG_LANGUAGES)[number];

/** Metadata for the song picked in Search. Only the artwork URL is stored, never image bytes. */
export type PickedSong = Readonly<{
  album: string;
  artist: string;
  artworkUrl: string;
  durationMs: number;
  store: string;
  title: string;
  trackId: number;
}>;

export type SongSearchResult = Readonly<{
  album: string;
  artist: string;
  artworkUrl: string;
  durationMs: number;
  thumbnailUrl: string;
  title: string;
  trackId: number;
}>;

export type SongSearchOutcome =
  | Readonly<{ kind: "results"; results: readonly SongSearchResult[]; store: string }>
  | Readonly<{ kind: "empty" }>
  | Readonly<{ kind: "unreachable" }>;

export type LyricsOutcome =
  | Readonly<{ kind: "lyrics"; text: string }>
  | Readonly<{ kind: "instrumental" }>
  | Readonly<{ kind: "missing" }>;

export function isSongLanguage(value: unknown): value is SongLanguage {
  return (SONG_LANGUAGES as readonly unknown[]).includes(value);
}

export function readPickedSong(value: unknown): PickedSong | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const text = (key: string) =>
    typeof record[key] === "string" ? (record[key] as string) : "";
  const number = (key: string) =>
    typeof record[key] === "number" && Number.isFinite(record[key])
      ? (record[key] as number)
      : 0;
  const artworkUrl = text("artworkUrl");
  if (!artworkUrl.startsWith("https://")) return null;
  return {
    album: text("album"),
    artist: text("artist"),
    artworkUrl,
    durationMs: number("durationMs"),
    store: text("store"),
    title: text("title"),
    trackId: number("trackId"),
  };
}
