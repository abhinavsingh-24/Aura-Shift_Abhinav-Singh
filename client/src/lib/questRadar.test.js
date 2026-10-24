import test from 'node:test';
import assert from 'node:assert/strict';
import { distanceKm, isInTimeframe, rankRadarQuests } from './questRadar.js';

const now = new Date('2026-10-24T10:00:00');
const events = [
  { id: 'a', title: 'Music soon', category: 'Music', date: '2026-10-24', startTime: '18:00', city: 'Bengaluru', locality: 'Koramangala', latitude: 12.9352, longitude: 77.6245 },
  { id: 'b', title: 'Tech tomorrow', category: 'Technology', date: '2026-10-25', startTime: '15:00', city: 'Bengaluru', locality: 'Indiranagar', latitude: 12.9784, longitude: 77.6408 },
  { id: 'c', title: 'Old art event', category: 'Art and culture', date: '2026-10-20', startTime: '13:00', city: 'Bengaluru', locality: 'Jayanagar' },
  { id: 'd', title: 'Pune games', category: 'Gaming', date: '2026-10-26', startTime: '13:00', city: 'Pune', locality: 'Shivajinagar' },
];

test('Radar filters future quests by category, city and timeframe', () => {
  const result = rankRadarQuests(events, { now, timeframe: 'next7days', category: 'Music', city: 'Bengaluru' });
  assert.deepEqual(result.map((item) => item.event.id), ['a']);
});

test('Radar boosts interest matches and gives a reason for the match', () => {
  const result = rankRadarQuests(events, { now, timeframe: 'any', interests: ['Technology'] });
  assert.equal(result[0].event.id, 'b');
  assert.match(result[0].reasons.join(' '), /Technology interest/);
});

test('location radius excludes events without coordinates or outside the radius', () => {
  const result = rankRadarQuests(events, { now, timeframe: 'any', userCoordinates: { latitude: 12.9352, longitude: 77.6245 }, radiusKm: '5' });
  assert.deepEqual(result.map((item) => item.event.id), ['a', 'b'].filter((id) => id === 'a'));
  assert.ok(distanceKm({ latitude: 12.9352, longitude: 77.6245 }, events[1]) > 0);
});

test('timeframe helpers correctly identify today and weekend', () => {
  assert.equal(isInTimeframe(events[0], 'today', now), true);
  assert.equal(isInTimeframe(events[1], 'weekend', now), true);
  assert.equal(isInTimeframe(events[2], 'any', now), false);
});

test('nearest sort orders distance only when coordinates are provided', () => {
  const result = rankRadarQuests(events, { now, timeframe: 'any', userCoordinates: { latitude: 12.9784, longitude: 77.6408 }, radiusKm: 'any', sort: 'nearest' });
  assert.equal(result[0].event.id, 'b');
});

test('Sunday weekend filter does not include the following weekend', () => {
  const sundayNow = new Date('2026-10-25T10:00:00');
  const thisSunday = { id: 'sun', date: '2026-10-25', startTime: '18:00' };
  const nextSaturday = { id: 'next-sat', date: '2026-10-31', startTime: '18:00' };
  assert.equal(isInTimeframe(thisSunday, 'weekend', sundayNow), true);
  assert.equal(isInTimeframe(nextSaturday, 'weekend', sundayNow), false);
});
