const { chromium } = require('@playwright/test');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const mongoose = require('mongoose');
const { UserModel } = require('./server/db');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

function waitForPort(port, timeoutMs = 25000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function tryConnect() {
      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timed out waiting for port ${port}`));
        } else {
          setTimeout(tryConnect, 500);
        }
      });
    }
    tryConnect();
  });
}

function waitForVite(port, timeoutMs = 25000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function tryConnect() {
      const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timed out waiting for Vite port ${port}`));
        } else {
          setTimeout(tryConnect, 500);
        }
      });
    }
    tryConnect();
  });
}

async function runVerification() {
  console.log('=== STARTING PRODUCTION-GRADE END-TO-END VERIFICATION ===\n');

  let serverProcess = null;
  let clientProcess = null;
  let browser = null;

  try {
    // 1. Start backend process
    console.log('[1/10] Starting backend server (PORT=3001) connected to Atlas...');
    serverProcess = spawn('node', ['server/index.js'], {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: '3001' },
    });

    serverProcess.stdout.on('data', (d) => {
      const str = d.toString().trim();
      if (str) console.log(`[BACKEND]: ${str}`);
    });
    serverProcess.stderr.on('data', (d) => {
      const str = d.toString().trim();
      if (str) console.error(`[BACKEND ERR]: ${str}`);
    });

    await waitForPort(3001);
    console.log('[1/10] Backend server is healthy on http://127.0.0.1:3001/api/health');

    // 2. Start Vite client process
    console.log('\n[2/10] Starting Vite frontend on http://127.0.0.1:5173...');
    clientProcess = spawn('npx.cmd', ['vite', '--port', '5173', '--strictPort'], {
      cwd: path.resolve(__dirname, 'client'),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      env: { ...process.env },
    });

    clientProcess.stdout.on('data', (d) => {
      const str = d.toString().trim();
      if (str.includes('ready') || str.includes('Local:')) console.log(`[VITE]: ${str}`);
    });

    await waitForVite(5173);
    console.log('[2/10] Vite client is live on http://127.0.0.1:5173');

    // Connect mongoose for verification queries
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[DB] Connected to MongoDB Atlas for persistence verification.');

    // 3. Launch Playwright Chromium
    console.log('\n[3/10] Launching Chromium browser...');
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    let lastApiResponse = null;
    page.on('response', async (res) => {
      if (res.url().includes('/api/auth/')) {
        try {
          const body = await res.text();
          lastApiResponse = { status: res.status(), url: res.url(), body };
        } catch {}
      }
      if (res.url().includes('/api/events')) {
        try {
          const body = await res.json();
          console.log(`[API /api/events]: status ${res.status()} from ${res.url()} count: ${body.events ? body.events.length : 0}`);
        } catch {}
      }
    });

    // 4. Test Explorer Registration
    const explorerEmail = `verif-exp-${Date.now()}@example.in`;
    const explorerPassword = 'Password123!';
    console.log(`\n[4/10] Registering new Explorer account: ${explorerEmail}...`);
    await page.goto('http://127.0.0.1:5173/register');
    await page.fill('input[autoComplete="name"]', 'Deepak Explorer');
    await page.fill('input[type="email"]', explorerEmail);
    await page.fill('input[autoComplete="new-password"]', explorerPassword);
    await page.selectOption('select', 'explorer');
    await page.click('button[type="submit"]');

    await page.waitForTimeout(1500);
    if (page.url().includes('/register')) {
      const err = await page.locator('.message.error-message').textContent().catch(() => '');
      throw new Error(`Explorer registration failed: ${err} (API response: ${JSON.stringify(lastApiResponse)})`);
    }
    const navText = await page.locator('.nav-user').textContent();
    console.log(`✓ Explorer registered successfully! Logged in as: "${navText.trim()}"`);
    console.log(`  Last API status: ${lastApiResponse.status}`);

    // Verify session cookie
    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) => c.name === 'sidequest_session');
    if (!sessionCookie) throw new Error('Session cookie "sidequest_session" was not set!');
    console.log(`✓ Session cookie received: ${sessionCookie.name} (HttpOnly: ${sessionCookie.httpOnly})`);

    // Verify user in MongoDB Atlas
    const explorerUserDoc = await UserModel.findOne({ email: explorerEmail }).lean();
    if (!explorerUserDoc) throw new Error('Explorer user was not persisted to MongoDB Atlas!');
    const hashParts = (explorerUserDoc.passwordHash || '').split(':');
    if (hashParts.length !== 2 || hashParts[0].length !== 32 || hashParts[1].length !== 128) {
      throw new Error(`Invalid scrypt password hash format! Got: ${explorerUserDoc.passwordHash}`);
    }
    console.log(`✓ MongoDB confirmation: User persisted with role "${explorerUserDoc.role}", scrypt hash: ${explorerUserDoc.passwordHash.slice(0, 20)}...`);

    // 5. Test Organiser Registration
    console.log('\n[5/10] Signing out and registering new Organiser account...');
    await page.click('button:has-text("Sign out")');
    await page.waitForTimeout(500);

    const organiserEmail = `verif-org-${Date.now()}@example.in`;
    const organiserPassword = 'OrgPassword456!';
    await page.goto('http://127.0.0.1:5173/register?role=organizer');
    await page.fill('input[autoComplete="name"]', 'Pooja Events');
    await page.fill('input[type="email"]', organiserEmail);
    await page.fill('input[autoComplete="new-password"]', organiserPassword);
    await page.selectOption('select', 'organizer');
    await page.click('button[type="submit"]');

    await page.waitForTimeout(1500);
    if (page.url().includes('/register')) {
      const err = await page.locator('.message.error-message').textContent().catch(() => '');
      throw new Error(`Organiser registration failed: ${err} (API response: ${JSON.stringify(lastApiResponse)})`);
    }
    const orgNavText = await page.locator('.nav-user').textContent();
    console.log(`✓ Organiser registered successfully! Logged in as: "${orgNavText.trim()}"`);

    const orgUserDoc = await UserModel.findOne({ email: organiserEmail }).lean();
    if (!orgUserDoc || orgUserDoc.role !== 'organizer') {
      throw new Error('Organiser user was not persisted with organizer role!');
    }
    console.log(`✓ MongoDB confirmation: Organiser persisted with role "${orgUserDoc.role}"`);

    // 6. Test Duplicate Email Registration
    console.log('\n[6/10] Testing duplicate email registration rejection...');
    await page.click('button:has-text("Sign out")');
    await page.waitForTimeout(500);

    await page.goto('http://127.0.0.1:5173/register');
    await page.fill('input[autoComplete="name"]', 'Imposter Deepak');
    await page.fill('input[type="email"]', explorerEmail); // Duplicate!
    await page.fill('input[autoComplete="new-password"]', 'AnotherPassword');
    await page.click('button[type="submit"]');

    await page.waitForTimeout(1000);
    const dupError = await page.locator('.message.error-message').textContent();
    console.log(`✓ Duplicate registration rejected with HTTP ${lastApiResponse.status}: "${dupError}"`);
    if (lastApiResponse.status !== 409) {
      throw new Error(`Expected HTTP 409 for duplicate email, got ${lastApiResponse.status}`);
    }

    // 7. Test Login with Both Accounts
    console.log('\n[7/10] Testing login with newly created accounts...');
    // Login explorer
    await page.goto('http://127.0.0.1:5173/login');
    await page.fill('input[type="email"]', explorerEmail);
    await page.fill('input[type="password"]', explorerPassword);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);
    await page.waitForSelector('.nav-user');
    console.log('✓ Explorer logged in successfully.');

    // Sign out & login organiser
    await page.click('button:has-text("Sign out")');
    await page.waitForTimeout(500);
    await page.goto('http://127.0.0.1:5173/login');
    await page.fill('input[type="email"]', organiserEmail);
    await page.fill('input[type="password"]', organiserPassword);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);
    await page.waitForSelector('.nav-user');
    console.log('✓ Organiser logged in successfully.');

    // 8. Homepage Event Cards Audit: Ensure NO "Concert Tour" spam and verified India events load
    console.log('\n[8/10] Auditing Homepage event cards for duplicate/synthetic spam...');
    await page.goto('http://127.0.0.1:5173/');
    const listBtn = page.getByRole('button', { name: 'List' });
    if (await listBtn.isVisible()) {
      await listBtn.click();
    }
    await page.waitForSelector('.event-card');

    const cardTitles = await page.locator('.event-card h3').allTextContents();
    console.log(`Found ${cardTitles.length} event cards rendered on homepage.`);
    console.log('ALL CARD TITLES ON PAGE:', JSON.stringify(cardTitles, null, 2));

    const concertTourCards = cardTitles.filter((t) => /Concert Tour \d+/i.test(t));
    if (concertTourCards.length > 0) {
      throw new Error(`FAILED: Found ${concertTourCards.length} synthetic "Concert Tour" cards on homepage: ${concertTourCards.join(', ')}`);
    }
    console.log('✓ 0 synthetic "Concert Tour <timestamp>" cards found on homepage! Clean dataset verified.');

    // Verify genuine Indian event titles
    const sampleFound = cardTitles.filter((t) =>
      /Bengaluru Tech Summit|Mood Indigo|PyCon India|T-Hub|Saarang|Sunburn|Jaipur Literature/i.test(t)
    );
    console.log(`✓ Verified ${sampleFound.length} prominent Indian events active on homepage.`);

    // 9. Restart Backend and Confirm Accounts Persist in MongoDB
    console.log('\n[9/10] Testing backend restart and data persistence...');
    serverProcess.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 2000));

    console.log('Starting backend server again...');
    serverProcess = spawn('node', ['server/index.js'], {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: '3001' },
    });
    await waitForPort(3001);
    console.log('✓ Backend restarted successfully.');

    // Log in again after restart to verify persistent session
    await page.goto('http://127.0.0.1:5173/login');
    await page.fill('input[type="email"]', explorerEmail);
    await page.fill('input[type="password"]', explorerPassword);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);
    await page.waitForSelector('.nav-user');
    console.log('✓ Account persisted and logged in successfully after backend restart!');

    // 10. Clean up test users
    console.log('\n[10/10] Cleaning up temporary test accounts from Atlas...');
    await UserModel.deleteMany({ email: { $in: [explorerEmail, organiserEmail] } });
    console.log('✓ Test accounts removed.');

    console.log('\n======================================================');
    console.log('🎉 ALL PRODUCTION-GRADE VERIFICATION TESTS PASSED 100%!');
    console.log('======================================================\n');
    process.exit(0);
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (serverProcess) {
      try { require('child_process').execSync(`taskkill /pid ${serverProcess.pid} /T /F`); } catch {}
    }
    if (clientProcess) {
      try { require('child_process').execSync(`taskkill /pid ${clientProcess.pid} /T /F`); } catch {}
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => {});
    }
  }
}

runVerification().catch((err) => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
