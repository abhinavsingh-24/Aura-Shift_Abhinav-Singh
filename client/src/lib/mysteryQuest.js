/** Pick a quest for the Mystery Quest reveal. Pure helper for deterministic testing. */
export function getMysteryQuest(events = [], options = {}) {
  const now = options.now instanceof Date ? options.now.getTime() : new Date(options.now ?? Date.now()).getTime();
  const interests = (Array.isArray(options.interests) ? options.interests : []).map((item) => String(item).trim().toLowerCase());
  const timeframe = options.timeframe || 'any';
  const city = options.city && options.city !== 'all' ? String(options.city).toLowerCase() : '';
  const category = options.category && options.category !== 'all' ? String(options.category).toLowerCase() : '';
  const future = (Array.isArray(events) ? events : []).filter((event) => {
    if (!event || event.id === undefined || !event.title || !event.date) return false;
    const start = new Date(`${event.date}T${event.startTime || '23:59'}:00`).getTime();
    if (!Number.isFinite(start) || start <= now) return false;
    if (timeframe !== 'any') {
      const today = new Date(now); today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      if (timeframe === 'today' && !(start >= today.getTime() && start < tomorrow.getTime())) return false;
      if (timeframe === 'next7days' && start >= today.getTime() + 7 * 24 * 60 * 60 * 1000) return false;
      if (timeframe === 'weekend') {
        const day = today.getDay();
        const weekendStart = day === 0 ? today : new Date(today.getTime() + ((6 - day + 7) % 7) * 24 * 60 * 60 * 1000);
        const weekendEnd = new Date(weekendStart.getTime() + (day === 0 ? 24 : 48) * 60 * 60 * 1000);
        const startDate = new Date(start);
        if (!(start >= weekendStart.getTime() && start < weekendEnd.getTime() && [0, 6].includes(startDate.getDay()))) return false;
      }
    }
    if (city && String(event.city || '').toLowerCase() !== city) return false;
    if (category && String(event.category || '').toLowerCase() !== category) return false;
    return true;
  }).map((event) => {
    const eventInterests = [event.category, ...(Array.isArray(event.interests) ? event.interests : String(event.interests || '').split(','))]
      .map((value) => String(value || '').trim().toLowerCase()).filter(Boolean);
    const matches = interests.filter((interest) => interest && eventInterests.includes(interest));
    return { event, start: new Date(`${event.date}T${event.startTime || '23:59'}:00`).getTime(), matches };
  });
  if (!future.length) return null;
  // Randomize the candidates first to avoid always favoring the same event on ties.
  for (let i = future.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [future[i], future[j]] = [future[j], future[i]];
  }
  future.sort((a, b) => b.matches.length - a.matches.length || a.start - b.start);
  const best = future[0];
  const reasons = [];
  if (best.matches.length) reasons.push(`Matches your ${best.matches.slice(0, 2).join(' and ')} interest${best.matches.length > 1 ? 's' : ''}`);
  if (best.start - now < 24 * 60 * 60 * 1000) reasons.push('Happening within the next 24 hours');
  else if (best.start - now < 7 * 24 * 60 * 60 * 1000) reasons.push('Coming up this week');
  if (!reasons.length) reasons.push('A wildcard pick to discover something new');
  return { event: best.event, reasons, matchingInterests: best.matches, candidatesCount: future.length };
}
