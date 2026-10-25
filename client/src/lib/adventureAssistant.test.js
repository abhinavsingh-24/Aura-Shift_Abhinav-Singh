import test from 'node:test';
import assert from 'node:assert/strict';
import { answerAdventureQuestion } from './adventureAssistant.js';

const now = new Date('2026-10-24T10:00:00');
const events = [
  { id: '1', title: 'Indie Music Night', category: 'Music', description: 'Live indie bands', date: '2026-10-25', city: 'Mumbai' },
  { id: '2', title: 'Beginner Coding Workshop', category: 'Technology', description: 'Learn JavaScript', date: '2026-10-26', city: 'Mumbai' },
  { id: '3', title: 'Old Art Walk', category: 'Art and culture', date: '2026-10-01', city: 'Mumbai' },
];

test('assistant ranks events matching the prompt', () => {
  const result = answerAdventureQuestion('I want live music', events, { now });
  assert.equal(result.events[0].id, '1');
  assert.equal(result.mode, 'recommendations');
});
test('assistant excludes past events', () => {
  const result = answerAdventureQuestion('show me something', events, { now });
  assert.ok(result.events.every((event) => event.id !== '3'));
});
test('assistant handles no matching future events', () => {
  const result = answerAdventureQuestion('today', [{ id: '1', title: 'Later event', date: '2026-10-25' }], { now });
  assert.equal(result.mode, 'no-results');
});
test('empty prompt asks for clarification', () => {
  assert.equal(answerAdventureQuestion('  ', events).mode, 'guide');
});
test('budget prompts include cost caveat', () => {
  const result = answerAdventureQuestion('find cheap events', events, { now });
  assert.match(result.text, /confirm costs/i);
});
