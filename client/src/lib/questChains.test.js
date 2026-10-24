import test from 'node:test';
import assert from 'node:assert/strict';
import { addEventToChain, createQuestChain, estimateChainSummary, moveChainStop, normalizeChainName, removeChainStop } from './questChains.js';

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
