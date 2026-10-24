export function rankSmartRecommendations(events, { interests = [], savedIds = [], now = new Date(), city = '' } = {}) {
  const wanted = new Set(interests.map((item) => String(item).toLowerCase()));
  const interestLabels = new Map(interests.map((item) => [String(item).toLowerCase(), String(item)]));
  return (Array.isArray(events) ? events : []).map((event) => {
    const category = String(event.category || '').toLowerCase();
    const eventInterests = Array.isArray(event.interests) ? event.interests.map((item) => String(item).toLowerCase()) : String(event.interests || '').split(',').map((item) => item.trim().toLowerCase());
    const matches = [...wanted].filter((item) => item && (item === category || eventInterests.includes(item)));
    const days = event.date ? Math.ceil((new Date(`${event.date}T${event.startTime || '23:59'}:00`).getTime() - now.getTime()) / 86400000) : 365;
    const isSaved = savedIds.some((id) => String(id) === String(event.id));
    const cityMatch = city && city !== 'all' && String(event.city || '').toLowerCase() === city.toLowerCase();
    const score = matches.length * 5 + (cityMatch ? 2 : 0) + (days >= 0 && days <= 7 ? 2 : 0) + (isSaved ? -2 : 0);
    return { ...event, recommendationScore: score, recommendationReasons: [matches.length ? `Matches ${matches.map((item) => interestLabels.get(item) || item).join(', ')}` : 'A chance to explore something new', cityMatch ? 'In your selected city' : null, days >= 0 && days <= 7 ? 'Coming up soon' : null].filter(Boolean) };
  }).filter((event) => !event.date || new Date(`${event.date}T${event.startTime || '23:59'}:00`) >= now).sort((a, b) => b.recommendationScore - a.recommendationScore);
}
