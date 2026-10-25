const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./index');

function dateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

test('API validates events, creates quests, and handles registration safely', async (t) => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const healthResponse = await fetch(`${base}/api/health`);
  assert.equal(healthResponse.status, 200);
  assert.equal((await healthResponse.json()).status, 'ok');

  const invalidResponse = await fetch(`${base}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Invalid quest', description: 'Bad date', category: 'Music', date: '2026-02-30',
      startTime: '18:00', city: 'Test City', locality: 'Test Area', venue: 'Test Hall', organizerName: 'Test',
    }),
  });
  assert.equal(invalidResponse.status, 401, 'event creation requires an organizer session');

  const unauthorizedCreate = await fetch(`${base}/api/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'No account', description: 'should fail', category: 'Music', date: dateOffset(2), startTime: '18:00', city: 'Test', locality: 'Test', venue: 'Test', organizerName: 'Test' }) });
  assert.equal(unauthorizedCreate.status, 401);

  const explorerEmail = `explorer-${Date.now()}@example.com`;
  const explorerResponse = await fetch(`${base}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Test Explorer', email: explorerEmail, password: 'safe-demo-password-123', role: 'explorer' }) });
  assert.equal(explorerResponse.status, 201);
  const explorerCookie = explorerResponse.headers.get('set-cookie').split(';')[0];
  const forbiddenCreate = await fetch(`${base}/api/events`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: explorerCookie }, body: JSON.stringify({ title: 'Not allowed', description: 'should fail', category: 'Music', date: dateOffset(2), startTime: '18:00', city: 'Test', locality: 'Test', venue: 'Test', organizerName: 'Test' }) });
  assert.equal(forbiddenCreate.status, 403);

  const organizerEmail = `organizer-${Date.now()}@example.com`;
  const accountResponse = await fetch(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test Organizer', email: organizerEmail, password: 'safe-demo-password-123', role: 'organizer' }),
  });
  assert.equal(accountResponse.status, 201);
  const duplicateAccountResponse = await fetch(`${base}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Duplicate', email: organizerEmail, password: 'safe-demo-password-123', role: 'organizer' }) });
  assert.equal(duplicateAccountResponse.status, 409);
  const invalidLogin = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: organizerEmail, password: 'incorrect-password' }) });
  assert.equal(invalidLogin.status, 401);
  const loginResponse = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: organizerEmail, password: 'safe-demo-password-123' }) });
  assert.equal(loginResponse.status, 200);
  const sessionCookie = loginResponse.headers.get('set-cookie').split(';')[0];
  const meResponse = await fetch(`${base}/api/auth/me`, { headers: { Cookie: sessionCookie } });
  assert.equal((await meResponse.json()).user.role, 'organizer');

  const authenticatedInvalidResponse = await fetch(`${base}/api/events`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
    body: JSON.stringify({ title: 'Invalid quest', description: 'Bad date', category: 'Music', date: '2026-02-30', startTime: '18:00', city: 'Test City', locality: 'Test Area', venue: 'Test Hall', organizerName: 'Test' }),
  });
  assert.equal(authenticatedInvalidResponse.status, 400);
  assert.ok((await authenticatedInvalidResponse.json()).errors.length > 0);

  const createResponse = await fetch(`${base}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
    body: JSON.stringify({
      title: 'API Test Quest', description: 'A test event', category: 'Music', interests: 'Music, music, Tech',
      date: dateOffset(2), startTime: '18:00', city: 'Test City', locality: 'Test Area', venue: 'Test Hall',
      organizerName: 'Client-supplied name should be ignored', capacity: 2, latitude: 19.076, longitude: 72.8777,
    }),
  });
  assert.equal(createResponse.status, 201);
  const created = (await createResponse.json()).event;
  assert.ok(created.id);
  assert.deepEqual(created.interests, ['Music', 'Tech']);
  assert.equal(created.organizerName, 'Test Organizer', 'organizer display name comes from the signed-in account');
  assert.equal(created.latitude, 19.076);

  const filteredResponse = await fetch(`${base}/api/events?search=tech&category=music&city=Test%20City&locality=Test%20Area`);
  assert.equal(filteredResponse.status, 200);
  const filteredData = await filteredResponse.json();
  assert.ok(filteredData.events.some((item) => item.id === created.id), 'search should match interests and combine filters case-insensitively');

  const unauthenticatedRegistration = await fetch(`${base}/api/events/${encodeURIComponent(created.id)}/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participantName: 'Forged Name', participantId: 'forged-id' }),
  });
  assert.equal(unauthenticatedRegistration.status, 401, 'registration must require a signed-in account');

  const explorerRegistration = await fetch(`${base}/api/events/${encodeURIComponent(created.id)}/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: explorerCookie },
    body: JSON.stringify({ participantName: 'Forged Name', participantId: 'forged-id', userId: 'someone-else' }),
  });
  assert.equal(explorerRegistration.status, 201);
  const firstRegistration = (await explorerRegistration.json()).registration;
  assert.equal(firstRegistration.participantName, 'Test Explorer', 'participant name must come from the authenticated account');
  assert.notEqual(firstRegistration.participantId, 'forged-id', 'participant ID must not be client-controlled');

  const duplicateResponse = await fetch(`${base}/api/events/${encodeURIComponent(created.id)}/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: explorerCookie },
    body: JSON.stringify({ participantName: 'Different Name', participantId: 'different-id' }),
  });
  assert.equal(duplicateResponse.status, 409, 'same account cannot register twice even with a forged client ID');

  const secondExplorerEmail = `explorer-second-${Date.now()}@example.com`;
  const secondExplorerResponse = await fetch(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Second Explorer', email: secondExplorerEmail, password: 'safe-demo-password-123', role: 'explorer' }),
  });
  assert.equal(secondExplorerResponse.status, 201);
  const secondExplorerCookie = secondExplorerResponse.headers.get('set-cookie').split(';')[0];
  const secondRegistration = await fetch(`${base}/api/events/${encodeURIComponent(created.id)}/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: secondExplorerCookie }, body: JSON.stringify({}),
  });
  assert.equal(secondRegistration.status, 201);

  const capacityResponse = await fetch(`${base}/api/events/${encodeURIComponent(created.id)}/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: sessionCookie }, body: JSON.stringify({}),
  });
  assert.equal(capacityResponse.status, 409);

  const privateRecordsResponse = await fetch(`${base}/api/events/${encodeURIComponent(created.id)}/registrations`);
  assert.equal(privateRecordsResponse.status, 404);

  const logoutResponse = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { Cookie: sessionCookie } });
  assert.equal(logoutResponse.status, 200);
  const afterLogout = await fetch(`${base}/api/auth/me`, { headers: { Cookie: logoutResponse.headers.get('set-cookie').split(';')[0] } });
  assert.equal((await afterLogout.json()).user, null);
});

test('API handles event details, recommendations, insights, reports, and bookings with proper authorization', async (t) => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(() => new Promise((resolve) => server.close(resolve)));

  // 1. GET /api/events/:id (not found vs found)
  const notFound = await fetch(`${base}/api/events/non-existent-id`);
  assert.equal(notFound.status, 404);
  assert.match((await notFound.json()).message, /Event not found/);

  // 2. GET /api/recommendations
  const recommendationsResponse = await fetch(`${base}/api/recommendations?interests=Music,Technology&city=Bengaluru`);
  assert.equal(recommendationsResponse.status, 200);
  const recData = await recommendationsResponse.json();
  assert.ok(Array.isArray(recData.recommendations));

  // 3. GET /api/insights
  const insightsResponse = await fetch(`${base}/api/insights`);
  assert.equal(insightsResponse.status, 200);
  const insightsData = await insightsResponse.json();
  assert.ok(typeof insightsData.totalRegistrations === 'number');
  assert.ok(Array.isArray(insightsData.popularCategories));
  assert.ok(Array.isArray(insightsData.topEvents));

  // 4. Authenticated explorer for bookings and reporting
  const userEmail = `explorer-reporting-${Date.now()}@example.com`;
  const registerRes = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Report Tester', email: userEmail, password: 'safe-password-123', role: 'explorer' }),
  });
  assert.equal(registerRes.status, 201);
  const userCookie = registerRes.headers.get('set-cookie').split(';')[0];

  // GET /api/my-registrations requires auth
  const unauthBookings = await fetch(`${base}/api/my-registrations`);
  assert.equal(unauthBookings.status, 401);

  const authBookings = await fetch(`${base}/api/my-registrations`, { headers: { Cookie: userCookie } });
  assert.equal(authBookings.status, 200);
  const bookingsData = await authBookings.json();
  assert.ok(Array.isArray(bookingsData.bookings));

  // 5. POST /api/reports
  const unauthReport = await fetch(`${base}/api/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetType: 'organizer', targetId: 'org-test', targetLabel: 'Test Org', reason: 'spam', details: 'Spam' }),
  });
  assert.equal(unauthReport.status, 401);

  // Organizer report with targetLabel (testing bug fix for req.body.targetLabel)
  const organizerReportRes = await fetch(`${base}/api/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: userCookie },
    body: JSON.stringify({
      targetType: 'organizer',
      targetId: 'org-troublesome-1',
      targetLabel: 'Troublesome Host',
      reason: 'spam',
      details: 'Sending spam invitations constantly.',
    }),
  });
  assert.equal(organizerReportRes.status, 201);
  const reportPayload = await organizerReportRes.json();
  assert.equal(reportPayload.report.targetLabel, 'Troublesome Host');
  assert.equal(reportPayload.report.targetType, 'organizer');

  // Duplicate report for the same target should return 409
  const duplicateReport = await fetch(`${base}/api/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: userCookie },
    body: JSON.stringify({
      targetType: 'organizer',
      targetId: 'org-troublesome-1',
      targetLabel: 'Troublesome Host',
      reason: 'spam',
      details: 'Another report for same target.',
    }),
  });
  assert.equal(duplicateReport.status, 409);

  // Missing targetLabel for organizer report should return 400
  const missingLabelReport = await fetch(`${base}/api/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: userCookie },
    body: JSON.stringify({
      targetType: 'organizer',
      targetId: 'org-no-label',
      reason: 'spam',
      details: 'Missing label',
    }),
  });
  assert.equal(missingLabelReport.status, 400);

  // GET /api/my-reports
  const unauthMyReports = await fetch(`${base}/api/my-reports`);
  assert.equal(unauthMyReports.status, 401);

  const myReportsRes = await fetch(`${base}/api/my-reports`, { headers: { Cookie: userCookie } });
  assert.equal(myReportsRes.status, 200);
  const myReportsData = await myReportsRes.json();
  assert.ok(Array.isArray(myReportsData.reports));
  assert.ok(myReportsData.reports.some((r) => r.targetId === 'org-troublesome-1'));

  // 6. Malformed JSON handling
  const malformedJson = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"invalid": json',
  });
  assert.equal(malformedJson.status, 400);
  assert.match((await malformedJson.json()).message, /valid JSON/);
});
