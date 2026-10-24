const WEIGHTS = {
  interest: 40,
  locality: 30,
  soon: 20,
  category: 10,
};

function normalizeList(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeInterests(value) {
  const values = Array.isArray(value) ? value : normalizeList(value);
  return [...new Set(values.map((item) => String(item).trim().toLowerCase()).filter(Boolean))];
}

function getEventDate(event) {
  if (!event || !event.date) return null;
  const time = event.startTime || '09:00';
  return new Date(`${event.date}T${time}:00`);
}

function scoreEvent(event, options = {}) {
  if (!event) {
    return { score: 0, reasons: [], matchingInterest: '' };
  }

  const selectedInterests = normalizeInterests(options.interests || options.selectedInterests || []);
  const selectedCategory = options.category ? String(options.category).trim() : '';
  const selectedCity = options.city ? String(options.city).trim() : '';
  const selectedLocality = options.locality ? String(options.locality).trim() : '';

  const eventDate = getEventDate(event);
  const now = new Date();
  const isEligible = eventDate && eventDate > now;

  if (!isEligible) {
    return { score: -Infinity, reasons: [], matchingInterest: '' };
  }

  let score = 0;
  const reasons = [];
  let matchingInterest = '';

  const eventInterests = normalizeInterests(event.interests || []);
  const interestMatch = selectedInterests.find((interest) => eventInterests.includes(interest));
  if (interestMatch) {
    score += WEIGHTS.interest;
    matchingInterest = interestMatch;
    reasons.push(`Matches your interest in ${interestMatch}.`);
  }

  const sameLocality = selectedCity && selectedLocality &&
    String(event.city || '').toLowerCase() === selectedCity.toLowerCase() &&
    String(event.locality || '').toLowerCase() === selectedLocality.toLowerCase();
  if (sameLocality) {
    score += WEIGHTS.locality;
    reasons.push('In your selected locality.');
  }

  const daysUntilEvent = Math.ceil((eventDate - now) / (1000 * 60 * 60 * 24));
  if (daysUntilEvent <= 7) {
    score += WEIGHTS.soon;
    reasons.push('Happening in the next 7 days.');
  }

  if (selectedCategory && String(event.category || '').toLowerCase() === selectedCategory.toLowerCase()) {
    score += WEIGHTS.category;
    reasons.push(`Matches your preferred category: ${selectedCategory}.`);
  }

  return { score, reasons, matchingInterest };
}

function rankEvents(events, options = {}) {
  const upcoming = Array.isArray(events)
    ? events.filter((event) => {
        const eventDate = getEventDate(event);
        return eventDate && eventDate > new Date();
      })
    : [];

  return upcoming
    .map((event) => {
      const result = scoreEvent(event, options);
      return {
        ...event,
        recommendationScore: result.score,
        recommendationReasons: result.reasons,
        matchingInterest: result.matchingInterest,
      };
    })
    .sort((a, b) => {
      const scoreDifference = (b.recommendationScore || 0) - (a.recommendationScore || 0);
      if (scoreDifference !== 0) return scoreDifference;
      const eventA = getEventDate(a);
      const eventB = getEventDate(b);
      return (eventA || 0) - (eventB || 0);
    });
}

module.exports = {
  WEIGHTS,
  normalizeInterests,
  normalizeList,
  rankEvents,
  scoreEvent,
  getEventDate,
};
