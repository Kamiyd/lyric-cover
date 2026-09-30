import { describe, expect, it } from "vitest";

import type { ToolcraftCommand } from "@/toolcraft/runtime";

import { resolveCoverSource } from "../weave/cover-source";
import { buildItunesSearchUrl, ITUNES_STORES, searchItunesSongs, toLargeArtworkUrl } from "./itunes";
import { cleanSongTitle, tidyLyrics, weaveCharacters } from "./lyrics-text";
import { fetchLrclibLyrics } from "./lrclib";
import type { FetchLike } from "./remote-json";
import { pickSong } from "./song-actions";
import type { SongSearchResult } from "./song-types";

function jsonFetch(routes: Readonly<Record<string, unknown>>, calls: string[] = []): FetchLike {
  return async (url) => {
    calls.push(url);
    const key = Object.keys(routes).find((prefix) => url.startsWith(prefix));
    if (!key) return { json: async () => null, ok: false, status: 404 };
    const body = routes[key];
    if (typeof body === "number") return { json: async () => null, ok: false, status: body };
    return { json: async () => body, ok: true, status: 200 };
  };
}

const result: SongSearchResult = {
  album: "華麗的冒險",
  artist: "陳綺貞",
  artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/a/1200x1200bb.jpg",
  durationMs: 257_000,
  thumbnailUrl: "https://is1-ssl.mzstatic.com/image/thumb/a/100x100bb.jpg",
  title: "旅行的意義 (Live)",
  trackId: 818157965,
};

describe("song search", () => {
  it("song search picks a song and applies cover, caption and lyrics", async () => {
    const commands: ToolcraftCommand[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: string) => {
      const url = String(input);
      if (url.startsWith("https://lrclib.net/api/get")) {
        return new Response(JSON.stringify({ duration: 257, plainLyrics: "作詞：陳綺貞\n舉頭望明月\n低頭思故鄉" }));
      }
      return new Response("null", { status: 404 });
    }) as typeof fetch;
    try {
      const status = await pickSong({
        dispatch: (command) => commands.push(command),
        language: "tw",
        result,
        signal: new AbortController().signal,
        store: "tw",
        uploadIds: ["upload-1"],
      });
      expect(status).toEqual({ kind: "info", message: "Loaded 旅行的意義" });
    } finally {
      globalThis.fetch = originalFetch;
    }
    expect(commands[0]).toEqual({ mediaId: "upload-1", type: "media.delete" });
    expect(commands[1]).toMatchObject({
      type: "controls.apply",
      values: {
        "caption.artist": "陳綺貞",
        "caption.title": "旅行的意義",
        "song.lyrics": "舉頭望明月\n低頭思故鄉",
        "song.pick": { artworkUrl: result.artworkUrl, store: "tw", trackId: result.trackId },
      },
    });
  });

  it("language selects the store and script applied to a pick", async () => {
    expect(ITUNES_STORES.cn[0]).toBe("tw");
    expect(ITUNES_STORES.tw[0]).toBe("tw");
    expect(ITUNES_STORES.en[0]).toBe("us");
    expect(buildItunesSearchUrl("陈绮贞", "tw")).toContain("country=tw");
    const calls: string[] = [];
    const outcome = await searchItunesSongs("陈绮贞", "en", {
      fetch: jsonFetch(
        {
          "https://itunes.apple.com/search": {
            results: [
              {
                artistName: "Cheer Chen",
                artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/a/100x100bb.jpg",
                collectionName: "Single",
                trackId: 1,
                trackName: "旅行的意義",
                trackTimeMillis: 244_000,
              },
            ],
          },
        },
        calls,
      ),
    });
    expect(calls[0]).toContain("country=us");
    expect(outcome).toMatchObject({ kind: "results", store: "us" });
    expect(toLargeArtworkUrl("https://x/100x100bb.jpg")).toBe("https://x/1200x1200bb.jpg");
  });

  it("an uploaded cover replaces the searched cover", () => {
    const values = { "song.pick": { ...result, store: "tw" } };
    expect(resolveCoverSource([], values)).toMatchObject({ kind: "remote", url: result.artworkUrl });
    const upload = {
      assetKind: "image",
      fileName: "cover.png",
      id: "m1",
      layerId: "l1",
      lifecycle: "ready",
      mimeType: "image/png",
      resourceRef: "r1",
      sourceSize: { height: 10, width: 10 },
      sourceTarget: "source.cover",
      transform: { rotationDeg: 90 },
    } as const;
    expect(resolveCoverSource([upload as never], values)).toMatchObject({
      kind: "upload",
      mediaId: "m1",
      transform: { rotationDeg: 90 },
    });
  });
});

describe("lyrics", () => {
  it("fetches LRCLIB lyrics closest to the iTunes duration", async () => {
    const lyrics = await fetchLrclibLyrics(
      { album: "", artist: "A", durationMs: 200_000, title: "Song (Live)" },
      {
        fetch: jsonFetch({
          "https://lrclib.net/api/get": 404,
          "https://lrclib.net/api/search": [
            { duration: 320, plainLyrics: "far" },
            { duration: 205, plainLyrics: "near" },
          ],
        }),
      },
    );
    expect(lyrics).toEqual({ kind: "lyrics", text: "near" });
  });

  it("retries LRCLIB when it is briefly unavailable", async () => {
    let attempts = 0;
    const lyrics = await fetchLrclibLyrics(
      { album: "", artist: "A", durationMs: 0, title: "Song" },
      {
        fetch: async () => {
          attempts += 1;
          return attempts === 1
            ? { json: async () => null, ok: false, status: 503 }
            : { json: async () => [{ instrumental: true }], ok: true, status: 200 };
        },
        retryDelayMs: 1,
      },
    );
    expect(attempts).toBe(2);
    expect(lyrics).toEqual({ kind: "instrumental" });
  });

  it("cleans titles and lyric credits", () => {
    expect(cleanSongTitle("旅行的意義 (Live)")).toBe("旅行的意義");
    expect(tidyLyrics(null, "[00:01.00]作曲：X\n[00:02.00]第一句")).toBe("第一句");
  });

  it("tight text removes punctuation from the glyph run", () => {
    expect(weaveCharacters("你好，世界！\nSorry I'm Late", true).join("")).toBe("你好世界Sorry Im Late");
    expect(weaveCharacters("你好，世界！\nSorry", false).join("")).toBe("你好，世界！ / Sorry");
  });
});
