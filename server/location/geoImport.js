// Repeatable, idempotent importer for the India geographic master data.
// Source: India Post "All India Pincode Directory" (data.gov.in, OGDL-India)
// plus a curated city list (data/location/cities.curated.json).
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { COUNTRY, STATES, resolveState, normalizeKey } = require('./geoData');

const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'location');
const BUNDLED_CSV = path.join(DATA_DIR, 'pincode.csv');
const BUNDLED_CITIES = path.join(DATA_DIR, 'cities.curated.json');
const SOURCE = 'India Post – All India Pincode Directory (data.gov.in, Open Government Data License – India)';
const DATASET_VERSION = 'india-post-pincode-directory-2020+curated-cities-v1';
const BATCH = 5000;
const INDIA_BOUNDS = { minLat: 6, maxLat: 38, minLng: 68, maxLng: 98 };
const REQUIRED_COLUMNS = ['OfficeName', 'Pincode', 'OfficeType', 'District', 'StateName'];

let running = false;

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const titleCase = (s) =>
  String(s).toLowerCase().replace(/\s+/g, ' ').trim().replace(/(^|[\s(\-/])([a-z])/g, (_, p, ch) => p + ch.toUpperCase());
const slug = (s) => normalizeKey(s).replace(/ /g, '-');
const hashOf = (obj) => crypto.createHash('sha1').update(JSON.stringify(obj)).digest('hex').slice(0, 16);
const cleanOffice = (name) => String(name).replace(/\s+/g, ' ').replace(/\s+(?:[BSH]\.?\s?O\.?|G\.?P\.?O\.?)$/i, '').trim();

function parseCoords(latRaw, lngRaw) {
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || latRaw === '' || lngRaw === '') return null;
  if (lat < INDIA_BOUNDS.minLat || lat > INDIA_BOUNDS.maxLat || lng < INDIA_BOUNDS.minLng || lng > INDIA_BOUNDS.maxLng) return 'out_of_bounds';
  return { type: 'Point', coordinates: [lng, lat] };
}

function toRecords(rawRows, curatedCities) {
  const report = {
    rowsRead: rawRows.length,
    validation: { invalidPincode: 0, missingFields: 0, unknownState: 0, invalidCoordinates: 0, missingCoordinates: 0, samples: [] },
    duplicates: { duplicateRows: 0, districtNameVariantsMerged: 0, samples: [] },
    missingRelationships: { curatedCityDistrictsNotFound: [], curatedCityStateUnknown: [], districtsWithoutCity: 0 },
  };
  const note = (arr, v) => { if (arr.length < 20) arr.push(v); };

  const records = new Map();
  const add = (rec) => records.set(rec.id, rec);

  add({ id: COUNTRY.id, type: 'country', name: COUNTRY.name, altNames: COUNTRY.altNames, parentId: null, stateId: null, districtId: null, cityId: null, code: COUNTRY.code, pincode: '', officeType: '' });
  STATES.forEach((s) => add({
    id: s.id, type: 'state', name: s.name, altNames: s.altNames, parentId: COUNTRY.id, stateId: s.id, districtId: null, cityId: null,
    code: s.code, pincode: '', officeType: '', kind: s.kind,
  }));

  const districts = new Map();
  const districtNameVariants = new Map();
  const seenOffices = new Set();
  const pinStats = new Map();
  const offices = [];

  for (const r of rawRows) {
    const pin = String(r.Pincode || '').trim();
    if (!/^[1-9]\d{5}$/.test(pin)) { report.validation.invalidPincode += 1; note(report.validation.samples, { reason: 'invalid_pincode', pin }); continue; }
    if (!r.OfficeName || !r.District || !r.StateName) { report.validation.missingFields += 1; continue; }
    const state = resolveState(r.StateName);
    if (!state) { report.validation.unknownState += 1; note(report.validation.samples, { reason: 'unknown_state', state: r.StateName }); continue; }
    const dKey = `${state.id}|${normalizeKey(r.District)}`;
    const dName = titleCase(r.District);
    if (!districts.has(dKey)) {
      districts.set(dKey, { id: `d-${state.code.slice(3).toLowerCase()}-${slug(r.District)}`, name: dName, state });
    }
    const variants = districtNameVariants.get(dKey) || new Set();
    variants.add(String(r.District).trim());
    districtNameVariants.set(dKey, variants);
    const district = districts.get(dKey);

    const office = cleanOffice(r.OfficeName);
    const oType = String(r.OfficeType || '').trim().toUpperCase();
    const dupKey = `${district.id}|${normalizeKey(office)}|${pin}|${oType}`;
    if (seenOffices.has(dupKey)) {
      report.duplicates.duplicateRows += 1;
      note(report.duplicates.samples, { office, pin, district: district.name });
      continue;
    }
    seenOffices.add(dupKey);

    const geo = parseCoords(String(r.Latitude || '').trim(), String(r.Longitude || '').trim());
    if (geo === 'out_of_bounds') report.validation.invalidCoordinates += 1;
    else if (!geo) report.validation.missingCoordinates += 1;

    const stat = pinStats.get(pin) || new Map();
    stat.set(district.id, (stat.get(district.id) || 0) + 1);
    pinStats.set(pin, stat);
    offices.push({ office, pin, oType, district, geo: geo && geo !== 'out_of_bounds' ? geo : undefined });
  }

  districts.forEach((d, key) => {
    if (districtNameVariants.get(key).size > 1) report.duplicates.districtNameVariantsMerged += districtNameVariants.get(key).size - 1;
    add({ id: d.id, type: 'district', name: d.name, altNames: [], parentId: d.state.id, stateId: d.state.id, districtId: d.id, cityId: null, code: '', pincode: '', officeType: '' });
  });

  // Curated cities: one record per (city, district) so every district→cities lookup is a simple parent query.
  const cityByDistrict = new Map();
  for (const c of curatedCities) {
    const state = resolveState(c.state);
    if (!state) { report.missingRelationships.curatedCityStateUnknown.push(c.name); continue; }
    for (const dn of c.districts) {
      const district = districts.get(`${state.id}|${normalizeKey(dn)}`);
      if (!district) { report.missingRelationships.curatedCityDistrictsNotFound.push({ city: c.name, district: dn }); continue; }
      const id = `c-${slug(c.name)}-${district.id.slice(2)}`;
      add({ id, type: 'city', name: c.name, altNames: c.altNames || [], parentId: district.id, stateId: state.id, districtId: district.id, cityId: id, code: '', pincode: '', officeType: '' });
      if (!cityByDistrict.has(district.id)) cityByDistrict.set(district.id, id);
    }
  }
  report.missingRelationships.districtsWithoutCity = districts.size - cityByDistrict.size;

  for (const o of offices) {
    const cityId = cityByDistrict.get(o.district.id) || null;
    const id = `l-${hashOf([o.district.id, normalizeKey(o.office), o.pin, o.oType])}`;
    add({
      id, type: 'locality', name: o.office, altNames: [], parentId: cityId || o.district.id, stateId: o.district.state.id,
      districtId: o.district.id, cityId, code: '', pincode: o.pin, officeType: o.oType, geo: o.geo,
    });
  }

  pinStats.forEach((stat, pin) => {
    const [districtId] = [...stat.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    const district = [...districts.values()].find((d) => d.id === districtId);
    add({
      id: `pin-${pin}`, type: 'postal_code', name: pin, altNames: [], parentId: districtId, stateId: district.state.id,
      districtId, cityId: cityByDistrict.get(districtId) || null, code: pin, pincode: pin, officeType: '',
    });
  });

  return { records: [...records.values()], report };
}

function loadBundled() {
  const text = fs.readFileSync(BUNDLED_CSV, 'utf8').replace(/^\uFEFF/, '');
  const curated = JSON.parse(fs.readFileSync(BUNDLED_CITIES, 'utf8'));
  return { rows: csvToObjects(text), cities: curated };
}

function csvToObjects(text) {
  const [header, ...body] = parseCsv(text);
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length) throw Object.assign(new Error(`CSV is missing required columns: ${missing.join(', ')}`), { status: 400 });
  return body.map((cols) => Object.fromEntries(header.map((h, i) => [h, cols[i] ?? ''])));
}

async function runImport(store, { rows, cities, csv, dataset = 'bundled', dryRun = false, actor = {}, source, datasetVersion } = {}) {
  if (running) throw Object.assign(new Error('An import is already running'), { status: 409 });
  running = true;
  const run = {
    id: `imp-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
    dataset, source: source || SOURCE, datasetVersion: datasetVersion || DATASET_VERSION, status: 'running', dryRun,
    actorId: actor.id || 'system', actorEmail: actor.email || 'system', startedAt: new Date(), finishedAt: null, report: {},
  };
  try {
    let inputRows = rows;
    let inputCities = cities;
    if (csv) inputRows = csvToObjects(csv);
    if (!inputRows) ({ rows: inputRows, cities: inputCities } = loadBundled());
    if (!inputCities) inputCities = fs.existsSync(BUNDLED_CITIES) ? JSON.parse(fs.readFileSync(BUNDLED_CITIES, 'utf8')) : [];

    const { records, report } = toRecords(inputRows, inputCities);
    const existing = await store.existingHashes();
    const stamp = { source: run.source, datasetVersion: run.datasetVersion };
    const summary = { inserted: 0, updated: 0, unchanged: 0, skippedManualEdits: 0 };
    const pending = [];
    const typeCounts = {};

    for (const rec of records) {
      typeCounts[rec.type] = (typeCounts[rec.type] || 0) + 1;
      const { geo, ...hashable } = rec;
      const contentHash = hashOf({ ...hashable, geo: geo ? geo.coordinates : null, v: run.datasetVersion });
      const prev = existing.get(rec.id);
      if (prev && prev.manual) { summary.skippedManualEdits += 1; continue; }
      if (prev && prev.hash === contentHash) { summary.unchanged += 1; continue; }
      if (prev) summary.updated += 1; else summary.inserted += 1;
      pending.push({ ...rec, ...stamp, nameLower: rec.name.toLowerCase(), contentHash, active: true, editedByAdmin: false });
    }

    if (!dryRun) {
      for (let i = 0; i < pending.length; i += BATCH) {
        await store.upsertMany(pending.slice(i, i + BATCH));
      }
    }
    run.status = dryRun ? 'dry_run' : 'completed';
    run.report = {
      importDate: new Date().toISOString(), source: run.source, datasetVersion: run.datasetVersion, dryRun,
      counts: typeCounts, summary, ...report,
      coverageNote: 'Localities are India Post post-office areas (HO/SO/BO) and PIN codes from the supplied dataset; this is not a claim of complete coverage of every locality in India. Cities come from a curated list.',
    };
  } catch (error) {
    run.status = 'failed';
    run.report = { error: error.message };
    run.finishedAt = new Date();
    await store.saveImport(run).catch(() => {});
    running = false;
    throw error;
  }
  run.finishedAt = new Date();
  await store.saveImport(run);
  running = false;
  return run;
}

module.exports = { runImport, parseCsv, toRecords, titleCase, SOURCE, DATASET_VERSION, BUNDLED_CSV };
