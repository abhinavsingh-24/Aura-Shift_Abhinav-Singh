const { chromium } = require('@playwright/test');

async function testBrowserRegistration() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', (msg) => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('request', (req) => {
    if (req.url().includes('/api/')) {
      console.log('REQ:', req.method(), req.url());
      console.log('REQ HEADERS:', JSON.stringify(req.headers()));
      console.log('REQ POST DATA:', req.postData());
    }
  });
  page.on('response', async (res) => {
    if (res.url().includes('/api/')) {
      console.log('RES:', res.status(), res.url());
      try {
        console.log('RES BODY:', await res.text());
      } catch (e) {
        console.log('RES BODY ERROR:', e.message);
      }
    }
  });

  console.log('Navigating to http://localhost:5173/register...');
  await page.goto('http://localhost:5173/register', { waitUntil: 'networkidle' });

  console.log('Filling form...');
  await page.fill('input[autoComplete="name"]', 'Deep Dive Explorer');
  const uniqueEmail = `explorer-debug-${Date.now()}@example.com`;
  await page.fill('input[type="email"]', uniqueEmail);
  await page.fill('input[autoComplete="new-password"]', 'CorrectPassword123');
  await page.selectOption('select', 'explorer');

  console.log('Submitting form...');
  await page.click('button[type="submit"]');

  await page.waitForTimeout(2000);

  const errorElement = page.locator('.message.error-message');
  if (await errorElement.isVisible()) {
    console.log('ERROR ON PAGE:', await errorElement.textContent());
  } else {
    console.log('SUCCESS! Current URL:', page.url());
  }

  await browser.close();
}

testBrowserRegistration().catch((err) => {
  console.error('Test crashed:', err);
  process.exit(1);
});

