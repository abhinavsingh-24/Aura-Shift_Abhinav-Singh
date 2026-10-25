import test from 'node:test';
import assert from 'node:assert/strict';
import { ROUTES, GROUPS, resolveRoute, navFor, normalizePath, isClientNavigable, safeNextPath, documentTitle, siblingsOf } from './routes.js';

test('route ids and paths are unique and every route belongs to a known group', () => {
  assert.equal(new Set(ROUTES.map((r) => r.id)).size, ROUTES.length);
  assert.equal(new Set(ROUTES.map((r) => r.path)).size, ROUTES.length);
  for (const r of ROUTES) assert.ok(GROUPS[r.group], `${r.id} has unknown group ${r.group}`);
});

test('every known path resolves to itself, tolerating trailing slashes, queries and hashes', () => {
  for (const r of ROUTES) {
    assert.equal(resolveRoute(r.path).route.id, r.id);
    assert.equal(resolveRoute(`${r.path}/`).route.id, r.id);
    assert.equal(resolveRoute(`${r.path}?x=1#y`).route.id, r.id);
  }
});

test('unknown paths are "not-found", never the home page', () => {
  assert.equal(resolveRoute('/nope').route.id, 'not-found');
  assert.equal(resolveRoute('/quests/a/b').route.id, 'not-found');
  assert.equal(resolveRoute('/saved/extra').route.id, 'not-found');
});

test('quest detail extracts and decodes the id', () => {
  const r = resolveRoute('/quests/evt-2');
  assert.equal(r.route.id, 'quest-detail'); assert.equal(r.params.id, 'evt-2');
  assert.equal(resolveRoute('/quests/a%20b').params.id, 'a b');
  assert.equal(resolveRoute('/quests/%E0%A4%A').params.id, '%E0%A4%A', 'malformed escapes must not throw');
});

test('role- and auth-restricted routes only appear for eligible users', () => {
  const ids = (slot, user) => navFor(slot, user).map((r) => r.id);
  assert.ok(ids('primary-action', null).includes('publish'), 'guests still see the publish call-to-action (the page gates it)');
  assert.ok(!ids('account', null).includes('bookings'));
  assert.ok(ids('account', { role: 'explorer' }).includes('bookings'));
  assert.ok(!ids('account', { role: 'explorer' }).includes('organizer'));
  assert.ok(ids('account', { role: 'organizer' }).includes('organizer'));
});

test('the top bar stays small (the old header had 19 links)', () => {
  assert.ok(navFor('primary', null).length <= 5);
});

test('client router only handles same-origin app pages', () => {
  assert.equal(isClientNavigable('/quests'), true);
  assert.equal(isClientNavigable('/quests/evt-1?x=1#h'), true);
  assert.equal(isClientNavigable('https://example.com/x'), false);
  assert.equal(isClientNavigable('//evil.example/x'), false);
  assert.equal(isClientNavigable('mailto:a@b.c'), false);
  assert.equal(isClientNavigable('/api/events'), false);
  assert.equal(isClientNavigable('/brand/logo-primary.svg'), false);
  assert.equal(isClientNavigable(''), false);
});

test('post-login redirect only allows same-site paths (no open redirect)', () => {
  assert.equal(safeNextPath('/saved'), '/saved');
  assert.equal(safeNextPath('//evil.com'), '/');
  assert.equal(safeNextPath('https://evil.com'), '/');
  assert.equal(safeNextPath('/\\evil.com'), '/');
  assert.equal(safeNextPath(null), '/');
});

test('titles and sibling lookups', () => {
  assert.match(documentTitle(resolveRoute('/saved').route), /Saved Quests · SIDEQUEST/);
  assert.match(documentTitle(resolveRoute('/zzz').route), /Page not found/);
  assert.deepEqual(siblingsOf('journal').map((r) => r.id).sort(), ['achievements', 'bookings', 'levels', 'profile']);
});
