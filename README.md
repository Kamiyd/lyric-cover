# Lyric Cover

English | [简体中文](README.zh-CN.md)

Redraw a song's album cover out of its own lyrics.

Every character takes the colour of the cover beneath it: from a distance you see the cover, up close you read the lyrics.

## Why

I saw people making bouquets out of album covers and realised how much it means to turn an album you love into something you can give away. Lyric Cover is the digital version of that idea: no flowers, just the song's own words.

## How to use it

1. Pick the song language, then search for a song, or upload a cover and paste the lyrics yourself.
2. Tune character density, saturation and font, and decide whether to show the title and artist along the bottom.
3. Export a PNG or JPG at 2K, 4K or 8K. The file is named `title-artist`.

The song language can be 简体, 繁體 or English; the title, artist and lyrics use that script. The interface itself switches between English and Chinese. On the first visit, it follows your browser language; a manual choice is saved locally and takes precedence on later visits.

## Run it

```bash
cd app
pnpm install
pnpm dev
```

It needs a network connection: covers come from iTunes Search, lyrics from LRCLIB, and fonts from Google Fonts.

## Repository layout

The app lives in `app/`. It is built on Toolcraft; the product code is under `app/src/app/`.

## Branches

| Branch | Difference |
|---|---|
| `main` | No interface sounds |
| `sound` | `main` plus interface sounds; otherwise identical |

Changes unrelated to sound land on `main` first and are then merged into `sound`.

## Development

```bash
cd app
pnpm test                                  # type check and unit tests under src
pnpm exec playwright install chromium      # install once before browser tests
pnpm test:browser                          # application browser tests (serial)
pnpm build                                 # production build
```

`pnpm test:browser` covers app controls, song workflows, and interface language; the sound branch also includes sound tests. It uses `--workers=1` to avoid parallel first-load timeouts. `pnpm test` retains application and framework unit tests under `src`, without running the upstream signed integrity check.

## Data sources and copyright

- Covers and song details come from the [iTunes Search API](https://performance-partners.apple.com/search-api), lyrics from [LRCLIB](https://lrclib.net), and fonts from Google Fonts. Your browser makes these requests directly. The project has no server of its own. Settings, workspace state, and uploaded media are stored locally in your browser so they can be restored after a reload. Clearing this site’s browser data removes those local records.
- Album covers and lyrics belong to their rights holders. This repository contains no cover images and no lyrics. Keep the images you make for personal enjoyment and sharing, and get permission before any commercial use.
- These are third-party services; their availability and terms are their own.

## About Toolcraft

`app/` was generated with [Toolcraft](https://toolcraft.sh). `app/src/toolcraft/` is a copy of the Toolcraft runtime (MIT; see `app/LICENSE.md` and `app/NOTICE.md`).

That copy has local modifications:

- an interface-language switch in the toolbar, with a small localization layer;
- an option to turn off Infinity canvas;
- the canvas and the toolbar centre in the area beside the controls panel, and toolbar zoom keeps that centre;
- the Export button shows a busy state while an export runs, and the footer progress line is thicker;
- export file names can come from the app state and keep non-Latin characters.

Because of these changes, Toolcraft's original signed integrity check reports differences from the upstream copy. This is separate from application behavior tests and does not certify the local copy as an upstream release.

- `pnpm test:toolcraft:integrity`: run the original integrity check alone; currently expected to fail.
- `pnpm test:toolcraft`: preserve the original full verification command, which stops at the integrity check.
- `pnpm test:toolcraft:browser`: preserve the original framework browser test command.
- `pnpm verify:delivery`: the original delivery verification is also subject to the integrity check.

The upstream checker and signed manifests are unchanged. For everyday development, use `pnpm test`, `pnpm test:browser`, and `pnpm build` above.

## Interface sounds (this branch)

This branch adds short synthesized interface sounds with [cuelume](https://github.com/danielwh2/cuelume) (MIT): a snap for switches, a detent for choices and slider steps, keystrokes for typing, and cues when a cover finishes, when an export settles, and when something fails. The speaker button in the bottom toolbar mutes them; the setting is remembered.

It depends on `cuelume@0.2.4`. If your npm mirror does not have that version yet, install from the official registry: `pnpm install --registry https://registry.npmjs.org/`.

Additional changes to the Toolcraft copy on this branch: a sound preference and mute button in the toolbar, `data-cuelume-tap` on toolbar and export buttons, and a public hook for the export status.

## License

The project's own code is released under the [MIT License](LICENSE). Third-party code keeps its own licenses.
