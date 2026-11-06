export function rankSmartRecommendations(events, { interests = [], savedIds = [], now = new Date(), city = '', locality = '', userCoordinates = null } = {}) {
  const wanted = new Set(interests.map((item) => String(item).toLowerCase()));
  const interestLabels = new Map(interests.map((item) => [String(item).toLowerCase(), String(item)]));

  return (Array.isArray(events) ? events : []).map((event) => {
    const category = String(event.category || '').toLowerCase();
    const eventInterests = Array.isArray(event.interests)
      ? event.interests.map((item) => String(item).toLowerCase())
      : String(event.interests || '').split(',').map((item) => item.trim().toLowerCase());
    const matches = [...wanted].filter((item) => item && (item === category || eventInterests.includes(item)));

    let eventTime = null;
    if (event.date) {
      try {
        const d = new Date(`${event.date}T${event.startTime || '23:59'}:00`);
        if (!isNaN(d.getTime())) eventTime = d;
      } catch {
        eventTime = null;
      }
    }
    const days = eventTime ? Math.ceil((eventTime.getTime() - now.getTime()) / 86400000) : 365;
    const isSaved = savedIds.some((id) => String(id) === String(event.id));
    const cityMatch = city && city !== 'all' && String(event.city || '').toLowerCase() === city.toLowerCase();
    const localityMatch = locality && locality !== 'all' && String(event.locality || '').toLowerCase() === locality.toLowerCase();

    let distanceKm = null;
    if (userCoordinates && Number.isFinite(Number(event.latitude)) && Number.isFinite(Number(event.longitude))) {
      const radians = (deg) => (deg * Math.PI) / 180;
      const dLat = radians(Number(event.latitude) - userCoordinates.latitude);
      const dLon = radians(Number(event.longitude) - userCoordinates.longitude);
      const lat1 = radians(userCoordinates.latitude);
      const lat2 = radians(Number(event.latitude));
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
      distanceKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
    }

    const score =
      matches.length * 5 +
      (cityMatch ? 3 : 0) +
      (localityMatch ? 2 : 0) +
      (days >= 0 && days <= 7 ? 2 : 0) +
      (distanceKm !== null && distanceKm < 15 ? 2 : 0) +
      (isSaved ? -2 : 0);

    const reasons = [];
    if (matches.length) reasons.push(`Matches ${matches.map((item) => interestLabels.get(item) || item).join(', ')}`);
    else reasons.push('A chance to explore something new');
    if (localityMatch) reasons.push(`In your locality (${event.locality})`);
    else if (cityMatch) reasons.push(`In ${event.city}`);
    if (days >= 0 && days <= 2) reasons.push('Happening this week');
    else if (days >= 0 && days <= 7) reasons.push('Coming up soon');
    if (distanceKm !== null && distanceKm < 20) reasons.push(`~${distanceKm.toFixed(1)} km from your location`);

    return {
      ...event,
      distanceKm,
      recommendationScore: score,
      recommendationReasons: reasons,
    };
  })
  .filter((event) => {
    if (!event.date) return true;
    try {
      return new Date(`${event.date}T${event.startTime || '23:59'}:00`) >= now;
    } catch {
      return true;
    }
  })
  .sort((a, b) => b.recommendationScore - a.recommendationScore);
}
