import test from 'node:test';
import assert from 'node:assert/strict';
import { addEventToChain, createQuestChain, estimateChainSummary, moveChainStop, normalizeChainName, optimizeChainRoute, removeChainStop } from './questChains.js';

const event = (id, title = `Quest ${id}`, extra = {}) => ({ id, title, category: 'Music', city: 'Bengaluru', date: '2026-11-01', ...extra });

test('chain names are trimmed, whitespace-normalized, and length validated', () => {
  assert.equal(normalizeChainName('  Sunday   adventure  '), 'Sunday adventure');
  assert.equal(createQuestChain('x'), null);
  assert.equal(createQuestChain('A valid plan', new Date('2026-10-24T12:00:00Z')).title, 'A valid plan');
});

test('adding an event stores a lightweight snapshot and prevents duplicates', () => {
  const chain = createQuestChain('Day out', new Date('2026-10-24T12:00:00Z'));
  const withStop = addEventToChain(chain, event(12, 'Art walk', { venue: 'Main Square' }));
  const duplicate = addEventToChain(withStop, event('12', 'Art walk duplicate'));
  assert.equal(withStop.stops.length, 1);
  assert.equal(duplicate.stops.length, 1);
  assert.equal(withStop.stops[0].venue, 'Main Square');
});

test('stop order can move up or down without mutating the source array', () => {
  const stops = [{ eventId: 'a' }, { eventId: 'b' }, { eventId: 'c' }];
  assert.deepEqual(moveChainStop(stops, 1, -1).map((stop) => stop.eventId), ['b', 'a', 'c']);
  assert.deepEqual(moveChainStop(stops, 1, 1).map((stop) => stop.eventId), ['a', 'c', 'b']);
  assert.deepEqual(moveChainStop(stops, 0, -1), stops);
  assert.deepEqual(stops.map((stop) => stop.eventId), ['a', 'b', 'c']);
});

test('removing a stop uses string-safe ids and summary describes the chain', () => {
  const stops = [
    { eventId: '1', city: 'Bengaluru', date: '2026-11-01' },
    { eventId: '2', city: 'Pune', date: '2026-11-02' },
  ];
  assert.equal(removeChainStop(stops, 1).length, 1);
  assert.deepEqual(estimateChainSummary({ stops }), { stopCount: 2, cities: ['Bengaluru', 'Pune'], dates: ['2026-11-01', '2026-11-02'], multiCity: true, multiDate: true });
});

test('nearby chain quest search filters by radius, excludes selected quests and sorts nearest first', async () => {
  const { findNearbyChainQuests } = await import('./questChains.js');
  const now = new Date('2026-11-06T10:00:00');
  const events = [
    event('far', 'Far quest', { latitude: 12.99, longitude: 77.70, date: '2026-11-08' }),
    event('near', 'Near quest', { latitude: 12.9352, longitude: 77.6245, date: '2026-11-08' }),
    event('selected', 'Already selected', { latitude: 12.936, longitude: 77.625, date: '2026-11-08' }),
    event('past', 'Past quest', { latitude: 12.936, longitude: 77.625, date: '2026-11-01' }),
  ];
  const result = findNearbyChainQuests(events, {
    userCoordinates: { latitude: 12.9352, longitude: 77.6245 },
    radiusKm: 5,
    excludedIds: ['selected'],
    now,
  });
  assert.deepEqual(result.map((item) => item.id), ['near']);
  assert.equal(result[0].distanceKm, 0);
});

test('nearby chain quest search falls back to selected city and locality without GPS', async () => {
  const { findNearbyChainQuests } = await import('./questChains.js');
  const now = new Date('2026-11-06T10:00:00');
  const events = [
    event('local', 'Local quest', { city: 'Bengaluru', locality: 'Koramangala', date: '2026-11-08' }),
    event('other-locality', 'Other locality', { city: 'Bengaluru', locality: 'Whitefield', date: '2026-11-08' }),
    event('other-city', 'Other city', { city: 'Pune', locality: 'Koregaon Park', date: '2026-11-08' }),
  ];
  const result = findNearbyChainQuests(events, { city: 'Bengaluru', locality: 'Koramangala', now });
  assert.deepEqual(result.map((item) => item.id), ['local']);
});


test('route optimizer starts from the supplied origin and chooses the nearest next stop', () => {
  const stops = [
    { eventId: 'far', title: 'Far', latitude: 19.45, longitude: 72.86 },
    { eventId: 'near', title: 'Near', latitude: 19.414, longitude: 72.821 },
    { eventId: 'mid', title: 'Mid', latitude: 19.416, longitude: 72.824 },
  ];
  const route = optimizeChainRoute(stops, { latitude: 19.4148, longitude: 72.8201 });
  assert.deepEqual(route.stops.map((stop) => stop.eventId), ['near', 'mid', 'far']);
  assert.equal(route.optimized, true);
  assert.equal(route.legs.length, 3);
  assert.ok(route.totalDistanceKm > 0);
});

test('route optimizer keeps the original order when fewer than two stops have coordinates', () => {
  const stops = [{ eventId: 'a', title: 'A' }, { eventId: 'b', title: 'B', latitude: null, longitude: null }];
  const route = optimizeChainRoute(stops);
  assert.deepEqual(route.stops, stops);
  assert.equal(route.optimized, false);
  assert.equal(route.missingCoordinates, 2);
});
