# Import guide

## Automatic
On server start, if `geo_locations` is empty, the bundled dataset is imported. Disable with `LOCATION_AUTO_IMPORT=false`.

## Admin UI
Admin Portal → Locations → Import. Choose the bundled dataset or upload a CSV (India Post pincode format), optionally tick **Dry run**.

## API
`POST /api/locations/import` (admin token) with `{ "dryRun": true }` or `{ "csv": "...", "datasetVersion": "..." }`.

## Behaviour
- Idempotent: unchanged rows are skipped via hash; re-running creates no duplicates.
- Records edited by admins are never overwritten.
- Each import is logged in the ledger (source, version, dates, status) and audit log (`LOCATION_IMPORT`).
- The report contains `summary`, `validation`, `duplicates`, `missingRelationships`, `coverageNote`.
- Only one import runs at a time (in-process lock).

To update data later, replace `data/location/pincode.csv` (or upload a new CSV); no code changes needed.
