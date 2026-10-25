import { useState } from 'react';
import QRCodeSvg from './QRCodeSvg';
import { createPaymentOrder, sandboxPay } from '../services/api';

export default function CheckoutModal({ event, currentUser, onClose, onBookingSuccess }) {
  const tiers = Array.isArray(event.ticketTiers) && event.ticketTiers.length > 0
    ? event.ticketTiers
    : [
        {
          id: 'free-rsvp',
          name: event.isFree || !event.priceStarting ? 'Free Registration' : 'General Admission',
          price: event.priceStarting || 0,
          currency: 'INR',
          capacity: event.capacity || 100,
          soldCount: 0,
        },
      ];

  const [selectedTierId, setSelectedTierId] = useState(tiers[0]?.id || 'free-rsvp');
  const [quantity, setQuantity] = useState(1);
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('select'); // 'select', 'pay', 'confirmed'
  const [orderData, setOrderData] = useState(null);
  const [confirmedBooking, setConfirmedBooking] = useState(null);
  const [qrToken, setQrToken] = useState('');

  const selectedTier = tiers.find((t) => t.id === selectedTierId) || tiers[0];
  const unitPrice = Number(selectedTier?.price || 0);
  const totalAmount = unitPrice * quantity;
  const isFree = unitPrice === 0;

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await createPaymentOrder({
        eventId: event.id || event._id,
        tierId: selectedTier.id,
        quantity,
        buyerPhone: phone,
      });

      setOrderData(result);

      if (result.isFree) {
        // Free registration is instantly confirmed
        setConfirmedBooking({
          bookingRef: result.bookingRef,
          ticketTierName: selectedTier.name,
          quantity,
          totalAmount: 0,
        });
        setQrToken(result.qrCodeData || `SQPASS:${result.bookingRef}`);
        setStep('confirmed');
        if (onBookingSuccess) onBookingSuccess();
      } else {
        // Move to paid checkout step
        setStep('pay');
      }
    } catch (err) {
      setError(err.message || 'Unable to create booking order.');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulatePayment = async () => {
    if (!orderData) return;
    setError('');
    setLoading(true);

    try {
      const result = await sandboxPay({
        orderId: orderData.orderId,
        bookingId: orderData.bookingId,
      });

      setConfirmedBooking(result.booking);
      setQrToken(result.qrCodeData || `SQPASS:${result.booking.bookingRef}`);
      setStep('confirmed');
      if (onBookingSuccess) onBookingSuccess();
    } catch (err) {
      setError(err.message || 'Payment simulation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="checkout-modal-title">
      <div className="modal-card checkout-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="badge event-category">{event.category}</span>
            <h2 id="checkout-modal-title" style={{ marginTop: '0.4rem', fontSize: '1.35rem' }}>
              {step === 'confirmed' ? 'Booking Confirmed!' : `Book Tickets: ${event.title}`}
            </h2>
          </div>
          <button type="button" className="close-button" onClick={onClose} aria-label="Close modal">✕</button>
        </div>

        {error && <div className="message error-message" role="alert">{error}</div>}

        {step === 'select' && (
          <form onSubmit={handleCreateOrder} className="checkout-form">
            <div className="checkout-event-summary">
              <p><strong>Date & Time:</strong> {event.date} at {event.startTime}</p>
              <p><strong>Venue:</strong> {event.venue}, {event.city}</p>
            </div>

            <div className="tier-selector-group">
              <label className="field-label">Select Ticket Tier</label>
              <div className="tier-options-list">
                {tiers.map((tier) => (
                  <label
                    key={tier.id}
                    className={`tier-radio-card ${selectedTierId === tier.id ? 'is-selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="tierOption"
                      value={tier.id}
                      checked={selectedTierId === tier.id}
                      onChange={() => setSelectedTierId(tier.id)}
                    />
                    <div className="tier-info">
                      <div className="tier-name-price">
                        <strong>{tier.name}</strong>
                        <span className="tier-price-tag">
                          {tier.price === 0 ? 'FREE' : `₹${tier.price.toLocaleString('en-IN')}`}
                        </span>
                      </div>
                      {tier.description && <p className="tier-desc">{tier.description}</p>}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="qty-row">
              <label>
                Quantity
                <select value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n} {n === 1 ? 'ticket' : 'tickets'}</option>
                  ))}
                </select>
              </label>

              <label>
                Phone (for SMS updates)
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </label>
            </div>

            <div className="price-breakdown-card">
              <div className="breakdown-row">
                <span>{selectedTier.name} × {quantity}</span>
                <span>{unitPrice === 0 ? '₹0' : `₹${(unitPrice * quantity).toLocaleString('en-IN')}`}</span>
              </div>
              <div className="breakdown-row">
                <span>Platform Convenience Fee</span>
                <span className="fee-waived">₹0 (Waived)</span>
              </div>
              <div className="breakdown-row total-row">
                <strong>Total Amount</strong>
                <strong className="total-price">
                  {totalAmount === 0 ? 'FREE' : `₹${totalAmount.toLocaleString('en-IN')}`}
                </strong>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: '1.2rem' }}>
              <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
              <button type="submit" className="primary-btn" disabled={loading}>
                {loading ? 'Processing…' : isFree ? 'Confirm Free RSVP' : `Proceed to Pay ₹${totalAmount}`}
              </button>
            </div>
          </form>
        )}

        {step === 'pay' && orderData && (
          <div className="sandbox-pay-view">
            <div className="sandbox-badge-banner">
              <span className="badge status-badge">INDIA PAYMENT SANDBOX</span>
              <p>Test environment active. No real credit card or UPI account will be charged.</p>
            </div>

            <div className="payment-order-meta">
              <p><strong>Order ID:</strong> <code>{orderData.orderId}</code></p>
              <p><strong>Booking Ref:</strong> <code>{orderData.bookingRef}</code></p>
              <p><strong>Total Due:</strong> ₹{orderData.totalAmount?.toLocaleString('en-IN')} INR</p>
            </div>

            <div className="sandbox-methods">
              <div className="sandbox-method-pill is-active">
                <span>⚡ UPI / Instant QR (Simulated)</span>
              </div>
              <div className="sandbox-method-pill">
                <span>💳 Debit / Credit Card (Test)</span>
              </div>
            </div>

            <p className="sandbox-hint">
              Clicking below will simulate a successful Razorpay gateway callback, verify the HMAC signature on the server, and issue your unique digital ticket.
            </p>

            <div className="modal-actions">
              <button type="button" className="ghost-btn" onClick={() => setStep('select')}>Back</button>
              <button
                type="button"
                className="primary-btn sandbox-confirm-btn"
                onClick={handleSimulatePayment}
                disabled={loading}
              >
                {loading ? 'Verifying payment…' : `Simulate Successful Payment of ₹${orderData.totalAmount}`}
              </button>
            </div>
          </div>
        )}

        {step === 'confirmed' && (
          <div className="booking-confirmed-view">
            <div className="confirmation-header">
              <div className="success-icon-circle">✓</div>
              <h3>You’re on the Guest List!</h3>
              <p className="booking-ref-display">Booking Reference: <strong>{confirmedBooking?.bookingRef}</strong></p>
            </div>

            <div className="ticket-qr-container">
              <QRCodeSvg value={qrToken} size={150} />
              <p className="qr-caption">Show this QR code at the event entrance for admission.</p>
            </div>

            <div className="confirmed-summary-box">
              <p><strong>Event:</strong> {event.title}</p>
              <p><strong>Date & Time:</strong> {event.date} at {event.startTime}</p>
              <p><strong>Venue:</strong> {event.venue}, {event.city}</p>
              <p><strong>Ticket Tier:</strong> {confirmedBooking?.ticketTierName || selectedTier.name} ({quantity} ticket{quantity > 1 ? 's' : ''})</p>
            </div>

            <div className="modal-actions" style={{ justifyContent: 'center', marginTop: '1rem' }}>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => {
                  onClose();
                  window.location.assign('/bookings');
                }}
              >
                Go to My Bookings
              </button>
              <button type="button" className="primary-btn" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

