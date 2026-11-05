# Living Quest Map — interaction & performance redesign

Primary acceptance criterion: **click Event A, immediately click Event B, and see B in the same persistent panel with nothing closed and no loading cycle.**
Verified in a real browser (Chromium) against the real map, panel and detail-store code — see "What was and wasn't verified".

## Root causes found (and fixed)

| Symptom | Root cause in the original | Fix |
|---|---|---|
| "Must close one event to open another" | Selecting an event zoomed the camera 1.0× → 1.5× and panned (0.65 s animation), pushing most other events off-screen; the details were a floating overlay that also covered markers. Measured: after opening A, **only 4 of 16 markers were still clickable** (1 under the overlay, 11 off-screen). | Details live in a **persistent panel outside the map** (side column on desktop, bottom sheet on phones). Selecting from the map never moves the camera. |
| Keyboard users couldn't switch | The close button grabbed focus on every selection. | Focus is never moved on selection; a polite live region announces the switch. `[` / `]` step through quests, `Esc` is an optional close. |
| Overlapping cards | The layout assumed a card is 128 map-units tall. **Rendered cards are ~164 × 187 units**, so cards were guaranteed to overlap vertically. Dense areas had no fallback. | Layout uses the measured footprint (`CARD_W/CARD_H`) and has two tiers: full **cards** where they fit, compact **pins** elsewhere, so every event stays reachable. |
| Wasted work per interaction | App passed a new inline `onSelect` every render (defeating `memo` on every marker); `getBoundingClientRect` ran on every mouse move for a 3-D tilt; map controls floated over cards. | Stable callbacks, tilt removed, controls moved to a toolbar above the map. |
| Map and list could disagree | Region filter lived only inside the map; map and list used different collections. | One `filterByRegion` / selection state in `App`, shared by map, list, counts and panel. |
| Stale list responses | The filter fetch had no cancellation: a slow older request could overwrite a newer one. | `cancelled` guard in the effect. |

## What changed

- `lib/mapLayout.js` — measured card footprint, card/pin tiers, grid-snapped pins that avoid cards and region names, still deterministic and independent of filters.
- `lib/questDetailStore.js` (+ `services/questDetails.js`) — shared cache with in-flight de-duplication, hover/focus prefetch, abort of requests for events the user left, per-id errors, results always stored under the id they were requested for.
- `lib/questSelection.js` — pure helpers: shared region filter, selection reconciliation, keyboard stepping, pan-only camera reveal.
- `components/map/QuestDetailPanel.jsx` — one persistent panel (map **and** list). Shows list data instantly, merges fetched detail when it arrives, small inline loading/error states, "More in this region" for in-place switching, Back (mobile) / Close (desktop) as optional actions.
- `components/map/QuestPaper.jsx` — card or pin, accessible names, 120 ms-debounced prefetch.
- `components/map/WorldMap.jsx` — no selection state of its own; camera only pans for off-screen selections from keyboard/list/panel; honours `prefers-reduced-motion`.
- `components/map/RegionFilter.jsx` — shared by both views. `App.jsx` — wiring, list cards selectable and highlighted.
- Removed: `SelectedQuestPreview.jsx` (replaced by the panel).
- Not changed on purpose: routing/URL (selection is not written to history — the app routes by path and `/quests/:id` already opens the full page), saved quests, checkout/registration, server.

## Before / after (measured, same script on both builds)

Chromium headless, 1280×860, a harness that mounts each version of the real map component (the "before" harness wraps the original code from your ZIP). Single machine, small samples — treat as indicative.

| Metric | Before | After |
|---|---|---|
| Markers still clickable right after opening Event A (16 quests) | 4 of 16 (1 under overlay, 11 pushed off-screen) | **16 of 16** |
| Camera on selecting a quest | zoom 1.0→1.5 and pan, 0.65 s transition | **unchanged** (no zoom/pan, 0 s) |
| Overlapping card pairs, 16 quests | 6 | **0** |
| Overlapping card pairs, 56 quests (40 in one region) | 233 | **0** (10 cards + 46 pins) |
| Markers directly clickable at default view, 56 quests | 18 of 56 | **56 of 56** |
| Click → new details painted (median of 6, programmatic click) | 94.9 ms (range 46–381) | 29–50 ms across runs (range ~21–212) |

Notes on the timing row: the harness parent is trivial, so it does **not** include the cost of re-rendering the 2000-line `App`; the real-app difference is unmeasured. Run-to-run variance is large (single outliers of 100–380 ms in both builds), so only the order of magnitude is meaningful. Selection never waits on the network: the panel renders list data immediately and merges the fetched detail later.

**Not measured:** React re-render counts, map redraw frequency, layout-shift scores, network requests per selection against the real API (the browser tests do assert exactly one request per event, with hover prefetch + clicks sharing it).

## Tests

- `npm test` — now 63 client unit tests (layout: 11, detail store: 8, selection/camera: 5, plus existing) and the existing server tests.
- `npm run test:map` — 13 browser tests: A→B in the same panel (DOM node identity + removal observer), no duplicate requests, abort of obsolete requests, failed request keeps map/panel usable, out-of-order responses, map↔list consistency, filtering both views and selection clearing only when ineligible, selected-marker highlight, zoom/pan unchanged by selection, keyboard selection/stepping with focus kept, dense cluster (no card overlap, every marker clickable), mobile bottom sheet (geometry, in-place switching, Back, no horizontal overflow), timing.
- `e2e/sidequest.spec.js` — test 10 updated for the new panel; new 10b for A→B and list sync.

Bugs these tests caught during development (all fixed, none "fixed" by loosening the test): fetcher ran after an abort could register; reveal logic panned on pointer clicks near map edges; card footprint was smaller than rendered cards; pins snapped closer than their drawn size; pins started above the visible area; mobile sheet was pinned to the top (stale `top` from the desktop rule).

## What was and wasn't verified

Verified here: all unit tests; the browser tests above in Chromium; `App.jsx` and all new modules bundle (esbuild).

**Not verified — please run:**
1. `npm --prefix client run build` and `npm run lint`: Vite/oxlint weren't installable offline. I only confirmed the code bundles with esbuild.
2. The real `App` in a browser: the harness mounts the real map, panel, filter and store, but its list is a minimal mirror of App's list, and there is no backend. App's list card click handling, the real `GET /api/events/:id` response, checkout, login redirect and saved-quest flows were not exercised.
3. `npm run test:e2e` (Playwright against the running app) — updated but not run (needs the server and MongoDB).
4. `build-harness.mjs` has a Vite fallback branch that was never executed (esbuild branch is what ran).
5. Real touch devices, screen readers and Safari/Firefox; reduced-motion was implemented in CSS/JS but not tested.

## Known limits / judgment calls

- Each region fits ~2–3 full cards; the rest appear as pins (scaled with the map) and in the list/panel. This is intentional ("do not fit every card"). Beyond ~60 events in a single region some pins can touch; the list remains complete.
- On a phone at the default 240% zoom, the bottom sheet leaves a small strip of map; "Back" collapses it.
- The panel's price/"Spots left" style fields only show what the API provides; the server has no availability field, so none is shown.
- Region names remain decorative category groupings, not geography; no coordinates were invented.
