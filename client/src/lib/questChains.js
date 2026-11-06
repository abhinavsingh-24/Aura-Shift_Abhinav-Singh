export function normalizeChainName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ');
}

export function createQuestChain(name, now = new Date()) {
  const title = normalizeChainName(name);
  if (title.length < 2 || title.length > 60) return null;
  return {
    id: `chain-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    createdAt: now.toISOString(),
    stops: [],
  };
}

export function addEventToChain(chain, event) {
  if (!chain || !event || event.id === undefined || event.id === null) return chain;
  const eventId = String(event.id);
  if ((chain.stops || []).some((stop) => String(stop.eventId) === eventId)) return chain;
  const stop = {
    eventId,
    title: event.title || 'Untitled quest',
    category: event.category || 'Community quest',
    date: event.date || '',
    startTime: event.startTime || '',
    city: event.city || '',
    locality: event.locality || '',
    venue: event.venue || '',
    latitude: event.latitude ?? null,
    longitude: event.longitude ?? null,
  };
  return { ...chain, stops: [...(chain.stops || []), stop] };
}

export function moveChainStop(stops, fromIndex, direction) {
  if (!Array.isArray(stops)) return [];
  const toIndex = fromIndex + direction;
  if (fromIndex < 0 || fromIndex >= stops.length || toIndex < 0 || toIndex >= stops.length) return stops;
  const next = [...stops];
  [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
  return next;
}

export function removeChainStop(stops, eventId) {
  return (Array.isArray(stops) ? stops : []).filter((stop) => String(stop.eventId) !== String(eventId));
}

function hasValidCoordinates(point) {
  return Boolean(point && point.latitude !== null && point.latitude !== undefined && point.longitude !== null && point.longitude !== undefined && Number.isFinite(Number(point.latitude)) && Number.isFinite(Number(point.longitude)) && Math.abs(Number(point.latitude)) <= 90 && Math.abs(Number(point.longitude)) <= 180);
}

function getDistanceKm(origin, event) {
  if (!hasValidCoordinates(origin) || !hasValidCoordinates(event)) return null;
  const lat = Number(event.latitude);
  const lon = Number(event.longitude);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const radians = (value) => value * Math.PI / 180;
  const dLat = radians(lat - origin.latitude);
  const dLon = radians(lon - origin.longitude);
  const lat1 = radians(origin.latitude);
  const lat2 = radians(lat);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

/** Optimize a chain as an open route using a nearest-neighbour heuristic.
 * It keeps the shorter of the current order and the suggested order. Distances
 * are straight-line estimates, not road-routing distances. */
export function optimizeChainRoute(stops = [], origin = null) {
  const source = Array.isArray(stops) ? stops : [];
  const missingCoordinates = source.filter((stop) => !hasValidCoordinates(stop)).length;
  if (source.length < 2) return { stops: [...source], totalDistanceKm: 0, legs: [], missingCoordinates, optimized: false, improved: false };

  const hasOrigin = hasValidCoordinates(origin);
  const located = source.filter(hasValidCoordinates);
  const unlocated = source.filter((stop) => !hasValidCoordinates(stop));
  if (located.length < 2) return { stops: [...source], totalDistanceKm: 0, legs: [], missingCoordinates, optimized: false, improved: false };

  const measure = (ordered) => {
    let cursor = hasOrigin ? { latitude: Number(origin.latitude), longitude: Number(origin.longitude), title: 'Your location' } : ordered[0];
    const path = hasOrigin ? ordered : ordered.slice(1);
    let total = 0;
    const legs = [];
    path.forEach((next) => {
      const distance = getDistanceKm(cursor, next);
      if (distance !== null) {
        total += distance;
        legs.push({ from: cursor.title || cursor.venue || 'Start', to: next.title || next.venue || 'Next stop', distanceKm: distance });
      }
      cursor = next;
    });
    return { total, legs };
  };

  const remaining = [...located];
  const suggested = [];
  let cursor;
  if (hasOrigin) cursor = { latitude: Number(origin.latitude), longitude: Number(origin.longitude), title: 'Your location' };
  else { cursor = remaining.shift(); suggested.push(cursor); }

  while (remaining.length) {
    let bestIndex = 0;
    let bestDistance = Infinity;
    remaining.forEach((candidate, index) => {
      const distance = getDistanceKm(cursor, candidate);
      if (distance !== null && distance < bestDistance) { bestDistance = distance; bestIndex = index; }
    });
    const [next] = remaining.splice(bestIndex, 1);
    suggested.push(next);
    cursor = next;
  }

  const originalMetrics = measure(located);
  const suggestedMetrics = measure(suggested);
  const improved = suggestedMetrics.total + 0.01 < originalMetrics.total;
  const chosen = improved ? suggested : located;
  const chosenMetrics = improved ? suggestedMetrics : originalMetrics;
  return {
    stops: [...chosen, ...unlocated],
    totalDistanceKm: Number(chosenMetrics.total.toFixed(2)),
    legs: chosenMetrics.legs,
    missingCoordinates,
    optimized: true,
    improved,
  };
}

/** Return selectable upcoming quests near the explorer, or in their chosen locality
 * when browser location permission has not been granted. */
export function findNearbyChainQuests(events = [], options = {}) {
  const { userCoordinates = null, city = '', locality = '', radiusKm = 25, search = '', excludedIds = [], now = new Date() } = options;
  const excluded = new Set(excludedIds.map(String));
  const query = String(search).trim().toLowerCase();
  const radius = radiusKm === 'any' ? Infinity : Math.max(0, Number(radiusKm) || 25);
  return (Array.isArray(events) ? events : []).filter((event) => {
    if (!event || event.id === undefined || event.id === null || excluded.has(String(event.id))) return false;
    if (event.status && ['cancelled', 'deleted', 'draft'].includes(String(event.status).toLowerCase())) return false;
    if (event.date) {
      const dateText = String(event.date).slice(0, 10);
      const timeText = /^\d{1,2}:\d{2}/.test(String(event.startTime || '')) ? String(event.startTime).slice(0, 5) : '23:59';
      const eventDate = new Date(`${dateText}T${timeText}:00`);
      if (!Number.isNaN(eventDate.getTime()) && eventDate < now) return false;
    }
    if (query && ![event.title, event.category, event.city, event.locality, event.venue].some((value) => String(value || '').toLowerCase().includes(query))) return false;
    if (userCoordinates) {
      const distance = getDistanceKm(userCoordinates, event);
      if (distance !== null) return distance <= radius;
      // Some imported listings do not have coordinates; retain same-locality matches.
      const cityMatches = !city || city === 'all' || String(event.city || '').toLowerCase() === String(city).toLowerCase();
      const localityMatches = !locality || locality === 'all' || String(event.locality || '').toLowerCase().includes(String(locality).toLowerCase());
      return cityMatches && localityMatches;
    }
    const cityMatches = !city || city === 'all' || String(event.city || '').toLowerCase() === String(city).toLowerCase();
    const localityMatches = !locality || locality === 'all' || String(event.locality || '').toLowerCase().includes(String(locality).toLowerCase());
    return cityMatches && localityMatches;
  }).map((event) => ({ ...event, distanceKm: getDistanceKm(userCoordinates, event) }))
    .sort((a, b) => {
      if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
      if (a.distanceKm !== null) return -1;
      if (b.distanceKm !== null) return 1;
      return String(a.date || '').localeCompare(String(b.date || ''));
    });
}

export function estimateChainSummary(chain) {
  const stops = chain?.stops || [];
  const cities = [...new Set(stops.map((stop) => stop.city).filter(Boolean))];
  const dates = [...new Set(stops.map((stop) => stop.date).filter(Boolean))];
  return { stopCount: stops.length, cities, dates, multiCity: cities.length > 1, multiDate: dates.length > 1 };
}
