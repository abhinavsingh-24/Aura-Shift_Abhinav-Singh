# API reference (`/api/locations`)

List endpoints accept `page`, `limit`, `q` and return `{ data, pagination: { page, limit, total, totalPages } }`.

| Method | Path | Notes |
|---|---|---|
| GET | `/countries` | |
| GET | `/states` | 36 states/UTs |
| GET | `/states/:stateId/districts` | |
| GET | `/districts/:districtId/cities` | |
| GET | `/districts/:districtId/localities` | fallback when no city |
| GET | `/cities/:cityId/localities` | |
| GET | `/search?q=&type=` | min 2 chars |
| GET | `/postal-codes/:pincode` | 6 digits, returns state/district/localities |
| POST | `/validate` | body of IDs; `{valid, errors, resolved}`, 422 if invalid |
| POST | `/detect` | `{latitude, longitude}` → approximate area; nothing stored |
| PUT | `/preferences` | auth; `{homeLocation: {...ids}}` or `null` |
| POST | `/import` | **admin**; import dataset |
| GET | `/admin/records`, `/admin/imports`, `/admin/duplicates`, `/admin/audit` | **admin** |
| PATCH | `/admin/records/:id` | **admin**; rename / activate / deactivate (cascades) |

Errors: 400 validation, 401 unauthenticated, 403 non-admin, 404 not found, 422 invalid combination.
