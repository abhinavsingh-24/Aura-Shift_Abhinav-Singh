# Local stabilization changes

- Added a Vercel deployment configuration and catch-all Express API function entrypoint.
- Added a root production build script and start script.
- Made production startup require a reachable MongoDB database instead of silently using ephemeral in-memory storage.
- Improved keyboard focus visibility, responsive layout polish, and Party Hub presentation.
- Party Hub now shows available quest parties, requires joining a party before its chat room unlocks, and scopes local messages by party.

## Review pass: navigation, integration and bug fixes

**Information architecture**
- One route table (`client/src/lib/routes.js`) now drives the navigation, page headings, sibling tabs, footer, document titles and the 404 page. Header went from 19 links (165px desktop / 557px phone) to 4 links + an "Adventure tools" menu + an account menu (65px on both).
- The home page is now: hero, quest map, happening soon, recommendations, organizer invitation. It no longer embeds the publish form, quest chains, saved, nearby and insights panels (each has its own page).
- In-app links use client-side navigation (no full reloads); focus moves to the page heading and the document title updates on every route. Unknown URLs show a 404 instead of the home page.
- Removed developer scaffolding from the UI ("Feature 12 / Party Hub" labels, duplicated generic subtitles). The rule-based guide is no longer labelled "AI" in navigation or headings.

**Data and privacy**
- Browser-stored state (saved quests, notes, chat, chains, reminders, profile) is namespaced per account (`client/src/lib/storage.js`). Previously it was global, so the next person to sign in on a shared browser inherited it. Legacy un-namespaced data is only inherited by signed-out visitors.
- Organizer Hub now reads `GET /api/my-events` (matched by owner id and including join counts) instead of matching events by organizer *display name*.
- Saved page: details, remove, links to calendar/reminders/chains, and unavailable saved ids are reported instead of silently dropped (the nav badge now matches the page).

**Server bugs fixed**
- `POST /api/reports`: organizer reports referenced an undefined variable (`body`) and would have returned a 500.
- `POST /api/events` (MongoDB): the in-memory copy of a freshly published event lost its `ownerId`.
- Rate limiting behind Vercel: `trust proxy` was never set, so every visitor shared one limit bucket. It is now enabled automatically on Vercel (`TRUST_PROXY` overrides).

**Tests**
- `npm test` skipped the three `.mjs` suites (14 tests), which hid a failing, randomly-flaky Mystery Quest test. The glob now includes them and tie-breaking is injectable so the test is deterministic.
- New unit tests: route table, storage scoping.
- The insights request now only fires on the Insights page, not on every filter change.

## Validation performed (in a sandbox without registry access)

- `npm test`: every suite passes **except `server/api.test.js`, which needs Express and could not be run here**.
- Type-check for undefined identifiers (TypeScript `checkJs`) over server and client: clean.
- Client bundled with esbuild and driven in Chromium (Playwright) against a stand-in API that serves `sampleData.js`: 91 checks across navigation, accessibility, per-account storage, organizer and Saved flows, mobile and the map.
- **Not verified:** the real Express server (including `/api/my-events` and the proxy fix), MongoDB, `vite build`, and an actual Vercel deployment. Run `npm install && npm test && npm run build` on a machine with registry access before deploying.

## Remaining limitations

- Party membership, chat messages, field notes, quest chains and profile remain **local to the browser** (clearly labelled in the UI). Cross-user chat/reviews need a persistent API and realtime transport.
- Editing or cancelling a published quest is not implemented.
- Rate limits are per server instance; use a shared store before scaling out.
- Configure `MONGO_URI` and a random `SESSION_SECRET` (32+ characters) in Vercel before deployment.
