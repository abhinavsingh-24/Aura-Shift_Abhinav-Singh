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
- Development-only sample data clearly marked in the UI
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

Participant-level registration records are not exposed through a public endpoint.

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
- Production deployments should add rate limiting, email verification, password reset, stronger session revocation/rotation, monitoring, and independently verified organizer onboarding before handling real users.

## Testing and quality checks

Run the available checks from the client folder:

```bash
cd client
npm run lint
npm run build
```

Run backend tests with `npm test`. The tests cover recommendation scoring and key API flows, including invalid payloads, publishing, duplicate registration, capacity limits, and the absence of a public participant-records endpoint. Run the frontend build with `npm run build --prefix client` after installing dependencies.

## Known limitations

- MongoDB persistence is optional for local development but required for durable accounts/events/registrations across server restarts.
- Authentication is implemented with signed HttpOnly cookies and scrypt password hashes. In-memory accounts are lost when the backend restarts; configure MongoDB for persistence.
- Organizer account type is self-selected during registration and is not independently verified. Do not treat this as a production-grade trust/verification system.
- The prototype does not yet include password reset, email verification, social login, account deletion, rate limiting, or a production session revocation store.
- Distance sorting requires latitude/longitude on events. Events without coordinates can still be found by city/locality and have address-based map links.
- Individual registration records are not exposed through a public API route. Registration uses a browser-local participant identifier for the prototype; it is not authentication, and clearing browser storage changes that identifier.
- The recommendation logic is explainable and transparent, not AI-based.
- The insights endpoint returns aggregate registration metrics only; it does not return participant names.

## Demo flow

1. Open the app at http://localhost:5173/
2. Browse the Quest Board and use search or filters
3. Open an event detail to inspect the event and available actions
4. Explore recommended quests and their reasons
5. Publish a new quest from the organiser form
6. Confirm the event appears in the board after the backend accepts it
7. Experience the responsive mobile layout

## Notes

- Sample events are clearly labelled as development data.
- Event publication requires valid field input and backend confirmation before success is displayed.
- The project is structured to remain easy to extend for a hackathon demo or prototype build.
