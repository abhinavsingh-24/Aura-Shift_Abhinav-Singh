import { useState, useEffect } from 'react';
import QRCodeSvg from './QRCodeSvg';
import { getMyBookings, cancelBooking } from '../services/api';

export default function MyTickets({ currentUser, authLoading = false, onExploreClick }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState('');
  const [actionMessage, setActionMessage] = useState('');

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
                      <strong className="meta-val reference-code booking-ref">{booking.bookingRef || booking.id}</strong>
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
