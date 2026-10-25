import { useState, useEffect } from 'react';
import {
  getOrganizerEvents,
  getOrganizerStats,
  getOrganizerAttendees,
  checkInTicket,
  createEvent,
  updateEventStatus,
} from '../services/api';

const CATEGORIES = [
  'Technology',
  'College festivals',
  'Music concerts',
  'Comedy shows and theatre',
  'Workshops',
  'Startup & entrepreneurship',
  'Sports, marathons and outdoor activities',
  'Art, photography and creative workshops',
  'Cultural festivals',
  'Community events and volunteering',
];

const CITIES = [
  'Bengaluru',
  'Mumbai',
  'Delhi NCR',
  'Pune',
  'Hyderabad',
  'Chennai',
  'Kolkata',
  'Ahmedabad',
  'Jaipur',
  'Goa',
  'Kochi',
  'Indore',
  'Lucknow',
  'Chandigarh',
  'Guwahati',
  'Online / Pan-India',
];

export default function OrganizerPortal({ currentUser, initialEvents = [], onEventCreated }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'events', 'create', 'attendees', 'checkin'
  const [stats, setStats] = useState(null);
  const [events, setEvents] = useState(() => {
    if (currentUser) {
      return (initialEvents || []).filter(
        (e) => e.ownerId === currentUser.id || e.organizerName === currentUser.name || currentUser.role === 'admin',
      );
    }
    return [];
  });
  const [selectedEventId, setSelectedEventId] = useState('');
  const [attendees, setAttendees] = useState([]);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Ticket scanner state
  const [scanInput, setScanInput] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [scanLoading, setScanLoading] = useState(false);

  // New Event Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Technology',
    date: '',
    startTime: '10:00',
    city: 'Bengaluru',
    locality: 'Koramangala',
    venue: '',
    isOnline: false,
    capacity: 100,
    priceStarting: 0,
    imageUrl: '',
    cancellationPolicy: 'Free cancellation up to 24 hours before the event starts.',
    ticketTiers: [
      { id: 'tier-1', name: 'General Admission', price: 0, capacity: 100, description: 'Standard admission pass' },
    ],
  });

  const loadAttendees = async (eventId) => {
    try {
      const data = await getOrganizerAttendees(eventId);
      setAttendees(Array.isArray(data.attendees) ? data.attendees : []);
    } catch (err) {
      setError(err.message || 'Unable to load attendees.');
    }
  };

  const loadData = async () => {
    setError('');
    try {
      const [statsData, eventsData] = await Promise.all([
        getOrganizerStats(),
        getOrganizerEvents(),
      ]);
      setStats(statsData);
      const evts = Array.isArray(eventsData.events) ? eventsData.events : [];
      setEvents(evts);
      if (evts.length > 0 && !selectedEventId) {
        setSelectedEventId(evts[0].id);
      }
    } catch (err) {
      setError(err.message || 'Unable to load organizer data.');
    }
  };

  useEffect(() => {
    if (currentUser && (currentUser.role === 'organizer' || currentUser.role === 'admin')) {
      loadData();
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedEventId && activeTab === 'attendees') {
      loadAttendees(selectedEventId);
    }
  }, [selectedEventId, activeTab]);

  const handleStatusChange = async (eventId, newStatus) => {
    try {
      await updateEventStatus(eventId, newStatus);
      setSuccessMsg(`Event status updated to ${newStatus}.`);
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to update event status.');
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    try {
      const payload = {
        ...formData,
        isFree: Number(formData.priceStarting) === 0,
        priceStarting: Number(formData.priceStarting),
        capacity: Number(formData.capacity),
        ticketTiers: formData.ticketTiers.map((t) => ({
          ...t,
          price: Number(t.price),
          capacity: Number(t.capacity),
        })),
      };

      const result = await createEvent(payload);
      setSuccessMsg(`Quest "${result.event.title}" published successfully!`);
      setActiveTab('events');
      await loadData();
      if (onEventCreated) onEventCreated();
    } catch (err) {
      setError(err.message || 'Unable to create event.');
    }
  };

  const handleCheckInSubmit = async (e) => {
    e.preventDefault();
    if (!scanInput.trim()) return;
    setScanLoading(true);
    setScanResult(null);
    try {
      const res = await checkInTicket({
        ticketReference: scanInput.trim(),
        eventId: selectedEventId || undefined,
      });
      setScanResult(res);
      setScanInput('');
      if (res.isValid) {
        // Refresh stats & attendees
        loadData();
      }
    } catch (err) {
      setScanResult({ isValid: false, message: err.message || 'Check-in failed.' });
    } finally {
      setScanLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="auth-gate">
        <div className="auth-gate-card">
          <h2>Organizer Access Required</h2>
          <p>Please log in with an organizer or host account to access the management portal.</p>
          <div className="auth-gate-actions">
            <a className="primary-btn" href="/login?next=/organizer">Sign in</a>
            <a className="secondary-btn" href="/register?role=organizer&next=/organizer">Create Organizer Account</a>
          </div>
        </div>
      </div>
    );
  }

  if (currentUser.role === 'explorer') {
    return (
      <div className="auth-gate">
        <div className="auth-gate-card">
          <h2>Explorer Account Detected</h2>
          <p>You are currently signed in as an Explorer ({currentUser.email}). An Organizer account is required to publish and manage events.</p>
          <div className="auth-gate-actions">
            <a className="primary-btn" href="/register?role=organizer">Register as Organizer</a>
            <a className="secondary-btn" href="/">Return to Discovery</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="organizer-portal-container">
      <div className="portal-header">
        <div>
          <span className="badge category-badge">HOST & ORGANIZER HUB</span>
          <h1>Organizer Command Centre</h1>
          <p>Manage ticketing, inspect real-time sales, export attendees, and verify QR admissions.</p>
        </div>

        <button
          type="button"
          className="primary-btn"
          onClick={() => setActiveTab('create')}
        >
          + Host New Event
        </button>
      </div>

      {successMsg && <div className="message success-message" role="status">{successMsg}</div>}
      {error && <div className="message error-message" role="alert">{error}</div>}

      <div className="portal-nav-tabs">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'overview' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 Overview
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'events' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('events')}
        >
          🎪 My Events ({events.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'attendees' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('attendees')}
        >
          👥 Attendees & CSV Export
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'checkin' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('checkin')}
        >
          🎟️ Ticket Scanner & Check-In
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'create' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          ✍️ Create Event
        </button>
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="portal-tab-content">
          <div className="metrics-summary-grid">
            <div className="metric-card">
              <span className="metric-label">TOTAL REVENUE (INR)</span>
              <strong className="metric-value">₹{(stats?.grossRevenue || 0).toLocaleString('en-IN')}</strong>
              <span className="metric-sub">From ticket sales</span>
            </div>

            <div className="metric-card">
              <span className="metric-label">TOTAL ATTENDEES</span>
              <strong className="metric-value">{stats?.totalAttendees || 0}</strong>
              <span className="metric-sub">Across all quests</span>
            </div>

            <div className="metric-card">
              <span className="metric-label">CHECKED IN ADMISSIONS</span>
              <strong className="metric-value">{stats?.checkedInCount || 0}</strong>
              <span className="metric-sub">Verified at door</span>
            </div>

            <div className="metric-card">
              <span className="metric-label">ACTIVE PUBLISHED EVENTS</span>
              <strong className="metric-value">{stats?.activeEvents || 0}</strong>
              <span className="metric-sub">{stats?.totalEvents || 0} total listings</span>
            </div>
          </div>

          <div className="quick-access-section" style={{ marginTop: '2rem' }}>
            <h3>Fast Actions</h3>
            <div className="quick-action-cards">
              <div className="action-card" onClick={() => setActiveTab('checkin')}>
                <h4>🎟️ QR Check-In Scanner</h4>
                <p>Validate tickets at entry. Real-time server validation protects against double check-in.</p>
              </div>
              <div className="action-card" onClick={() => setActiveTab('attendees')}>
                <h4>📥 Download Guest List CSV</h4>
                <p>Export full attendee rosters with ticket types, quantities, and payment status.</p>
              </div>
              <div className="action-card" onClick={() => setActiveTab('create')}>
                <h4>✨ Publish a New Event</h4>
                <p>Configure free or paid ticket tiers, set capacity limits, and launch to India.</p>
              </div>
            </div>
          </div>

          <div className="insight-list" style={{ marginTop: '2rem' }}>
            <h3>Your Quests Snapshot</h3>
            {events.map((evt) => (
              <article className="insight-item" key={evt.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                <div>
                  <strong>{evt.title}</strong>
                  <span className="helper-text" style={{ display: 'block', fontSize: '0.8rem', color: '#6b7280' }}>
                    {evt.date} @ {evt.startTime} · {evt.venue}, {evt.city}
                  </span>
                </div>
                <a className="secondary-btn btn-sm" href={`/quests/${encodeURIComponent(evt.id)}`}>View quest</a>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* MY EVENTS TAB */}
      {activeTab === 'events' && (
        <div className="portal-tab-content">
          <div className="events-table-header">
            <h3>Events You Manage</h3>
          </div>

          {events.length === 0 ? (
            <div className="empty-state-card">
              <p>You haven’t published any events yet.</p>
              <button type="button" className="primary-btn" onClick={() => setActiveTab('create')}>
                Create Your First Event
              </button>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Event Title</th>
                    <th>City</th>
                    <th>Date & Time</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((evt) => (
                    <tr key={evt.id}>
                      <td>
                        <strong>{evt.title}</strong>
                        <div className="table-sub">{evt.category}</div>
                      </td>
                      <td>{evt.city}</td>
                      <td>{evt.date} @ {evt.startTime}</td>
                      <td>{evt.isFree || evt.priceStarting === 0 ? 'Free' : `₹${evt.priceStarting}`}</td>
                      <td>
                        <span className={`status-tag status-${evt.status || 'published'}`}>
                          {evt.status || 'published'}
                        </span>
                      </td>
                      <td>
                        <div className="table-btn-group">
                          {evt.status === 'published' ? (
                            <button
                              type="button"
                              className="btn-xs ghost-btn"
                              onClick={() => handleStatusChange(evt.id, 'draft')}
                            >
                              Unpublish
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn-xs secondary-btn"
                              onClick={() => handleStatusChange(evt.id, 'published')}
                            >
                              Publish
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn-xs danger-btn"
                            onClick={() => handleStatusChange(evt.id, 'cancelled')}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ATTENDEES & CSV TAB */}
      {activeTab === 'attendees' && (
        <div className="portal-tab-content">
          <div className="attendee-filter-bar">
            <label>
              Select Event:
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
              >
                {events.map((e) => (
                  <option key={e.id} value={e.id}>{e.title} ({e.city})</option>
                ))}
              </select>
            </label>

            {selectedEventId && (
              <a
                className="secondary-btn"
                href={`/api/organizer/events/${encodeURIComponent(selectedEventId)}/attendees/csv`}
                download
              >
                📥 Download Attendee CSV
              </a>
            )}
          </div>

          <div className="table-wrapper" style={{ marginTop: '1.2rem' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Booking Ref</th>
                  <th>Attendee Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Tier</th>
                  <th>Qty</th>
                  <th>Status</th>
                  <th>Checked In</th>
                </tr>
              </thead>
              <tbody>
                {attendees.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>
                      No attendees registered for this event yet.
                    </td>
                  </tr>
                ) : (
                  attendees.map((a) => (
                    <tr key={a.id}>
                      <td><code>{a.bookingRef || a.id}</code></td>
                      <td><strong>{a.buyerName}</strong></td>
                      <td>{a.buyerEmail}</td>
                      <td>{a.buyerPhone || '—'}</td>
                      <td>{a.ticketTierName}</td>
                      <td>{a.quantity}</td>
                      <td><span className={`status-tag status-${a.status}`}>{a.status}</span></td>
                      <td>
                        {a.isCheckedIn ? (
                          <span className="badge tag-green">✓ Checked In</span>
                        ) : (
                          <span className="badge tag-muted">Pending</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TICKET SCANNER & CHECK-IN TAB */}
      {activeTab === 'checkin' && (
        <div className="portal-tab-content">
          <div className="scanner-hero-card">
            <h3>🎟️ Ticket Verification & Entry Scanner</h3>
            <p>Scan a QR code pass or enter the booking reference code to verify valid entry and mark admission.</p>

            <form onSubmit={handleCheckInSubmit} className="scanner-input-row">
              <input
                type="text"
                placeholder="Enter Booking Ref (e.g. SQ-2026-IN001) or scan QR code"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                autoFocus
              />
              <button type="submit" className="primary-btn" disabled={scanLoading}>
                {scanLoading ? 'Verifying…' : 'Verify & Check In'}
              </button>
            </form>

            {scanResult && (
              <div className={`scan-alert-box ${scanResult.isValid ? 'is-valid' : 'is-invalid'}`}>
                <div className="scan-alert-icon">{scanResult.isValid ? '✅' : '❌'}</div>
                <div>
                  <h4>{scanResult.isValid ? 'Entry Approved' : 'Admission Denied'}</h4>
                  <p>{scanResult.message}</p>
                  {scanResult.booking && (
                    <div className="scan-booking-meta">
                      <strong>Attendee:</strong> {scanResult.booking.buyerName} &bull;{' '}
                      <strong>Pass:</strong> {scanResult.booking.ticketTierName} &bull;{' '}
                      <strong>Ref:</strong> {scanResult.booking.bookingRef}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE EVENT TAB */}
      {activeTab === 'create' && (
        <div className="portal-tab-content">
          <div className="create-event-card">
            <h3>Host & Publish an Event in India</h3>
            <p>Fill out the details below. All listings are verified and published across the platform.</p>

            <form onSubmit={handleCreateSubmit} className="organizer-create-form">
              <div className="form-group">
                <label>Event Title *</label>
                <input
                  type="text"
                  required
                  maxLength="140"
                  placeholder="e.g. Pune Tech & Startup Summit 2026"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>City *</label>
                  <select
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  >
                    {CITIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Event Date (YYYY-MM-DD) *</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Start Time (HH:mm) *</label>
                  <input
                    type="time"
                    required
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Venue Name & Address *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. NIMHANS Convention Centre, Hosur Road"
                    value={formData.venue}
                    onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Locality / Neighborhood</label>
                  <input
                    type="text"
                    placeholder="e.g. Koramangala / Bandra"
                    value={formData.locality}
                    onChange={(e) => setFormData({ ...formData, locality: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Description *</label>
                <textarea
                  required
                  rows="4"
                  maxLength="3000"
                  placeholder="Provide an overview of the event schedule, speakers, and what attendees should expect."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Starting Ticket Price (INR ₹)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0 for Free"
                    value={formData.priceStarting}
                    onChange={(e) => setFormData({ ...formData, priceStarting: e.target.value })}
                  />
                  <small className="helper-text">Enter 0 for free admission.</small>
                </div>

                <div className="form-group">
                  <label>Total Event Capacity *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="100"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Cover Banner Image URL (optional)</label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Cancellation & Refund Policy</label>
                <input
                  type="text"
                  placeholder="Free cancellation up to 24 hours before the event starts."
                  value={formData.cancellationPolicy}
                  onChange={(e) => setFormData({ ...formData, cancellationPolicy: e.target.value })}
                />
              </div>

              <div className="form-actions" style={{ marginTop: '1.5rem' }}>
                <button type="submit" className="primary-btn">
                  Publish Quest to India
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
