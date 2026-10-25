const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./index');
const { signSandboxPayment } = require('./payments');

function futureDate(offsetDays = 5) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

test('Ticketing, Payments & Role Authorization Test Suite', async (t) => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(() => new Promise((resolve) => server.close(resolve)));

  // 1. Create Organizer Account & Publish Event with Ticket Tiers
  const orgEmail = `org-test-${Date.now()}@example.in`;
  const orgRes = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Organizer Pro',
      email: orgEmail,
      password: 'OrganizerPassword@123',
      role: 'organizer',
    }),
  });
  assert.equal(orgRes.status, 201);
  const orgCookie = orgRes.headers.get('set-cookie').split(';')[0];

  const createEventRes = await fetch(`${base}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: orgCookie },
    body: JSON.stringify({
      title: 'Bangalore Indie Game & Tech Fest',
      description: 'Hands on indie game showcases, interactive dev sprints and keynote discussions.',
      category: 'Technology',
      date: futureDate(10),
      startTime: '10:00',
      city: 'Bengaluru',
      locality: 'Indiranagar',
      venue: 'Indie Loft Arena',
      capacity: 50,
      priceStarting: 499,
      ticketTiers: [
        { id: 'tier-std', name: 'Standard Pass', price: 499, capacity: 40, soldCount: 0 },
        { id: 'tier-vip', name: 'VIP Developer Pass', price: 1499, capacity: 10, soldCount: 0 },
      ],
    }),
  });
  assert.equal(createEventRes.status, 201);
  const createdEvent = (await createEventRes.json()).event;
  const eventId = createdEvent.id;

  // 2. Buyer 1 registers and initiates paid checkout
  const buyerEmail = `buyer-test-${Date.now()}@example.in`;
  const buyerRes = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Rohan Developer',
      email: buyerEmail,
      password: 'BuyerPassword@123',
      role: 'explorer',
    }),
  });
  assert.equal(buyerRes.status, 201);
  const buyerCookie = buyerRes.headers.get('set-cookie').split(';')[0];

  // Try creating order with invalid quantity
  const badQtyRes = await fetch(`${base}/api/payments/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: buyerCookie },
    body: JSON.stringify({ eventId, tierId: 'tier-std', quantity: -1 }),
  });
  assert.equal(badQtyRes.status, 400);

  // Valid order creation
  const orderRes = await fetch(`${base}/api/payments/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: buyerCookie },
    body: JSON.stringify({ eventId, tierId: 'tier-std', quantity: 2 }),
  });
  assert.equal(orderRes.status, 201);
  const orderData = await orderRes.json();
  assert.equal(orderData.totalAmount, 499 * 2);
  assert.equal(orderData.currency, 'INR');
  assert.ok(orderData.orderId);
  assert.ok(orderData.bookingRef);

  // Tampered payment signature verification must FAIL
  const badSigRes = await fetch(`${base}/api/payments/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: buyerCookie },
    body: JSON.stringify({
      orderId: orderData.orderId,
      paymentId: 'pay_fake_123',
      signature: '0000000000000000000000000000000000000000000000000000000000000000',
      bookingId: orderData.bookingId,
    }),
  });
  assert.equal(badSigRes.status, 400);

  // Valid sandbox payment must succeed and issue verified ticket with QR code
  const payRes = await fetch(`${base}/api/payments/sandbox-pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: buyerCookie },
    body: JSON.stringify({
      orderId: orderData.orderId,
      bookingId: orderData.bookingId,
    }),
  });
  assert.equal(payRes.status, 200);
  const payData = await payRes.json();
  assert.equal(payData.booking.status, 'confirmed');
  assert.equal(payData.booking.paymentStatus, 'paid');
  assert.ok(payData.qrCodeData);

  // 3. Buyer views tickets under /api/my-bookings
  const myBookingsRes = await fetch(`${base}/api/my-bookings`, {
    headers: { Cookie: buyerCookie },
  });
  assert.equal(myBookingsRes.status, 200);
  const myBookings = await myBookingsRes.json();
  assert.equal(myBookings.count >= 1, true);
  const confirmedBooking = myBookings.bookings.find((b) => b.id === orderData.bookingId);
  assert.ok(confirmedBooking);
  assert.equal(confirmedBooking.bookingRef, orderData.bookingRef);

  // 4. Organiser Check-In Verification
  // Check in with valid reference
  const checkInRes = await fetch(`${base}/api/organizer/check-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: orgCookie },
    body: JSON.stringify({
      ticketReference: orderData.bookingRef,
      eventId,
    }),
  });
  assert.equal(checkInRes.status, 200);
  const checkInData = await checkInRes.json();
  assert.equal(checkInData.isValid, true);
  assert.equal(checkInData.alreadyCheckedIn, false);

  // Second check-in attempt MUST fail to prevent reuse
  const secondCheckIn = await fetch(`${base}/api/organizer/check-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: orgCookie },
    body: JSON.stringify({
      ticketReference: orderData.bookingRef,
      eventId,
    }),
  });
  assert.equal(secondCheckIn.status, 200);
  const secondData = await secondCheckIn.json();
  assert.equal(secondData.isValid, false);
  assert.equal(secondData.alreadyCheckedIn, true);

  // 5. Organiser Attendee CSV Export
  const csvRes = await fetch(`${base}/api/organizer/events/${eventId}/attendees/csv`, {
    headers: { Cookie: orgCookie },
  });
  assert.equal(csvRes.status, 200);
  const csvText = await csvRes.text();
  assert.ok(csvText.includes('Booking Ref'));
  assert.ok(csvText.includes(orderData.bookingRef));
  assert.ok(csvText.includes('YES')); // Checked in is YES

  // 6. Security & Role Permissions: Explorer cannot access organizer or admin endpoints
  const forbiddenOrgEvents = await fetch(`${base}/api/organizer/events`, {
    headers: { Cookie: buyerCookie },
  });
  assert.equal(forbiddenOrgEvents.status, 403);

  const forbiddenAdmin = await fetch(`${base}/api/admin/overview`, {
    headers: { Cookie: buyerCookie },
  });
  assert.equal(forbiddenAdmin.status, 403);

  // 7. Admin role verification
  const adminEmail = `admin-test-${Date.now()}@example.in`;
  const adminRes = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'System Admin Pro',
      email: adminEmail,
      password: 'AdminPassword@123',
      role: 'admin',
    }),
  });
  assert.equal(adminRes.status, 201);
  const adminCookie = adminRes.headers.get('set-cookie').split(';')[0];

  const adminOverview = await fetch(`${base}/api/admin/overview`, {
    headers: { Cookie: adminCookie },
  });
  assert.equal(adminOverview.status, 200);
  const adminData = await adminOverview.json();
  assert.equal(adminData.systemStatus, 'healthy');
});

