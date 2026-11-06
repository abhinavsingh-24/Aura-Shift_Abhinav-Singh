// Storage adapter for geographic master data. Uses MongoDB when connected and
// falls back to an in-memory store (development without a database, tests).
const { GeoLocationModel, GeoImportModel } = require('../db');

const EARTH_KM = 6371;
const toRad = (d) => (d * Math.PI) / 180;
function haversineKm(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(a));
}

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const stripDoc = (doc) => {
  if (!doc) return doc;
  const { _id, __v, geo, contentHash, ...rest } = doc;
  return rest;
};

function createGeoStore({ isMongoReady }) {
  const mem = { docs: new Map(), imports: [] };
  const useMongo = () => Boolean(isMongoReady && isMongoReady());

  const FIELD_KEYS = ['type', 'stateId', 'districtId', 'cityId', 'pincode', 'active', 'parentId'];

  function memMatches(doc, f) {
    for (const key of FIELD_KEYS) if (f[key] !== undefined && doc[key] !== f[key]) return false;
    if (f.prefix && !doc.nameLower.startsWith(f.prefix)) return false;
    if (f.contains && !doc.nameLower.includes(f.contains) && !(doc.altNames || []).some((a) => a.toLowerCase().includes(f.contains))) return false;
    if (f.ids && !f.ids.includes(doc.id)) return false;
    return true;
  }

  function mongoFilter(f) {
    const q = {};
    for (const key of FIELD_KEYS) if (f[key] !== undefined) q[key] = f[key];
    if (f.prefix) q.nameLower = new RegExp(`^${escapeRegex(f.prefix)}`);
    else if (f.contains) {
      const rx = new RegExp(escapeRegex(f.contains));
      q.$or = [{ nameLower: rx }, { altNames: new RegExp(escapeRegex(f.contains), 'i') }];
    }
    if (f.ids) q.id = { $in: f.ids };
    return q;
  }

  const store = {
    mode: () => (useMongo() ? 'mongodb' : 'memory'),

    async find(filter = {}, { skip = 0, limit = 50, sort = 'name' } = {}) {
      if (useMongo()) {
        const sortSpec = sort === 'pincode' ? { pincode: 1, nameLower: 1 } : { nameLower: 1 };
        const docs = await GeoLocationModel.find(mongoFilter(filter)).sort(sortSpec).skip(skip).limit(limit).lean();
        return docs.map(stripDoc);
      }
      const all = [...mem.docs.values()].filter((d) => memMatches(d, filter));
      all.sort((a, b) =>
        sort === 'pincode'
          ? a.pincode.localeCompare(b.pincode) || a.nameLower.localeCompare(b.nameLower)
          : a.nameLower.localeCompare(b.nameLower),
      );
      return all.slice(skip, skip + limit).map(stripDoc);
    },

    async count(filter = {}) {
      if (useMongo()) return GeoLocationModel.countDocuments(mongoFilter(filter));
      let n = 0;
      for (const d of mem.docs.values()) if (memMatches(d, filter)) n += 1;
      return n;
    },

    async findById(id) {
      if (useMongo()) return stripDoc(await GeoLocationModel.findOne({ id }).lean());
      return stripDoc(mem.docs.get(id) || null);
    },

    async countByType() {
      const out = { country: 0, state: 0, district: 0, city: 0, locality: 0, postal_code: 0 };
      if (useMongo()) {
        const rows = await GeoLocationModel.aggregate([{ $group: { _id: '$type', n: { $sum: 1 } } }]);
        rows.forEach((r) => { out[r._id] = r.n; });
      } else {
        for (const d of mem.docs.values()) out[d.type] += 1;
      }
      return out;
    },

    // Returns Map(id -> {hash, manual}) so importers can skip unchanged records.
    async existingHashes() {
      const map = new Map();
      if (useMongo()) {
        const cursor = GeoLocationModel.find({}, { id: 1, contentHash: 1, editedByAdmin: 1 }).lean().cursor();
        for await (const d of cursor) map.set(d.id, { hash: d.contentHash, manual: Boolean(d.editedByAdmin) });
      } else {
        for (const d of mem.docs.values()) map.set(d.id, { hash: d.contentHash, manual: Boolean(d.editedByAdmin) });
      }
      return map;
    },

    async upsertMany(docs, { now = new Date() } = {}) {
      if (!docs.length) return;
      if (useMongo()) {
        const ops = docs.map((doc) => {
          const { createdAt, ...rest } = doc;
          return {
            updateOne: {
              filter: { id: doc.id },
              update: { $set: { ...rest, updatedAt: now }, $setOnInsert: { createdAt: now } },
              upsert: true,
            },
          };
        });
        await GeoLocationModel.bulkWrite(ops, { ordered: false });
        return;
      }
      docs.forEach((doc) => {
        const prev = mem.docs.get(doc.id);
        mem.docs.set(doc.id, { ...(prev || {}), ...doc, createdAt: prev ? prev.createdAt : now, updatedAt: now });
      });
    },

    async update(id, patch) {
      const now = new Date();
      if (useMongo()) {
        return stripDoc(await GeoLocationModel.findOneAndUpdate({ id }, { $set: { ...patch, updatedAt: now } }, { new: true }).lean());
      }
      const prev = mem.docs.get(id);
      if (!prev) return null;
      const next = { ...prev, ...patch, updatedAt: now };
      mem.docs.set(id, next);
      return stripDoc(next);
    },

    // Applies the patch to every descendant (used for activate/deactivate cascades).
    async updateDescendants(record, patch) {
      const key = { state: 'stateId', district: 'districtId', city: 'cityId' }[record.type];
      if (!key) return 0;
      const now = new Date();
      if (useMongo()) {
        const res = await GeoLocationModel.updateMany({ [key]: record.id, id: { $ne: record.id } }, { $set: { ...patch, updatedAt: now } });
        return res.modifiedCount;
      }
      let n = 0;
      for (const [id, d] of mem.docs) {
        if (d[key] === record.id && d.id !== record.id) { mem.docs.set(id, { ...d, ...patch, updatedAt: now }); n += 1; }
      }
      return n;
    },

    async nearestLocality(lat, lng, maxKm = 50) {
      if (useMongo()) {
        const docs = await GeoLocationModel.find({
          type: 'locality',
          active: true,
          geo: { $near: { $geometry: { type: 'Point', coordinates: [lng, lat] }, $maxDistance: maxKm * 1000 } },
        }).limit(1).lean();
        return docs[0] ? stripDoc(docs[0]) : null;
      }
      let best = null;
      let bestKm = Infinity;
      for (const d of mem.docs.values()) {
        if (d.type !== 'locality' || !d.active || !d.geo) continue;
        const km = haversineKm(lat, lng, d.geo.coordinates[1], d.geo.coordinates[0]);
        if (km < bestKm) { bestKm = km; best = d; }
      }
      return best && bestKm <= maxKm ? stripDoc(best) : null;
    },

    async saveImport(run) {
      const doc = {
        id: run.id, dataset: run.dataset, source: run.source, datasetVersion: run.datasetVersion, status: run.status,
        dryRun: run.dryRun, actorId: run.actorId, actorEmail: run.actorEmail, startedAt: run.startedAt,
        finishedAt: run.finishedAt, report: run.report,
      };
      if (useMongo()) {
        await GeoImportModel.updateOne({ id: run.id }, { $set: doc }, { upsert: true });
        return;
      }
      const idx = mem.imports.findIndex((r) => r.id === run.id);
      if (idx >= 0) mem.imports[idx] = doc; else mem.imports.unshift(doc);
    },

    async listImports(limit = 25) {
      if (useMongo()) return (await GeoImportModel.find({}).sort({ startedAt: -1 }).limit(limit).lean()).map(({ _id, __v, ...r }) => r);
      return mem.imports.slice(0, limit);
    },

    async getImport(id) {
      if (useMongo()) {
        const r = await GeoImportModel.findOne({ id }).lean();
        if (!r) return null;
        const { _id, __v, ...rest } = r;
        return rest;
      }
      return mem.imports.find((r) => r.id === id) || null;
    },

    async findDuplicateGroups(limit = 50) {
      const groups = [];
      if (useMongo()) {
        const rows = await GeoLocationModel.aggregate([
          { $match: { type: { $in: ['district', 'city'] } } },
          { $group: { _id: { type: '$type', parent: '$parentId', name: '$nameLower' }, ids: { $push: '$id' }, n: { $sum: 1 } } },
          { $match: { n: { $gt: 1 } } },
          { $limit: limit },
        ]);
        rows.forEach((r) => groups.push({ type: r._id.type, parentId: r._id.parent, name: r._id.name, ids: r.ids }));
        return groups;
      }
      const seen = new Map();
      for (const d of mem.docs.values()) {
        if (d.type !== 'district' && d.type !== 'city') continue;
        const k = `${d.type}|${d.parentId}|${d.nameLower}`;
        seen.set(k, [...(seen.get(k) || []), d.id]);
      }
      for (const [k, ids] of seen) {
        if (ids.length > 1 && groups.length < limit) {
          const [type, parentId, name] = k.split('|');
          groups.push({ type, parentId, name, ids });
        }
      }
      return groups;
    },

    _memory: mem,
    async _reset() { mem.docs.clear(); mem.imports.length = 0; },
  };
  return store;
}

module.exports = { createGeoStore, haversineKm };
