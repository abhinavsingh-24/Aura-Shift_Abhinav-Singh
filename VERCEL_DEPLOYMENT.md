# SIDEQUEST — Vercel deployment notes

This repository is configured for a Vercel deployment with a Vite frontend and Express API function.

## Required environment variables

Set these in Vercel Project Settings → Environment Variables for Preview and Production:

- `NODE_ENV=production`
- `MONGO_URI` — a MongoDB Atlas connection string with network access configured for the deployment.
- `SESSION_SECRET` — a cryptographically random secret of at least 32 characters. Generate locally with `node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"`. Do not commit or share it.

Production startup intentionally fails if MongoDB is missing or unreachable. This prevents users, sessions, reports, and registrations from silently falling back to ephemeral in-memory storage.

## Build and checks

- Build command: `npm run build`
- Output directory: `client/dist`
- API handler: `api/[...path].js`
- Run tests locally: `npm test`

## Important limitations

Party membership and Party Hub messages are still browser-local prototype data. The UI now requires joining a quest party before chat is unlocked, but cross-user real-time chat requires a persistent party/membership/message API and a realtime transport. Do not describe the current Party Hub as live multi-user chat.

Before production launch, verify auth/session behavior, MongoDB indexes, deployment logs, and all user flows in a Vercel Preview deployment.
