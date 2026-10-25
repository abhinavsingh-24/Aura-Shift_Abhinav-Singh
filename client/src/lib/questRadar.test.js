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

test('Radar handles empty event lists and non-array inputs safely', () => {
  assert.deepEqual(rankRadarQuests([], { now }), []);
  assert.deepEqual(rankRadarQuests(null, { now }), []);
  assert.deepEqual(rankRadarQuests(undefined, { now }), []);
});

test('Radar handles missing fields and incomplete event records safely', () => {
  const brokenEvents = [
    {},
    { id: 'missing-date', title: 'No Date Quest' },
    { id: 'partial', category: null, city: undefined, date: '2026-10-25' },
  ];
  const result = rankRadarQuests(brokenEvents, { now, timeframe: 'any' });
  assert.ok(Array.isArray(result));
  assert.ok(result.length > 0);
  assert.equal(result.find((r) => r.id === 'partial').city, undefined);
});

test('Radar handles invalid dates without crashing or throwing RangeError', () => {
  const invalidDateEvents = [
    { id: 'bad-1', date: 'not-a-date', startTime: 'invalid' },
    { id: 'bad-2', date: '9999-99-99', startTime: '25:99' },
    { id: 'good', date: '2026-10-25', startTime: '10:00' },
  ];
  const result = rankRadarQuests(invalidDateEvents, { now, timeframe: 'any' });
  assert.ok(Array.isArray(result));
  const bad1 = result.find((r) => r.id === 'bad-1');
  assert.ok(bad1);
  assert.equal(bad1.parsedDate, null);
});

test('Radar handles missing, null, or out-of-range coordinates safely', () => {
  const coordEvents = [
    { id: 'no-coords', title: 'No coords', date: '2026-10-25' },
    { id: 'nan-coords', title: 'NaN coords', latitude: 'abc', longitude: null, date: '2026-10-25' },
    { id: 'out-of-range', title: 'Extreme coords', latitude: 999, longitude: -999, date: '2026-10-25' },
    { id: 'valid', title: 'Valid coords', latitude: 12.9352, longitude: 77.6245, date: '2026-10-25' },
  ];
  const userCoords = { latitude: 12.9352, longitude: 77.6245 };
  const result = rankRadarQuests(coordEvents, { now, timeframe: 'any', userCoordinates: userCoords, radiusKm: '10' });
  assert.deepEqual(result.map((r) => r.id), ['valid']);
  assert.equal(distanceKm(userCoords, coordEvents[0]), null);
  assert.equal(distanceKm(userCoords, coordEvents[1]), null);
  assert.equal(distanceKm(userCoords, coordEvents[2]), null);
});
