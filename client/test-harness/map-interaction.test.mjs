// Browser tests for the quest map / detail panel, run against test-harness/index.html (built by build-harness.mjs).
// Run: node --test client/test-harness/map-interaction.test.mjs   (after `node client/test-harness/build-harness.mjs`)
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const PAGE = pathToFileURL(path.join(here, 'index.html')).href;

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

async function open(qs = '', contextOptions = { viewport: { width: 1280, height: 860 } }) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${PAGE}${qs}`);
  await page.waitForSelector('.map-canvas [data-quest-id]');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.map-viewport')).visibility === 'visible');
  return { page, context, errors };
}
const marker = (page, id) => page.locator(`.map-canvas [data-quest-id="${id}"]`);
const title = (page) => page.locator('.quest-panel.has-selection .panel-title');
const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

// Markers whose centre is on screen and is the topmost element there (i.e. really clickable).
const clickableIds = (page) => page.evaluate(() => {
  const vp = document.querySelector('.map-viewport').getBoundingClientRect();
  const panel = document.querySelector('.quest-panel.has-selection')?.getBoundingClientRect();
  return [...document.querySelectorAll('.map-canvas [data-quest-id]')].filter((el) => {
    const b = el.getBoundingClientRect(); const x = b.x + b.width / 2; const y = b.y + b.height / 2;
    if (x < vp.left + 8 || x > vp.right - 8 || y < vp.top + 8 || y > vp.bottom - 8) return false;
    if (panel && x > panel.left && x < panel.right && y > panel.top && y < panel.bottom) return false;
    const top = document.elementFromPoint(x, y);
    return top === el || el.contains(top);
  }).map((el) => el.getAttribute('data-quest-id'));
});

test('1+2. clicking Event A opens details; clicking Event B swaps the SAME panel without closing it', async () => {
  const { page, context, errors } = await open();
  await page.evaluate(() => {
    window.__removed = 0;
    new MutationObserver((muts) => muts.forEach((m) => m.removedNodes.forEach((n) => { if (n.nodeType === 1 && (n.matches?.('.quest-panel') || n.querySelector?.('.quest-panel'))) window.__removed += 1; }))).observe(document.body, { childList: true, subtree: true });
    window.__panel = document.querySelector('.quest-panel');
  });
  await marker(page, 'evt-00').click();
  await expect(title(page)).toHaveText('Quest 0 with a rather long title that must truncate gracefully');
  // Immediately click B — nothing was closed, nothing awaited.
  await marker(page, 'evt-01').click();
  await expect(title(page)).toHaveText(/^Quest 1 /);
  const state = await page.evaluate(() => ({ same: document.querySelector('.quest-panel') === window.__panel, removed: window.__removed, panels: document.querySelectorAll('.quest-panel').length, open: !!document.querySelector('.quest-panel.has-selection') }));
  assert.deepEqual(state, { same: true, removed: 0, panels: 1, open: true });
  assert.deepEqual(errors, []);
  await context.close();
});

test('3. repeated clicks and hover do not issue duplicate requests', async () => {
  const { page, context } = await open();
  const m = marker(page, 'evt-02');
  await m.hover(); await page.waitForTimeout(200); // hover prefetch
  await m.click(); await m.click(); await m.click({ clickCount: 2 });
  await settle(page);
  assert.equal(await page.evaluate(() => window.__requests.filter((r) => r.id === 'evt-02').length), 1);
  await context.close();
});

test('3b. requests for an event the user already left are aborted; hover prefetches are not', async () => {
  const { page, context } = await open();
  await marker(page, 'evt-00').click();
  await marker(page, 'evt-01').click();
  await settle(page);
  const r = await page.evaluate(() => window.__requests.map((q) => [q.id, q.aborted]));
  assert.deepEqual(r.find(([id]) => id === 'evt-00'), ['evt-00', true]);
  assert.deepEqual(r.find(([id]) => id === 'evt-01'), ['evt-01', false]);
  await context.close();
});

test('4. a failed detail request does not break the map or the panel, and the user can keep switching', async () => {
  const { page, context, errors } = await open();
  await marker(page, 'evt-00').click();
  await page.evaluate(() => window.__requests.find((r) => r.id === 'evt-00').reject('Server down'));
  await expect(page.locator('.quest-panel [role="alert"]')).toContainText('Couldn’t refresh');
  await expect(title(page)).toContainText('Quest 0');          // list data still shown
  assert.ok(await page.locator('.map-canvas [data-quest-id]').count() >= 16);
  await marker(page, 'evt-03').click();
  await expect(title(page)).toContainText('Quest 3');
  assert.deepEqual(errors, []);
  await context.close();
});

test('12. details stay with the right event when requests finish out of order', async () => {
  const { page, context } = await open();
  await marker(page, 'evt-04').hover(); await page.waitForTimeout(200);   // prefetch A (not aborted by later selection)
  await marker(page, 'evt-05').click();                                      // select B
  await page.evaluate(() => {
    window.__requests.find((r) => r.id === 'evt-05').resolve({ id: 'evt-05', description: 'B FULL' });
  });
  await expect(page.locator('.panel-desc')).toHaveText('B FULL');
  await page.evaluate(() => { window.__requests.find((r) => r.id === 'evt-04').resolve({ id: 'evt-04', description: 'A FULL' }); });
  await settle(page);
  await expect(page.locator('.panel-desc')).toHaveText('B FULL');            // late A must not overwrite B
  const before = await page.evaluate(() => window.__requests.length);
  await marker(page, 'evt-04').click();
  await expect(page.locator('.panel-desc')).toHaveText('A FULL');            // A was cached: instant, no new request
  assert.equal(await page.evaluate(() => window.__requests.length), before);
  await context.close();
});

test('5. selection stays consistent between map and list', async () => {
  const { page, context } = await open();
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await page.locator('[data-quest-id="evt-03"] .card-title-btn').click();
  await expect(title(page)).toContainText('Quest 3');
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await expect(marker(page, 'evt-03')).toHaveAttribute('aria-pressed', 'true');
  await expect(title(page)).toContainText('Quest 3');
  await marker(page, 'evt-06').click();
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await expect(page.locator('.event-card.is-selected')).toHaveCount(1);
  await expect(page.locator('.event-card.is-selected')).toHaveAttribute('data-quest-id', 'evt-06');
  await context.close();
});

test('6. filtering updates both views with the same collection; selection is cleared only if no longer eligible', async () => {
  const { page, context } = await open();
  await marker(page, 'evt-01').click();                                       // Technology
  await page.getByRole('button', { name: /Music Meadow/ }).click();           // Music only
  const markers = await page.locator('.map-canvas [data-quest-id]').count();
  assert.equal(markers, 2);                                                   // evt-00, evt-08
  assert.match(await page.getByTestId('count').textContent(), /^2 quests/);
  await expect(page.locator('.quest-panel.is-idle')).toHaveCount(1);          // Technology event no longer eligible → cleared
  await marker(page, 'evt-08').click();
  await page.getByRole('button', { name: /Whole map/ }).click();
  await expect(title(page)).toContainText('Quest 8');                         // still eligible → kept
  await page.getByRole('button', { name: /Music Meadow/ }).click();
  await expect(title(page)).toContainText('Quest 8');
  await page.getByRole('button', { name: 'List', exact: true }).click();
  assert.equal(await page.locator('.event-card').count(), markers);
  await context.close();
});

test('7. exactly the selected marker is highlighted', async () => {
  const { page, context } = await open();
  await marker(page, 'evt-02').click();
  const pressed = await page.evaluate(() => [...document.querySelectorAll('.map-canvas [aria-pressed="true"]')].map((e) => [e.dataset.questId, e.classList.contains('is-selected')]));
  assert.deepEqual(pressed, [['evt-02', true]]);
  await marker(page, 'evt-05').click();
  const pressed2 = await page.evaluate(() => [...document.querySelectorAll('.map-canvas [aria-pressed="true"]')].map((e) => e.dataset.questId));
  assert.deepEqual(pressed2, ['evt-05']);
  await context.close();
});

test('8. selecting visible events does not change map zoom or pan', async () => {
  const { page, context } = await open();
  await page.getByRole('button', { name: 'Zoom in' }).click(); await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.waitForTimeout(800);
  const cam = () => page.getByTestId('map-canvas').evaluate((el) => [el.dataset.zoom, el.dataset.pan]);
  const before = await cam();
  const ids = await clickableIds(page);
  assert.ok(ids.length >= 2, `need two visible markers, got ${ids.length}`);
  await marker(page, ids[0]).click(); await marker(page, ids[1]).click();
  await page.waitForTimeout(800);
  assert.deepEqual(await cam(), before);
  await context.close();
});

test('9. keyboard users can select events and switch between them without losing focus', async () => {
  const { page, context } = await open();
  await marker(page, 'evt-00').focus();
  await page.keyboard.press('Enter');
  await expect(title(page)).toContainText('Quest 0');
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.questId), 'evt-00', 'focus stays on the marker');
  await marker(page, 'evt-01').focus();
  await page.keyboard.press('Space');
  await expect(title(page)).toContainText('Quest 1');
  // viewport shortcuts: ] / [ step through quests, Escape is the optional close
  await page.locator('.map-viewport').focus();
  await page.keyboard.press(']');
  const t1 = await title(page).textContent();
  await page.keyboard.press(']');
  const t2 = await title(page).textContent();
  assert.notEqual(t1, t2);
  await page.keyboard.press('[');
  assert.equal(await title(page).textContent(), t1);
  assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('map-viewport')), true);
  await page.keyboard.press('Escape');
  await expect(page.locator('.quest-panel.is-idle')).toHaveCount(1);
  await context.close();
});

test('10. a dense cluster stays usable: every event placed, cards never overlap, markers are clickable', async () => {
  const { page, context } = await open('?dense=40');
  const total = await page.locator('.map-canvas [data-quest-id]').count();
  assert.equal(total, 56);
  const overlap = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll('.quest-paper')].map((e) => e.getBoundingClientRect());
    let n = 0;
    for (let i = 0; i < boxes.length; i += 1) for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i]; const b = boxes[j];
      if (a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2) n += 1;
    }
    return { cards: boxes.length, overlapping: n, pins: document.querySelectorAll('.quest-pin').length };
  });
  console.log('   dense cluster:', JSON.stringify(overlap));
  assert.equal(overlap.overlapping, 0);
  assert.ok(overlap.pins > 0);
  const clickable = await clickableIds(page);
  console.log(`   clickable at default view: ${clickable.length}/${total}`);
  assert.ok(clickable.length / total >= 0.9, `only ${clickable.length}/${total} markers are directly clickable`);
  // a pin can be selected like any other marker
  const pin = await page.locator('.quest-pin').first().getAttribute('data-quest-id');
  await marker(page, pin).click({ force: false });
  await expect(page.locator('.quest-panel.has-selection')).toHaveCount(1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await context.close();
});

test('11. mobile: details open as a bottom sheet, switching swaps its content, Back closes it, no horizontal overflow', async () => {
  const { page, context } = await open('', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const ids = await clickableIds(page);
  assert.ok(ids.length >= 2, `visible markers on mobile: ${ids.length}`);
  await page.evaluate(() => { window.__panel = document.querySelector('.quest-panel'); });
  await marker(page, ids[0]).tap();
  const sheet = page.locator('.quest-panel.has-selection');
  await expect(sheet).toBeVisible();
  const box = await sheet.boundingBox();
  assert.ok(box.y + box.height <= 844 && box.x >= 0 && box.x + box.width <= 390, JSON.stringify(box));
  assert.equal(await sheet.evaluate((e) => getComputedStyle(e).position), 'fixed');
  // It is a BOTTOM sheet: it hugs the bottom and leaves the upper part of the screen (and the map) usable.
  assert.ok(box.y >= 844 * 0.4, `sheet starts too high (y=${box.y}); it must not cover most of the map`);
  assert.ok(box.y + box.height >= 844 - 140, `sheet is not anchored to the bottom (bottom=${box.y + box.height})`);
  await expect(page.getByRole('button', { name: 'Back to the map' })).toBeVisible();
  const first = await title(page).textContent();
  const visibleNow = (await clickableIds(page)).filter((id) => id !== ids[0]);
  assert.ok(visibleNow.length >= 1, 'another marker must stay reachable above the sheet');
  await marker(page, visibleNow[0]).tap();
  await expect.poll(() => title(page).textContent()).not.toBe(first);
  assert.equal(await page.evaluate(() => document.querySelector('.quest-panel') === window.__panel), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.getByRole('button', { name: 'Back to the map' }).tap();
  await expect(page.locator('.quest-panel.is-idle')).toHaveCount(1);
  await context.close();
});

test('perf (measured): click → updated details, with details already loaded vs still loading', async () => {
  const { page, context } = await open('?auto=1');
  const ids = ['evt-00', 'evt-01', 'evt-02', 'evt-03', 'evt-04', 'evt-05'];
  const samples = [];
  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i];
    const ms = await page.evaluate((qid) => new Promise((resolve) => {
      const el = document.querySelector(`.map-canvas [data-quest-id="${qid}"]`);
      const t0 = performance.now();
      const obs = new MutationObserver(() => {
        const t = document.querySelector('.panel-title');
        if (t && el.getAttribute('aria-label').startsWith(t.textContent)) { obs.disconnect(); requestAnimationFrame(() => resolve(performance.now() - t0)); }
      });
      obs.observe(document.body, { childList: true, subtree: true, characterData: true });
      el.click();
    }), id);
    samples.push(ms);
  }
  samples.sort((a, b) => a - b);
  console.log(`   click → details painted (ms), n=${samples.length}: ${samples.map((n) => n.toFixed(1)).join(', ')}  median=${samples[Math.floor(samples.length / 2)].toFixed(1)}`);
  assert.ok(samples[samples.length - 1] < 250, 'selection must not wait for network');
  await context.close();
});

function expect(locator) { return {
  toHaveText: async (v) => { const t = locator; await t.waitFor(); await pollEq(async () => (await t.textContent()).trim(), v); },
  toContainText: async (v) => pollEq(async () => (await locator.first().textContent()) ?? '', v, true),
  toHaveCount: async (n) => pollEq(async () => locator.count(), n),
  toHaveAttribute: async (a, v) => pollEq(async () => locator.first().getAttribute(a), v),
  toBeVisible: async () => pollEq(async () => locator.first().isVisible(), true),
}; }
async function pollEq(get, expected, contains = false) {
  const end = Date.now() + 4000; let last;
  while (Date.now() < end) {
    try { last = await get(); } catch { last = undefined; }
    const ok = expected instanceof RegExp ? expected.test(String(last)) : contains ? String(last).includes(String(expected)) : last === expected;
    if (ok) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  assert.fail(`expected ${expected} but got ${last}`);
}
expect.poll = (get) => ({ not: { toBe: async (v) => { const end = Date.now() + 4000; let last; while (Date.now() < end) { last = await get(); if (last !== v) return; await new Promise((r) => setTimeout(r, 25)); } assert.fail(`still ${v}`); } } });
