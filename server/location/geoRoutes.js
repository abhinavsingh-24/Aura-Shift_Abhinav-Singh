const crypto = require('node:crypto');
const { createGeoStore } = require('./geoStore');
const { runImport, SOURCE, DATASET_VERSION } = require('./geoImport');
const { COUNTRY } = require('./geoData');
const { AuditLogModel } = require('../db');

const TYPES = ['country', 'state', 'district', 'city', 'locality', 'postal_code'];
const PIN_RE = /^[1-9]\d{5}$/;

function paging(query, defaultLimit = 50) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

const pageMeta = (page, limit, total) => ({ page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
const publicRecord = (r) => r && ({ ...r, editedByAdmin: undefined, source: undefined, datasetVersion: undefined });

function registerLocationRoutes(app, ctx) {
  const store = createGeoStore({ isMongoReady: ctx.isMongoReady });
  const { requireAdmin, requireAuth, inMemoryState } = ctx;

  const wrap = (fn) => async (req, res) => {
    try { await fn(req, res); } catch (error) {
      if (error.status) return res.status(error.status).json({ message: error.message });
      console.error('[locations]', error);
      return res.status(500).json({ message: 'Location service error.' });
    }
  };

  async function audit(user, action, targetId, details) {
    const entry = { id: `audit-${crypto.randomUUID()}`, actorId: user.id, actorEmail: user.email, action, targetType: 'location', targetId, details };
    if (ctx.isMongoReady()) await AuditLogModel.create(entry);
    else (inMemoryState.auditLogs = inMemoryState.auditLogs || []).unshift({ ...entry, createdAt: new Date() });
  }

  async function listChildren(res, query, filter, parentCheck) {
    if (parentCheck && !parentCheck.ok) return res.status(404).json({ message: parentCheck.message });
    const { page, limit, skip } = paging(query);
    const f = { ...filter, active: true };
    const q = String(query.q || '').trim().toLowerCase();
    if (q) f.contains = q;
    const [data, total] = await Promise.all([store.find(f, { skip, limit, sort: filter.type === 'locality' ? 'name' : 'name' }), store.count(f)]);
    return res.json({ data: data.map(publicRecord), pagination: pageMeta(page, limit, total) });
  }

  async function activeParent(id, type) {
    const rec = await store.findById(id);
    if (!rec || rec.type !== type || !rec.active) return { ok: false, message: `${type} not found.` };
    return { ok: true, rec };
  }

  // Returns {valid, errors, resolved} for a (state,district,city,locality,pincode) selection.
  async function validateSelection(sel = {}) {
    const errors = [];
    const resolved = {};
    const load = async (id, type, label) => {
      if (!id) return null;
      const rec = await store.findById(String(id));
      if (!rec || rec.type !== type || !rec.active) { errors.push(`${label} is not a valid active ${type}.`); return null; }
      return rec;
    };
    const state = await load(sel.stateId, 'state', 'stateId');
    const district = await load(sel.districtId, 'district', 'districtId');
    const city = await load(sel.cityId, 'city', 'cityId');
    const locality = await load(sel.localityId, 'locality', 'localityId');
    if (district && state && district.stateId !== state.id) errors.push('District does not belong to the selected state.');
    if (district && !state && sel.stateId === undefined) resolved.stateId = district.stateId;
    if (city && district && city.districtId !== district.id) errors.push('City does not belong to the selected district.');
    if (city && !district && sel.districtId === undefined) resolved.districtId = city.districtId;
    if (city && state && city.stateId !== state.id) errors.push('City does not belong to the selected state.');
    if (locality) {
      if (city && locality.cityId !== city.id) errors.push('Locality does not belong to the selected city.');
      if (district && locality.districtId !== district.id) errors.push('Locality does not belong to the selected district.');
      if (state && locality.stateId !== state.id) errors.push('Locality does not belong to the selected state.');
    }
    if (sel.pincode) {
      const pin = String(sel.pincode);
      if (!PIN_RE.test(pin)) errors.push('PIN code must be a valid 6-digit number.');
      else {
        const pinRec = await store.findById(`pin-${pin}`);
        if (!pinRec || !pinRec.active) errors.push('PIN code was not found in the master data.');
        else {
          if (locality && locality.pincode !== pin) errors.push('PIN code does not match the selected locality.');
          if (state && pinRec.stateId !== state.id) errors.push('PIN code does not belong to the selected state.');
        }
      }
    }
    return { valid: errors.length === 0, errors, resolved };
  }

  // ---------- Public read APIs ----------
  app.get('/api/locations/countries', wrap(async (req, res) => {
    const total = await store.count({ type: 'country', active: true });
    const data = total ? (await store.find({ type: 'country', active: true })).map(publicRecord) : [];
    res.json({ data, pagination: pageMeta(1, 50, total) });
  }));

  app.get('/api/locations/states', wrap(async (req, res) => {
    const f = { type: 'state', active: true };
    const q = String(req.query.q || '').trim().toLowerCase();
    if (q) f.contains = q;
    const { page, limit, skip } = paging(req.query, 100);
    const [data, total] = await Promise.all([store.find(f, { skip, limit }), store.count(f)]);
    const kind = req.query.kind;
    const filtered = kind ? data.filter((s) => s.kind === kind) : data;
    res.json({ data: filtered.map(publicRecord), pagination: pageMeta(page, limit, kind ? filtered.length : total) });
  }));

  app.get('/api/locations/states/:stateId/districts', wrap(async (req, res) => {
    const parent = await activeParent(req.params.stateId, 'state');
    return listChildren(res, req.query, { type: 'district', stateId: req.params.stateId }, parent);
  }));

  app.get('/api/locations/districts/:districtId/cities', wrap(async (req, res) => {
    const parent = await activeParent(req.params.districtId, 'district');
    return listChildren(res, req.query, { type: 'city', districtId: req.params.districtId }, parent);
  }));

  // Fallback for districts that have no curated city records.
  app.get('/api/locations/districts/:districtId/localities', wrap(async (req, res) => {
    const parent = await activeParent(req.params.districtId, 'district');
    return listChildren(res, req.query, { type: 'locality', districtId: req.params.districtId }, parent);
  }));

  app.get('/api/locations/cities/:cityId/localities', wrap(async (req, res) => {
    const parent = await activeParent(req.params.cityId, 'city');
    return listChildren(res, req.query, { type: 'locality', cityId: req.params.cityId }, parent);
  }));

  app.get('/api/locations/search', wrap(async (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase();
    if (q.length < 2) return res.status(400).json({ message: 'Search query must be at least 2 characters.' });
    if (q.length > 80) return res.status(400).json({ message: 'Search query is too long.' });
    const { page, limit, skip } = paging(req.query, 20);
    let types = TYPES.filter((t) => t !== 'country');
    if (req.query.type) {
      types = String(req.query.type).split(',').filter((t) => TYPES.includes(t));
      if (!types.length) return res.status(400).json({ message: `type must be one of ${TYPES.join(', ')}.` });
    }
    if (/^\d{3,6}$/.test(q)) types = types.filter((t) => t === 'postal_code' || t === 'locality');
    const base = {};
    if (req.query.stateId) base.stateId = String(req.query.stateId);
    if (req.query.districtId) base.districtId = String(req.query.districtId);
    const results = [];
    for (const type of types) {
      if (/^\d{3,6}$/.test(q)) {
        const f = { ...base, type, active: true };
        if (type === 'postal_code') f.prefix = q; else if (q.length === 6) f.pincode = q; else continue;
        results.push(...(await store.find(f, { limit: 20 })));
        continue;
      }
      const pre = await store.find({ ...base, type, active: true, prefix: q }, { limit: 20 });
      results.push(...pre);
      if (pre.length < 20) {
        const ids = new Set(pre.map((r) => r.id));
        const more = await store.find({ ...base, type, active: true, contains: q }, { limit: 20 });
        results.push(...more.filter((r) => !ids.has(r.id)).slice(0, 20 - pre.length));
      }
    }
    // Multi-district curated cities repeat per district; collapse by name within a state.
    const seen = new Set();
    const unique = results.filter((r) => {
      const key = r.type === 'city' ? `city|${r.stateId}|${r.nameLower}` : r.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const stateRank = { state: 0, district: 1, city: 2, locality: 3, postal_code: 4 };
    unique.sort((a, b) => Number(!a.nameLower.startsWith(q)) - Number(!b.nameLower.startsWith(q)) || stateRank[a.type] - stateRank[b.type] || a.nameLower.localeCompare(b.nameLower));
    res.json({ data: unique.slice(skip, skip + limit).map(publicRecord), pagination: pageMeta(page, limit, unique.length) });
  }));

  app.get('/api/locations/postal-codes/:pincode', wrap(async (req, res) => {
    const pin = req.params.pincode;
    if (!PIN_RE.test(pin)) return res.status(400).json({ message: 'PIN code must be a valid 6-digit number.' });
    const pinRec = await store.findById(`pin-${pin}`);
    if (!pinRec || !pinRec.active) return res.status(404).json({ message: 'PIN code not found in the master data.' });
    const { page, limit, skip } = paging(req.query, 50);
    const f = { type: 'locality', pincode: pin, active: true };
    const [localities, total, state, district, city] = await Promise.all([
      store.find(f, { skip, limit }), store.count(f), store.findById(pinRec.stateId), store.findById(pinRec.districtId),
      pinRec.cityId ? store.findById(pinRec.cityId) : null,
    ]);
    res.json({
      pincode: pin,
      state: publicRecord(state),
      district: publicRecord(district),
      city: publicRecord(city),
      localities: localities.map(publicRecord),
      pagination: pageMeta(page, limit, total),
    });
  }));

  app.post('/api/locations/validate', wrap(async (req, res) => {
    const result = await validateSelection(req.body || {});
    res.status(result.valid ? 200 : 422).json(result);
  }));

  // Coordinates are processed in memory only: the response contains no coordinates and nothing is stored.
  app.post('/api/locations/detect', wrap(async (req, res) => {
    const lat = Number(req.body && req.body.latitude);
    const lng = Number(req.body && req.body.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ message: 'Valid latitude and longitude are required.' });
    }
    const loc = await store.nearestLocality(lat, lng, 50);
    if (!loc) return res.status(404).json({ message: 'No known Indian location found near these coordinates.' });
    const [state, district, city] = await Promise.all([store.findById(loc.stateId), store.findById(loc.districtId), loc.cityId ? store.findById(loc.cityId) : null]);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      approximate: true,
      state: publicRecord(state), district: publicRecord(district), city: publicRecord(city), locality: publicRecord(loc), pincode: loc.pincode,
    });
  }));

  // ---------- Home location (authenticated; IDs only, never coordinates) ----------
  app.get('/api/locations/preferences', requireAuth, wrap(async (req, res) => {
    res.json({ homeLocation: req.user.homeLocation || null });
  }));

  app.put('/api/locations/preferences', requireAuth, wrap(async (req, res) => {
    const body = req.body || {};
    if (body.homeLocation === null) {
      await ctx.updateUser(req.user.id, { homeLocation: null });
      return res.json({ homeLocation: null });
    }
    const sel = body.homeLocation || {};
    if (!sel.stateId) return res.status(400).json({ message: 'At least a state is required.' });
    const check = await validateSelection(sel);
    if (!check.valid) return res.status(422).json({ message: 'Invalid location combination.', errors: check.errors });
    const homeLocation = {
      countryId: 'IN',
      stateId: sel.stateId || null, districtId: sel.districtId || null, cityId: sel.cityId || null,
      localityId: sel.localityId || null, pincode: sel.pincode || null, updatedAt: new Date().toISOString(),
    };
    await ctx.updateUser(req.user.id, { homeLocation });
    return res.json({ homeLocation });
  }));

  // ---------- Admin ----------
  app.get('/api/locations/admin/summary', requireAdmin, wrap(async (req, res) => {
    const [counts, imports] = await Promise.all([store.countByType(), store.listImports(1)]);
    res.json({ storage: store.mode(), counts, lastImport: imports[0] || null, country: COUNTRY.name, source: SOURCE, datasetVersion: DATASET_VERSION });
  }));

  app.get('/api/locations/admin/records', requireAdmin, wrap(async (req, res) => {
    const { page, limit, skip } = paging(req.query, 25);
    const f = {};
    if (req.query.type && TYPES.includes(req.query.type)) f.type = req.query.type;
    if (req.query.stateId) f.stateId = String(req.query.stateId);
    if (req.query.districtId) f.districtId = String(req.query.districtId);
    if (req.query.active === 'true' || req.query.active === 'false') f.active = req.query.active === 'true';
    const q = String(req.query.q || '').trim().toLowerCase();
    if (q) f.contains = q;
    const [data, total] = await Promise.all([store.find(f, { skip, limit }), store.count(f)]);
    res.json({ data, pagination: pageMeta(page, limit, total) });
  }));

  app.patch('/api/locations/admin/records/:id', requireAdmin, wrap(async (req, res) => {
    const rec = await store.findById(req.params.id);
    if (!rec) return res.status(404).json({ message: 'Location record not found.' });
    const body = req.body || {};
    const patch = {};
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (name.length < 2 || name.length > 120) return res.status(400).json({ message: 'Name must be 2-120 characters.' });
      patch.name = name;
      patch.nameLower = name.toLowerCase();
    }
    if (body.altNames !== undefined) {
      if (!Array.isArray(body.altNames) || body.altNames.some((a) => typeof a !== 'string' || a.length > 120)) {
        return res.status(400).json({ message: 'altNames must be an array of strings.' });
      }
      patch.altNames = [...new Set(body.altNames.map((a) => a.trim()).filter(Boolean))].slice(0, 20);
    }
    if (body.active !== undefined) {
      if (typeof body.active !== 'boolean') return res.status(400).json({ message: 'active must be a boolean.' });
      patch.active = body.active;
    }
    if (!Object.keys(patch).length) return res.status(400).json({ message: 'Nothing to update.' });
    if (rec.type === 'country') return res.status(400).json({ message: 'The country record cannot be modified.' });
    patch.editedByAdmin = true;
    const updated = await store.update(rec.id, patch);
    let cascaded = 0;
    if (patch.active !== undefined && patch.active !== rec.active) cascaded = await store.updateDescendants(rec, { active: patch.active });
    await audit(req.user, 'LOCATION_UPDATED', rec.id, { type: rec.type, before: { name: rec.name, active: rec.active, altNames: rec.altNames }, patch, cascaded });
    res.json({ record: updated, cascaded });
  }));

  app.post('/api/locations/import', requireAdmin, wrap(async (req, res) => {
    const body = req.body || {};
    const dryRun = body.dryRun === true;
    const dataset = body.rows || body.csv ? 'inline' : 'bundled';
    if (body.rows !== undefined && (!Array.isArray(body.rows) || !body.rows.length || body.rows.length > 5000)) {
      return res.status(400).json({ message: 'rows must be a non-empty array of at most 5000 India Post style records.' });
    }
    if (body.cities !== undefined && !Array.isArray(body.cities)) return res.status(400).json({ message: 'cities must be an array.' });
    if (body.csv !== undefined && typeof body.csv !== 'string') return res.status(400).json({ message: 'csv must be a string.' });
    const run = await runImport(store, {
      rows: body.rows, cities: body.cities, csv: body.csv, dataset, dryRun, actor: req.user,
      source: typeof body.source === 'string' ? body.source.slice(0, 300) : undefined,
      datasetVersion: typeof body.datasetVersion === 'string' ? body.datasetVersion.slice(0, 80) : undefined,
    });
    await audit(req.user, 'LOCATION_IMPORT', run.id, { dataset, dryRun, summary: run.report.summary });
    res.status(dryRun ? 200 : 201).json({ importId: run.id, status: run.status, dryRun, ...run.report });
  }));

  app.get('/api/locations/admin/imports', requireAdmin, wrap(async (req, res) => {
    const imports = await store.listImports(25);
    res.json({ data: imports.map(({ report, ...r }) => ({ ...r, summary: report && report.summary, error: report && report.error })) });
  }));

  app.get('/api/locations/admin/imports/:id', requireAdmin, wrap(async (req, res) => {
    const run = await store.getImport(req.params.id);
    if (!run) return res.status(404).json({ message: 'Import not found.' });
    res.json(run);
  }));

  app.get('/api/locations/admin/duplicates', requireAdmin, wrap(async (req, res) => {
    res.json({ data: await store.findDuplicateGroups(100) });
  }));

  app.get('/api/locations/admin/audit', requireAdmin, wrap(async (req, res) => {
    const logs = ctx.isMongoReady()
      ? await AuditLogModel.find({ targetType: 'location' }).sort({ createdAt: -1 }).limit(100).lean()
      : (inMemoryState.auditLogs || []).filter((l) => l.targetType === 'location').slice(0, 100);
    res.json({ data: logs.map(({ _id, __v, ...l }) => l) });
  }));

  async function seedIfEmpty() {
    if (process.env.NODE_ENV === 'test' || process.env.LOCATION_AUTO_IMPORT === 'false') return;
    const counts = await store.count({ type: 'state' });
    if (counts >= 36) return;
    console.log('[LOCATIONS] Importing bundled India master data...');
    const run = await runImport(store, { dataset: 'bundled', actor: { id: 'system', email: 'system' } });
    console.log('[LOCATIONS] Import finished', run.report.counts);
  }

  return { store, seedIfEmpty, validateSelection };
}

module.exports = registerLocationRoutes;
