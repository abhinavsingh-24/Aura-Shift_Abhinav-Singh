const EARTH_RADIUS_KM = 6371;
const DEFAULT_RADIUS_KM = 10;
const MAX_RADIUS_KM = 100;
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;
const SORTS = new Set(['nearest', 'soonest', 'newest']);

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

// Great-circle distance in km between two { latitude, longitude } points.
function haversineKm(from, to) {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

// Returns { latitude, longitude } only when the event has finite, in-range coordinates.
function getEventCoordinates(event) {
  if (!event || event.latitude === undefined || event.latitude === null || event.latitude === '') return null;
  if (event.longitude === undefined || event.longitude === null || event.longitude === '') return null;
  const latitude = Number(event.latitude);
  const longitude = Number(event.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

function parseNumber(value) {
  if (typeof value !== 'string' || !value.trim()) return NaN;
  return Number(value);
}

// Validates the query string. Returns { errors, params }.
function parseNearbyQuery(query = {}) {
  const errors = [];

  const latitude = parseNumber(query.latitude);
  const longitude = parseNumber(query.longitude);
  if (query.latitude === undefined || query.longitude === undefined) {
    errors.push('latitude and longitude are required.');
  } else {
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) errors.push('latitude must be a number between -90 and 90.');
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) errors.push('longitude must be a number between -180 and 180.');
  }

  let radiusKm = DEFAULT_RADIUS_KM;
  if (query.radiusKm !== undefined) {
    radiusKm = parseNumber(query.radiusKm);
    if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > MAX_RADIUS_KM) {
      errors.push(`radiusKm must be greater than 0 and at most ${MAX_RADIUS_KM}.`);
    }
  }

  let limit = DEFAULT_LIMIT;
  if (query.limit !== undefined) {
    limit = parseNumber(query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) errors.push(`limit must be a whole number between 1 and ${MAX_LIMIT}.`);
  }

  const sort = query.sort === undefined ? 'nearest' : String(query.sort);
  if (!SORTS.has(sort)) errors.push('sort must be one of: nearest, soonest, newest.');

  const search = typeof query.search === 'string' ? query.search.trim().slice(0, 100) : '';
  const category = typeof query.category === 'string' ? query.category.trim() : 'all';

  return { errors, params: { latitude, longitude, radiusKm, limit, sort, search, category } };
}

function matchesSearch(event, searchText) {
  if (!searchText) return true;
  const needle = searchText.toLowerCase();
  const fields = [
    event.title, event.description, event.category, event.city, event.state, event.locality,
    event.venue, event.organizerName,
    ...(Array.isArray(event.tags) ? event.tags : []),
    ...(Array.isArray(event.interests) ? event.interests : []),
  ];
  return fields.some((value) => String(value || '').toLowerCase().includes(needle));
}

function matchesCategory(event, category) {
  if (!category || category.toLowerCase() === 'all') return true;
  return String(event.category || '').toLowerCase() === category.toLowerCase();
}

// Pure search over an already-eligible event list (published, upcoming).
// Returns { results, total, withoutCoordinates } where results carry distanceKm.
function findNearbyEvents(events, params, getDate = () => null) {
  const origin = { latitude: params.latitude, longitude: params.longitude };
  let withoutCoordinates = 0;
  const matches = [];

  for (const event of events) {
    if (!matchesCategory(event, params.category) || !matchesSearch(event, params.search)) continue;
    const coords = getEventCoordinates(event);
    if (!coords) { withoutCoordinates += 1; continue; }
    const distanceKm = haversineKm(origin, coords);
    if (distanceKm <= params.radiusKm) matches.push({ event, distanceKm });
  }

  const time = (event) => { const d = getDate(event); return d ? d.getTime() : Infinity; };
  const created = (event) => { const t = new Date(event.createdAt || 0).getTime(); return Number.isFinite(t) ? t : 0; };
  matches.sort((a, b) => {
    if (params.sort === 'soonest') return time(a.event) - time(b.event) || a.distanceKm - b.distanceKm;
    if (params.sort === 'newest') return created(b.event) - created(a.event) || a.distanceKm - b.distanceKm;
    return a.distanceKm - b.distanceKm;
  });

  return {
    total: matches.length,
    withoutCoordinates,
    results: matches.slice(0, params.limit).map(({ event, distanceKm }) => ({ event, distanceKm: Math.round(distanceKm * 10) / 10 })),
  };
}

module.exports = { haversineKm, getEventCoordinates, parseNearbyQuery, findNearbyEvents, MAX_RADIUS_KM, DEFAULT_RADIUS_KM };
