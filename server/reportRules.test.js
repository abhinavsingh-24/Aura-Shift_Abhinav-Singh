const test = require('node:test');
const assert = require('node:assert/strict');
const { validateReportDraft } = require('./reportRules');

test('valid report drafts are trimmed and normalized', () => {
  const result = validateReportDraft({ targetType: 'event', targetId: ' evt-1 ', reason: 'unsafe', details: '  Loose cables near the stage.  ' });
  assert.equal(result.isValid, true);
  assert.deepEqual(result.value, { targetType: 'event', targetId: 'evt-1', reason: 'unsafe', details: 'Loose cables near the stage.' });
});

test('report draft rejects unsupported target and reason', () => {
  const result = validateReportDraft({ targetType: 'user-account', targetId: '1', reason: 'ban-them' });
  assert.equal(result.isValid, false);
  assert.equal(result.errors.length, 2);
});

test('report details have a 1000 character limit', () => {
  const result = validateReportDraft({ targetType: 'event', targetId: '1', reason: 'other', details: 'x'.repeat(1001) });
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((error) => error.includes('1,000 characters')));
});

test('report target ids cannot be empty or overlong', () => {
  assert.equal(validateReportDraft({ targetType: 'event', targetId: ' ', reason: 'spam' }).isValid, false);
  assert.equal(validateReportDraft({ targetType: 'event', targetId: 'x'.repeat(161), reason: 'spam' }).isValid, false);
});
