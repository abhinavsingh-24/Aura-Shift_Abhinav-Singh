import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutEvents, regionForCategory, hash32, MAP_W, MAP_H, REGIONS, PAPER_W, PAPER_H } from './mapLayout.js';

const mk = (id, category = 'Music') => ({ id, category });
const sample = [
  mk('evt-1', 'Music'), mk('evt-2', 'Technology'), mk('evt-3', 'Sports'), mk('evt-4', 'Art and culture'),
  mk('evt-5', 'Workshops'), mk('evt-6', 'Gaming'), mk('evt-7', 'Music'), mk('evt-8', 'Music'), mk('evt-9', 'Education'),
];

test('hash32 is stable', () => {
  assert.equal(hash32('evt-1'), hash32('evt-1'));
  assert.notEqual(hash32('evt-1'), hash32('evt-2'));
});

test('every category maps to a region, unknown falls back to Lantern Village', () => {
  assert.equal(regionForCategory('Music').id, 'meadow');
  assert.equal(regionForCategory('technology').id, 'forge');
  assert.equal(regionForCategory('Something new').id, 'village');
  assert.equal(regionForCategory(undefined).id, 'village');
  assert.ok(REGIONS.length >= 6);
});

test('layout is deterministic and independent of input order / filtering', () => {
  const a = layoutEvents(sample);
  const b = layoutEvents([...sample].reverse());
  assert.deepEqual(a, b);
  assert.deepEqual(a, layoutEvents(sample));
});

test('one position per event, inside the map bounds, with small rotation', () => {
  const layout = layoutEvents(sample);
  assert.equal(Object.keys(layout).length, sample.length);
  for (const p of Object.values(layout)) {
    assert.ok(p.x > 0 && p.x < MAP_W && p.y > 0 && p.y < MAP_H);
    assert.ok(Math.abs(p.rot) <= 3);
  }
});

test('papers in the same crowded region are separated', () => {
  const crowded = Array.from({ length: 6 }, (_, i) => mk(`m-${i}`, 'Music'));
  const pts = Object.values(layoutEvents(crowded));
  let overlapping = 0;
  for (let i = 0; i < pts.length; i += 1) for (let j = i + 1; j < pts.length; j += 1) {
    if (Math.abs(pts[i].x - pts[j].x) < PAPER_W && Math.abs(pts[i].y - pts[j].y) < PAPER_H) overlapping += 1;
  }
  assert.equal(overlapping, 0);
});

test('ignores events without ids and tolerates empty input', () => {
  assert.deepEqual(layoutEvents([]), {});
  assert.deepEqual(layoutEvents(null), {});
  assert.deepEqual(layoutEvents([{ category: 'Music' }]), {});
});
