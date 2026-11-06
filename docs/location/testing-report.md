# Testing report

Command: `npm test` → **71 pass, 0 fail** (62 existing + 9 location). `npm run build` passes; lint shows warnings only.

## Automated (`server/location.test.js`)
All 28 states and 8 UTs present; state→district→city→locality relationships; postal-code lookup; invalid combinations rejected (422); duplicate/repeat import is idempotent; non-admin and anonymous import rejected; search; empty-database behaviour.

## Manual / live
Against MongoDB: 36 states, locality search ("koramangala"), `postal-codes/560034`, and `/detect` for (12.93, 77.62) → Karnataka → Bengaluru Urban → Bengaluru.

## Not automated (unverified)
- GPS permission denial: handled in code (manual entry stays available) but not tested.
- Mobile responsive layout: CSS breakpoint at 640px; not tested on devices.
- Search performance: no benchmark; relies on indexes.
- Browser UI cascade was not fully exercised end-to-end.

## Other fix
Self-registration with `role: 'admin'` is now refused in production (unless `ALLOW_ADMIN_SELF_REGISTRATION=true`).
