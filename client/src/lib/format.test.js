import test from 'node:test';
import assert from 'node:assert/strict';
import { formatShortDate, formatLongDateTime, categoryGlyph, CATEGORY_GLYPHS } from './format.js';

test('formatShortDate formats valid event dates and handles missing/invalid gracefully', () => {
  assert.equal(formatShortDate(null), 'Date TBD');
  assert.equal(formatShortDate({}), 'Date TBD');
  assert.equal(formatShortDate({ date: 'invalid-date' }), 'Date TBD');

  const formatted = formatShortDate({ date: '2026-04-15', startTime: '10:00' });
  assert.ok(formatted.includes('15') && (formatted.includes('Apr') || formatted.includes('04')));
});

test('formatLongDateTime formats full date time and handles edge cases', () => {
  assert.equal(formatLongDateTime(null), 'Date TBD');
  assert.equal(formatLongDateTime({ date: '' }), 'Date TBD');
  assert.equal(formatLongDateTime({ date: 'not-a-date' }), 'Date TBD');

  const formatted = formatLongDateTime({ date: '2026-04-15', startTime: '18:30' });
  assert.ok(formatted.includes('15'));
  assert.ok(formatted.includes('6:30') || formatted.includes('18:30'));
});

test('categoryGlyph maps known categories to adventure symbols and falls back to default', () => {
  assert.equal(categoryGlyph('Music'), '♫');
  assert.equal(categoryGlyph('Technology'), '⌘');
  assert.equal(categoryGlyph('Sports'), '↗');
  assert.equal(categoryGlyph('Art and culture'), '✳');
  assert.equal(categoryGlyph('Education'), '✎');
  assert.equal(categoryGlyph('Gaming'), '◇');
  assert.equal(categoryGlyph('Community activities'), '◎');
  assert.equal(categoryGlyph('Workshops'), '✂');
  assert.equal(categoryGlyph('Unknown'), '✦');
  assert.equal(categoryGlyph(null), '✦');
  assert.equal(Object.keys(CATEGORY_GLYPHS).length, 8);
});

