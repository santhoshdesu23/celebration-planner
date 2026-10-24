import { test, expect } from '@playwright/test';

test.describe('Celebration Planner E2E Smoke & Ownership Suite', () => {
  const timestamp = Date.now();
  const userA = {
    name: 'Smoke Tester A',
    email: `smoke.tester.a.${timestamp}@testdomain.internal`,
    password: 'SafePassword123!',
  };
  const userB = {
    name: 'Smoke Tester B',
    email: `smoke.tester.b.${timestamp}@testdomain.internal`,
    password: 'SafePassword123!',
  };

  const eventTitle = `Milestone Gala ${timestamp}`;
  let createdEventId: string = '';

  test('full user journey: register, login, create event, budget mutation, persistence, logout, and ownership enforcement', async ({
    page,
    request,
  }) => {
    // Collect intercepted mutation requests to verify CSRF token inclusion
    const interceptedMutations: { url: string; method: string; csrfHeader?: string }[] = [];

    page.on('request', (req) => {
      const method = req.method().toUpperCase();
      if (['POST', 'PATCH', 'DELETE'].includes(method) && req.url().includes('/api/')) {
        const headers = req.headers();
        interceptedMutations.push({
          url: req.url(),
          method,
          csrfHeader: headers['x-csrf-token'] || headers['x-xsrf-token'] || headers['csrf-token'],
        });
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 1. REGISTER A NEW USER
    // ─────────────────────────────────────────────────────────────────────────
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /create an account/i })).toBeVisible();

    await page.locator('#register-name').fill(userA.name);
    await page.locator('#register-email').fill(userA.email);
    await page.locator('#register-password').fill(userA.password);
    await page.locator('#register-confirm-password').fill(userA.password);

    await page.locator('#register-submit-btn').click();

    // After registration, user is redirected to /events
    await expect(page).toHaveURL(/\/events/);
    await expect(page.getByRole('heading', { name: /my planned celebrations/i })).toBeVisible();

    // ─────────────────────────────────────────────────────────────────────────
    // 2. LOG OUT AND LOG IN
    // ─────────────────────────────────────────────────────────────────────────
    // Open profile dropdown and log out
    await page.locator('#profile-menu-button').click();
    await page.locator('#profile-logout-btn').click();

    // Verify redirected away from protected area
    await expect(page.locator('#profile-menu-button')).not.toBeVisible();
    await expect(page.locator('#nav-login-btn')).toBeVisible();

    // Navigate to /login and sign in
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();

    await page.locator('#login-email').fill(userA.email);
    await page.locator('#login-password').fill(userA.password);
    await page.locator('#login-submit-btn').click();

    await expect(page).toHaveURL(/\/events/);
    await expect(page.getByRole('heading', { name: /my planned celebrations/i })).toBeVisible();

    // ─────────────────────────────────────────────────────────────────────────
    // 3. CREATE AN EVENT (WIZARD FLOW)
    // ─────────────────────────────────────────────────────────────────────────
    await page.getByRole('button', { name: /plan new celebration/i }).click();
    await expect(page).toHaveURL('/create');
    await expect(page.getByRole('heading', { name: /create your event/i })).toBeVisible();

    // Step 1: Event Basics
    await page.locator('#event-title').fill(eventTitle);
    await page.locator('#event-type').selectOption('anniversary');

    // Choose future date (180 days ahead)
    const futureDate = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    await page.locator('#event-date').fill(futureDate);
    await page.locator('#event-location').fill('The Glasshouse Pavilion, New York');
    await page.locator('#event-guest-count').fill('120');

    await page.locator('#wizard-next-step-1').click();

    // Step 2: Budget (Provide total budget and advance)
    await expect(page.locator('#total-budget')).toBeVisible();
    await page.locator('#total-budget').fill('25000');
    await expect(page.locator('#wizard-next-step-2')).toBeVisible();
    await page.locator('#wizard-next-step-2').click();

    // Step 3: Preview
    await expect(page.locator('#wizard-next-step-3')).toBeVisible();
    await page.locator('#wizard-next-step-3').click();

    // Step 4: Confirm and Submit
    await expect(page.locator('#wizard-submit')).toBeVisible();
    await page.locator('#wizard-submit').click();

    // ─────────────────────────────────────────────────────────────────────────
    // 4. OPEN EVENT DASHBOARD
    // ─────────────────────────────────────────────────────────────────────────
    // Redirects to /events/:id
    await expect(page).toHaveURL(/\/events\/[a-zA-Z0-9_-]+/);
    const currentUrl = page.url();
    const eventIdMatch = currentUrl.match(/\/events\/([a-zA-Z0-9_-]+)/);
    expect(eventIdMatch).not.toBeNull();
    createdEventId = eventIdMatch![1];

    // Confirm dashboard header renders event title
    await expect(page.getByRole('heading', { name: eventTitle })).toBeVisible();

    // ─────────────────────────────────────────────────────────────────────────
    // 5. ADD OR UPDATE A BUDGET ITEM
    // ─────────────────────────────────────────────────────────────────────────
    // Switch to Budget Planner tab
    await page.getByRole('button', { name: /budget planner/i }).click();
    await expect(page.getByRole('heading', { name: /itemized expenses/i })).toBeVisible();

    // Open Add Expense modal
    await page.getByRole('button', { name: /add expense/i }).click();
    await expect(page.getByRole('heading', { name: /add budget expense/i })).toBeVisible();

    const customCategory = `Artisan Dessert Bar ${timestamp}`;
    await page.locator('input[placeholder="e.g. Wedding Cake, Acoustic Guitarist"]').fill(customCategory);
    await page.locator('input[placeholder="e.g. 1200"]').fill('1850');
    await page.getByRole('button', { name: /save item/i }).click();

    // Verify item appears in table
    await expect(page.getByText(customCategory)).toBeVisible();

    // ─────────────────────────────────────────────────────────────────────────
    // 6. VERIFY PERSISTENCE AFTER PAGE REFRESH
    // ─────────────────────────────────────────────────────────────────────────
    await page.reload();

    await expect(page.getByRole('heading', { name: eventTitle })).toBeVisible();
    await page.getByRole('button', { name: /budget planner/i }).click();
    await expect(page.getByText(customCategory)).toBeVisible();

    // ─────────────────────────────────────────────────────────────────────────
    // 7. VERIFY CSRF TOKEN WAS ATTACHED TO MUTATIONS
    // ─────────────────────────────────────────────────────────────────────────
    const eventCreationRequest = interceptedMutations.find((m) =>
      m.url.endsWith('/api/events') && m.method === 'POST'
    );
    expect(eventCreationRequest).toBeDefined();
    expect(eventCreationRequest?.csrfHeader).toBeDefined();
    expect(eventCreationRequest?.csrfHeader?.length).toBeGreaterThan(16);

    const budgetAddRequest = interceptedMutations.find((m) =>
      m.url.includes('/budget/items') && m.method === 'POST'
    );
    expect(budgetAddRequest).toBeDefined();
    expect(budgetAddRequest?.csrfHeader).toBeDefined();
    expect(budgetAddRequest?.csrfHeader?.length).toBeGreaterThan(16);

    // ─────────────────────────────────────────────────────────────────────────
    // 8. LOG OUT & VERIFY PROTECTED ROUTE REDIRECT
    // ─────────────────────────────────────────────────────────────────────────
    await page.locator('#profile-menu-button').click();
    await page.locator('#profile-logout-btn').click();
    await expect(page.locator('#nav-login-btn')).toBeVisible();

    // Attempt to navigate to protected routes directly (/events redirects, but /create is open for guest planning)
    await page.goto('/events');
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/create');
    await expect(page).toHaveURL('/create');

    // ─────────────────────────────────────────────────────────────────────────
    // 9. EVENT OWNERSHIP ENFORCEMENT
    // ─────────────────────────────────────────────────────────────────────────
    // Register User B
    await page.goto('/register');
    await page.locator('#register-name').fill(userB.name);
    await page.locator('#register-email').fill(userB.email);
    await page.locator('#register-password').fill(userB.password);
    await page.locator('#register-confirm-password').fill(userB.password);
    await page.locator('#register-submit-btn').click();

    await expect(page).toHaveURL(/\/events/);

    // User B attempts to access User A's private event
    await page.goto(`/events/${createdEventId}`);

    // User B should NOT see User A's event title or custom expense
    await expect(page.getByText(customCategory)).not.toBeVisible();
    await expect(page.getByRole('heading', { name: eventTitle })).not.toBeVisible();
    // The dashboard page renders an error state or redirects when event is not found
    await expect(
      page.getByRole('heading', { name: /celebration not found/i })
    ).toBeVisible();
  });
});
