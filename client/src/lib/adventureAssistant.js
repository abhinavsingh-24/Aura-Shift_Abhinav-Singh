const STOP_WORDS = new Set(['a','an','the','and','or','for','with','near','in','on','at','to','me','my','we','i','want','would','like','please','find','show','suggest','help','plan','something','some','events','event','quest','quests','this','weekend','today','next','days','within','under','around','city']);

function textOf(event) {
  return [event.title, event.description, event.category, event.interests, event.city, event.locality, event.venue].filter(Boolean).join(' ').toLowerCase();
}

export function answerAdventureQuestion(message, events, { interests = [], city = '', savedIds = [], now = new Date() } = {}) {
  const prompt = String(message || '').trim();
  if (!prompt) return { text: 'Tell me what kind of outing you have in mind, and I’ll look through the quests currently listed in SIDEQUEST.', events: [], mode: 'guide' };
  const lower = prompt.toLowerCase();
  const tokens = lower.split(/[^\p{L}\p{N}]+/u).filter((token) => token.length > 2 && !STOP_WORDS.has(token));
  const isBudget = /cheap|budget|free|low.cost|affordable|under\s*₹?\s*\d+/i.test(prompt);
  const isWeekend = /weekend|saturday|sunday/i.test(prompt);
  const isToday = /\btoday\b|tonight/i.test(prompt);
  const candidates = (Array.isArray(events) ? events : []).filter((event) => {
    if (event.date && new Date(`${event.date}T${event.startTime || '23:59'}:00`) < now) return false;
    if (city && !/any city|anywhere/i.test(city) && !lower.includes('any city') && String(event.city || '').toLowerCase() !== city.toLowerCase() && /\b(in|near|around)\s+[a-z]/i.test(prompt)) {
      const explicit = String(event.city || '').toLowerCase();
      const cityMention = lower.includes(explicit);
      if (!cityMention && /\b(in|near|around)\s+[a-z]/i.test(prompt)) return false;
    }
    if (isToday && event.date && new Date(`${event.date}T00:00:00`).toDateString() !== now.toDateString()) return false;
    if (isWeekend && event.date) {
      const day = new Date(`${event.date}T00:00:00`).getDay();
      if (day !== 0 && day !== 6) return false;
    }
    return true;
  });
  const ranked = candidates.map((event) => {
    const searchable = textOf(event);
    const keywordScore = tokens.reduce((score, token) => score + (searchable.includes(token) ? 3 : 0), 0);
    const interestScore = interests.reduce((score, interest) => score + (searchable.includes(String(interest).toLowerCase()) ? 2 : 0), 0);
    const cityScore = city && String(event.city || '').toLowerCase() === city.toLowerCase() ? 2 : 0;
    const savedPenalty = savedIds.some((id) => String(id) === String(event.id)) ? 1 : 0;
    const costScore = isBudget && /free|no cost|₹\s?0|complimentary/i.test(searchable) ? 4 : 0;
    return { event, score: keywordScore + interestScore + cityScore + costScore - savedPenalty };
  }).sort((a, b) => b.score - a.score || String(a.event.date || '').localeCompare(String(b.event.date || ''))).slice(0, 3);

  if (!ranked.length) return { text: 'I couldn’t find upcoming quests that fit that request in the current event list. Try a broader timeframe, another category, or ask me to explore all available events.', events: [], mode: 'no-results' };
  const top = ranked[0];
  const why = top.score > 0 ? 'It best matches the keywords and interests in your request.' : 'I found an upcoming option, but the event details don’t provide enough information to claim a strong match.';
  const list = ranked.map(({ event }, index) => `${index + 1}. ${event.title}${event.category ? ` (${event.category})` : ''} — ${event.date || 'date not listed'}${event.city ? `, ${event.city}` : ''}`).join('\n');
  const suffix = ranked.length > 1 ? `\n\nOther options:\n${list}` : `\n\n${list}`;
  const caution = isBudget ? '\n\nBudget note: SIDEQUEST’s event list may not include ticket prices, so confirm costs with the organizer.' : '';
  return { text: `My best starting point is ${top.event.title}. ${why}${suffix}${caution}`, events: ranked.map(({ event }) => event), mode: 'recommendations' };
}
