import test from 'node:test';
import assert from 'node:assert/strict';
import { getExplorerLevel } from './gamification.js';
test('calculates XP and level from explorer activity', () => { assert.deepEqual(getExplorerLevel({saved:2,reviews:1}), {xp:45,level:1,title:'Rookie Explorer',currentLevelXp:45,nextLevelXp:100,progress:45}); });
test('levels up for accumulated activity', () => { assert.equal(getExplorerLevel({saved:10}).level, 2); });
