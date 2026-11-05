// Framework-free cache for quest details. One shared instance backs the detail panel, so:
//  - the same id is never requested twice while a request is in flight (dedupe),
//  - finished details are cached (instant on re-selection),
//  - hover/focus prefetch shares the same request the click would have made,
//  - requests nobody is waiting for any more are aborted,
//  - results always land under the id they were requested for, so out-of-order responses cannot
//    show the wrong event.
//
// `fetcher(id, { signal })` must resolve to the detailed event object (or { event }).

export function createQuestDetailStore(fetcher, { maxEntries = 100 } = {}) {
  const cache = new Map();      // id -> detail object
  const errors = new Map();     // id -> message
  const inflight = new Map();   // id -> { promise, controller, wanted }
  const listeners = new Set();
  let version = 0;

  const key = (id) => String(id);
  const emit = () => { version += 1; listeners.forEach((fn) => fn()); };

  function remember(id, detail) {
    cache.delete(id);
    cache.set(id, detail);
    if (cache.size > maxEntries) cache.delete(cache.keys().next().value);
  }

  function load(rawId, { prefetch = false } = {}) {
    const id = key(rawId);
    if (cache.has(id)) return Promise.resolve(cache.get(id));
    const existing = inflight.get(id);
    if (existing) {
      if (!prefetch) existing.wanted = true;
      return existing.promise;
    }
    const controller = new AbortController();
    const entry = { controller, wanted: !prefetch, promise: null };
    let started;
    try { started = Promise.resolve(fetcher(id, { signal: controller.signal })); } catch (err) { started = Promise.reject(err); }
    entry.promise = started
      .then((res) => {
        const detail = res && res.event ? res.event : res;
        remember(id, detail);
        errors.delete(id);
        return detail;
      })
      .catch((err) => {
        if (controller.signal.aborted) return null;
        errors.set(id, (err && err.message) || 'Could not load the latest details.');
        return null;
      })
      .finally(() => { if (inflight.get(id) === entry) inflight.delete(id); emit(); });
    inflight.set(id, entry);
    emit();
    return entry.promise;
  }

  return {
    /** Start (or join) a load for something the user is looking at. */
    select: (id) => load(id),
    /** Warm the cache for hover/focus. Never marks the request as wanted. */
    prefetch: (id) => { if (id != null) load(id, { prefetch: true }); },
    /** The user moved on: abort requests that were wanted for other events. Prefetches are left running. */
    abortObsolete(keepId) {
      const keep = keepId == null ? null : key(keepId);
      [...inflight.entries()].forEach(([id, entry]) => {
        if (id !== keep && entry.wanted) { entry.controller.abort(); inflight.delete(id); }
      });
      emit();
    },
    abort(id) {
      const entry = inflight.get(key(id));
      if (entry) { entry.controller.abort(); inflight.delete(key(id)); emit(); }
    },
    retry(id) { errors.delete(key(id)); return load(id); },
    get: (id) => cache.get(key(id)) || null,
    getError: (id) => errors.get(key(id)) || null,
    isLoading: (id) => inflight.has(key(id)),
    inflightCount: () => inflight.size,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    getVersion: () => version,
    invalidate(id) { if (id == null) cache.clear(); else cache.delete(key(id)); emit(); },
  };
}

/** Merge list data (instant) with fetched detail (richer). Fetched values win only when they are present. */
export function mergeQuest(base, detail) {
  if (!detail) return base;
  const out = { ...base };
  Object.entries(detail).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') out[k] = v; });
  return out;
}
