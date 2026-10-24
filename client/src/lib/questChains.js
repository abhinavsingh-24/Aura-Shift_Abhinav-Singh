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

export function estimateChainSummary(chain) {
  const stops = chain?.stops || [];
  const cities = [...new Set(stops.map((stop) => stop.city).filter(Boolean))];
  const dates = [...new Set(stops.map((stop) => stop.date).filter(Boolean))];
  return { stopCount: stops.length, cities, dates, multiCity: cities.length > 1, multiDate: dates.length > 1 };
}
