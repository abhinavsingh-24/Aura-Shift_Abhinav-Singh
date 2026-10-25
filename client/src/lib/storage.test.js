import test from 'node:test';
import assert from 'node:assert/strict';

function installFakeStorage() {
  const data = new Map();
  globalThis.localStorage = { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k) };
  return data;
}
const load = async () => { installFakeStorage(); return import(`./storage.js?${Math.random()}`); };

test('different accounts on one browser do not see each other\'s data', async () => {
  const { setStorageScope, scopedStorage } = await load();
  setStorageScope('alice'); scopedStorage.setItem('sidequest-saved', '["evt-1"]');
  setStorageScope('bob'); assert.equal(scopedStorage.getItem('sidequest-saved'), null);
  scopedStorage.setItem('sidequest-saved', '["evt-9"]');
  setStorageScope('alice'); assert.equal(scopedStorage.getItem('sidequest-saved'), '["evt-1"]');
});

test('guest and signed-in scopes are separate', async () => {
  const { setStorageScope, scopedStorage } = await load();
  setStorageScope(null); scopedStorage.setItem('sidequest-profile', 'guest-data');
  setStorageScope('alice'); assert.equal(scopedStorage.getItem('sidequest-profile'), null);
});

test('legacy un-namespaced data is only inherited by guests, never by a signed-in user', async () => {
  const { setStorageScope, scopedStorage } = await load();
  globalThis.localStorage.setItem('sidequest-saved', '["old"]');
  setStorageScope(null); assert.equal(scopedStorage.getItem('sidequest-saved'), '["old"]');
  setStorageScope('alice'); assert.equal(scopedStorage.getItem('sidequest-saved'), null);
});

test('hostile or odd user ids cannot escape their namespace', async () => {
  const { setStorageScope, scopedKey } = await load();
  const scope = setStorageScope('../../x:y z/<script>');
  assert.match(scope, /^u:[\w.-]+$/);
  assert.ok(scopedKey('sidequest-saved').startsWith('sidequest:u:'));
});

test('storage failures never throw', async () => {
  const { scopedStorage } = await load();
  delete globalThis.localStorage;
  assert.equal(scopedStorage.getItem('sidequest-saved'), null);
  assert.doesNotThrow(() => scopedStorage.setItem('sidequest-saved', 'x'));
});
