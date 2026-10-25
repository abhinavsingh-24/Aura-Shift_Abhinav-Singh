import test from 'node:test';
import assert from 'node:assert/strict';
import { getMysteryQuest } from './mysteryQuest.js';

const now = new Date('2026-10-24T09:00:00');
const events = [
  { id: 'past', title: 'Old music', date: '2026-10-01', category: 'Music', city: 'Mumbai' },
  { id: 'tech', title: 'Future tech', date: '2026-10-27', category: 'Technology', city: 'Mumbai' },
  { id: 'music', title: 'Music night', date: '2026-10-25', category: 'Music', city: 'Mumbai' },
  { id: 'other-city', title: 'Remote music', date: '2026-10-25', category: 'Music', city: 'Pune' },
];

test('Mystery Quest skips past events and prefers the explorer interests', () => {
  const result = getMysteryQuest(events, { now, interests: ['Music'] });
  assert.ok(['music', 'other-city'].includes(result.event.id), 'should pick an upcoming event matching explorer interests');
  assert.match(result.reasons[0], /music/i);
  assert.equal(result.candidatesCount, 3);
});

test('Mystery Quest respects category and city constraints', () => {
  const result = getMysteryQuest(events, { now, interests: [], city: 'Mumbai', category: 'Technology' });
  assert.equal(result.event.id, 'tech');
  assert.equal(result.candidatesCount, 1);
});

test('Mystery Quest respects its upcoming time window', () => {
  const result = getMysteryQuest(events, { now, timeframe: 'today' });
  assert.equal(result, null);
});

test('Mystery Quest reports no result when all candidates are filtered out', () => {
  assert.equal(getMysteryQuest(events, { now, city: 'Delhi' }), null);
});

test('Mystery Quest handles invalid and missing event data safely', () => {
  assert.equal(getMysteryQuest([null, {}, { id: 'bad', title: 'Bad date', date: 'not-a-date' }], { now }), null);
});
