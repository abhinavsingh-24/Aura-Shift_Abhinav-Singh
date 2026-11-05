import test from 'node:test';
import assert from 'node:assert/strict';
import { filterByRegion, regionCounts, reconcileSelection, stepSelection, revealPoint } from './questSelection.js';

const ev = (id, category) => ({ id, category });
const events = [ev('a', 'Music'), ev('b', 'Music'), ev('c', 'Technology'), ev('d', 'Sports'), ev('e', 'Mystery')];

test('map and list share one region filter and counts', () => {
  assert.equal(filterByRegion(events, 'all'), events);
  assert.deepEqual(filterByRegion(events, 'meadow').map((e) => e.id), ['a', 'b']);
  assert.deepEqual(filterByRegion(events, 'village').map((e) => e.id), ['e'], 'unknown categories fall back to Lantern Village');
  const counts = regionCounts(events);
  assert.equal(counts.meadow, 2);
  assert.equal(Object.values(counts).reduce((x, y) => x + y, 0), events.length);
});

test('filtering clears the selection only when the selected event is no longer eligible', () => {
  assert.equal(reconcileSelection('a', filterByRegion(events, 'meadow')), 'a');
  assert.equal(reconcileSelection('c', filterByRegion(events, 'meadow')), null);
  assert.equal(reconcileSelection(null, events), null);
  assert.equal(reconcileSelection(7, [{ id: '7' }]), 7, 'ids compare as strings');
});

test('keyboard stepping switches events, wraps, and handles empty / unselected', () => {
  assert.equal(stepSelection(events, 'a', 1).id, 'b');
  assert.equal(stepSelection(events, 'e', 1).id, 'a');
  assert.equal(stepSelection(events, 'a', -1).id, 'e');
  assert.equal(stepSelection(events, null, 1).id, 'a');
  assert.equal(stepSelection(events, null, -1).id, 'e');
  assert.equal(stepSelection([], 'a', 1), null);
});

test('selecting a visible event leaves zoom and pan untouched (same camera object)', () => {
  const cam = { x: -200, y: -100, k: 2 };
  const vp = { vw: 1000, vh: 600 };
  // map point (600, 300) -> screen x = -200 + 0.5*2000 = 800, y = -100 + 0.375*(2*1000*800/1200) = 400: well inside 1000x600.
  assert.equal(revealPoint(cam, vp, { x: 600, y: 300 }), cam);
  // and the map's own centre (600, 400) at this camera is below the comfortable area, so it WOULD pan: proves the check is real.
  assert.notEqual(revealPoint(cam, vp, { x: 600, y: 400 }), cam);
});

test('an off-screen event is revealed by panning only; zoom never changes', () => {
  const cam = { x: 0, y: 0, k: 2 };
  const vp = { vw: 1000, vh: 600 };
  const next = revealPoint(cam, vp, { x: 1100, y: 700 });
  assert.notEqual(next, cam);
  assert.equal(next.k, 2);
  const sx = next.x + (1100 / 1200) * 2000;
  assert.ok(sx >= 110 && sx <= 890, `marker x on screen: ${sx}`);
});
