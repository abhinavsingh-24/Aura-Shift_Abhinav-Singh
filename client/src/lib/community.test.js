import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalReview, validateReviewDraft } from './community.js';

test('review validation requires a useful minimum and enforces maximum length', () => {
  assert.equal(validateReviewDraft('too short').valid, false);
  assert.equal(validateReviewDraft('This was a great community event!').valid, true);
  assert.equal(validateReviewDraft('x'.repeat(601)).valid, false);
});

test('local review trims text, clamps rating, and records author and date', () => {
  const now = new Date('2026-10-24T12:00:00.000Z');
  const review = createLocalReview({ rating: 9, story: '  Had a great time meeting new people.  ', tips: '  Arrive early  ', author: '  Alex  ', now });
  assert.equal(review.rating, 5);
  assert.equal(review.story, 'Had a great time meeting new people.');
  assert.equal(review.tips, 'Arrive early');
  assert.equal(review.author, 'Alex');
  assert.equal(review.createdAt, now.toISOString());
});

test('invalid review cannot be created', () => {
  assert.throws(() => createLocalReview({ story: 'short' }), /12 characters/);
});
