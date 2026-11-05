const test = require('node:test');
const assert = require('node:assert/strict');
const { haversineKm, getEventCoordinates, parseNearbyQuery, findNearbyEvents } = require('./nearby');
const app = require('./index');

test('haversineKm computes known distances', () => {
  assert.ok(haversineKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 }) < 0.001);
  // Mumbai -> Pune is roughly 120 km in a straight line
  const d = haversineKm({ latitude: 19.076, longitude: 72.8777 }, { latitude: 18.5204, longitude: 73.8567 });
  assert.ok(d > 110 && d < 130, `unexpected distance ${d}`);
});

test('getEventCoordinates rejects missing or invalid coordinates', () => {
  assert.equal(getEventCoordinates({}), null);
  assert.equal(getEventCoordinates({ latitude: 'x', longitude: 10 }), null);
  assert.equal(getEventCoordinates({ latitude: 95, longitude: 10 }), null);
  assert.deepEqual(getEventCoordinates({ latitude: '12.5', longitude: 77 }), { latitude: 12.5, longitude: 77 });
});

test('parseNearbyQuery validates ranges and applies defaults', () => {
  assert.ok(parseNearbyQuery({}).errors.length > 0);
  assert.ok(parseNearbyQuery({ latitude: '91', longitude: '10' }).errors.length > 0);
  assert.ok(parseNearbyQuery({ latitude: '10', longitude: '181' }).errors.length > 0);
  assert.ok(parseNearbyQuery({ latitude: 'abc', longitude: '10' }).errors.length > 0);
  assert.ok(parseNearbyQuery({ latitude: '10', longitude: '10', radiusKm: '0' }).errors.length > 0);
  assert.ok(parseNearbyQuery({ latitude: '10', longitude: '10', radiusKm: '5000' }).errors.length > 0);
  assert.ok(parseNearbyQuery({ latitude: '10', longitude: '10', sort: 'bogus' }).errors.length > 0);
  const ok = parseNearbyQuery({ latitude: '10', longitude: '20' });
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.params.radiusKm, 10);
  assert.equal(ok.params.sort, 'nearest');
});

test('findNearbyEvents filters by radius, category and keyword, and sorts by distance', () => {
  const origin = { latitude: 12.9716, longitude: 77.5946 };
  const events = [
    { id: 'far', title: 'Far Fest', category: 'Music', latitude: 19.076, longitude: 72.8777 },
    { id: 'near', title: 'Near Jam', category: 'Music', latitude: 12.98, longitude: 77.6 },
    { id: 'nearer', title: 'Nearest Tech Talk', category: 'Technology', latitude: 12.9717, longitude: 77.5947 },
    { id: 'nocoords', title: 'Mystery', category: 'Music' },
  ];
  const base = { ...origin, radiusKm: 5, limit: 10, sort: 'nearest', search: '', category: 'all' };

  const all = findNearbyEvents(events, base);
  assert.deepEqual(all.results.map((r) => r.event.id), ['nearer', 'near']);
  assert.equal(all.withoutCoordinates, 1);
  assert.ok(all.results[0].distanceKm < all.results[1].distanceKm);

  const music = findNearbyEvents(events, { ...base, category: 'Music' });
  assert.deepEqual(music.results.map((r) => r.event.id), ['near']);

  const kw = findNearbyEvents(events, { ...base, search: 'tech' });
  assert.deepEqual(kw.results.map((r) => r.event.id), ['nearer']);

  const wide = findNearbyEvents(events, { ...base, radiusKm: 100 });
  assert.ok(!wide.results.some((r) => r.event.id === 'far'));
  const huge = findNearbyEvents(events, { ...base, radiusKm: 2000 });
  assert.ok(huge.results.some((r) => r.event.id === 'far'));

  const limited = findNearbyEvents(events, { ...base, limit: 1 });
  assert.equal(limited.results.length, 1);
  assert.equal(limited.total, 2);
});

test('GET /api/events/nearby validates input and returns events with distances', async (t) => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const missing = await fetch(`${base}/api/events/nearby`);
  assert.equal(missing.status, 400);
  const badLat = await fetch(`${base}/api/events/nearby?latitude=200&longitude=10`);
  assert.equal(badLat.status, 400);
  const badRadius = await fetch(`${base}/api/events/nearby?latitude=10&longitude=10&radiusKm=100000`);
  assert.equal(badRadius.status, 400);

  const empty = await fetch(`${base}/api/events/nearby?latitude=-60&longitude=-120&radiusKm=5`);
  assert.equal(empty.status, 200);
  const emptyBody = await empty.json();
  assert.equal(emptyBody.count, 0);
  assert.deepEqual(emptyBody.events, []);

  const res = await fetch(`${base}/api/events/nearby?latitude=12.9716&longitude=77.5946&radiusKm=50`);
  assert.equal(res.status, 200);
  const body = await res.json();
  for (const event of body.events) {
    assert.equal(typeof event.distanceKm, 'number');
    assert.ok(event.distanceKm <= 50);
    assert.equal(event.ownerId, undefined);
  }
});
