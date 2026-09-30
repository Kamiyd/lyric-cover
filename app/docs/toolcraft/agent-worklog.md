# Implementation Notes

This file is required by the Toolcraft app contract. It records the product's implementation decisions; it is not a conversation log.

## Status

Mode: product

Active change: lyric-cover

Lyric Cover redraws a song's album cover out of its own lyrics: search a song or upload a cover, fetch or paste lyrics, and export the image.

## Decision Trail

### Change lyric-cover

- Change ID: lyric-cover
- Request: Build a Toolcraft app that redraws an album cover out of the song's lyrics, with song search, cover upload, caption and image export.
- Task type: first product delivery — a new Toolcraft product.
- User-visible result: A Toolcraft workspace with Song (language + search), Cover & Lyrics (upload + lyrics), Weave, Caption and runtime Setup sections; the canvas shows the lyric glyphs in the cover's colours with an optional caption; Export PNG/JPG at 2K/4K/8K, named after the song.
- Source/reference checked: an earlier standalone prototype and the Toolcraft component catalogue at https://toolcraft.sh/components.
- Reference inputs: None — no motion or design reference file.
- Docs/contracts read: `AGENTS.md`, `workflow.md`, `core/runtime-boundary.md`, `assembly-workflow.md`, `core/control-selection.md`, `core/layout.md`, `core/performance.md`, `core/setup-export.md`, `core/media-upload.md`, `decision-contract.md`, `schema-reference.md`, `component-rules.md`, `custom-controls.md`, `custom-control-visuals.md`, `renderer-technique.md`, `performance.md`, `acceptance-testing.md`.
- Contract rules applied: runtime-shell-required (composeToolcraftApp only), canvas-no-app-ui (the canvas holds only the woven raster; upload lives in fileDrop), canvas-surface-preserved (runtime owns Background; the product draws a transparent foreground), controls-section-inventory-required, output-export-required (image only), renderer-technique-inventory (Canvas 2D pipeline declared before renderer code), persistence-policy-explicit (default local persistence).
- View interaction intent: non-spatial — the woven cover is a flat two-dimensional image with no model or camera; no orientation targets.
- Interaction ownership: song-search → panel (command; typing and picking need a field and a list); viewport-pan and viewport-zoom → canvas (direct-spatial-edit). Every other control is a global panel property with no canvas counterpart.
- Decision: Canvas 2D renderer with a memoized cover-sample → glyph layout → time-sliced raster pipeline and an uncached caption compose; one custom control (Song search) built from public InputGroup, Spinner, ScrollFade and Button; built-in controls for everything else.
- Alternatives rejected: importing the searched cover as runtime media (the source-asset coordinator is not a public API), a WebGL glyph atlas (exact font rendering matters more than speed at these glyph counts).
- State/output mapping: `song.pick` (artwork URL) or `source.cover` (uploaded media) → cover-sample; `song.lyrics`, `weave.density`, `weave.saturation`, `weave.font`, `weave.toneSize`, `weave.compact`, `appearance.background` (light/dark only) → weave-layout; `weave.underlay`, `canvas.renderScale` → weave-raster; `caption.enabled`, `caption.title`, `caption.artist`, `caption.fade` → caption-compose only; `export.image.*` + `actions.output` → export-render through `scene.rasterFrameRenderer`, reusing the preview's cover-sample and weave-layout cache keys.
- Verification: Product unit tests, framework validators, typecheck and the product source boundary pass; browser specs cover song search, language, cover upload and transforms, canvas sizing, caption styles and export.
- Risks: Risk: iTunes and LRCLIB are third-party services; browser acceptance mocks them, live results can change or be rate limited. Risk: Web fonts load per unicode-range subset from Google Fonts; offline use falls back to system CJK fonts.

## Decisions

### Renderer

- Decision: Canvas 2D product canvas in `scene.canvasContent` driven by the registered `lyric-weave-v1` pipeline: cover-sample (decode, memoized per source), weave-layout (text-layout, memoized), weave-raster (rasterize into an OffscreenCanvas in 12 ms slices, transferred as an ImageBitmap), caption-compose (uncached composite), export-render (export).
- Reason: Glyph output is text sampled from a raster cover; Canvas 2D renders the exact web font at any backing size and exports at 8K by re-weaving in scene units.
- Evidence: `src/app/weave/weave-pipeline.ts`, `weave-canvas.tsx`, `weave-raster.ts`, `weave-export.ts`; unit tests in `weave.test.ts` and `weave-export.test.ts`.
- Canvas size: `canvas.sizing` is `intrinsic-media`. The cover frame is the rotated cover scaled to a 1080-unit long edge, so the output keeps the cover's aspect ratio and is never cropped; there are no manual size controls.
- Progress: each raster slice is copied to the visible canvas so glyphs write in from the top; a re-weave keeps the previous image below the writing row. A pending cover shows a soft sweeping band (static under reduced motion).
- Caption: drawn inside the cover frame. By default a solid strip 8.5% of the width tall; with Soft fade the glyph rows above the caption grow fainter instead. Both are applied while composing, so caption changes never re-draw the glyphs.
- Export: drawn in ~32 ms slices so the interface stays responsive; the file is named `title-artist` from the caption fields, falling back to `lyric-cover`.

### View Interaction

- Decision: non-spatial.
- Reason: The product is a flat image; there is no model, camera or rotation.
- Evidence: `appProductReadiness.viewInteraction` in `src/app/app-acceptance-data.ts`.
- Mode: non-spatial
- Source: product analysis of the woven cover output
- Alternatives: orbit rejected because nothing in the scene is three-dimensional.
- Targets: none

### Interaction Ownership

- Decision: Song search is a panel command; viewport pan and zoom stay on the canvas; all other settings are global panel properties.
- Reason: Search needs a text field and a result list beside the settings it fills; spatial viewport gestures need direct canvas feedback.
- Evidence: `appProductReadiness.interactionOwnership` entries song-search, viewport-pan, viewport-zoom.

### Timeline

- Decision: No timeline.
- Reason: The output is a still image; nothing animates over time and there is no video export.
- Evidence: `appTransferMode.animationIntent.mode` is `none`; no timeline module.

### Layers

- Decision: No layers.
- Reason: There is one cover source and one woven output; no layer workflow is needed.
- Evidence: No `layersModule()` in `src/app/app-schema.ts`.

### Controls

- Decision: Five product sections: Song (segmented Language, then custom Search), Cover & Lyrics (image fileDrop, multiline code), Weave (Density and Saturation sliders, Font segmented, Tone sizing and Tight text inline switches, Cover underlay slider), Caption (Show strip switch with conditional Title and Artist text and a Soft fade switch), Background (runtime-relocated switch + color). Song and Cover & Lyrics share the `song-source` entity as two workflow stages.
- Reason: Entity-first grouping by the thing each control edits; the runtime would otherwise split the song entity at the large fileDrop/code controls.
- Evidence: `src/app/controls/*.ts`, `src/app/app-control-inventory.ts`.
- Custom control fit check (Song search): capabilities custom-value-model and commands; checked text, select, imagePicker, fileDrop, actions; closest imagePicker; insufficient because songs come from a live query and one pick applies the artwork reference, caption and fetched lyrics together.
- Custom control visual map (Song search):
  - Search field: public InputGroup + InputGroupInput with a MagnifyingGlass InputGroupAddon; owner public component; no product tokens.
  - Busy indicator: public Spinner in an inline-end InputGroupAddon; shown only while searching or fetching lyrics.
  - Status line: local text, `--muted-foreground` (errors `--destructive`); shows result count, pick outcome or the picked song.
  - Result list viewport: public ScrollFade with `scrollBoundaryBehavior="chain"`; no painted surface.
  - Result row: public Button `variant="ghost"`; highlighted row uses the Button's own hover state, the picked row sets `aria-pressed`; no `--accent` or `--primary` geometry.
  - Row thumbnail: actual album artwork (product data), 36px, `pointer-events: none`.
  - Row text: title `--foreground`, meta and duration `--muted-foreground`; direction is not encoded by colour.

### Export

- Decision: Image export only via `imageExportModule()` (PNG/JPG, 2K/4K/8K); no SVG or video.
- Reason: The product's output is a still image of the woven cover.
- Evidence: `productReadiness.exportIntent` image `toolcraft-default`, svg and video `not-requested`; `scene.rasterFrameRenderer = weaveExportRenderer`.

### Performance

- Decision: Workload dimensions `weave-density` (schema-target maximum 160, quadratic glyph count), `export-long-edge` (custom mapping of the resolution option) and derived `export-pixels`.
- Reason: Glyph count dominates layout and raster cost; export additionally scales with the exported pixel area.
- Evidence: `src/app/weave/weave-workload.ts`, `src/app/app-performance.ts`.
- Workload: weave-density drives weave-layout, weave-raster and export-render; export-pixels drives export-render.
- Lifecycle: cover-sample memoized per source; weave-layout and weave-raster memoized per interaction; caption-compose and export-render uncached per call.
- Assessment: Pipeline declared before renderer code; performance gate validators pass. Measured performance was not run.
- Paths: derived with `deriveToolcraftPerformancePaths` from the registered pipeline; one generated scenario per path.

Canonical control values and selected-entity isolation must follow runtime representations and the declared selection owner. Render-scale-enabled products record functional `renderScaleCoverage`; prose never substitutes for asserted backing-quality proof.

## Evidence

- Source reviewed: an earlier standalone prototype, the Toolcraft component catalogue, and the local Toolcraft contract docs listed above.
- Contract applied: Product modules pass the product source boundary.

## Verification

Verification tier: Tier 4
Reason: First product delivery of a new app with a custom renderer, custom control, media upload and image export.
Run: product unit tests and framework validators with vitest; typecheck; boundary checker; focused Playwright product specs.
Skip: Measured performance — not run. The protected delivery gate — not run, because the bundled Toolcraft copy has local modifications and its integrity check rejects them (see the repository README).

## Risks

- Risk: iTunes and LRCLIB are third-party services; results, availability and rate limits can change. Browser acceptance mocks both.
- Risk: The bundled Toolcraft copy under `src/toolcraft` has local modifications (listed in the repository README), so the framework's integrity check and delivery gate do not pass.

## Interface sounds (sound branch)

- Decision: interface sounds use `cuelume` (MIT, synthesized with Web Audio, no audio files). Cues are chosen by each control's job in `src/app/sound/weave-cues.ts`: switches → `toggle`; choices → `select` with direction; slider steps → `select`, rate-limited; text edits → `type`; a picked song → one `select`; reset → `close`; a newly woven cover → `ready`; a slow cover → `loading`; a settled export → `success` or `error`. Toolbar buttons and the Export button play `tap` through `data-cuelume-tap`.
- Preference: a mute button in the bottom toolbar, stored per app outside workspace values, history and reset. Volume is the library's maximum.
- Evidence: `src/app/sound/*`, `e2e/product-sound.spec.ts`.

### Open-source contributor checks and storage documentation

- User explicitly requested replacing the failing default test entry point with application checks and correcting both READMEs; dependency and bundle pruning remain out of scope.
- `test` now runs TypeScript and the existing source unit suite. Original Toolcraft verification and browser commands remain available as `test:toolcraft` and `test:toolcraft:browser`, with `test:toolcraft:integrity` for the signed check alone. The integrity checker and signed manifests were not edited.
- Updated the lifecycle contract test to verify the new application commands and the preserved upstream commands. Added missing caption-fade applicability evidence through real caption switch actions and retained rendered-pixel assertions.
- Both READMEs now explain browser-local settings, workspace and media persistence, browser installation, application tests, and the expected failure of upstream integrity checks on this modified copy.
- `pnpm test` passed: 745 tests passed, 9 existing optional tests skipped. Initial browser run exposed missing caption applicability evidence and a Playwright connection error; browser verification is rerun after the evidence fix.
- Final browser validation: all 9 application tests passed in an isolated worktree of `sound` plus this change. Concurrent language edits in the main checkout were preserved and excluded from that verification snapshot. Chromium headless-shell repeatedly exited mid-suite on this host; using the full Chromium headless channel completed the suite. The Playwright config now selects that channel; no dependency versions changed.
- Branch synchronization: `main` passed 741 unit tests (9 existing optional skips) and all 8 application browser tests. `sound` previously passed 745 unit tests and all 9 browser tests. Common contributor changes are committed on `main` and merged into `sound`, retaining the sound-only features.

### Browser language preference

- User requested publishing the browser-language change on both branches alongside contributor-check improvements.
- With no saved UI language, choose Chinese or English from browser language preferences; retain saved manual choices as the priority and English as the fallback.
- Added a browser regression proving a Chinese browser starts in Chinese and an explicit English choice survives reload. The existing language-switch/artwork-persistence scenario remains intact.
- Main validation: TypeScript and both interface-language browser tests passed.

### Restrained empty-canvas guide

- User requested a minimal guide matching the existing UI and explicitly chose 陈绮贞《旅行的意义》 as the example.
- Added viewport-space editor overlay and canonical control navigation ports. Product-owned guidance uses existing buttons and theme tokens; it offers search, file selection, and a smaller example link. A cover without lyrics prompts for lyrics; supplied lyrics without a cover preserve the text and request a cover. The guide disappears once both inputs exist and stays outside exports.
- The example uses the existing iTunes/LRCLIB pipeline on demand, with no bundled album art or song lyrics. Its metadata, lyrics and Chinese song-language selection share one undo step. It supports retry and cancels when the user starts their own work. Live iTunes metadata lookup returned the intended title and artist; automated tests mock the external services.
- Browser plugin not available; used the existing Playwright workflow. Flow: empty app → search focus / upload → lyrics → artwork; example → artwork → undo; failed example → retry; Chinese/English and dark/light themes. Reviewed screenshots at 1440×960 and layout at the 1024px desktop minimum. Mobile continues to use the existing desktop-only entry gate.
- Validation: 741 unit tests passed (9 existing optional skips), full 13-test app browser suite passed, then all 4 onboarding tests passed again after adding explicit example-language/undo checks. No console/page errors in the upload-to-artwork flow. Screenshot evidence saved outside the repository.

### Reuse the existing empty-state design

- Active change: empty-guide-component-reuse. Later focused visual edit: reuse the existing components and design instead of custom styling.
- Replaced custom headings, typography, button overrides, spacing CSS and viewport backdrop with the existing Empty/Header/Title/Description/Content and Button variants. Icons use the existing Phosphor family; loading uses Button's built-in loading state. Shortened the introductory copy. Removed the guide CSS module entirely.
- Kept canonical search/upload navigation and the requested song example. The guide uses the editor background token within its own bounds so text remains readable over a dark artwork background in light theme.
- Focused verification: TypeScript passed; all four onboarding browser tests passed, including upload/lyrics, example/undo, error/retry, language and theme visibility. Reviewed dark/light screenshots and confirmed the guide avoids the panel at 1024px.

### Transparent canvas guidance

- Active change: transparent-canvas-guide. User asked to remove the extra background around the guide while retaining the reused components.
- Removed the guide surface fill. Existing Empty and Button components now sit directly over the canvas. Their existing theme tokens follow the canvas background luminance (using the existing background resolver and luminance helper), so light editor chrome does not produce dark text on dark artwork. No new canvas backing or pseudo-element is added.
- Focused validation: TypeScript and all four onboarding browser tests passed. Reviewed the light-theme screenshot: no card or additional background, readable text over the existing canvas. Search, upload, example, undo and retry remain covered.

### Hide the empty artwork backing

- Active change: empty-artwork-backing. User clarified with a screenshot that the unwanted block is the entire black artwork background, not the guide container.
- Product bounds are now empty until a cover and lyrics exist. The runtime omits the finite preview fill for an explicitly empty product while retaining the mounted renderer and existing media behavior. The guide inherits editor theme tokens again and sits directly over the workspace pattern.
- Focused proof: TypeScript and four onboarding browser tests passed. Tests assert no finite background initially or after undo, and its return after valid content. Reviewed the light-theme screenshot confirming uninterrupted workspace dots behind the guide.

### Initial artwork zoom

- Active change: initial-artwork-zoom. User requested 55% after loading the example or generating the first cover, since 100% looks too large.
- The example sets the viewport to 55%; first rendered output changes an untouched 100% viewport to 55% once. Existing artwork and subsequent edits preserve the chosen view. Source dimensions and exports are unchanged.
- Focused validation: TypeScript and all four onboarding browser tests passed. Assertions cover 55% for upload and example, then manual zoom to 65% retained after lyric edits and reload.

### Center initial output beside controls

- Active change: initial-free-area-center. User clarified that initial artwork must center in the left available workspace, excluding the controls panel.
- Extracted the existing toolbar free-area calculation into a shared runtime helper. First-generation 55% zoom and example loading now use that same center, instead of scaling the previous offset or resetting it to the full-page origin.
- Focused validation: TypeScript and four onboarding browser tests passed. Added geometric assertions comparing artwork center to the midpoint between viewport left and controls-panel left for both uploaded and example artwork. Manual zoom persistence remains covered.

### Set initial zoom before rendering

- Active change: initial-zoom-before-render. User identified that first search generation shrank only after drawing while the example zoomed first.
- The one-time initial viewport adjustment now runs in a layout effect when cover metadata and lyrics become available, before drawing, rather than waiting for the completed glyph count. Existing artwork and later manual viewport changes remain preserved.
- Focused validation: TypeScript and five onboarding browser tests passed. New search regression blocks artwork requests, verifies 55% and free-area centering with zero drawn glyphs, then releases the image and verifies those values remain unchanged after generation.


### Text brightness control

- Active change: text-brightness-control. Change ID: text-brightness-control. Later feature work: add a text brightness control after text saturation.
- Built-in continuous slider after Saturation: weave.brightness, 0–200%, default 100%. Shared layout colour output scales RGB after saturation; tone sizing continues to use the original sampled luminance. Preview/export share the layout and brightness cache key. Existing workload dimensions remain unchanged; brightness joins the saturation invalidation path.
- Verification tier: Tier 3, focused renderer colour behavior. Run: weave layout unit tests and weave.brightness feature browser acceptance (live drag, brightness direction, reset). Skip: aggregate delivery, full browser/export matrix and measured performance because this is a localized later edit.
- No additional workflow skill is needed for this small edit; the signed local workflow supplies the contract.
- Verification: all 20 weave unit tests passed; the single focused Playwright brightness test passed, proving control order, live brightening before pointer release, dimming, and section reset to 100%. `git diff --check` passed. The protected `test:feature -- weave.brightness` preflight is unavailable because the existing playwright.config.ts does not match its signed config digest; no protected config or manifest was modified. The direct browser run is focused diagnostic/functional proof, not a protected feature receipt. Measured performance was not run.
