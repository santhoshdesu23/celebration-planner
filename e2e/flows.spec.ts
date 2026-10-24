import { test, expect } from '@playwright/test';

test.describe('Celebration Planner End-to-End Extended Journeys', () => {
  const timestamp = Date.now();
  const testUser = {
    name: `Journey Planner ${timestamp}`,
    email: `journey.planner.${timestamp}@testdomain.internal`,
    password: 'SecurePassword123!',
  };
  const eventName = `Silver Jubilee Banquet ${timestamp}`;

  test('negative auth validation: mismatched password rejection & invalid credentials toast', async ({
    page,
  }) => {
    // 1. Password mismatch blocks registration
    await page.goto('/register');
    await page.locator('#register-name').fill(testUser.name);
    await page.locator('#register-email').fill(testUser.email);
    await page.locator('#register-password').fill(testUser.password);
    await page.locator('#register-confirm-password').fill('DifferentPassword123!');
    await page.locator('#register-submit-btn').click();

    // Browser remains on register and validation error is displayed
    await expect(page).toHaveURL(/\/register/);
    await expect(page.getByText(/passwords do not match/i)).toBeVisible();

    // 2. Invalid credentials displays error
    await page.goto('/login');
    await page.locator('#login-email').fill(testUser.email);
    await page.locator('#login-password').fill('IncorrectPassword999!');
    await page.locator('#login-submit-btn').click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  });

  test('interactive lifecycle: milestones, vendors, AI chat consultation, and event deletion', async ({
    page,
  }) => {
    const lifecycleUser = {
      name: `Lifecycle User ${Date.now()}`,
      email: `lifecycle.${Date.now()}.${Math.random().toString(36).substring(7)}@testdomain.internal`,
      password: 'SecurePassword123!',
    };
    const lifecycleEventName = `Silver Jubilee Banquet ${Date.now()}`;

    // 1. Register and enter app
    await page.goto('/register');
    await page.locator('#register-name').fill(lifecycleUser.name);
    await page.locator('#register-email').fill(lifecycleUser.email);
    await page.locator('#register-password').fill(lifecycleUser.password);
    await page.locator('#register-confirm-password').fill(lifecycleUser.password);
    await page.locator('#register-submit-btn').click();

    await expect(page).toHaveURL(/\/events/);

    // 2. Create Event through Wizard
    await page.getByRole('button', { name: /plan new celebration/i }).click();
    await expect(page).toHaveURL('/create');

    await page.locator('#event-title').fill(lifecycleEventName);
    await page.locator('#event-type').selectOption('anniversary');

    const futureDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    await page.locator('#event-date').fill(futureDate);
    await page.locator('#event-location').fill('Lakeview Terrace, Chicago');
    await page.locator('#event-guest-count').fill('95');

    await page.locator('#wizard-next-step-1').click();
    await page.locator('#total-budget').fill('15000');
    await page.locator('#wizard-next-step-2').click();
    await page.locator('#wizard-next-step-3').click();
    await page.locator('#wizard-submit').click();

    // 3. Confirm Dashboard Loaded
    await expect(page).toHaveURL(/\/events\/[a-zA-Z0-9_-]+/);
    await expect(page.getByRole('heading', { name: lifecycleEventName })).toBeVisible();

    // 4. Milestone Flow: Add and Toggle
    await page.getByRole('button', { name: /milestones & tasks/i }).click();
    await expect(page.getByRole('heading', { name: /celebration timeline & milestones/i })).toBeVisible();

    await page.getByRole('button', { name: /add milestone/i }).click();
    await expect(page.getByRole('heading', { name: /add timeline milestone/i })).toBeVisible();

    const milestoneTitle = `Send Save-the-Dates ${timestamp}`;
    await page.locator('input[placeholder="e.g. Finalize seating chart & place cards"]').fill(milestoneTitle);
    await page.locator('input[type="date"]').last().fill(futureDate);
    await page.locator('form').getByRole('button', { name: /add milestone/i }).click();

    await expect(page.getByText(milestoneTitle)).toBeVisible();

    // Toggle milestone completion
    const milestoneRow = page.locator('div', { hasText: milestoneTitle }).filter({
      has: page.locator('button[aria-label*="milestone"]'),
    }).first();
    const toggleButton = milestoneRow.locator('button[aria-label*="milestone"]').first();
    await toggleButton.click();

    // Toast notification confirms completion
    await expect(page.getByText(/milestone completed/i)).toBeVisible();

    // 5. Vendor Flow: Update Vendor Pipeline Status
    await page.getByRole('button', { name: /vendor directory/i }).click();
    await expect(page.getByRole('heading', { name: /vendor directory & pipeline/i })).toBeVisible();

    // Change status on the first vendor in directory to 'booked'
    const firstVendorSelect = page.locator('select').first();
    await firstVendorSelect.selectOption('booked');
    await expect(page.getByText(/vendor status set to booked/i)).toBeVisible();

    // 6. AI Chat Consultation Flow
    await page.getByRole('button', { name: /celebration ai chat/i }).click();
    await expect(page.getByPlaceholder(/ask anything/i)).toBeVisible();

    const userQuestion = 'How can we optimize our catering and decor budget?';
    await page.getByPlaceholder(/ask anything/i).fill(userQuestion);
    await page.getByRole('button', { name: /send/i }).click();

    // Verify user question appears in chat message bubble
    await expect(page.getByText(userQuestion)).toBeVisible();
    // Verify AI response arrives
    await expect(
      page.getByText(/Budget Optimization Tips|Consultant is typing/i)
    ).toBeVisible({ timeout: 25_000 });

    // 7. Event Deletion Flow
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Are you sure you want to delete');
      await dialog.accept();
    });

    await page.getByRole('button', { name: /^delete$/i }).click();

    // Redirection back to /events and event no longer listed
    await expect(page).toHaveURL(/\/events$/);
    await expect(page.getByRole('heading', { name: eventName })).not.toBeVisible();
  });
});
