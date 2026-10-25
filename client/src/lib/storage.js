// Per-account browser storage. Every key is namespaced by the signed-in user's id so two people sharing a
// browser never see each other's saved quests, notes, chat, reminders or profile.

const PREFIX = 'sidequest';
let scope = 'guest';

export function setStorageScope(userId) {
  scope = userId ? `u:${String(userId).replace(/[^\w.-]/g, '_').slice(0, 64)}` : 'guest';
  return scope;
}
export const getStorageScope = () => scope;

/** 'sidequest-saved' → 'sidequest:u:123:saved'. Keys already outside the sidequest- namespace are scoped too. */
export function scopedKey(key) {
  const base = String(key).startsWith(`${PREFIX}-`) ? String(key).slice(PREFIX.length + 1) : String(key);
  return `${PREFIX}:${scope}:${base}`;
}

function backend() {
  try { return typeof window !== 'undefined' && window.localStorage ? window.localStorage : (typeof localStorage !== 'undefined' ? localStorage : null); } catch { return null; }
}

/**
 * Drop-in replacement for window.localStorage for app state.
 * Guests inherit any legacy un-namespaced value (from before accounts were scoped); signed-in users never do,
 * because that data cannot be attributed to them.
 */
export const scopedStorage = {
  getItem(key) {
    const store = backend(); if (!store) return null;
    const value = store.getItem(scopedKey(key));
    if (value !== null) return value;
    return scope === 'guest' ? store.getItem(key) : null;
  },
  setItem(key, value) { const store = backend(); if (store) store.setItem(scopedKey(key), String(value)); },
  removeItem(key) { const store = backend(); if (store) store.removeItem(scopedKey(key)); },
};
