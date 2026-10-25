const DAY_MS = 24 * 60 * 60 * 1000;

function parseEventDate(event) {
  if (!event?.date) return null;
  if (event.date instanceof Date) {
    return Number.isNaN(event.date.getTime()) ? null : event.date;
  }
  const dateStr = String(event.date).trim();
  if (Number.isNaN(Date.parse(dateStr))) return null;
  const timeStr = event.startTime && /^\d{1,2}:\d{2}/.test(String(event.startTime).trim())
    ? String(event.startTime).trim()
    : '23:59';
  const value = new Date(`${dateStr}T${timeStr}:00`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function distanceKm(from, event) {
  if (!from || event?.latitude === undefined || event?.latitude === null || event?.longitude === undefined || event?.longitude === null) return null;
  const lat = Number(event.latitude);
  const lon = Number(event.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const radians = (degrees) => degrees * Math.PI / 180;
  const dLat = radians(lat - from.latitude);
  const dLon = radians(lon - from.longitude);
  const lat1 = radians(from.latitude);
  const lat2 = radians(lat);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

function isInTimeframe(event, timeframe, now) {
  const date = parseEventDate(event);
  if (!date) return timeframe === 'any';
  if (date.getTime() < now.getTime()) return false;
  const today = startOfDay(now);
  const tomorrow = new Date(today.getTime() + DAY_MS);
  if (timeframe === 'today') return date >= today && date < tomorrow;
  if (timeframe === 'next7days') return date < new Date(today.getTime() + 7 * DAY_MS);
  if (timeframe === 'weekend') {
    const day = today.getDay();
    const weekendStart = day === 0 ? today : new Date(today.getTime() + ((6 - day + 7) % 7) * DAY_MS);
    const weekendEnd = new Date(weekendStart.getTime() + (day === 0 ? DAY_MS : 2 * DAY_MS));
    return date >= weekendStart && date < weekendEnd && (date.getDay() === 0 || date.getDay() === 6);
  }
  return true;
}

function interestMatch(event, interests = []) {
  const eventCategories = [event?.category, ...(Array.isArray(event?.interests) ? event.interests : String(event?.interests || '').split(','))]
    .map((item) => String(item || '').trim().toLowerCase()).filter(Boolean);
  return interests.find((interest) => eventCategories.includes(String(interest).trim().toLowerCase())) || '';
}

export function rankRadarQuests(events = [], filters = {}) {
  const now = filters.now instanceof Date ? filters.now : new Date();
  const interests = Array.isArray(filters.interests) ? filters.interests : [];
  const coordinates = filters.userCoordinates;
  const radius = filters.radiusKm === 'any' || filters.radiusKm === undefined ? null : Number(filters.radiusKm);
  const results = (Array.isArray(events) ? events : []).filter((event) => {
    if (!isInTimeframe(event, filters.timeframe || 'any', now)) return false;
    if (filters.category && filters.category !== 'all') {
      const evCat = String(event.category || '').toLowerCase();
      const filterCat = String(filters.category).toLowerCase();
      if (evCat !== filterCat && !evCat.includes(filterCat) && !filterCat.includes(evCat)) {
        return false;
      }
    }
    if (filters.city && filters.city !== 'all' && event.city !== filters.city) return false;
    if (filters.locality && filters.locality !== 'all' && event.locality !== filters.locality) return false;
    if (coordinates && Number.isFinite(radius)) {
      const distance = distanceKm(coordinates, event);
      if (distance === null || distance > radius) return false;
    }
    return true;
  }).map((event) => {
    const match = interestMatch(event, interests);
    const distance = distanceKm(coordinates, event);
    const date = parseEventDate(event);
    const hoursUntil = date ? Math.max(0, (date.getTime() - now.getTime()) / (60 * 60 * 1000)) : Infinity;
    const reasons = [];
    if (match) reasons.push(`Matches your ${match} interest`);
    if (distance !== null) reasons.push(`${distance.toFixed(1)} km away`);
    if (hoursUntil < 24) reasons.push('Happening within 24 hours');
    else if (hoursUntil < 24 * 7) reasons.push('Coming up this week');
    if (!reasons.length) reasons.push('A chance to explore something new');
    const recencyScore = Number.isFinite(hoursUntil) ? Math.max(0, 20 - hoursUntil / 24) : 0;
    const score = (match ? 100 : 0) + recencyScore + (distance !== null ? Math.max(0, 15 - distance / 5) : 0);
    return {
      ...event,
      event,
      score,
      distanceKm: distance,
      date: event.date,
      parsedDate: date,
      reasons,
      matchLabel: match ? 'Interest match' : '',
    };
  });

  if (filters.sort === 'soonest') results.sort((a, b) => (a.parsedDate?.getTime() ?? Infinity) - (b.parsedDate?.getTime() ?? Infinity));
  else if (filters.sort === 'nearest' && coordinates) results.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  else results.sort((a, b) => b.score - a.score || (a.parsedDate?.getTime() ?? Infinity) - (b.parsedDate?.getTime() ?? Infinity));
  return results;
}

export { distanceKm, isInTimeframe };
