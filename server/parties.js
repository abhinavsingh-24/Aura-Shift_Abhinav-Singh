const crypto = require('crypto');

function validatePartyDraft({ title, description, visibility, capacity, eventId }) {
  const errors = [];
  const cleanTitle = String(title || '').trim();
  if (!cleanTitle || cleanTitle.length < 3) errors.push('Title must be at least 3 characters.');
  if (cleanTitle.length > 120) errors.push('Title must be 120 characters or fewer.');

  const cleanDesc = String(description || '').trim();
  if (cleanDesc.length > 500) errors.push('Description must be 500 characters or fewer.');

  const validVisibility = ['public', 'private'].includes(visibility) ? visibility : 'public';

  const numCapacity = Number(capacity);
  const cleanCapacity = Number.isInteger(numCapacity) && numCapacity >= 2 && numCapacity <= 100 ? numCapacity : 10;

  if (!eventId || typeof eventId !== 'string') errors.push('Linked quest/event ID is required.');

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      title: cleanTitle,
      description: cleanDesc,
      visibility: validVisibility,
      capacity: cleanCapacity,
      eventId: String(eventId).trim(),
    },
  };
}

function validatePartyMessage({ text }) {
  const errors = [];
  const cleanText = String(text || '').trim();
  if (!cleanText) errors.push('Message cannot be empty.');
  if (cleanText.length > 500) errors.push('Message must be 500 characters or fewer.');
  return { isValid: errors.length === 0, errors, text: cleanText };
}

async function listParties({ eventId, city, currentUser, mongoReady, PartyModel, PartyMembershipModel, inMemoryState }) {
  let partyList = [];
  if (mongoReady) {
    const query = {};
    if (eventId) query.eventId = eventId;
    if (city) query.eventCity = city;
    partyList = await PartyModel.find(query).sort({ createdAt: -1 }).lean();
  } else {
    partyList = (inMemoryState.parties || []).filter((p) => {
      if (eventId && p.eventId !== eventId) return false;
      if (city && p.eventCity !== city) return false;
      return true;
    });
  }

  // Fetch memberships to calculate active member counts and user's membership
  const results = [];
  for (const party of partyList) {
    let memberships = [];
    if (mongoReady) {
      memberships = await PartyMembershipModel.find({ partyId: party.id }).lean();
    } else {
      memberships = (inMemoryState.partyMemberships || []).filter((m) => m.partyId === party.id);
    }

    const activeMembers = memberships.filter((m) => m.status === 'joined');
    const myMembership = currentUser
      ? memberships.find((m) => String(m.userId) === String(currentUser.id)) || null
      : null;

    // Visibility filter: private parties are only listed for members or if public
    if (party.visibility === 'private' && (!myMembership || myMembership.status !== 'joined') && currentUser?.role !== 'admin') {
      continue;
    }

    results.push({
      ...party,
      memberCount: activeMembers.length,
      isFull: activeMembers.length >= party.capacity,
      myMembership: myMembership ? { role: myMembership.role, status: myMembership.status } : null,
    });
  }

  return results;
}

async function createParty({ owner, event, data, mongoReady, PartyModel, PartyMembershipModel, inMemoryState }) {
  const partyId = `party-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const partyRecord = {
    id: partyId,
    ownerId: String(owner.id),
    ownerName: owner.name,
    eventId: event.id,
    eventTitle: event.title,
    eventCity: event.city || '',
    title: data.title,
    description: data.description,
    visibility: data.visibility,
    capacity: data.capacity,
    status: 'open',
    createdAt: new Date(),
  };

  const membershipId = `pm-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const leaderMembership = {
    id: membershipId,
    partyId,
    userId: String(owner.id),
    userName: owner.name,
    userEmail: owner.email,
    role: 'leader',
    status: 'joined',
    requestedAt: new Date(),
    approvedAt: new Date(),
  };

  if (mongoReady) {
    await PartyModel.create(partyRecord);
    await PartyMembershipModel.create(leaderMembership);
  } else {
    inMemoryState.parties.push(partyRecord);
    inMemoryState.partyMemberships.push(leaderMembership);
  }

  return {
    party: { ...partyRecord, memberCount: 1, isFull: false, myMembership: { role: 'leader', status: 'joined' } },
    membership: leaderMembership,
  };
}

async function getPartyDetails({ partyId, currentUser, mongoReady, PartyModel, PartyMembershipModel, inMemoryState }) {
  let party = null;
  if (mongoReady) {
    party = await PartyModel.findOne({ id: partyId }).lean();
  } else {
    party = (inMemoryState.parties || []).find((p) => p.id === partyId) || null;
  }
  if (!party) return null;

  let memberships = [];
  if (mongoReady) {
    memberships = await PartyMembershipModel.find({ partyId }).lean();
  } else {
    memberships = (inMemoryState.partyMemberships || []).filter((m) => m.partyId === partyId);
  }

  const myMembership = currentUser
    ? memberships.find((m) => String(m.userId) === String(currentUser.id)) || null
    : null;

  const isLeader = myMembership?.role === 'leader' || currentUser?.role === 'admin';
  const activeMembers = memberships.filter((m) => m.status === 'joined');
  const pendingRequests = isLeader ? memberships.filter((m) => m.status === 'pending') : [];

  return {
    party: {
      ...party,
      memberCount: activeMembers.length,
      isFull: activeMembers.length >= party.capacity,
      myMembership: myMembership ? { role: myMembership.role, status: myMembership.status } : null,
    },
    members: activeMembers.map((m) => ({ id: m.id, userId: m.userId, userName: m.userName, role: m.role, approvedAt: m.approvedAt })),
    pendingRequests: pendingRequests.map((m) => ({ id: m.id, userId: m.userId, userName: m.userName, requestedAt: m.requestedAt })),
  };
}

async function joinParty({ partyId, user, mongoReady, PartyModel, PartyMembershipModel, inMemoryState }) {
  let party = null;
  if (mongoReady) {
    party = await PartyModel.findOne({ id: partyId });
  } else {
    party = (inMemoryState.parties || []).find((p) => p.id === partyId) || null;
  }
  if (!party) throw new Error('Party not found.');
  if (party.status === 'closed') throw new Error('This party is closed to new members.');

  let memberships = [];
  if (mongoReady) {
    memberships = await PartyMembershipModel.find({ partyId }).lean();
  } else {
    memberships = (inMemoryState.partyMemberships || []).filter((m) => m.partyId === partyId);
  }

  const activeCount = memberships.filter((m) => m.status === 'joined').length;
  if (activeCount >= party.capacity) throw new Error('This party has reached full capacity.');

  const existing = memberships.find((m) => String(m.userId) === String(user.id));
  if (existing) {
    if (existing.status === 'joined') throw new Error('You are already an active member of this party.');
    if (existing.status === 'pending') throw new Error('Your request to join this party is pending approval.');
    if (existing.status === 'declined') throw new Error('Your previous request was declined.');
  }

  const isPublic = party.visibility === 'public';
  const membershipId = `pm-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const newMembership = {
    id: membershipId,
    partyId,
    userId: String(user.id),
    userName: user.name,
    userEmail: user.email,
    role: 'member',
    status: isPublic ? 'joined' : 'pending',
    requestedAt: new Date(),
    approvedAt: isPublic ? new Date() : null,
  };

  if (mongoReady) {
    await PartyMembershipModel.create(newMembership);
  } else {
    inMemoryState.partyMemberships.push(newMembership);
  }

  return newMembership;
}

async function leaveParty({ partyId, user, mongoReady, PartyModel, PartyMembershipModel, inMemoryState }) {
  let membership = null;
  if (mongoReady) {
    membership = await PartyMembershipModel.findOne({ partyId, userId: String(user.id) });
    if (!membership || membership.status !== 'joined') throw new Error('You are not an active member of this party.');
    membership.status = 'left';
    await membership.save();
  } else {
    membership = (inMemoryState.partyMemberships || []).find((m) => m.partyId === partyId && String(m.userId) === String(user.id));
    if (!membership || membership.status !== 'joined') throw new Error('You are not an active member of this party.');
    membership.status = 'left';
  }

  return { success: true };
}

async function updateMembershipStatus({ partyId, leaderUser, memberId, newStatus, mongoReady, PartyModel, PartyMembershipModel, inMemoryState }) {
  let party = null;
  if (mongoReady) {
    party = await PartyModel.findOne({ id: partyId });
  } else {
    party = (inMemoryState.parties || []).find((p) => p.id === partyId);
  }
  if (!party) throw new Error('Party not found.');

  // Leader / owner check
  const isLeader = party.ownerId === String(leaderUser.id) || leaderUser.role === 'admin';
  if (!isLeader) throw new Error('Only the party leader can approve or decline members.');

  if (!['joined', 'declined'].includes(newStatus)) throw new Error('Invalid membership status.');

  let targetMembership = null;
  if (mongoReady) {
    targetMembership = await PartyMembershipModel.findOne({ id: memberId, partyId });
    if (!targetMembership) throw new Error('Membership record not found.');
    targetMembership.status = newStatus;
    if (newStatus === 'joined') targetMembership.approvedAt = new Date();
    await targetMembership.save();
  } else {
    targetMembership = (inMemoryState.partyMemberships || []).find((m) => m.id === memberId && m.partyId === partyId);
    if (!targetMembership) throw new Error('Membership record not found.');
    targetMembership.status = newStatus;
    if (newStatus === 'joined') targetMembership.approvedAt = new Date();
  }

  return targetMembership;
}

async function listPartyMessages({ partyId, user, mongoReady, PartyModel, PartyMembershipModel, PartyMessageModel, inMemoryState }) {
  // Authorization check: User must be a joined member or admin
  let memberships = [];
  if (mongoReady) {
    memberships = await PartyMembershipModel.find({ partyId, userId: String(user.id) }).lean();
  } else {
    memberships = (inMemoryState.partyMemberships || []).filter((m) => m.partyId === partyId && String(m.userId) === String(user.id));
  }

  const isMember = memberships.some((m) => m.status === 'joined');
  if (!isMember && user.role !== 'admin') {
    const error = new Error('Access denied. You must be an approved party member to view party chat.');
    error.status = 403;
    throw error;
  }

  let messages = [];
  if (mongoReady) {
    messages = await PartyMessageModel.find({ partyId }).sort({ createdAt: 1 }).limit(100).lean();
  } else {
    messages = (inMemoryState.partyMessages || []).filter((m) => m.partyId === partyId).slice(-100);
  }

  return messages;
}

async function sendPartyMessage({ partyId, user, text, mongoReady, PartyModel, PartyMembershipModel, PartyMessageModel, inMemoryState }) {
  // Authorization check: User must be a joined member or admin
  let memberships = [];
  if (mongoReady) {
    memberships = await PartyMembershipModel.find({ partyId, userId: String(user.id) }).lean();
  } else {
    memberships = (inMemoryState.partyMemberships || []).filter((m) => m.partyId === partyId && String(m.userId) === String(user.id));
  }

  const isMember = memberships.some((m) => m.status === 'joined');
  if (!isMember && user.role !== 'admin') {
    const error = new Error('Access denied. You must be an approved party member to send messages.');
    error.status = 403;
    throw error;
  }

  const messageRecord = {
    id: `msg-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    partyId,
    senderId: String(user.id),
    senderName: user.name,
    text,
    createdAt: new Date(),
  };

  if (mongoReady) {
    await PartyMessageModel.create(messageRecord);
  } else {
    inMemoryState.partyMessages.push(messageRecord);
  }

  return messageRecord;
}

module.exports = {
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
};
