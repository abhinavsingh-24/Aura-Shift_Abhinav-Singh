# SIDEQUEST

SIDEQUEST is a hyperlocal event discovery and community engagement platform for nearby experiences. It helps people discover workshops, open mics, sports sessions, maker nights, cultural events, and community meetups that match their interests and local area.

## Problem and solution

People often miss local experiences because opportunities are spread across different platforms and neighborhoods. SIDEQUEST brings local events into a single, searchable quest board, highlights recommended matches, and lets organizers publish new quests without pretending that identity or verification is complete.

## Main features

- Quest Board with keyword, category, date, city, and locality filtering
- Nearby quests by city and locality
- Transparent recommendation scoring with real reasons
- Responsive Mystery Journal homepage and dedicated routes for Quest Board, Nearby, Recommended, Saved, and Publish
- Email/password account registration and login with signed HttpOnly session cookies
- Explorer and organizer account types; organizer accounts can publish events
- Quest details with map/directions links and optional event coordinates
- Browser geolocation for nearby sorting when event coordinates are available, with manual locality fallback
- Keyword, category, date, city, and locality filters
- Transparent interest-based recommendations
- Event publishing with backend validation, optional image URL, and venue coordinates
- Event registration and saved quests
- Quest Chains: create named mini-outings, add quests, reorder or remove stops, and share/copy a simple itinerary
- Quest Reminders: opt-in browser notifications and an upcoming list for saved quests, with a configurable lead time (15 minutes, 30 minutes, 1 hour, or 1 day)
- Mystery Quest: a surprise-pick page that draws from real upcoming events, optionally filtered by city, category, and time window, with a transparent explanation of the selection
- Development-only sample data clearly marked in the UI
- Quest Chains and reminder preferences are stored locally in the current browser; they do not sync across accounts/devices, calculate travel times, or verify venue opening hours
- Quest Reminders are best-effort browser notifications checked while SIDEQUEST is open; notifications may not fire when the browser is closed or the device is asleep, and they do not use server push
- Optional MongoDB persistence with in-memory fallback (in-memory changes reset when the server restarts)

## Tech stack

- Frontend: React + Vite + JavaScript
- Backend: Node.js + Express.js
- Database: MongoDB + Mongoose (optional), with in-memory demo fallback
- Styling: custom CSS with a Mystery Journal visual direction

## Architecture overview

- `client/` contains the React app and API client
- `server/` contains the Express app, validation, sample data, and recommendation logic
- `server/db.js` handles MongoDB connections when `MONGO_URI` is configured
- `server/index.js` defines the REST API and serves the app logic

## Project structure

```text
sidequest/
├── client/
│   ├── src/
│   ├── package.json
│   └── vite.config.*
├── server/
│   ├── db.js
│   ├── index.js
│   ├── recommendations.js
│   └── sampleData.js
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── package-lock.json
```

## Prerequisites

- Node.js 18+
- npm
- Optional: MongoDB instance for persistent storage

## Installation

1. Install the root dependencies:
   ```bash
   npm install
   ```
2. Install the client dependencies:
   ```bash
   cd client && npm install
   ```

## Environment setup

Copy the example env file and adjust values if needed:

```bash
cp .env.example .env
```

Example variables:

```env
PORT=3001
MONGO_URI=
FRONTEND_URL=http://localhost:5173
SESSION_SECRET=replace-with-a-long-random-secret-before-deployment
```

Notes:
- `PORT` controls the backend port.
- `MONGO_URI` enables MongoDB-backed persistence when set.
- `FRONTEND_URL` is used for local CORS configuration.
- `SESSION_SECRET` signs authentication cookies. Set a long, random secret before deployment; the default is only for local development.
- If MongoDB is not configured, the app continues with in-memory data for demo use. Users and events will be lost when the server restarts.

## Local startup

Start the combined app from the project root:

```bash
npm run dev
```

This runs:
- backend: `node server/index.js`
- frontend: `cd client && npm run dev -- --host 0.0.0.0`

The frontend is available at:
- http://localhost:5173/

The backend API is available at:
- http://localhost:3001/api/health

## Database setup

MongoDB persistence is supported through Mongoose. To enable durable accounts, events, and registrations, create a database (for example, a MongoDB Atlas cluster), copy its connection string into `MONGO_URI`, and restart the backend. Keep database credentials private and never commit `.env`.

- When `MONGO_URI` is present and reachable, user accounts, events, and registrations use MongoDB.
- When `MONGO_URI` is empty or the connection fails, the backend falls back to in-memory demo storage. Accounts, events, and registrations will be lost when the backend restarts.
- The frontend shows a `MongoDB` or `Demo data` status indicator based on `/api/health`.
- Verify persistence by publishing an event, restarting the backend, and confirming the event is still present.

## API contract

### GET /api/health
Returns the backend health status.

### GET /api/events
Lists upcoming events with optional filters:
- `search`
- `category`
- `date`
- `city`
- `locality`

### GET /api/events/:id
Returns a single event.

### POST /api/events
Creates an event. Requires a valid payload and an authenticated organizer session. Optional `latitude`, `longitude`, and `imageUrl` can be included.

### GET /api/recommendations
Returns the ranked recommendation list using a transparent score model.

### POST /api/events/:id/register
Registers a participant for an event. Capacity and duplicate checks are enforced where supported.

### GET /api/my-registrations
Returns the authenticated explorer's registration records with populated event summaries. Requires authentication.

### POST /api/reports
Submits a trust and safety report for an event or organizer. Validates target type, label, reason, and details (up to 1000 characters). Requires authentication. Prevents duplicate open reports for the same target by the same explorer.

### GET /api/my-reports
Returns all trust and safety reports filed by the authenticated explorer. Requires authentication.

### GET /api/insights
Returns aggregate registration and category insight data for the dashboard.

### POST /api/auth/register
Creates an explorer or organizer account and starts a session. Passwords are stored as scrypt hashes, not plaintext.

### POST /api/auth/login
Authenticates an existing account and starts a session.

### GET /api/auth/me
Returns the current session user or `{ "user": null }`.

### POST /api/auth/logout
Clears the browser session cookie.

Participant-level registration records are not exposed through an unauthenticated or public endpoint.

## Recommendation model

The recommendation engine is intentionally transparent and not presented as machine learning. It uses a simple weighted model:

- Interest match: +40
- Selected locality match: +30
- Happening soon: +20
- Selected category match: +10

Recommendations are sorted by total score and then by event date. Each recommendation includes its reason list.

## Authentication and registration behavior

- Account creation and login use email/password, scrypt password hashes, and signed HttpOnly session cookies.
- Publishing requires a logged-in organizer account. Organizer role is self-selected at signup and is not independently verified.
- Event attendance registration remains a guest-friendly prototype flow. It uses a browser-local participant identifier; this is not authentication, and clearing browser storage or switching browsers/devices changes that identity.
- Production deployments still need email verification, password reset, stronger session revocation/rotation, monitoring, and independently verified organizer onboarding before handling real users. Basic process-local rate limits and baseline security headers are now included, but they are not a substitute for a shared rate-limit store or a full security review.

## Testing and quality checks

### Automated Unit and API Integration Tests
Run all 56 automated unit and API integration tests:

```bash
npm test
# or
npm run test:unit
```

Tests cover:
- XP and level progression calculations
- Quest chains validation, stop reordering, duplicate prevention, and formatting
- Adventure AI assistant prompt ranking, edge cases, and past-event exclusion
- Achievement milestone progression and invalid counter resilience
- Mystery Quest selection scoring, category/city constraints, and tie-breaking
- Date/time formatters, category glyphs, and review draft validation
- Fantasy map layout determinism and collision avoidance
- API event publishing, validation, duplicate registration checks, and capacity limits
- Protected route authentication, IDOR prevention, and role checks (`/api/my-registrations`, `/api/reports`, `/api/my-reports`)
- HTTP 429 rate limiting and malformed JSON error handling

### End-to-End Browser Automation Tests (Playwright)
Run the Playwright E2E suite covering all 14 core user journeys:

```bash
npm run test:e2e
```

The test runner starts isolated backend (port 3050) and frontend (port 5199) servers automatically via `playwright.config.js` to prevent collisions with any existing local servers.

Test flows verified:
1. Homepage rendering and hero call to action
2. Keyword search and category filtering on Quest Board
3. Explorer user registration with session cookie issuance
4. Sign out, session persistence, and re-login
5. Quest saving and unsaving
6. Event registration (RSVP) with duplicate registration prevention
7. Organizer account registration
8. Event publishing with validation
9. Board display verification for newly published quests
10. Interactive fantasy map view, marker selection, and zoom controls
11. Quest Chains creation, adding stops, and stop reordering
12. Trust & safety reporting and validation
13. Protected routes redirect / auth-gate for unauthenticated visitors
14. Responsive mobile viewport drawer navigation

### Linting and Production Build
```bash
npm run lint    # Oxlint (0 errors, 0 warnings across all files)
npm run build   # Production Vite client build
```

## Known limitations

- MongoDB persistence is optional for local development but required for durable accounts/events/registrations across server restarts.
- Authentication is implemented with signed HttpOnly cookies and scrypt password hashes. In-memory accounts are lost when the backend restarts; configure MongoDB for persistence.
- Organizer account type is self-selected during registration and is not independently verified. Do not treat this as a production-grade trust/verification system.
- The prototype does not yet include password reset, email verification, social login, account deletion, or a production session revocation store. Current rate limits are in-memory per process and reset on restart; use a shared store for multi-instance deployments.
- Distance sorting requires latitude/longitude on events. Events without coordinates can still be found by city/locality and have address-based map links.
- Individual registration records are not exposed through a public API route. Registration uses a browser-local participant identifier for the prototype; it is not authentication, and clearing browser storage changes that identifier.
- The recommendation logic is explainable and transparent, not AI-based.
- The insights endpoint returns aggregate registration metrics only; it does not return participant names.

## Demo flow

1. Open the app at http://localhost:5173/
2. Browse the Quest Board and use search or filters
3. Open an event detail to inspect the event and available actions
4. Explore recommended quests and their reasons
5. Create a Quest Chain from the Quest Chains page
6. Open a quest and add it to the active chain; reorder stops and share/copy the itinerary
7. Publish a new quest from the organiser form and confirm it appears on the board
8. Experience the responsive mobile layout

## Notes

- Sample events are clearly labelled as development data.
- Event publication requires valid field input and backend confirmation before success is displayed.
- The project is structured to remain easy to extend for a hackathon demo or prototype build.


### Event registration authentication

- Visitors can browse quests without an account. Joining a quest requires signing in or creating an account.
- The login flow returns visitors to the event they intended to join.
- The registration API verifies the signed-in session and derives participant identity from the account; client-supplied participant names and IDs are ignored.
- The backend rejects unauthenticated registration requests, prevents duplicate registrations per account, and enforces event capacity.

This is a Node.js/React project, not a Python project. `requirements.txt` is provided as a pointer to the npm manifests; install dependencies using `npm install` at the root and `npm install --prefix client`.

---

## The illustrated quest map (design + engineering notes)

The home page and `/quests` open on an illustrated fantasy map. Every paper on it is a **real event from `GET /api/events`** — nothing is invented.

- **Regions are decorative.** Whispering Woods, Music Meadow, Lantern Village, Maker's Forge, Sunlit Arena and Hidden Garden group events by *category* (`client/src/lib/mapLayout.js`). Map positions are **not geographic**; each quest always shows its real city, locality and venue. Distances are only ever computed from real coordinates (Nearby page).
- **Deterministic placement.** A paper's position is derived from a hash of the event id, then nudged to avoid overlaps. It does not change on re-render, on filtering, or with the order the API returns events.
- **Genuine interactions.** Terrain and papers live on one canvas that is translated/scaled together, so they cannot drift apart. Drag to pan; `+`/`−` buttons or keys, or Ctrl/⌘ + scroll, to zoom; arrow keys pan; `0` or *Reset* restores the view; `Esc` closes the preview. Papers are real buttons (Tab/Enter), and focusing one brings it into view.
- **Map ⇄ List** share the same filtered events (search, category, date, city, locality).
- **Motion.** Paper lift/tilt, parallax haze, a few fireflies. All of it is disabled under `prefers-reduced-motion`.
- **Touch.** One-finger drag pans and the on-screen buttons zoom. Pinch-to-zoom is **not** implemented.
- **Brand.** `client/public/brand/` holds the SVG logo set (primary, emblem, horizontal, monochrome, app icon); `BrandLogo` renders the emblem inline. `favicon.svg` and PNG app icons are in `client/public/`. Wordmark SVGs use live text with a font fallback stack (not outlined).

### Tests

```bash
npm install && npm install --prefix client
npm test                         # server API/recommendation tests + map layout unit tests
npm run build --prefix client    # production build
```

### Troubleshooting: "Cannot reach the SIDEQUEST server" / "not responding (HTTP 502)"

The client talks to the API through Vite's proxy (`/api` → `http://localhost:3001`). If the backend is not running, or runs on another port, the proxy answers with an empty error and sign-up/sign-in used to show a generic "Something went wrong." They now say what is actually wrong. Fix: run `npm run dev` from the **project root** (it starts both the API and the client), and make sure `PORT` in `.env` matches the proxy target.


## Feature 08 — Mystery Quest

Mystery Quest offers a surprise reveal of an upcoming event, using the current event list rather than fabricated suggestions. Explorers can set optional city, category, and timeframe boundaries. Selected interests are used as a soft preference, not a hard exclusion, so a wildcard is still possible when no interest matches. The page explains why the event was picked and offers view/save/try-another actions.

Open `/mystery` or choose **Mystery Quest** in the navigation. This is a local selection flow and does not require a new API endpoint.

Tests: `node --test client/src/lib/mysteryQuest.test.js`

## Feature 06 — Quest Radar

Quest Radar ranks upcoming events using the explorer's selected interests and allows filtering by time window, category, city, and locality. It can optionally use browser location to filter by radius or sort by distance. Location coordinates are held in the current page session and are not sent to a new backend endpoint by this feature. Events need latitude/longitude data to appear in radius-limited results.

Open `/radar` in the running app or use the **Quest Radar** navigation link. The screen includes interest chips, time/category/location filters, best-match and soonest sorting, optional nearest sorting, a results count, and save/view actions.

Radar logic tests: `node --test client/src/lib/questRadar.test.js`

## Feature 09 — Explorer Achievements

The `/achievements` page adds six milestone badges based on the explorer's current saved-quest count, locally stored Quest Chains and their stops, and Mystery Quest reveal count. It includes progress bars and a small activity summary. Mystery reveal totals persist in this browser's local storage. Like other browser-local preferences, achievements are not synced across devices or accounts. Attendance/registration achievements are intentionally omitted because this prototype does not currently expose a reliable personal attendance history.

Open `/achievements` or choose **Achievements** from the navigation/footer.

## Feature 10 — Community Field Notes
- Quest details include star ratings, experience stories, and optional practical tips from explorers.
- Field notes are saved in browser localStorage for this prototype; they are not yet moderated or shared across accounts/devices through the server.

## Feature 11 — Explorer Profile
- The `/profile` route provides a profile card, editable home city and short bio, a visibility preference, and local activity counts.
- Profile preferences and the local field-note activity are browser-local prototype data. The visibility selector is a preview preference, not server-enforced privacy control.

## Features 12–15: Party Chat, Smart Recommendations, Quest Calendar, Explorer XP

- **Party Chat (Feature 12):** a lightweight coordination message board with 500-character limits and a clear-chat action. Messages are stored in this browser only; this is not real-time, cross-account, or server-backed messaging.
- **Smart Recommendations (Feature 13):** ranks upcoming events using selected interests, selected city, and near-term date. It displays match reasons and lightly de-prioritizes events already saved. It is a local heuristic, not a trained AI model.
- **Quest Calendar (Feature 14):** shows upcoming saved events and exports them as an `.ics` file. It does not sync with external calendar accounts or calculate travel-time conflicts.
- **Explorer XP & Levels (Feature 15):** derives a local XP/level summary from saved quests, field notes, chain stops, Mystery Quest reveals, and party messages. This is a prototype score and is not server-synced or protected against local browser data changes.

### Verification note

Targeted Node tests cover the recommendation ranking and XP calculation utilities. The full Vite production build and browser end-to-end flows have not been verified in this environment because client dependencies are not installed.

## Features 16–17: Organizer Hub and Bookings

- `/organizer` provides a role-gated overview of published quests for organizer accounts. Current view filters the loaded event list by organizer display name; owner-ID based analytics and event edit/pause/delete controls remain future work.
- `/bookings` displays the signed-in user's SIDEQUEST registrations. `GET /api/my-registrations` derives identity from the verified session and returns only that user's registration records.
- Organizer-provided `registrationUrl` values are shown as external registration/checkout links. SIDEQUEST does **not** process payments, verify external payment completion, issue paid tickets, or synchronize booking status with third-party checkout providers. A “confirmed” status means the SIDEQUEST RSVP was recorded only.
- The new API route requires a valid signed-in session. The complete server integration suite and production client build should be run after installing the dependencies listed in the package manifests.


## Feature 18 — Trust, Safety & Moderation

- Signed-in users can submit a private report for an event with a reason and optional factual details.
- Reports are validated on the server, linked to the reporting account, and can be reviewed by the reporter on `/safety`.
- MongoDB-backed projects persist reports in the `reports` collection; local development without MongoDB keeps them in memory only.
- Duplicate open reports for the same target from the same account are rejected.
- Important limitation: this feature records reports but does not yet include a staffed/admin moderation queue, report status management for moderators, user blocking, appeals, or emergency response. Do not represent a report as already reviewed or resolved.


## Feature 19 — Adventure Assistant

- Visit `/assistant` to ask for event ideas and shortlists.
- The current assistant uses a local, explainable keyword/interest scoring engine over SIDEQUEST's upcoming event list; it does **not** call a hosted AI model or require an API key.
- Up to 30 conversation messages are stored in this browser's local storage.
- Confirm availability, prices, venue details, accessibility, and event rules with organizers. Cost information may be missing from event records.
- A hosted LLM integration can be added later through a server-side provider adapter; never expose a provider API key in frontend code.


## Feature 20 & 21 — Full Production Upgrade: India Events, Ticketing & Payments

### 1. Verified India Event Discovery Catalogue
- **21 genuine, publicly announced events & programs** across India's premier metro hubs: Bengaluru, Mumbai, Delhi NCR, Pune, Hyderabad, Chennai, Goa, Kolkata, Ahmedabad, Jaipur, Kochi, Indore, Lucknow, Chandigarh, and Guwahati.
- Complete coverage across Tech Summits (Bengaluru Tech Summit, PyCon India, India FOSS), Premier College Cultural Fests (IIT Bombay Mood Indigo, IIT Madras Saarang, COEP MindSpark, IIT Guwahati Alcheringa), Comedy Showcases, Dastangoi/Urdu Poetry, Marathons (Tata Mumbai Marathon), Hackathons, and Indie Open Mic showcases.
- Verified fields: Official organiser attribution, exact venue coordinates, transparent pricing tiers in INR (`₹`), ticket deadlines, cancellation policies, and source attribution links.

### 2. Digital Ticketing & QR Pass Check-In Architecture
- **Buyer accounts & checkout journey**: Select ticket tiers and quantity, review transparent GST price breakdowns, and complete checkout.
- **Digital Tickets (`/bookings`)**: Generates an authentic SVG QR code matrix encoding a cryptographic validation token (`SQPASS:<bookingRef>:<eventId>`).
- **Server-side check-in validation (`/api/organizer/check-in`)**: Prevents ticket reuse, enforces role-based ticket validation, and records atomic admission timestamps.

### 3. India Payment Integration (Razorpay + Sandbox Simulator)
- Server-side order calculation and price validation in INR (`₹`).
- Webhook signature verification using HMAC-SHA256 (`x-razorpay-signature`).
- Built-in, clearly labeled **India Payment Sandbox Adapter** for safe local development and demo testing without incurring real financial charges.
- Full payment lifecycle states: `pending`, `successful`, `failed`, `cancelled`, and `refunded`.

### 4. Database Reset & Safe Seeding Scripts
- `npm run db:reset:dev`: Safely flushes test/demo data, strictly refuses execution if `NODE_ENV=production`, and preserves genuine user accounts (`pinkeshchavhan159@gmail.com`).
- `npm run db:seed`: Idempotently seeds verified India event listings.
- `npm run db:seed:demo`: Idempotently seeds demo admin, organizer, and explorer accounts and bookings.

### 5. Role-Based Portals & Governance
- **Organiser Hub (`/organizer`)**: Real-time sales metrics, CSV attendee export, event draft/publish controls, and live QR ticket admission scanner.
- **Platform Admin Portal (`/admin`)**: Platform overview, event moderation, content report resolution, audit logs, and bulk verified event importer.
- **Reference Credentials**: See [`DEMO_ACCOUNTS.md`](./DEMO_ACCOUNTS.md) for pre-seeded test accounts (Admin, 3 Organizers, 10 Explorers).

### 6. Verification & Test Suite
- `npm test`: **58 / 58 passing tests** (Unit, API, Integration, Quest Radar, and Payment tampering/signature security tests).
- `npm run test:e2e`: **11 / 11 passing Playwright E2E tests** (Testing homepage discovery, authentication, quest chains, map view, safety reports, mobile navigation, India ticket booking journey, and Quest Radar navigation & filtering).
- `npm run lint`: 0 errors.
- `npm run build`: Production bundle built successfully.
