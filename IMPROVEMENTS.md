# SIDEQUEST final improvement notes

This package preserves the existing React/Vite + Express application and extends it into a more complete hackathon MVP.

## Application and UI
- Mystery Journal identity: warm parchment and cream surfaces, forest-green actions, restrained mystery-red accents, compass/map motifs, a CSS-drawn map hero, and responsive event cards.
- Dedicated routes for `/`, `/quests`, `/quests/:id`, `/nearby`, `/recommended`, `/saved`, `/publish`, `/login`, and `/register`.
- Separate login and registration screens with account-type selection and clear errors.
- Main navigation shows the current API/database mode: MongoDB or temporary in-memory demo data.
- Optional event image URL with original illustrated fallback, venue coordinates, address-based directions, and OpenStreetMap embed when coordinates are provided.
- Browser geolocation is optional. Nearby sorting calculates distances only when both the user's and event's coordinates are available; manual city/locality browsing remains available.
- Responsive desktop, tablet, and mobile layouts, focus states, reduced-motion support, loading/error/empty states, and accessible modal labels.

## Backend, authentication, and data
- Stable string `id` field for MongoDB events; does not pass `evt-*` strings into Mongoose's default ObjectId `_id` field.
- Email/password signup and login, scrypt password hashes, signed HttpOnly SameSite=Lax session cookies, logout, and current-user endpoint.
- Publishing is restricted to authenticated organizer accounts. The server uses the account's name as the organizer name rather than trusting a submitted display name.
- Organizer role is self-selected and not independently verified. Authentication is an MVP implementation, not a substitute for production security review.
- MongoDB models for events, registrations, and users. MongoDB must be configured in `.env` for durable data; without it the app clearly reports demo/in-memory mode and data resets when the backend restarts.
- Event validation for dates, times, capacity, URLs, and paired coordinate fields. Image URLs are restricted to HTTP/HTTPS.
- Case-insensitive combined search/filtering; search includes category, interests, city, locality, and venue.
- Recommendation scoring remains transparent, excludes past events, and includes only true explanation reasons.
- Registration duplicate checks use browser-local participant IDs for the guest prototype; these IDs are not authenticated identities.
- Participant-level registration records are not exposed through a public API route; public insights contain aggregate counts only.

## Verification
- `npm test`: all 6 backend tests passed in this environment, including signup/login, duplicate accounts, role-based publishing, event validation/creation, filtering, registration duplicates/capacity, and hidden participant records.
- Frontend source syntax: `App.jsx`, `main.jsx`, and API client transpile without syntax errors using the available TypeScript JSX transpiler.
- `node -c` checks passed for backend JavaScript.
- Production Vite build could not be run because frontend dependencies in this environment were incomplete and installing them timed out. On the target laptop, run `npm install`, `npm install --prefix client`, then `npm run build --prefix client`.
- Live MongoDB persistence has not been verified because no MongoDB URI/service was available. Configure `MONGO_URI`, restart, publish an event, restart again, and verify it remains.

## Remaining production hardening
- Add rate limiting, email verification, password reset, session revocation/rotation, and independently verified organizer onboarding.
- Use MongoDB and a strong unique `SESSION_SECRET` for durable deployed environments.
- Add full browser/E2E testing and accessibility review before production use.
