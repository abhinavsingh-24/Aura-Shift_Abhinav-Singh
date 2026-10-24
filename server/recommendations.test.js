const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeInterests, rankEvents, scoreEvent, WEIGHTS } = require('./recommendations');

function dateOffset(days, hour = 18) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function event(overrides = {}) {
  return {
    id: 'evt-test',
    title: 'Community Music Night',
    description: 'Live music and community',
    category: 'Music',
    interests: ['Music', 'Community activities'],
    date: dateOffset(3),
    startTime: '18:00',
    city: 'Bengaluru',
    locality: 'Koramangala',
    ...overrides,
  };
}

test('normalizeInterests trims, lowercases and deduplicates values', () => {
  assert.deepEqual(normalizeInterests([' Music ', 'music', 'TECH', '']), ['music', 'tech']);
});

test('scoreEvent gives reasons only for actual matches', () => {
  const result = scoreEvent(event(), {
    interests: ['music'],
    city: 'Bengaluru',
    locality: 'Koramangala',
    category: 'Music',
  });
  assert.equal(result.score, WEIGHTS.interest + WEIGHTS.locality + WEIGHTS.soon + WEIGHTS.category);
  assert.equal(result.reasons.length, 4);
  assert.ok(result.reasons.some((reason) => reason.includes('interest in music')));
});

test('scoreEvent ignores case for locality and category matches', () => {
  const result = scoreEvent(event(), { city: 'bengaluru', locality: 'koramangala', category: 'music' });
  assert.ok(result.reasons.includes('In your selected locality.'));
  assert.ok(result.reasons.some((reason) => reason.includes('preferred category')));
});

test('rankEvents excludes past events and sorts higher scores first', () => {
  const past = event({ id: 'past', date: dateOffset(-3) });
  const lowerMatch = event({ id: 'lower', interests: [], category: 'Sports', city: 'Other', locality: 'Other', date: dateOffset(5) });
  const higherMatch = event({ id: 'higher', date: dateOffset(2) });
  const ranked = rankEvents([past, lowerMatch, higherMatch], { interests: ['music'], city: 'Bengaluru', locality: 'Koramangala', category: 'Music' });
  assert.deepEqual(ranked.map((item) => item.id), ['higher', 'lower']);
});

 test('recommendation scoring returns no eligibility for past events', () => {
  const result = scoreEvent(event({ date: dateOffset(-1) }), { interests: ['music'] });
  assert.equal(result.score, -Infinity);
  assert.deepEqual(result.reasons, []);
});
