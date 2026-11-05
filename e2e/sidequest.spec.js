import { test, expect } from '@playwright/test';

function futureDateString(offsetDays = 3) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function registerTestUser(page, { name = 'Test Explorer', role = 'explorer' } = {}) {
  const uniqueEmail = `test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const password = 'test-password-123';
  await page.goto(`/register?role=${role}`);
  await page.fill('input[autoComplete="name"]', name);
  await page.fill('input[type="email"]', uniqueEmail);
  await page.fill('input[autoComplete="new-password"]', password);
  await page.selectOption('select', role);
  await page.click('button[type="submit"]');
  await expect(page.locator('.nav-user')).toBeVisible();
  return { name, email: uniqueEmail, password, role };
}

test.describe('SIDEQUEST End-to-End Suite', () => {
  test('1 & 2. Homepage loads, search and category filters work', async ({ page }) => {
    await page.goto('/');

    // Check header and hero title
    await expect(page.locator('#hero-title')).toContainText('Your next adventure is');
    await expect(page.locator('.topbar')).toBeVisible();

    // Switch view to list to verify cards
    const listViewBtn = page.getByRole('button', { name: 'List' });
    if (await listViewBtn.isVisible()) {
      await listViewBtn.click();
    }

    // Check quest cards are rendered
    const eventCards = page.locator('.event-card');
    await expect(eventCards.first()).toBeVisible();

    // Search filter
    const searchInput = page.locator('input[name="search"]');
    await searchInput.fill('Sunset');
    await page.waitForTimeout(400);
    await expect(page.locator('.event-card h3').first()).toContainText('Sunset Open Mic Night');

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(400);

    // Filter by quick category chip
    const musicChip = page.getByRole('button', { name: /Music/i }).first();
    if (await musicChip.isVisible()) {
      await musicChip.click();
      await page.waitForTimeout(400);
      await expect(page.locator('.event-card h3').first()).toBeVisible();
    }
  });

  test('3 & 4. Explorer registration, session persistence, and login', async ({ page, context }) => {
    const email = `explorer-auth-${Date.now()}@example.com`;
    const password = 'e2e-password-123';

    // Register as new Explorer
    await page.goto('/register');
    await page.fill('input[autoComplete="name"]', 'Atlas Explorer');
    await page.fill('input[type="email"]', email);
    await page.fill('input[autoComplete="new-password"]', password);
    await page.selectOption('select', 'explorer');
    await page.click('button[type="submit"]');

    // Expect user greeting in topbar
    await expect(page.locator('.nav-user')).toContainText('Atlas');

    // Verify session cookie was set
    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) => c.name === 'sidequest_session');
    expect(sessionCookie).toBeTruthy();

    // Log out
    await page.click('button:has-text("Sign out")');
    await expect(page.locator('a[href="/login"]')).toBeVisible();

    // Log in again
    await page.goto('/login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    await expect(page.locator('.nav-user')).toContainText('Atlas');
  });

  test('5 & 6. Save quest and register for an event (RSVP)', async ({ page }) => {
    // Register self-contained user
    await registerTestUser(page, { name: 'Booker Explorer', role: 'explorer' });

    // Go to quest board in list view
    await page.goto('/quests');
    const listViewBtn = page.getByRole('button', { name: 'List' });
    if (await listViewBtn.isVisible()) {
      await listViewBtn.click();
    }

    // Save the first event
    const firstSaveBtn = page.locator('.event-card .save-btn').first();
    await firstSaveBtn.click();
    await expect(page.locator('.toast')).toBeVisible();

    // Verify it appears in Saved quests
    await page.goto('/saved');
    await expect(page.locator('.saved-card').first()).toBeVisible();

    // Open quest details and RSVP
    await page.goto('/quests');
    if (await listViewBtn.isVisible()) await listViewBtn.click();
    await page.locator('.event-card .secondary-btn:has-text("View details")').first().click();

    // Modal is open
    await expect(page.locator('.modal-card')).toBeVisible();
    const joinBtn = page.locator('.modal-card button:has-text("Join this quest")');
    await expect(joinBtn).toBeVisible();
    await joinBtn.click();
    await expect(page.locator('.toast')).toBeVisible();

    // Close modal
    await page.locator('.close-button').click();

    // Check bookings page
    await page.goto('/bookings');
    await expect(page.locator('.event-card-body h3').first()).toBeVisible();
  });

  test('7, 8 & 9. Organizer registration, publishing, and board display', async ({ page }) => {
    const orgName = `Host ${Date.now()}`;
    const customQuestTitle = `Indie Acoustic Showcase ${Date.now()}`;
    await registerTestUser(page, { name: orgName, role: 'organizer' });

    // Navigate to publish
    await page.goto('/publish');
    await expect(page.locator('form.quest-form')).toBeVisible();

    // Fill event form
    await page.fill('input[placeholder="Sunset yoga social"]', customQuestTitle);
    await page.selectOption('select', 'Music');
    await page.fill('textarea[placeholder*="Tell people what to expect"]', 'An exclusive acoustic live experience in the garden.');
    await page.fill('input[placeholder*="Music, Community"]', 'Music, Indie, Acoustic');
    await page.fill('input[type="date"]', futureDateString(4));
    await page.fill('input[type="time"]', '19:30');
    await page.fill('input[placeholder="Bengaluru"]', 'Bengaluru');
    await page.fill('input[placeholder="Koramangala"]', 'Indiranagar');
    await page.fill('input[placeholder="Riverside Lawn"]', 'Acoustic Loft');
    await page.fill('input[placeholder*="Optional capacity"]', '50');

    // Submit form
    await page.click('button[type="submit"]:has-text("Publish quest")');
    await expect(page.locator('.success-message')).toContainText('Quest published successfully');

    // Verify event is listed on Quest Board
    await page.goto('/quests');
    const listViewBtn = page.getByRole('button', { name: 'List' });
    if (await listViewBtn.isVisible()) await listViewBtn.click();
    await page.fill('input[name="search"]', customQuestTitle);
    await page.waitForTimeout(500);
    await expect(page.locator('.event-card h3').filter({ hasText: customQuestTitle })).toBeVisible();

    // Verify event is visible in Organizer Hub
    await page.goto('/organizer');
    await expect(page.locator('.insight-item strong').filter({ hasText: customQuestTitle })).toBeVisible();
  });

  test('10. Interactive fantasy map view, selection and controls', async ({ page }) => {
    await page.goto('/quests');
    const mapViewBtn = page.getByRole('button', { name: 'Map' });
    if (await mapViewBtn.isVisible()) {
      await mapViewBtn.click();
    }

    // Verify map canvas exists
    const mapCanvas = page.locator('[data-testid="map-canvas"]');
    await expect(mapCanvas).toBeVisible();

    // Check zoom controls
    const initialZoom = await mapCanvas.getAttribute('data-zoom');
    const zoomInBtn = page.getByRole('button', { name: 'Zoom in' });
    await zoomInBtn.click();
    await page.waitForTimeout(300);

    const newZoom = await mapCanvas.getAttribute('data-zoom');
    expect(Number(newZoom)).toBeGreaterThanOrEqual(Number(initialZoom));

    // Reset view
    await page.getByRole('button', { name: 'Reset map view' }).click();

    // Click a quest paper on the map
    const paper = page.locator('.quest-paper').first();
    if (await paper.isVisible()) {
      await paper.click();
      await expect(page.locator('.quest-preview')).toBeVisible();
    }
  });

  test('11. Quest Chains creation, adding stops, and reordering', async ({ page }) => {
    await page.goto('/chains');

    // Create a new chain
    const chainName = `Adventure Day ${Date.now()}`;
    await page.fill('input[aria-label="Quest Chain name"]', chainName);
    await page.click('button:has-text("Create Quest Chain")');

    await expect(page.locator('.chain-card.active h3')).toContainText(chainName);

    // Add a quest to the active chain from quest details
    await page.goto('/quests');
    const listViewBtn = page.getByRole('button', { name: 'List' });
    if (await listViewBtn.isVisible()) await listViewBtn.click();
    await page.locator('.event-card .secondary-btn:has-text("View details")').first().click();

    const addToChainBtn = page.locator('.chain-add-btn');
    await expect(addToChainBtn).toBeVisible();
    await addToChainBtn.click();
    await expect(page.locator('.toast')).toBeVisible();
    await page.locator('.close-button').click();

    // Verify stop in chain
    await page.goto('/chains');
    await expect(page.locator('.chain-stop').first()).toBeVisible();
  });

  test('12. Trust & safety reporting and validation', async ({ page }) => {
    // Log in as explorer
    await registerTestUser(page, { name: 'Safety Reporter', role: 'explorer' });

    // Open quest details and submit a safety report
    await page.goto('/quests');
    const listViewBtn = page.getByRole('button', { name: 'List' });
    if (await listViewBtn.isVisible()) await listViewBtn.click();
    await page.locator('.event-card .secondary-btn:has-text("View details")').first().click();

    // Submit report form
    await page.selectOption('.safety-report-inline select', 'unsafe');
    await page.fill('.safety-report-inline textarea', 'Test safety report detail for moderation verification.');
    await page.click('.safety-report-inline button:has-text("Report this event")');

    await expect(page.locator('.safety-report-inline [role="status"]')).toContainText('Report received');
    await page.locator('.close-button').click();

    // Verify submitted reports on safety page
    await page.goto('/safety');
    await expect(page.locator('.report-list .review-card').first()).toBeVisible();
  });

  test('13. Protected routes redirect or show auth gate when signed out', async ({ page }) => {
    // Ensure signed out
    await page.goto('/');
    const signOutBtn = page.locator('button:has-text("Sign out")');
    if (await signOutBtn.isVisible()) {
      await signOutBtn.click();
    }

    // Try accessing organizer publish without auth
    await page.goto('/publish');
    await expect(page.locator('.auth-gate')).toBeVisible();
    await expect(page.locator('a[href*="/register?role=organizer"]')).toBeVisible();

    // Try accessing bookings without auth
    await page.goto('/bookings');
    await expect(page.locator('.auth-gate')).toBeVisible();
    await expect(page.locator('.auth-gate a[href*="/login"]')).toBeVisible();
  });

  test('14. Responsive mobile viewport navigation drawer', async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    const menuToggle = page.locator('.mobile-menu-toggle');
    await expect(menuToggle).toBeVisible();

    // Open menu
    await menuToggle.click();
    const nav = page.locator('#primary-nav');
    await expect(nav).toHaveClass(/is-open/);

    // Click link inside menu
    await nav.locator('a[href="/quests"]').click();
    await expect(page).toHaveURL(/.*\/quests/);

    // Reset viewport to desktop standard
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('15. Complete India ticketing & sandbox payment journey with QR ticket issuance', async ({ page }) => {
    // Register a new explorer
    await registerTestUser(page, { name: 'Aarav Patel', role: 'explorer' });

    // Navigate to homepage and ensure user state is ready
    await page.goto('/');
    await expect(page.locator('.nav-user')).toBeVisible();

    // Switch view to list to access event cards
    const listViewBtn = page.getByRole('button', { name: 'List' });
    if (await listViewBtn.isVisible()) {
      await listViewBtn.click();
    }

    // Click booking button on the first event card
    const bookBtn = page.locator('.event-card .card-actions .primary-btn').first();
    await expect(bookBtn).toBeVisible();
    await bookBtn.click();

    // Verify Checkout modal opens
    const checkoutModal = page.locator('.checkout-modal');
    await expect(checkoutModal).toBeVisible();
    await expect(checkoutModal.locator('.price-breakdown-card')).toBeVisible();

    // Click Proceed to Pay
    const submitBtn = checkoutModal.locator('button[type="submit"]');
    await submitBtn.click();

    // Wait for India Payment Sandbox step and simulate payment
    const sandboxBtn = checkoutModal.locator('.sandbox-confirm-btn');
    await expect(sandboxBtn).toBeVisible({ timeout: 8000 });
    await sandboxBtn.click();

    // Verify booking confirmed state with QR code
    await expect(checkoutModal.locator('.booking-confirmed-view')).toBeVisible({ timeout: 8000 });
    await expect(checkoutModal.locator('.ticket-qr-container svg')).toBeVisible();

    // Navigate to My Bookings
    await checkoutModal.locator('button:has-text("Go to My Bookings")').click();
    await page.waitForURL(/.*\/bookings/);

    // Verify digital ticket pass is rendered with QR code and booking reference
    const ticketPass = page.locator('.digital-ticket-pass').first();
    await expect(ticketPass).toBeVisible();
    await expect(ticketPass.locator('.reference-code, .booking-ref')).toBeVisible();
    await expect(ticketPass.locator('svg')).toBeVisible();
  });

  test('16. Quest Radar navigation, filtering, match reasons, and state recovery', async ({ page }) => {
    // 1. Navigate from homepage to Quest Radar using the navigation bar
    await page.goto('/');
    const radarNavLink = page.locator('#primary-nav a[href="/radar"]');
    await expect(radarNavLink).toBeVisible();
    await radarNavLink.click();

    // Verify view is loaded and active navigation attribute is set
    await expect(page).toHaveURL(/.*\/radar/);
    await expect(radarNavLink).toHaveAttribute('aria-current', 'page');
    const radarPanel = page.locator('#quest-radar');
    await expect(radarPanel).toBeVisible();

    // Verify radar header and pulse emblem
    await expect(radarPanel.locator('h2')).toContainText('Find a quest that fits your plans');
    await expect(radarPanel.locator('.radar-emblem')).toBeVisible();

    // Verify ranked results are rendered
    const radarCards = radarPanel.locator('.radar-card');
    await expect(radarCards.first()).toBeVisible();

    // 2. Select an interest to test match ranking and match reasons
    const interestBtn = radarPanel.locator('.interest-chip:has-text("Music")').first();
    if (await interestBtn.isVisible()) {
      await interestBtn.click();
      await page.waitForTimeout(400);

      // Verify matching card shows match pill and reason tag
      const firstCard = radarCards.first();
      await expect(firstCard).toBeVisible();
      const reasons = firstCard.locator('.radar-reason-tag');
      if ((await reasons.count()) > 0) {
        await expect(reasons.first()).toBeVisible();
      }
    }

    // 3. Filter by category
    const categorySelect = radarPanel.locator('.radar-filters label:has-text("Quest type") select');
    await categorySelect.selectOption('Technology');
    await page.waitForTimeout(400);
    await expect(radarCards.first().locator('.pill.accent')).toContainText('Technology');

    // 4. Test empty filter combination and recovery via Clear Radar Filters
    const citySelect = radarPanel.locator('.radar-filters label:has-text("City") select');
    await citySelect.selectOption('Kolkata');
    await categorySelect.selectOption('Gaming');
    await page.waitForTimeout(400);

    // If no events match, empty state is shown with clear button
    const clearFiltersBtn = radarPanel.locator('.radar-empty-state button:has-text("Clear Radar Filters")');
    if (await clearFiltersBtn.isVisible()) {
      await clearFiltersBtn.click();
      await page.waitForTimeout(400);
      // Results are restored
      await expect(radarCards.first()).toBeVisible();
    }

    // 5. Test direct page refresh at /radar
    await page.reload();
    await expect(page.locator('#quest-radar')).toBeVisible();
    await expect(page.locator('.radar-card').first()).toBeVisible();

    // 6. Test browser history navigation (back and forward)
    await page.locator('#primary-nav a[href="/quests"]').click();
    await expect(page).toHaveURL(/.*\/quests/);
    await page.goBack();
    await expect(page).toHaveURL(/.*\/radar/);
    await expect(page.locator('#quest-radar')).toBeVisible();
    await page.goForward();
    await expect(page).toHaveURL(/.*\/quests/);
    await page.goBack();
    await expect(page).toHaveURL(/.*\/radar/);
    await expect(page.locator('#quest-radar')).toBeVisible();
  });
});
