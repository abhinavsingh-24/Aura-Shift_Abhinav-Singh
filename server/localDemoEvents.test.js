const test = require('node:test');
const assert = require('node:assert/strict');
const { nallasoparaDemoQuests } = require('./localDemoEvents');

test('Nallasopara demo quests are clearly marked synthetic and have map coordinates', () => {
  assert.equal(nallasoparaDemoQuests.length, 8);
  for (const quest of nallasoparaDemoQuests) {
    assert.equal(quest.city, 'Nallasopara');
    assert.equal(quest.state, 'Maharashtra');
    assert.equal(quest.isSampleData, true);
    assert.match(quest.description, /^DEMO QUEST/);
    assert.match(quest.terms, /not actually scheduled/i);
    assert.ok(Number.isFinite(quest.latitude) && Math.abs(quest.latitude) <= 90);
    assert.ok(Number.isFinite(quest.longitude) && Math.abs(quest.longitude) <= 180);
  }
});

test('Nallasopara demo quests have future dates and useful discovery metadata', () => {
  const now = new Date();
  for (const quest of nallasoparaDemoQuests) {
    assert.ok(new Date(`${quest.date}T${quest.startTime}:00`) > now);
    assert.ok(quest.description.length > 100);
    assert.ok(quest.tags.length >= 2);
    assert.ok(quest.capacity > 0);
    assert.ok(quest.ticketTiers.length > 0);
  }
});
