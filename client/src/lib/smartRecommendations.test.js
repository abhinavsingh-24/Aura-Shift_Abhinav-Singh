import test from 'node:test';
import assert from 'node:assert/strict';
import { rankSmartRecommendations } from './smartRecommendations.js';
test('ranks matching interests ahead of unrelated events', () => {
 const events = [{ id: 1, title: 'Music night', category: 'Music', date: '2030-01-02' }, { id: 2, title: 'Art show', category: 'Art', date: '2030-01-02' }];
 const result = rankSmartRecommendations(events, { interests: ['Music'], now: new Date('2030-01-01T00:00:00') });
 assert.equal(result[0].id, 1); assert.ok(result[0].recommendationReasons.some((reason) => reason.includes('Music')));
});
test('filters past events', () => { assert.equal(rankSmartRecommendations([{id:1,date:'2020-01-01'}], {now:new Date('2025-01-01')}).length, 0); });
