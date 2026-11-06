import { useState, useEffect, useCallback } from 'react';
import {
  getParties,
  createParty,
  getPartyDetails,
  joinParty,
  leaveParty,
  updatePartyMember,
  getPartyMessages,
  sendPartyMessage,
} from '../services/api';

export default function PartyChatPage({
  currentUser,
  allEvents = [],
  setToast,
  onViewDetails,
}) {
  const [activeTab, setActiveTab] = useState('hub'); // 'hub', 'active-party', 'create'
  const [parties, setParties] = useState([]);
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [partyDetail, setPartyDetail] = useState(null);
  const [serverMessages, setServerMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [messageDraft, setMessageDraft] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [filterCity, setFilterCity] = useState('all');

  // Create form state
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    eventId: '',
    visibility: 'public',
    capacity: 8,
  });
  const [createError, setCreateError] = useState('');

  const loadParties = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterCity !== 'all' ? { city: filterCity } : {};
      const res = await getParties(params);
      setParties(Array.isArray(res.parties) ? res.parties : []);
    } catch {
      setParties([]);
    } finally {
      setLoading(false);
    }
  }, [filterCity]);

  useEffect(() => {
    loadParties();
  }, [loadParties]);

  const loadPartyData = useCallback(async (partyId) => {
    if (!partyId) return;
    try {
      const details = await getPartyDetails(partyId);
      setPartyDetail(details);

      // If user is a joined member, load server messages
      const isJoined = details.party?.myMembership?.status === 'joined' || currentUser?.role === 'admin';
      if (isJoined) {
        try {
          const msgRes = await getPartyMessages(partyId);
          setServerMessages(Array.isArray(msgRes.messages) ? msgRes.messages : []);
        } catch {
          setServerMessages([]);
        }
      }
    } catch {
      setPartyDetail(null);
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedPartyId) {
      loadPartyData(selectedPartyId);
      const timer = setInterval(() => loadPartyData(selectedPartyId), 8000);
      return () => clearInterval(timer);
    }
  }, [selectedPartyId, loadPartyData]);

  const handleSelectParty = (partyId) => {
    setSelectedPartyId(partyId);
    setActiveTab('active-party');
  };

  const handleJoinParty = async (partyId) => {
    if (!currentUser) {
      if (setToast) setToast('Please sign in to join a party.');
      window.location.assign('/login?next=/chat');
      return;
    }
    try {
      const res = await joinParty(partyId);
      const isPublic = res.membership?.status === 'joined';
      if (setToast) {
        setToast(isPublic ? 'Joined party! Chat is unlocked.' : 'Request sent to party leader for approval.');
      }
      await loadParties();
      handleSelectParty(partyId);
    } catch (err) {
      if (setToast) setToast(err.message || 'Unable to join party.');
    }
  };

  const handleLeaveParty = async (partyId) => {
    try {
      await leaveParty(partyId);
      if (setToast) setToast('You left the party.');
      setSelectedPartyId('');
      setActiveTab('hub');
      await loadParties();
    } catch (err) {
      if (setToast) setToast(err.message || 'Unable to leave party.');
    }
  };

  const handleMemberApproval = async (memberId, status) => {
    if (!selectedPartyId) return;
    try {
      await updatePartyMember(selectedPartyId, memberId, status);
      if (setToast) setToast(`Member request ${status}.`);
      await loadPartyData(selectedPartyId);
      await loadParties();
    } catch (err) {
      if (setToast) setToast(err.message || 'Action failed.');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const text = messageDraft.trim();
    if (!text || !selectedPartyId) return;

    setSendingMessage(true);
    try {
      const res = await sendPartyMessage(selectedPartyId, text);
      setServerMessages((curr) => [...curr, res.message]);
      setMessageDraft('');
    } catch (err) {
      if (setToast) setToast(err.message || 'Could not send message.');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      window.location.assign('/login?next=/chat');
      return;
    }
    if (!createForm.eventId) {
      setCreateError('Please choose a quest to link your party to.');
      return;
    }
    setCreateError('');
    try {
      const res = await createParty(createForm);
      if (setToast) setToast(`Party "${res.party.title}" created! You are the leader.`);
      setCreateForm({ title: '', description: '', eventId: '', visibility: 'public', capacity: 8 });
      await loadParties();
      handleSelectParty(res.party.id);
    } catch (err) {
      setCreateError(err.message || 'Unable to create party.');
    }
  };

  const isJoinedMember =
    partyDetail?.party?.myMembership?.status === 'joined' || currentUser?.role === 'admin';
  const isLeader =
    partyDetail?.party?.myMembership?.role === 'leader' || currentUser?.role === 'admin';

  return (
    <section className="panel feature-panel chat-panel" aria-labelledby="party-heading">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Hyperlocal Coordination</span>
          <h2 id="party-heading">Party Up & Group Adventures</h2>
          <p className="small-copy">
            Connect with fellow explorers, form parties for quests across India, and coordinate meetups in real-time.
          </p>
        </div>
        <span className="feature-emblem" aria-hidden="true">👥</span>
      </div>

      <nav className="sq-subnav" aria-label="Party navigation" style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'hub' ? 'is-active' : ''}`}
          style={{ padding: '6px 14px', borderRadius: '20px', border: '1px solid var(--border)', background: activeTab === 'hub' ? 'var(--forest)' : '#fff', color: activeTab === 'hub' ? '#fff' : 'inherit', fontWeight: 600, cursor: 'pointer' }}
          onClick={() => setActiveTab('hub')}
        >
          Explore Party Hub ({parties.length})
        </button>
        {selectedPartyId && (
          <button
            type="button"
            className={`tab-btn ${activeTab === 'active-party' ? 'is-active' : ''}`}
            style={{ padding: '6px 14px', borderRadius: '20px', border: '1px solid var(--border)', background: activeTab === 'active-party' ? 'var(--forest)' : '#fff', color: activeTab === 'active-party' ? '#fff' : 'inherit', fontWeight: 600, cursor: 'pointer' }}
            onClick={() => setActiveTab('active-party')}
          >
            💬 {partyDetail?.party?.title || 'Party View & Chat'}
          </button>
        )}
        <button
          type="button"
          className={`tab-btn ${activeTab === 'create' ? 'is-active' : ''}`}
          style={{ padding: '6px 14px', borderRadius: '20px', border: '1px solid var(--border)', background: activeTab === 'create' ? 'var(--forest)' : '#fff', color: activeTab === 'create' ? '#fff' : 'inherit', fontWeight: 600, cursor: 'pointer' }}
          onClick={() => {
            if (!currentUser) {
              window.location.assign('/login?next=/chat');
              return;
            }
            setActiveTab('create');
          }}
        >
          ➕ Form a New Party
        </button>
      </nav>

      {/* ==================== TAB 1: PARTY HUB ==================== */}
      {activeTab === 'hub' && (
        <div className="party-hub-view">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>
              Showing verified squads and coordination parties looking for companions.
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>City:</span>
              <select
                value={filterCity}
                onChange={(e) => setFilterCity(e.target.value)}
                style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '0.85rem' }}
              >
                <option value="all">All Cities</option>
                <option value="Bengaluru">Bengaluru</option>
                <option value="Mumbai">Mumbai</option>
                <option value="Delhi NCR">Delhi NCR</option>
                <option value="Pune">Pune</option>
                <option value="Hyderabad">Hyderabad</option>
                <option value="Chennai">Chennai</option>
                <option value="Goa">Goa</option>
                <option value="Kolkata">Kolkata</option>
              </select>
            </div>
          </div>

          {loading ? (
            <p className="helper-text">Loading party directory…</p>
          ) : parties.length === 0 ? (
            <div className="empty-state" style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
              <span className="empty-icon" aria-hidden="true">🏕️</span>
              <h3>No open parties found right now</h3>
              <p className="small-copy">Be the adventure pioneer and create the first party for an upcoming quest!</p>
              <button
                type="button"
                className="primary-btn btn-sm"
                style={{ marginTop: '0.75rem' }}
                onClick={() => setActiveTab('create')}
              >
                Start a Party
              </button>
            </div>
          ) : (
            <div className="party-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '1rem' }}>
              {parties.map((p) => {
                const isMember = p.myMembership?.status === 'joined';
                const isPending = p.myMembership?.status === 'pending';
                return (
                  <article
                    key={p.id}
                    className="party-card event-card"
                    style={{
                      padding: '1.1rem',
                      background: '#fffdf8',
                      border: isMember ? '2px solid var(--forest)' : '1px solid var(--border)',
                      borderRadius: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 4px 12px -8px rgba(0,0,0,0.15)',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                        <span className="pill accent" style={{ fontSize: '0.75rem' }}>
                          📍 {p.eventCity || 'Pan-India'}
                        </span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <span className={`badge ${p.visibility === 'public' ? 'tag-green' : 'tag-muted'}`} style={{ fontSize: '0.72rem' }}>
                            {p.visibility === 'public' ? 'Public Open' : 'By Request'}
                          </span>
                          {p.isFull && <span className="badge tag-red" style={{ fontSize: '0.72rem' }}>Full</span>}
                        </div>
                      </div>

                      <h3 style={{ fontSize: '1.15rem', margin: '4px 0 6px', color: 'var(--deep)' }}>{p.title}</h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '0 0 10px', lineHeight: 1.4 }}>
                        {p.description || 'Join this party to attend and coordinate together.'}
                      </p>

                      <div style={{ padding: '8px 10px', background: '#f5eedc', borderRadius: '8px', marginBottom: '12px', fontSize: '0.82rem' }}>
                        <strong>Target Quest:</strong> {p.eventTitle}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '12px' }}>
                        <span>Leader: <strong>{p.ownerName}</strong></span>
                        <span>Roster: <strong>{p.memberCount}/{p.capacity}</strong></span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                      {isMember ? (
                        <button
                          type="button"
                          className="primary-btn btn-sm"
                          style={{ flex: 1 }}
                          onClick={() => handleSelectParty(p.id)}
                        >
                          💬 Open Chat
                        </button>
                      ) : isPending ? (
                        <span className="badge tag-muted" style={{ padding: '6px 10px', flex: 1, textAlign: 'center' }}>
                          ⏳ Request Pending
                        </span>
                      ) : p.isFull ? (
                        <button type="button" className="secondary-btn btn-sm" disabled style={{ flex: 1 }}>
                          Party Full
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="primary-btn btn-sm"
                          style={{ flex: 1 }}
                          onClick={() => handleJoinParty(p.id)}
                        >
                          {p.visibility === 'public' ? '👥 Join Party' : '✉️ Request Join'}
                        </button>
                      )}

                      <button
                        type="button"
                        className="secondary-btn btn-sm"
                        onClick={() => handleSelectParty(p.id)}
                      >
                        Details
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 2: ACTIVE PARTY CHAT & ROSTER ==================== */}
      {activeTab === 'active-party' && partyDetail && (
        <div className="party-active-view">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', padding: '1rem', background: '#f8f4ea', borderRadius: '12px', marginBottom: '1.25rem', border: '1px solid var(--border)' }}>
            <div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className="eyebrow">PARTY HEADQUARTERS</span>
                <span className={`badge ${partyDetail.party.visibility === 'public' ? 'tag-green' : 'tag-muted'}`}>
                  {partyDetail.party.visibility}
                </span>
              </div>
              <h3 style={{ margin: '4px 0 2px', fontSize: '1.35rem' }}>{partyDetail.party.title}</h3>
              <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--muted)' }}>
                Target Quest: <strong>{partyDetail.party.eventTitle}</strong> ({partyDetail.party.eventCity})
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {isJoinedMember && !isLeader && (
                <button
                  type="button"
                  className="ghost-btn btn-sm"
                  style={{ color: '#dc2626' }}
                  onClick={() => handleLeaveParty(partyDetail.party.id)}
                >
                  Leave Party
                </button>
              )}
              <button
                type="button"
                className="secondary-btn btn-sm"
                onClick={() => {
                  const ev = allEvents.find((e) => e.id === partyDetail.party.eventId);
                  if (ev && onViewDetails) onViewDetails(ev);
                }}
              >
                View Quest Card ↗
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) 2fr', gap: '1.25rem', alignItems: 'start' }}>
            {/* Left sidebar: Members Roster & Requests */}
            <div className="party-sidebar" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem' }}>
              <h4 style={{ margin: '0 0 10px', fontSize: '0.95rem' }}>
                Confirmed Members ({partyDetail.members.length}/{partyDetail.party.capacity})
              </h4>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '8px' }}>
                {partyDetail.members.map((m) => (
                  <li
                    key={m.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.85rem',
                      padding: '6px 10px',
                      background: '#faf8f2',
                      borderRadius: '8px',
                    }}
                  >
                    <span>{m.userName}</span>
                    <span className={`badge ${m.role === 'leader' ? 'tag-gold' : 'tag-muted'}`} style={{ fontSize: '0.7rem' }}>
                      {m.role === 'leader' ? '👑 Leader' : 'Explorer'}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Pending Join Requests (Visible to leader) */}
              {isLeader && partyDetail.pendingRequests.length > 0 && (
                <div style={{ marginTop: '1.25rem', borderTop: '1px dashed var(--border)', paddingTop: '10px' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '0.9rem', color: '#b45309' }}>
                    Pending Join Requests ({partyDetail.pendingRequests.length})
                  </h4>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '8px' }}>
                    {partyDetail.pendingRequests.map((req) => (
                      <li
                        key={req.id}
                        style={{
                          padding: '8px',
                          background: '#fef3c7',
                          borderRadius: '8px',
                          fontSize: '0.82rem',
                        }}
                      >
                        <div style={{ fontWeight: 600, marginBottom: '4px' }}>{req.userName}</div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="primary-btn btn-sm"
                            style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                            onClick={() => handleMemberApproval(req.id, 'joined')}
                          >
                            ✓ Approve
                          </button>
                          <button
                            type="button"
                            className="ghost-btn btn-sm"
                            style={{ fontSize: '0.75rem', padding: '2px 8px', color: '#dc2626' }}
                            onClick={() => handleMemberApproval(req.id, 'declined')}
                          >
                            ✕ Decline
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Right: Party Message Thread */}
            <div className="party-chat-area" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', minHeight: '400px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '10px' }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem' }}>💬 Secure Party Coordination Chat</h4>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Synced across party members</span>
              </div>

              {!isJoinedMember ? (
                <div style={{ textAlign: 'center', padding: '3rem 1.5rem', margin: 'auto' }}>
                  <span style={{ fontSize: '2rem' }}>🔒</span>
                  <h4 style={{ margin: '8px 0 4px' }}>Private Party Chat</h4>
                  <p className="small-copy" style={{ maxWidth: '380px', margin: '0 auto 1rem' }}>
                    Coordination messages and meetup logistics are restricted to verified members of this party.
                  </p>
                  {partyDetail.party.myMembership?.status === 'pending' ? (
                    <span className="badge tag-muted">⏳ Your join request is pending leader approval</span>
                  ) : (
                    <button
                      type="button"
                      className="primary-btn btn-sm"
                      onClick={() => handleJoinParty(partyDetail.party.id)}
                    >
                      {partyDetail.party.visibility === 'public' ? 'Join Party to Chat' : 'Request Access'}
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="chat-thread" style={{ flex: 1, overflowY: 'auto', maxHeight: '350px', display: 'flex', flexDirection: 'column', gap: '10px', padding: '8px 0' }}>
                    {serverMessages.length === 0 ? (
                      <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                        <span className="empty-icon" aria-hidden="true">💬</span>
                        <strong>Party chat is ready.</strong>
                        <p className="small-copy">Share arrival timing, travel plans, or meet-up locations with your party!</p>
                      </div>
                    ) : (
                      serverMessages.map((msg) => {
                        const isMe = String(msg.senderId) === String(currentUser?.id);
                        return (
                          <article
                            key={msg.id}
                            className="chat-message"
                            style={{
                              alignSelf: isMe ? 'flex-end' : 'flex-start',
                              maxWidth: '75%',
                              background: isMe ? '#254e3b18' : '#faf8f2',
                              border: isMe ? '1px solid var(--forest)' : '1px solid var(--border)',
                              borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                              padding: '8px 12px',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '4px' }}>
                              <strong>{isMe ? 'You' : msg.senderName}</strong>
                              <time>
                                {new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                              </time>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.88rem', wordBreak: 'break-word' }}>{msg.text}</p>
                          </article>
                        );
                      })
                    )}
                  </div>

                  <form className="chat-compose" onSubmit={handleSendMessage} style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Message your party…"
                      value={messageDraft}
                      onChange={(e) => setMessageDraft(e.target.value)}
                      maxLength="500"
                      style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.88rem' }}
                    />
                    <button
                      type="submit"
                      className="primary-btn btn-sm"
                      disabled={sendingMessage || !messageDraft.trim()}
                    >
                      {sendingMessage ? 'Sending…' : 'Send'}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 3: CREATE A PARTY ==================== */}
      {activeTab === 'create' && (
        <div className="party-create-view" style={{ maxWidth: '640px', margin: '0 auto', background: '#fff', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '1.3rem' }}>Create an Adventure Party</h3>
          <p className="small-copy" style={{ marginBottom: '1.25rem' }}>
            Gather a squad for a live workshop, hackathon, concert, or sports quest happening in India.
          </p>

          {createError && <div className="message error-message" role="alert">{createError}</div>}

          <form onSubmit={handleCreateSubmit} style={{ display: 'grid', gap: '14px' }}>
            <label style={{ display: 'grid', gap: '4px', fontSize: '0.88rem', fontWeight: 600 }}>
              Party Title *
              <input
                type="text"
                required
                maxLength="120"
                placeholder="e.g. Koramangala Indie Music Crew"
                value={createForm.title}
                onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}
              />
            </label>

            <label style={{ display: 'grid', gap: '4px', fontSize: '0.88rem', fontWeight: 600 }}>
              Linked Quest / Experience *
              <select
                required
                value={createForm.eventId}
                onChange={(e) => setCreateForm({ ...createForm, eventId: e.target.value })}
                style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}
              >
                <option value="">Select an upcoming event…</option>
                {allEvents.map((evt) => (
                  <option key={evt.id} value={evt.id}>
                    {evt.title} ({evt.city || 'India'})
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: 'grid', gap: '4px', fontSize: '0.88rem', fontWeight: 600 }}>
              Party Description & Plans
              <textarea
                rows="3"
                maxLength="500"
                placeholder="Where should members meet? What is the transport or plan?"
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.88rem' }}
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <label style={{ display: 'grid', gap: '4px', fontSize: '0.88rem', fontWeight: 600 }}>
                Party Visibility
                <select
                  value={createForm.visibility}
                  onChange={(e) => setCreateForm({ ...createForm, visibility: e.target.value })}
                  style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                >
                  <option value="public">Public (Open for anyone to join)</option>
                  <option value="private">Private (Join requires Leader approval)</option>
                </select>
              </label>

              <label style={{ display: 'grid', gap: '4px', fontSize: '0.88rem', fontWeight: 600 }}>
                Max Capacity
                <input
                  type="number"
                  min="2"
                  max="50"
                  value={createForm.capacity}
                  onChange={(e) => setCreateForm({ ...createForm, capacity: Number(e.target.value) || 8 })}
                  style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                />
              </label>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button type="submit" className="primary-btn" style={{ flex: 1 }}>
                Publish Party
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setActiveTab('hub')}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
