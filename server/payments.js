const crypto = require('crypto');
const { BookingModel, PaymentModel, EventModel, AuditLogModel } = require('./db');

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'sidequest-sandbox-secret-for-local-testing';
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'sidequest-sandbox-webhook-secret';

const isLiveRazorpay = Boolean(
  RAZORPAY_KEY_ID &&
  RAZORPAY_KEY_SECRET &&
  !RAZORPAY_KEY_ID.includes('placeholder') &&
  !RAZORPAY_KEY_SECRET.includes('replace-with')
);

function generateBookingRef() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let ref = 'SQ-';
  for (let i = 0; i < 7; i++) {
    ref += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return ref;
}

function generateQrToken(bookingRef, eventId, userId) {
  const payload = `${bookingRef}:${eventId}:${userId}:${Date.now()}`;
  const sig = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET).update(payload).digest('hex').slice(0, 16);
  return `SQPASS:${bookingRef}:${eventId}:${sig}`;
}

function signSandboxPayment(orderId, paymentId) {
  return crypto.createHmac('sha256', RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
}

function verifyHmac(data, signature, secret) {
  try {
    const expected = crypto.createHmac('sha256', secret).update(data).digest('hex');
    const actualBuf = Buffer.from(signature, 'hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    if (actualBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(actualBuf, expectedBuf);
  } catch {
    return false;
  }
}

async function createOrder({ event, tierId, quantity, buyer, user, mongoReady, inMemoryState }) {
  const cleanQuantity = Number(quantity);
  if (!Number.isInteger(cleanQuantity) || cleanQuantity < 1 || cleanQuantity > 10) {
    throw new Error('Quantity must be a positive integer between 1 and 10.');
  }

  if (event.status && event.status !== 'published') {
    throw new Error('This event is not currently accepting bookings.');
  }

  // Find ticket tier
  const tiers = Array.isArray(event.ticketTiers) && event.ticketTiers.length > 0
    ? event.ticketTiers
    : [{ id: 'free-rsvp', name: 'General Admission', price: event.priceStarting || 0, currency: 'INR', capacity: event.capacity || 100, soldCount: 0 }];

  const tier = tiers.find((t) => String(t.id) === String(tierId)) || tiers[0];
  const unitPrice = Number(tier.price) || 0;
  const isFree = unitPrice === 0;

  // Capacity check
  const currentSold = Number(tier.soldCount || 0);
  const maxCapacity = Number(tier.capacity || event.capacity || 999999);
  if (currentSold + cleanQuantity > maxCapacity) {
    throw new Error(`Only ${Math.max(0, maxCapacity - currentSold)} ticket(s) remaining for tier "${tier.name}".`);
  }

  const totalAmount = unitPrice * cleanQuantity;
  const bookingRef = generateBookingRef();
  const bookingId = `bk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // For paid events: Razorpay or Sandbox order
  let orderId = '';
  if (!isFree) {
    orderId = `order_sq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  const qrCodeData = generateQrToken(bookingRef, event.id || String(event._id), user.id);

  const booking = {
    id: bookingId,
    bookingRef,
    eventId: event.id || String(event._id),
    userId: user.id,
    buyerName: buyer.name || user.name,
    buyerEmail: buyer.email || user.email,
    buyerPhone: buyer.phone || '',
    ticketTierId: tier.id,
    ticketTierName: tier.name,
    quantity: cleanQuantity,
    unitPrice,
    totalAmount,
    currency: tier.currency || 'INR',
    status: isFree ? 'confirmed' : 'pending',
    paymentStatus: isFree ? 'free' : 'pending',
    paymentOrderId: orderId,
    paymentId: '',
    qrCodeData: isFree ? qrCodeData : '',
    isCheckedIn: false,
    createdAt: new Date(),
  };

  if (mongoReady) {
    await BookingModel.create(booking);
    if (isFree) {
      // Atomically increment soldCount
      await EventModel.updateOne(
        { id: event.id, 'ticketTiers.id': tier.id },
        { $inc: { 'ticketTiers.$.soldCount': cleanQuantity } },
      );
    }
  } else {
    inMemoryState.bookings.push(booking);
    if (isFree && tier) {
      tier.soldCount = (tier.soldCount || 0) + cleanQuantity;
    }
  }

  return {
    bookingId: booking.id,
    bookingRef: booking.bookingRef,
    isFree,
    totalAmount,
    currency: booking.currency,
    orderId,
    keyId: isLiveRazorpay ? RAZORPAY_KEY_ID : 'rzp_test_sandbox_mode',
    isSandbox: !isLiveRazorpay,
    qrCodeData: booking.qrCodeData,
    status: booking.status,
  };
}

async function verifyPayment({ orderId, paymentId, signature, bookingId, mongoReady, inMemoryState }) {
  if (!orderId || !paymentId || !signature) {
    throw new Error('Order ID, payment ID, and signature are required.');
  }

  let booking;
  if (mongoReady) {
    booking = await BookingModel.findOne({
      $or: [{ id: bookingId }, { paymentOrderId: orderId }],
    });
  } else {
    booking = inMemoryState.bookings.find(
      (b) => b.id === bookingId || b.paymentOrderId === orderId,
    );
  }

  if (!booking) {
    throw new Error('Booking record not found for this payment order.');
  }

  if (booking.paymentStatus === 'paid' && booking.status === 'confirmed') {
    return { success: true, alreadyConfirmed: true, booking };
  }

  // Signature verification
  const isValid = verifyHmac(`${orderId}|${paymentId}`, signature, RAZORPAY_KEY_SECRET);
  if (!isValid) {
    throw new Error('Payment signature verification failed. Possible tampering detected.');
  }

  // Issue confirmed ticket
  const qrCodeData = generateQrToken(booking.bookingRef, booking.eventId, booking.userId);
  booking.paymentId = paymentId;
  booking.paymentStatus = 'paid';
  booking.status = 'confirmed';
  booking.qrCodeData = qrCodeData;

  const paymentRecord = {
    id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    bookingId: booking.id,
    orderId,
    paymentId,
    amount: booking.totalAmount,
    currency: booking.currency || 'INR',
    status: 'captured',
    signature,
    method: isLiveRazorpay ? 'RAZORPAY_UPI_CARD' : 'SANDBOX_UPI',
    createdAt: new Date(),
  };

  if (mongoReady) {
    await booking.save();
    await PaymentModel.create(paymentRecord);
    await EventModel.updateOne(
      { id: booking.eventId, 'ticketTiers.id': booking.ticketTierId },
      { $inc: { 'ticketTiers.$.soldCount': booking.quantity } },
    );
    await AuditLogModel.create({
      id: `audit-${Date.now()}`,
      actorId: booking.userId,
      actorEmail: booking.buyerEmail,
      action: 'PAYMENT_CONFIRMED',
      targetType: 'booking',
      targetId: booking.id,
      details: { amount: booking.totalAmount, orderId, paymentId },
    });
  } else {
    inMemoryState.payments.push(paymentRecord);
    const event = inMemoryState.events.find((e) => e.id === booking.eventId);
    if (event && Array.isArray(event.ticketTiers)) {
      const tier = event.ticketTiers.find((t) => t.id === booking.ticketTierId);
      if (tier) tier.soldCount = (tier.soldCount || 0) + booking.quantity;
    }
  }

  return { success: true, booking, qrCodeData };
}

async function verifyCheckIn({ ticketReference, eventId, scannedByUserId, mongoReady, inMemoryState }) {
  const cleanRef = String(ticketReference || '').trim();
  if (!cleanRef) throw new Error('Ticket reference or QR code is required.');

  // Parse QR token format SQPASS:bookingRef:eventId:sig or standalone bookingRef SQ-XXXX
  let lookupRef = cleanRef;
  if (cleanRef.startsWith('SQPASS:')) {
    const parts = cleanRef.split(':');
    lookupRef = parts[1];
  }

  let booking;
  if (mongoReady) {
    booking = await BookingModel.findOne({
      $or: [{ bookingRef: lookupRef }, { id: lookupRef }, { qrCodeData: cleanRef }],
    });
  } else {
    booking = inMemoryState.bookings.find(
      (b) => b.bookingRef === lookupRef || b.id === lookupRef || b.qrCodeData === cleanRef,
    );
  }

  if (!booking) {
    throw new Error(`Ticket with reference "${cleanRef}" not found.`);
  }

  if (eventId && String(booking.eventId) !== String(eventId)) {
    throw new Error('This ticket is for a different event.');
  }

  if (booking.status !== 'confirmed') {
    throw new Error(`Ticket cannot be verified. Current status: ${booking.status}.`);
  }

  if (booking.isCheckedIn) {
    return {
      isValid: false,
      alreadyCheckedIn: true,
      checkedInAt: booking.checkedInAt,
      message: `TICKET ALREADY USED! Checked in on ${new Date(booking.checkedInAt).toLocaleString('en-IN')}.`,
      booking,
    };
  }

  // Atomically mark checked in
  const now = new Date();
  booking.isCheckedIn = true;
  booking.checkedInAt = now;
  booking.checkedInBy = scannedByUserId;

  if (mongoReady) {
    await booking.save();
    await AuditLogModel.create({
      id: `audit-${Date.now()}`,
      actorId: scannedByUserId,
      action: 'TICKET_CHECKED_IN',
      targetType: 'booking',
      targetId: booking.id,
      details: { bookingRef: booking.bookingRef, eventId: booking.eventId },
    });
  }

  return {
    isValid: true,
    alreadyCheckedIn: false,
    message: `Entry approved! Welcome ${booking.buyerName}. (${booking.ticketTierName} × ${booking.quantity})`,
    booking,
  };
}

module.exports = {
  isLiveRazorpay,
  createOrder,
  verifyPayment,
  verifyCheckIn,
  signSandboxPayment,
  generateBookingRef,
  generateQrToken,
};

