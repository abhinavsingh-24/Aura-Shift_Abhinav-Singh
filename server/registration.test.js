const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./index');
const { connectMongo, UserModel } = require('./db');

test('Comprehensive Registration & Authentication Verification Suite', async (t) => {
  // Connect database in backend index module
  if (app.startDatabase) {
    await app.startDatabase();
  }

  // Start Server Instance 1
  let server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  let base = `http://127.0.0.1:${server.address().port}`;

  let server2;
  t.after(async () => {
    if (server && server.listening) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (server2 && server2.listening) {
      await new Promise((resolve) => server2.close(resolve));
    }
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  const timestamp = Date.now();
  const explorerEmail = `explorer-test-${timestamp}@example.com`;
  const organizerEmail = `organiser-test-${timestamp}@example.com`;
  const plainPassword = 'SuperSecretPassword@123';

  // 1. Register a new Explorer account
  const explorerRes = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost:5174' },
    body: JSON.stringify({
      name: 'Aarav Explorer',
      email: explorerEmail,
      password: plainPassword,
      role: 'explorer',
    }),
  });
  assert.equal(explorerRes.status, 201, 'Explorer registration must return 201 Created');
  const explorerData = await explorerRes.json();
  assert.equal(explorerData.user.name, 'Aarav Explorer');
  assert.equal(explorerData.user.email, explorerEmail);
  assert.equal(explorerData.user.role, 'explorer');
  assert.equal(explorerData.user.password, undefined, 'Plain password must never be in user response');
  assert.equal(explorerData.user.passwordHash, undefined, 'Password hash must never be in safeUser response');
  const explorerCookie = explorerRes.headers.get('set-cookie');
  assert.ok(explorerCookie && explorerCookie.includes('sidequest_session='), 'Must set HttpOnly session cookie');

  // 2. Register a new Organiser account (testing 'organiser' spelling normalization)
  const organizerRes = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost:5175' },
    body: JSON.stringify({
      name: 'Vikram Organiser',
      email: organizerEmail,
      password: plainPassword,
      role: 'organiser',
      organizationName: 'Bangalore Indie Stages',
    }),
  });
  assert.equal(organizerRes.status, 201, 'Organiser registration must return 201 Created');
  const organizerData = await organizerRes.json();
  assert.equal(organizerData.user.name, 'Vikram Organiser');
  assert.equal(organizerData.user.email, organizerEmail);
  assert.equal(organizerData.user.role, 'organizer', "'organiser' role should be normalized to 'organizer'");
  const organizerCookie = organizerRes.headers.get('set-cookie');
  assert.ok(organizerCookie && organizerCookie.includes('sidequest_session='), 'Must set HttpOnly session cookie');

  // 3. Log in with each newly created account
  // 3a. Login as Explorer
  const explorerLoginRes = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost:5173' },
    body: JSON.stringify({ email: explorerEmail, password: plainPassword }),
  });
  assert.equal(explorerLoginRes.status, 200, 'Explorer login must succeed with 200 OK');
  const explorerLoginData = await explorerLoginRes.json();
  assert.equal(explorerLoginData.user.email, explorerEmail);

  // 3b. Login as Organiser
  const organizerLoginRes = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost:5173' },
    body: JSON.stringify({ email: organizerEmail, password: plainPassword }),
  });
  assert.equal(organizerLoginRes.status, 200, 'Organiser login must succeed with 200 OK');
  const organizerLoginData = await organizerLoginRes.json();
  assert.equal(organizerLoginData.user.role, 'organizer');

  // 4. Reject duplicate email registration gracefully
  const duplicateRes = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Duplicate Explorer',
      email: explorerEmail.toUpperCase(), // Case insensitive check
      password: plainPassword,
      role: 'explorer',
    }),
  });
  assert.equal(duplicateRes.status, 409, 'Duplicate email registration must return 409 Conflict');
  const duplicateData = await duplicateRes.json();
  assert.equal(duplicateData.message, 'An account with this email already exists.');

  // 5. Reject invalid email and missing fields
  // 5a. Missing name
  const missingNameRes = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `valid-${timestamp}@example.com`, password: plainPassword }),
  });
  assert.equal(missingNameRes.status, 400, 'Missing name must return 400');
  const missingNameData = await missingNameRes.json();
  assert.match(missingNameData.message, /Name must be between 2 and 80 characters/);

  // 5b. Invalid email
  const invalidEmailRes = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Valid Name', email: 'not-an-email', password: plainPassword }),
  });
  assert.equal(invalidEmailRes.status, 400, 'Invalid email must return 400');
  const invalidEmailData = await invalidEmailRes.json();
  assert.match(invalidEmailData.message, /Enter a valid email address/);

  // 5c. Short password (< 8 chars)
  const shortPassRes = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Valid Name', email: `short-${timestamp}@example.com`, password: 'short' }),
  });
  assert.equal(shortPassRes.status, 400, 'Short password must return 400');
  const shortPassData = await shortPassRes.json();
  assert.match(shortPassData.message, /Password must be between 8 and 128 characters/);

  // 5d. Invalid account type
  const badRoleRes = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Valid Name', email: `role-${timestamp}@example.com`, password: plainPassword, role: 'hacker' }),
  });
  assert.equal(badRoleRes.status, 400, 'Invalid role must return 400');

  // 6. Confirm passwords are stored securely hashed
  if (process.env.MONGO_URI) {
    const persistedUser = await UserModel.findOne({ email: explorerEmail }).lean();
    assert.ok(persistedUser, 'User must exist in MongoDB');
    assert.ok(persistedUser.passwordHash, 'User must have a passwordHash');
    assert.notEqual(persistedUser.passwordHash, plainPassword, 'Password must NOT be stored in plaintext');
    assert.ok(persistedUser.passwordHash.includes(':'), 'Password hash must be in salt:scrypt format');
    const [salt, hash] = persistedUser.passwordHash.split(':');
    assert.equal(salt.length, 32, 'Salt should be 16 bytes hex (32 characters)');
    assert.equal(hash.length, 128, 'Derived hash should be 64 bytes hex (128 characters)');
  }

  // 7. Confirm the account remains in the database after restarting the server
  // Close server instance 1
  await new Promise((resolve) => server.close(resolve));

  // Boot server instance 2 on a new port
  server2 = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server2.once('listening', resolve));
  const base2 = `http://127.0.0.1:${server2.address().port}`;

  // Log in on restarted server instance 2
  const restartedLoginRes = await fetch(`${base2}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: explorerEmail, password: plainPassword }),
  });
  assert.equal(restartedLoginRes.status, 200, 'Account must persist across server restarts and allow login');
  const restartedData = await restartedLoginRes.json();
  assert.equal(restartedData.user.email, explorerEmail);

  await new Promise((resolve) => server2.close(resolve));
});
