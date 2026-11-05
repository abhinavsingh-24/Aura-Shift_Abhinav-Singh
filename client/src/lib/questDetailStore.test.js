import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuestDetailStore, mergeQuest } from './questDetailStore.js';

const deferred = () => { let resolve; let reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; };

test('repeated selection of the same event issues one request', async () => {
  let calls = 0;
  const d = deferred();
  const store = createQuestDetailStore(() => { calls += 1; return d.promise; });
  store.select('a'); store.select('a'); store.prefetch('a'); store.select('a');
  await Promise.resolve();
  assert.equal(calls, 1);
  d.resolve({ id: 'a', description: 'full' });
  await d.promise; await new Promise((r) => setTimeout(r, 0));
  store.select('a');
  assert.equal(calls, 1, 'cached after completion');
  assert.equal(store.get('a').description, 'full');
});

test('hover prefetch and the following click share one request', async () => {
  let calls = 0;
  const store = createQuestDetailStore(async (id) => { calls += 1; return { id }; });
  store.prefetch('x');
  await store.select('x');
  assert.equal(calls, 1);
  assert.equal(store.get('x').id, 'x');
});

test('out-of-order responses stay attached to the event that was requested', async () => {
  const gates = { a: deferred(), b: deferred() };
  const store = createQuestDetailStore((id) => gates[id].promise);
  store.select('a'); store.select('b');
  gates.b.resolve({ id: 'b', title: 'B full' });
  await new Promise((r) => setTimeout(r, 0));
  gates.a.resolve({ id: 'a', title: 'A full' });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(store.get('a').title, 'A full');
  assert.equal(store.get('b').title, 'B full');
});

test('a failed request is reported for that id only, does not throw, and can be retried', async () => {
  let fail = true;
  const store = createQuestDetailStore(async (id) => { if (fail && id === 'bad') throw new Error('boom'); return { id }; });
  await store.select('bad');
  await store.select('good');
  assert.equal(store.getError('bad'), 'boom');
  assert.equal(store.getError('good'), null);
  assert.equal(store.get('good').id, 'good');
  fail = false;
  await store.retry('bad');
  assert.equal(store.getError('bad'), null);
  assert.equal(store.get('bad').id, 'bad');
});

test('abort cancels the in-flight request and records no error', async () => {
  let aborted = false;
  const store = createQuestDetailStore((id, { signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); });
  }));
  store.select('slow');
  store.abort('slow');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(aborted, true);
  assert.equal(store.getError('slow'), null);
  assert.equal(store.inflightCount(), 0);
});

test('subscribers are notified when loading starts and finishes', async () => {
  const store = createQuestDetailStore(async (id) => ({ id }));
  let n = 0;
  store.subscribe(() => { n += 1; });
  await store.select('q');
  assert.ok(n >= 2);
});

test('mergeQuest keeps instant list data and overlays richer detail', () => {
  const base = { id: 1, title: 'T', description: 'short', venue: 'V' };
  const merged = mergeQuest(base, { description: 'long', capacity: 50, venue: '' });
  assert.deepEqual(merged, { id: 1, title: 'T', description: 'long', venue: 'V', capacity: 50 });
  assert.equal(mergeQuest(base, null), base);
});

test('abortObsolete cancels requests for events the user left, but keeps the current one and prefetches', async () => {
  const signals = {};
  const store = createQuestDetailStore((id, { signal }) => { signals[id] = signal; return new Promise(() => {}); });
  store.select('old'); store.select('current'); store.prefetch('hover');
  store.abortObsolete('current');
  assert.equal(signals.old.aborted, true);
  assert.equal(signals.current.aborted, false);
  assert.equal(signals.hover.aborted, false);
});
