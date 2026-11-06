const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./index');
const { STATES } = require('./location/geoData');
const { runImport, parseCsv } = require('./location/geoImport');

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// Small India-Post-shaped fixture used so tests do not depend on the 23MB dataset.
const rows = [
  ['Alpha B.O', '560001', 'BO', 'BENGALURU URBAN', 'KARNATAKA', '12.97', '77.59'],
  ['Alpha Layout S.O', '560002', 'SO', 'BENGALURU URBAN', 'KARNATAKA', '12.98', '77.60'],
  ['Bangalore G.P.O', '560001', 'HO', 'Bengaluru Urban', 'KARNATAKA', '12.97', '77.59'],
  ['Mysore H.O', '570001', 'HO', 'MYSURU', 'KARNATAKA', '12.30', '76.65'],
  ['Cuffe Parade S.O', '400005', 'SO', 'MUMBAI', 'MAHARASHTRA', '18.91', '72.81'],
  ['Leh H.O', '194101', 'HO', 'LEH', 'LADAKH', '34.16', '77.58'],
  ['Alpha B.O', '560001', 'BO', 'BENGALURU URBAN', 'KARNATAKA', '12.97', '77.59'],
].map(([OfficeName, Pincode, OfficeType, District, StateName, Latitude, Longitude]) => ({ OfficeName, Pincode, OfficeType, District, StateName, Latitude, Longitude }));
const cities = [
  { name: 'Bengaluru', state: 'Karnataka', districts: ['BENGALURU URBAN'], altNames: ['Bangalore'] },
  { name: 'Ghostville', state: 'Karnataka', districts: ['NOPE'] },
];

async function withServer(fn) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = async (path, cookie) => {
    const res = await fetch(base + path, { headers: cookie ? { Cookie: cookie } : {} });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const send = async (method, path, body, cookie) => {
    const res = await fetch(base + path, { method, headers: { ...JSON_HEADERS, ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const register = async (role) => {
    const res = await fetch(`${base}/api/auth/register`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ name: `Geo ${role}`, email: `geo-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`, password: 'safe-demo-password-123', role }),
    });
    return res.headers.get('set-cookie').split(';')[0];
  };
  try { await fn({ get, send, register }); } finally { await new Promise((resolve) => server.close(resolve)); }
}

test('empty database returns empty lists, not errors', async () => {
  const store = app.locals.locationStore;
  await store._reset();
  await withServer(async ({ get }) => {
    for (const path of ['/api/locations/countries', '/api/locations/states']) {
      const res = await get(path);
      assert.equal(res.status, 200);
      assert.deepEqual(res.body.data, []);
      assert.equal(res.body.pagination.total, 0);
    }
    assert.equal((await get('/api/locations/states/IN-KA/districts')).status, 404);
    assert.equal((await get('/api/locations/postal-codes/560001')).status, 404);
    const search = await get('/api/locations/search?q=bang');
    assert.equal(search.status, 200);
    assert.equal(search.body.data.length, 0);
  });
});

test('import API rejects anonymous and non-admin callers', async () => {
  await withServer(async ({ send, get, register }) => {
    assert.equal((await send('POST', '/api/locations/import', { rows })).status, 401);
    const explorer = await register('explorer');
    const organizer = await register('organizer');
    assert.equal((await send('POST', '/api/locations/import', { rows }, explorer)).status, 403);
    assert.equal((await send('POST', '/api/locations/import', { rows }, organizer)).status, 403);
    assert.equal((await send('PATCH', '/api/locations/admin/records/IN-KA', { active: false }, explorer)).status, 403);
    assert.equal((await get('/api/locations/admin/records')).status, 401);
    assert.equal((await get('/api/locations/admin/audit', explorer)).status, 403);
  });
});

test('admin import is validated, idempotent, and reports quality', async () => {
  const store = app.locals.locationStore;
  await store._reset();
  await withServer(async ({ send, get, register }) => {
    const admin = await register('admin');
    assert.equal((await send('POST', '/api/locations/import', { rows: [] }, admin)).status, 400);
    assert.equal((await send('POST', '/api/locations/import', { rows: 'x' }, admin)).status, 400);

    const dry = await send('POST', '/api/locations/import', { rows, cities, dryRun: true }, admin);
    assert.equal(dry.status, 200);
    assert.equal(await store.count({}), 0, 'dry run must not write');

    const first = await send('POST', '/api/locations/import', { rows, cities }, admin);
    assert.equal(first.status, 201);
    assert.equal(first.body.counts.state, 36);
    assert.equal(first.body.counts.district, 4);
    assert.equal(first.body.duplicates.duplicateRows, 1);
    assert.deepEqual(first.body.missingRelationships.curatedCityDistrictsNotFound, [{ city: 'Ghostville', district: 'NOPE' }]);
    assert.ok(first.body.source && first.body.datasetVersion && first.body.importDate);
    const total = await store.count({});

    const second = await send('POST', '/api/locations/import', { rows, cities }, admin);
    assert.equal(second.body.summary.inserted, 0);
    assert.equal(second.body.summary.updated, 0);
    assert.equal(second.body.summary.unchanged, total);
    assert.equal(await store.count({}), total, 'duplicate import must not create records');

    const history = await get('/api/locations/admin/imports', admin);
    assert.equal(history.body.data.length >= 2, true);
    const audit = await get('/api/locations/admin/audit', admin);
    assert.ok(audit.body.data.some((l) => l.action === 'LOCATION_IMPORT'));
    assert.equal((await get('/api/locations/admin/duplicates', admin)).body.data.length, 0);
  });
});

test('all 28 states and 8 union territories are served', async () => {
  await withServer(async ({ get }) => {
    const res = await get('/api/locations/states?limit=100');
    assert.equal(res.body.data.length, 36);
    assert.equal(res.body.data.filter((s) => s.kind === 'state').length, 28);
    assert.equal(res.body.data.filter((s) => s.kind === 'union_territory').length, 8);
    assert.equal(STATES.length, 36);
    const names = res.body.data.map((s) => s.name);
    ['Ladakh', 'Telangana', 'Puducherry', 'Lakshadweep'].forEach((n) => assert.ok(names.includes(n), n));
    assert.equal((await get('/api/locations/states?kind=union_territory')).body.data.length, 8);
    const countries = await get('/api/locations/countries');
    assert.equal(countries.body.data[0].name, 'India');
  });
});

test('hierarchy, search, PIN lookup, pagination and invalid combinations', async () => {
  await withServer(async ({ get, send, register }) => {
    const districts = await get('/api/locations/states/IN-KA/districts');
    const names = districts.body.data.map((d) => d.name);
    assert.deepEqual(names, ['Bengaluru Urban', 'Mysuru']);
    const blr = districts.body.data[0];
    assert.equal(blr.source, undefined, 'internal fields are not exposed');

    const cityRes = await get(`/api/locations/districts/${blr.id}/cities`);
    assert.equal(cityRes.body.data.length, 1);
    const city = cityRes.body.data[0];
    assert.deepEqual(city.altNames, ['Bangalore']);
    const locs = await get(`/api/locations/cities/${city.id}/localities`);
    assert.equal(locs.body.data.length, 3);
    locs.body.data.forEach((l) => assert.equal(l.geo, undefined, 'coordinates are never public'));
    assert.equal((await get(`/api/locations/districts/${blr.id}/localities?limit=2`)).body.pagination.totalPages, 2);

    // Mysuru has no curated city here -> district-level fallback works
    const mysuru = districts.body.data[1];
    assert.equal((await get(`/api/locations/districts/${mysuru.id}/cities`)).body.data.length, 0);
    assert.equal((await get(`/api/locations/districts/${mysuru.id}/localities`)).body.data.length, 1);
    assert.equal((await get('/api/locations/districts/nope/cities')).status, 404);

    const pin = await get('/api/locations/postal-codes/560001');
    assert.equal(pin.status, 200);
    assert.equal(pin.body.state.name, 'Karnataka');
    assert.equal(pin.body.district.name, 'Bengaluru Urban');
    assert.equal(pin.body.localities.length, 2);
    assert.equal((await get('/api/locations/postal-codes/12345')).status, 400);
    assert.equal((await get('/api/locations/postal-codes/999999')).status, 404);

    assert.equal((await get('/api/locations/search?q=b')).status, 400);
    const bang = await get('/api/locations/search?q=bangal');
    assert.ok(bang.body.data.some((r) => r.type === 'city' && r.name === 'Bengaluru'), 'alt name search');
    const pinSearch = await get('/api/locations/search?q=5600');
    assert.ok(pinSearch.body.data.every((r) => r.type === 'postal_code'));
    assert.equal((await get('/api/locations/search?q=karn&type=state')).body.data[0].name, 'Karnataka');
    assert.equal((await get('/api/locations/search?q=karn&type=bogus')).status, 400);

    const maha = (await get('/api/locations/states?q=mahar')).body.data[0];
    const bad = await send('POST', '/api/locations/validate', { stateId: maha.id, districtId: blr.id });
    assert.equal(bad.status, 422);
    assert.match(bad.body.errors[0], /does not belong/);
    const badPin = await send('POST', '/api/locations/validate', { stateId: 'IN-KA', pincode: '400005' });
    assert.equal(badPin.status, 422);
    const good = await send('POST', '/api/locations/validate', { stateId: 'IN-KA', districtId: blr.id, cityId: city.id, pincode: '560001' });
    assert.equal(good.status, 200);

    const explorer = await register('explorer');
    const denied = await send('PUT', '/api/locations/preferences', { homeLocation: { stateId: maha.id, districtId: blr.id } }, explorer);
    assert.equal(denied.status, 422);
    const saved = await send('PUT', '/api/locations/preferences', { homeLocation: { stateId: 'IN-KA', districtId: blr.id, cityId: city.id } }, explorer);
    assert.equal(saved.status, 200);
    assert.equal((await get('/api/locations/preferences', explorer)).body.homeLocation.cityId, city.id);
    assert.equal((await get('/api/locations/preferences')).status, 401);
  });
});

test('GPS detection returns approximate place only and rejects bad input', async () => {
  await withServer(async ({ send }) => {
    const ok = await send('POST', '/api/locations/detect', { latitude: 12.971, longitude: 77.595 });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.state.name, 'Karnataka');
    assert.equal(JSON.stringify(ok.body).includes('77.59'), false, 'no coordinates in response');
    assert.equal((await send('POST', '/api/locations/detect', { latitude: 0, longitude: -150 })).status, 404);
    assert.equal((await send('POST', '/api/locations/detect', { latitude: 'x' })).status, 400);
  });
});

test('admin can deactivate with cascade and edits survive re-import', async () => {
  const store = app.locals.locationStore;
  await withServer(async ({ get, send, register }) => {
    const admin = await register('admin');
    assert.equal((await send('PATCH', '/api/locations/admin/records/IN-LA', {}, admin)).status, 400);
    assert.equal((await send('PATCH', '/api/locations/admin/records/IN-LA', { active: 'no' }, admin)).status, 400);
    assert.equal((await send('PATCH', '/api/locations/admin/records/missing', { active: false }, admin)).status, 404);
    const res = await send('PATCH', '/api/locations/admin/records/IN-LA', { active: false }, admin);
    assert.equal(res.status, 200);
    assert.ok(res.body.cascaded >= 2);
    assert.equal((await get('/api/locations/postal-codes/194101')).status, 404);
    assert.ok(!(await get('/api/locations/states?limit=100')).body.data.some((s) => s.id === 'IN-LA'));

    const reimport = await send('POST', '/api/locations/import', { rows, cities }, admin);
    assert.equal(reimport.body.summary.skippedManualEdits >= 1, true);
    assert.equal((await store.findById('IN-LA')).active, false, 're-import must not overwrite admin edits');
    assert.ok((await get('/api/locations/admin/audit', admin)).body.data.some((l) => l.action === 'LOCATION_UPDATED'));
    await send('PATCH', '/api/locations/admin/records/IN-LA', { active: true }, admin);
  });
});

test('search stays fast on a large dataset', async () => {
  const store = app.locals.locationStore;
  const big = [];
  for (let i = 0; i < 20000; i += 1) {
    big.push({ OfficeName: `Place ${i} B.O`, Pincode: String(100000 + (i % 900000)), OfficeType: 'BO', District: `District ${i % 50}`, StateName: 'GUJARAT', Latitude: 'NA', Longitude: 'NA' });
  }
  const run = await runImport(store, { rows: big, cities: [], actor: { id: 't', email: 't' } });
  assert.equal(run.report.validation.missingCoordinates, 20000);
  await withServer(async ({ get }) => {
    const start = process.hrtime.bigint();
    for (let i = 0; i < 5; i += 1) await get('/api/locations/search?q=place 19');
    const ms = Number(process.hrtime.bigint() - start) / 1e6 / 5;
    assert.ok(ms < 400, `average search took ${ms.toFixed(1)}ms`);
  });
  await store._reset();
});

test('CSV parser handles quotes, commas and embedded newlines', () => {
  const parsed = parseCsv('"a","b,c","d\ne"\r\n"1","say ""hi""","3"\n');
  assert.deepEqual(parsed, [['a', 'b,c', 'd\ne'], ['1', 'say "hi"', '3']]);
});
