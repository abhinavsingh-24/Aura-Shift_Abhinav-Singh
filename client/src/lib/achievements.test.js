import test from 'node:test';
import assert from 'node:assert/strict';
import { getAchievements } from './achievements.js';

test('achievement milestones start locked with zero progress', () => {
  const badges = getAchievements();
  assert.equal(badges.length, 6);
  assert.equal(badges.some((badge) => badge.earned), false);
  assert.equal(badges.every((badge) => badge.percent === 0), true);
});

test('saved quests unlock the bookmark and curator milestones', () => {
  const badges = getAchievements({ savedCount: 3 });
  assert.equal(badges.find((badge) => badge.id === 'first-save').earned, true);
  assert.equal(badges.find((badge) => badge.id === 'curator').earned, true);
});

test('chains and chain stops unlock separate planning milestones', () => {
  const badges = getAchievements({ chainCount: 1, chainStops: 3 });
  assert.equal(badges.find((badge) => badge.id === 'cartographer').earned, true);
  assert.equal(badges.find((badge) => badge.id === 'planner').earned, true);
});

test('mystery reveals unlock curiosity milestones', () => {
  const badges = getAchievements({ mysteryRevealCount: 5 });
  assert.equal(badges.find((badge) => badge.id === 'wildcard').earned, true);
  assert.equal(badges.find((badge) => badge.id === 'curious').earned, true);
});

test('invalid counters are treated as zero', () => {
  assert.equal(getAchievements({ savedCount: -2, chainCount: 'nope' }).some((badge) => badge.earned), false);
});
