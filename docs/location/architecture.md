# Location system architecture

Stack: React + Vite client, Express + Mongoose server, MongoDB (in-memory fallback when `MONGO_URI` is empty).

## Data model
One collection `geo_locations`, discriminated by `type`:
`country → state → district → city → locality`, plus `postal_code` linked to a locality/district.

Every record has: `id`, `type`, `name`, `altNames`, `parentId`, `code`, `active`, `createdAt`, `updatedAt`, plus `editedByAdmin`, `hash` and a GeoJSON `geo` (never returned by the API).
IDs: state `IN-KA`, district `d-<code>-<slug>`, city `c-<slug>-<suffix>`, locality `l-<hash>`, pin `pin-XXXXXX`.
Indexes: `(type, parentId, name)`, `(type, active)`, text/prefix search on name, `pincode`, and 2dsphere on `geo`. Users gain `homeLocation` (IDs only).

## Server (`server/location/`)
- `geoData.js` – 28 states + 8 UTs (ISO codes).
- `geoImport.js` – CSV parser, importer, reports.
- `geoStore.js` – Mongo / in-memory adapter.
- `geoRoutes.js` – APIs, validation, admin, audit logging.

Admin-edited records are preserved on re-import. Imports are idempotent via content hashes.
**No multi-document transactions**: standalone MongoDB does not support them, so imports use batched idempotent upserts, an in-process import lock and an import ledger.

## Client (`client/src/components/location/`)
`SearchableSelect` (debounced backend search, mobile bottom sheet), `LocationSelector` (cascade, PIN lookup, opt-in GPS), `LocationPicker` (modal; discovery location in localStorage, home location via API), `LocationAdmin` (Admin Portal → Locations tab).
Only the needed level is fetched; the full dataset is never loaded in the browser.

## Privacy
GPS is opt-in. `POST /detect` stores nothing, returns approximate admin areas only, `Cache-Control: no-store`. Precise coordinates are never saved. Home location and discovery location are separate.
