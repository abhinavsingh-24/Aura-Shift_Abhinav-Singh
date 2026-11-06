import { useState, useEffect } from 'react';
import QRCodeSvg from './QRCodeSvg';
import { getMyBookings, cancelBooking, getMyUpcoming } from '../services/api';
import { googleCalendarUrl } from '../lib/calendarLinks';

export default function MyTickets({ currentUser, authLoading = false, onExploreClick }) {
  const [upcoming, setUpcoming] = useState([]);

  useEffect(() => {
    if (!currentUser) return;
    getMyUpcoming()
      .then((data) => {
        const list = data.upcoming || [];
        setUpcoming(list);
        const soon = list.find((u) => u.minutesUntil <= 24 * 60);
        if (soon && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('SIDEQUEST reminder', { body: `${soon.title} starts soon at ${soon.venue}.` });
        }
      })
      .catch(() => setUpcoming([]));
  }, [currentUser]);

  const enableNotifications = async () => {
    if (typeof Notification === 'undefined') return;
    await Notification.requestPermission();
    setActionMessage(Notification.permission === 'granted' ? 'Browser reminders enabled.' : 'Notifications were blocked in your browser.');
  };

  const formatCountdown = (minutes) => {
    if (minutes < 60) return `${minutes} min`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)} h`;
    return `${Math.floor(minutes / 1440)} day(s)`;
  };
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [copiedRef, setCopiedRef] = useState('');

  const handleCopyRef = async (ref) => {
    try {
      await navigator.clipboard.writeText(ref);
      setCopiedRef(ref);
      setActionMessage(`Ticket reference ${ref} copied to clipboard!`);
      setTimeout(() => setCopiedRef(''), 2500);
    } catch {
      setActionMessage(`Booking reference: ${ref}`);
    }
  };

  const loadBookings = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getMyBookings();
      setBookings(Array.isArray(data.bookings) ? data.bookings : []);
    } catch (err) {
      setError(err.message || 'Unable to load tickets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadBookings();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [currentUser, authLoading]);

  const handleCancel = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking? This will release your ticket.')) {
      return;
    }
    setCancellingId(bookingId);
    setActionMessage('');
    try {
      await cancelBooking(bookingId);
      setActionMessage('Ticket cancelled successfully.');
      await loadBookings();
    } catch (err) {
      setError(err.message || 'Unable to cancel booking.');
    } finally {
      setCancellingId('');
    }
  };

  if (authLoading) {
    return (
      <div className="tickets-page-container">
        <div className="loading-box">Checking your account…</div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="auth-gate">
        <div className="auth-gate-card">
          <h2>Sign in to view your tickets</h2>
          <p>Your confirmed tickets, QR check-in passes, and booking history are saved to your account.</p>
          <div className="auth-gate-actions">
            <a className="primary-btn" href="/login?next=/bookings">Sign in</a>
            <a className="secondary-btn" href="/register?next=/bookings">Create account</a>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="tickets-page-container">
        <div className="page-header">
          <h1>My Tickets & Bookings</h1>
          <p>Your verified digital passes for upcoming events across India.</p>
        </div>
        <div className="loading-grid">
          <div className="loading-card skeleton" style={{ height: '220px' }} />
          <div className="loading-card skeleton" style={{ height: '220px' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="tickets-page-container">
      <div className="page-header">
        <div className="header-badge-row">
          <span className="badge category-badge">CONFIRMED PASSES</span>
        </div>
        <h1>My Tickets & Bookings</h1>
        <p>Present these digital QR tickets at the venue check-in desk for entry.</p>
      </div>

      {actionMessage && <div className="message success-message" role="status">{actionMessage}</div>}
      {error && <div className="message error-message" role="alert">{error}</div>}

      {upcoming.length > 0 && (
        <div className="message success-message" role="status" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>⏰ Next up: <strong>{upcoming[0].title}</strong> in {formatCountdown(upcoming[0].minutesUntil)}</span>
          {typeof Notification !== 'undefined' && Notification.permission === 'default' && (
            <button type="button" className="secondary-btn btn-sm" onClick={enableNotifications}>Enable browser reminders</button>
          )}
        </div>
      )}

      {bookings.length > 0 && (
        <div className="bookings-summary-banner" aria-label="Bookings overview">
          <div className="summary-stat-box">
            <span className="summary-num">{bookings.filter((b) => b.status === 'confirmed').length}</span>
            <span className="summary-lbl">Active Passes</span>
          </div>
          <div className="summary-stat-box">
            <span className="summary-num">{bookings.reduce((sum, b) => sum + (b.quantity || 1), 0)}</span>
            <span className="summary-lbl">Total Tickets</span>
          </div>
          <div className="summary-stat-box">
            <span className="summary-num">{bookings.filter((b) => b.isCheckedIn).length}</span>
            <span className="summary-lbl">Checked In</span>
          </div>
        </div>
      )}

      {bookings.length === 0 ? (
        <div className="empty-state-card">
          <div className="empty-icon">🎟️</div>
          <h3>No tickets or bookings yet</h3>
          <p>Discover real tech conferences, college fests, concerts, and workshops across India and book your spot.</p>
          <button type="button" className="primary-btn" onClick={onExploreClick}>
            Explore Events Across India
          </button>
        </div>
      ) : (
        <div className="tickets-list-grid">
          {bookings.map((booking) => {
            const event = booking.event || {};
            const isCancelled = booking.status === 'cancelled';
            const isCheckedIn = Boolean(booking.isCheckedIn);

            return (
              <div key={booking.id} className={`event-card digital-ticket-pass ${isCancelled ? 'is-cancelled' : ''}`}>
                <div className="ticket-main-section event-card-body">
                  <div className="ticket-header-strip">
                    <span className="ticket-event-type">{event.category || 'Event'}</span>
                    <span className={`ticket-status-pill ${isCancelled ? 'cancelled-pill' : isCheckedIn ? 'admitted-pill' : 'confirmed-pill'}`}>
                      {isCancelled ? 'CANCELLED' : isCheckedIn ? '✓ ADMITTED' : 'CONFIRMED'}
                    </span>
                  </div>

                  <h3 className="ticket-title">{event.title || 'Event Registration'}</h3>

                  <div className="ticket-details-grid">
                    <div className="ticket-meta-item">
                      <span className="meta-label">DATE & TIME</span>
                      <strong className="meta-val">{event.date || 'Upcoming'} at {event.startTime || '09:00'}</strong>
                    </div>

                    <div className="ticket-meta-item">
                      <span className="meta-label">VENUE / LOCATION</span>
                      <strong className="meta-val">{event.venue || 'Venue TBD'}, {event.city || 'India'}</strong>
                    </div>

                    <div className="ticket-meta-item">
                      <span className="meta-label">TICKET TIER</span>
                      <strong className="meta-val">{booking.ticketTierName || 'General Admission'} × {booking.quantity || 1}</strong>
                    </div>

                    <div className="ticket-meta-item">
                      <span className="meta-label">BOOKING REF</span>
                      <div className="booking-ref-copy-wrap">
                        <strong className="meta-val reference-code booking-ref">{booking.bookingRef || booking.id}</strong>
                        <button
                          type="button"
                          className={`copy-ref-pill ${copiedRef === (booking.bookingRef || booking.id) ? 'is-copied' : ''}`}
                          onClick={() => handleCopyRef(booking.bookingRef || booking.id)}
                          title="Copy reference code"
                          aria-label="Copy booking reference code"
                        >
                          {copiedRef === (booking.bookingRef || booking.id) ? '✓ Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>

                    <div className="ticket-meta-item">
                      <span className="meta-label">ATTENDEE</span>
                      <strong className="meta-val">{booking.buyerName || currentUser.name}</strong>
                    </div>

                    <div className="ticket-meta-item">
                      <span className="meta-label">PAYMENT</span>
                      <strong className="meta-val">
                        {booking.paymentStatus === 'free' ? 'FREE RSVP' : `₹${(booking.totalAmount || 0).toLocaleString('en-IN')} (PAID)`}
                      </strong>
                    </div>
                  </div>

                  <div className="ticket-action-bar">
                    <button
                      type="button"
                      className="secondary-btn btn-sm"
                      onClick={() => window.print()}
                    >
                      🖨️ Print / Save Pass
                    </button>

                    {!isCancelled && booking.eventId && (
                      <>
                        <a className="secondary-btn btn-sm" href={`/api/events/${encodeURIComponent(booking.eventId)}/calendar.ics`} download>
                          📅 Add to Calendar (.ics)
                        </a>
                        {event.date && (
                          <a className="secondary-btn btn-sm" href={googleCalendarUrl(event)} target="_blank" rel="noreferrer">
                            Google Calendar
                          </a>
                        )}
                      </>
                    )}

                    {!isCancelled && !isCheckedIn && (
                      <button
                        type="button"
                        className="ghost-btn btn-sm cancel-ticket-btn"
                        disabled={cancellingId === booking.id}
                        onClick={() => handleCancel(booking.id)}
                      >
                        {cancellingId === booking.id ? 'Cancelling…' : 'Cancel Ticket'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="ticket-stub-section">
                  <div className="stub-notch-top" />
                  <div className="stub-notch-bottom" />
                  <div className="stub-qr-wrap">
                    <QRCodeSvg
                      value={booking.qrCodeData || `SQPASS:${booking.bookingRef}:${booking.eventId}`}
                      size={130}
                    />
                    <span className="stub-code">{booking.bookingRef}</span>
                    <span className="stub-hint">SCAN FOR ENTRY</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
