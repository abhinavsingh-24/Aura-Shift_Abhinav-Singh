const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validatePartyDraft,
  validatePartyMessage,
  listParties,
  createParty,
  getPartyDetails,
  joinParty,
  leaveParty,
  updateMembershipStatus,
  listPartyMessages,
  sendPartyMessage,
} = require('./parties');

test('validatePartyDraft requires title, valid capacity and eventId', () => {
  const bad = validatePartyDraft({});
  assert.equal(bad.isValid, false);
  assert.ok(bad.errors.some((e) => e.includes('Title')));
  assert.ok(bad.errors.some((e) => e.includes('event ID')));

  const good = validatePartyDraft({
    title: 'Weekend Trekking Squad',
    description: 'Looking for 4 people to join for the Saturday morning trek.',
    visibility: 'public',
    capacity: 6,
    eventId: 'evt-101',
  });
  assert.equal(good.isValid, true);
  assert.equal(good.data.title, 'Weekend Trekking Squad');
  assert.equal(good.data.capacity, 6);
  assert.equal(good.data.visibility, 'public');
});

test('Party workflow: create, list, join public, full capacity, leave, access control', async () => {
  const inMemoryState = {
    parties: [],
    partyMemberships: [],
    partyMessages: [],
  };

  const owner = { id: 'usr-1', name: 'Rohan Sharma', email: 'rohan@example.com' };
  const member2 = { id: 'usr-2', name: 'Pooja Iyer', email: 'pooja@example.com' };
  const member3 = { id: 'usr-3', name: 'Vikram Mehta', email: 'vikram@example.com' };
  const outsider = { id: 'usr-4', name: 'Anonymous Outsider', email: 'anon@example.com' };

  const event = { id: 'evt-trek', title: 'Nandi Hills Sunrise Walk', city: 'Bengaluru' };

  // 1. Create a party with capacity 2
  const created = await createParty({
    owner,
    event,
    data: {
      title: 'Sunrise Walk Group',
      description: 'Meet at the north gate at 5:30 AM',
      visibility: 'public',
      capacity: 2,
    },
    mongoReady: false,
    inMemoryState,
  });

  assert.ok(created.party.id.startsWith('party-'));
  assert.equal(created.party.memberCount, 1);
  assert.equal(created.membership.role, 'leader');
  assert.equal(created.membership.status, 'joined');

  const partyId = created.party.id;

  // 2. Member 2 joins public party -> status is immediately 'joined'
  const join2 = await joinParty({
    partyId,
    user: member2,
    mongoReady: false,
    inMemoryState,
  });
  assert.equal(join2.status, 'joined');

  // 3. Member 3 tries to join -> capacity is 2, so should throw
  await assert.rejects(
    async () => {
      await joinParty({
        partyId,
        user: member3,
        mongoReady: false,
        inMemoryState,
      });
    },
    /reached full capacity/,
  );

  // 4. Outsider tries to read messages -> rejected with 403
  await assert.rejects(
    async () => {
      await listPartyMessages({
        partyId,
        user: outsider,
        mongoReady: false,
        inMemoryState,
      });
    },
    (err) => err.status === 403,
  );

  // 5. Outsider tries to post message -> rejected with 403
  await assert.rejects(
    async () => {
      await sendPartyMessage({
        partyId,
        user: outsider,
        text: 'Can I crash your party?',
        mongoReady: false,
        inMemoryState,
      });
    },
    (err) => err.status === 403,
  );

  // 6. Confirmed member posts a message -> succeeds
  const msg1 = await sendPartyMessage({
    partyId,
    user: member2,
    text: 'Hey everyone, I will bring the snacks!',
    mongoReady: false,
    inMemoryState,
  });
  assert.equal(msg1.senderId, 'usr-2');
  assert.equal(msg1.text, 'Hey everyone, I will bring the snacks!');

  // 7. Leader reads messages -> receives the message
  const messages = await listPartyMessages({
    partyId,
    user: owner,
    mongoReady: false,
    inMemoryState,
  });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].text, 'Hey everyone, I will bring the snacks!');

  // 8. Member 2 leaves the party
  await leaveParty({
    partyId,
    user: member2,
    mongoReady: false,
    inMemoryState,
  });

  // Now member 2 is no longer active, so they cannot read messages anymore
  await assert.rejects(
    async () => {
      await listPartyMessages({
        partyId,
        user: member2,
        mongoReady: false,
        inMemoryState,
      });
    },
    (err) => err.status === 403,
  );

  // Now party has capacity again (1/2), so member 3 can join
  const join3 = await joinParty({
    partyId,
    user: member3,
    mongoReady: false,
    inMemoryState,
  });
  assert.equal(join3.status, 'joined');
});

test('Private party requires leader approval', async () => {
  const inMemoryState = {
    parties: [],
    partyMemberships: [],
    partyMessages: [],
  };

  const leader = { id: 'usr-lead', name: 'Leader User', email: 'lead@example.com' };
  const applicant = { id: 'usr-app', name: 'Applicant User', email: 'app@example.com' };
  const event = { id: 'evt-private', title: 'Exclusive Jam Session', city: 'Mumbai' };

  const { party } = await createParty({
    owner: leader,
    event,
    data: {
      title: 'Secret Jam',
      description: 'Invite only',
      visibility: 'private',
      capacity: 5,
    },
    mongoReady: false,
    inMemoryState,
  });

  // Applicant requests to join private party -> status is 'pending'
  const reqJoin = await joinParty({
    partyId: party.id,
    user: applicant,
    mongoReady: false,
    inMemoryState,
  });
  assert.equal(reqJoin.status, 'pending');

  // Pending user cannot read messages
  await assert.rejects(
    async () => {
      await listPartyMessages({
        partyId: party.id,
        user: applicant,
        mongoReady: false,
        inMemoryState,
      });
    },
    (err) => err.status === 403,
  );

  // Non-leader cannot approve members
  await assert.rejects(
    async () => {
      await updateMembershipStatus({
        partyId: party.id,
        leaderUser: applicant,
        memberId: reqJoin.id,
        newStatus: 'joined',
        mongoReady: false,
        inMemoryState,
      });
    },
    /Only the party leader/,
  );

  // Leader approves the request
  const approved = await updateMembershipStatus({
    partyId: party.id,
    leaderUser: leader,
    memberId: reqJoin.id,
    newStatus: 'joined',
    mongoReady: false,
    inMemoryState,
  });
  assert.equal(approved.status, 'joined');

  // Now approved applicant can send and read messages
  const msg = await sendPartyMessage({
    partyId: party.id,
    user: applicant,
    text: 'Thanks for accepting my request!',
    mongoReady: false,
    inMemoryState,
  });
  assert.equal(msg.senderId, 'usr-app');
});
