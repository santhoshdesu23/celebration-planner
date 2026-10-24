import { test, expect } from '@playwright/test';

test.describe('Guest Celebration Planning & Auto-Save Transfer Journey', () => {
  const timestamp = Date.now();
  const guestEventTitle = `Ruby Sapphire Gala ${timestamp}`;
  const newUser = {
    name: `Guest Converter ${timestamp}`,
    email: `converter.${timestamp}@testdomain.internal`,
    password: 'SecurePassword123!',
  };

  test('complete guest journey: plan without login -> review and customize -> register -> auto-save to account', async ({
    page,
  }) => {
    // 1. Visit Landing Page as unauthenticated guest
    await page.goto('/');
    await expect(page.locator('#hero-plan-cta')).toBeVisible();

    // 2. Click "Plan a Celebration" to open the creation wizard without login
    await page.locator('#hero-plan-cta').click();
    await expect(page).toHaveURL('/create');

    // Verify wizard is open and interactive without login prompt
    await expect(page.getByRole('heading', { name: /tell us about your event/i })).toBeVisible();

    // Fill Step 1
    await page.locator('#event-title').fill(guestEventTitle);
    await page.locator('#event-type').selectOption('anniversary');

    const futureDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    await page.locator('#event-date').fill(futureDate);
    await page.locator('#event-location').fill('Grand Peninsula, Chicago');
    await page.locator('#event-guest-count').fill('75');

    // Next to Step 2: Budget
    await page.locator('#wizard-next-step-1').click();
    await page.locator('#total-budget').fill('20000');

    // Next to Step 3: Preferences & Details
    await page.locator('#wizard-next-step-2').click();

    // Next to Step 4: Review
    await page.locator('#wizard-next-step-3').click();

    // Submit wizard to generate guest plan
    await page.locator('#wizard-submit').click();

    // 3. User generates and views the AI celebration plan without registering or logging in
    await expect(page).toHaveURL('/guest-plan', { timeout: 15000 });
    await expect(page.getByRole('heading', { name: guestEventTitle })).toBeVisible();

    // Verify guest banner and unsaved indicator
    await expect(page.getByText(/Guest Celebration Plan — Not Yet Saved/i)).toBeVisible();
    await expect(page.getByText(/Unsaved Guest Plan/i)).toBeVisible();

    // Verify "Save My Plan" button is prominently displayed
    const saveMyPlanBtn = page.locator('#save-guest-plan-btn');
    await expect(saveMyPlanBtn).toBeVisible();

    // 4. Explore and edit generated plan details as a guest
    // Switch to Budget Tab
    await page.getByRole('button', { name: /budget planner/i }).click();
    await expect(page.getByRole('heading', { name: /itemized expenses/i })).toBeVisible();

    // Add a custom expense as guest
    await page.getByRole('button', { name: /add expense/i }).click();
    await page.locator('input[placeholder*="Wedding Cake"]').fill('Vintage Champagne Bar');
    await page.locator('input[placeholder*="1200"]').fill('2500');
    await page.getByRole('button', { name: /save item/i }).click();

    // Verify custom expense appears in guest draft budget
    await expect(page.getByText('Vintage Champagne Bar')).toBeVisible();

    // 5. Click "Save My Plan" to trigger authentication save flow
    await saveMyPlanBtn.click();

    // Unauthenticated user is taken to login/register with redirect context
    await expect(page).toHaveURL(/\/login\?redirect=%2Fguest-plan&save=true|\/login\?redirect=\/guest-plan&save=true/);
    await expect(page.getByText(/Celebration Draft Ready/i)).toBeVisible();

    // User switches to register
    await page.getByRole('link', { name: /create an account/i }).click();
    await expect(page).toHaveURL(/\/register/);
    await expect(page.getByText(/Celebration Plan Waiting/i)).toBeVisible();

    // 6. Complete registration
    await page.locator('#register-name').fill(newUser.name);
    await page.locator('#register-email').fill(newUser.email);
    await page.locator('#register-password').fill(newUser.password);
    await page.locator('#register-confirm-password').fill(newUser.password);
    await page.locator('#register-submit-btn').click();

    // 7. Plan is transferred to account and user is redirected to persistent event dashboard
    await expect(page).toHaveURL(/\/events\/[a-zA-Z0-9_-]+/, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: guestEventTitle })).toBeVisible();

    // Verify guest banner is GONE and plan is permanently saved
    await expect(page.getByText(/Guest Celebration Plan — Not Yet Saved/i)).not.toBeVisible();

    // Check that custom guest edit was preserved in the permanently saved account plan
    await page.getByRole('button', { name: /budget planner/i }).click();
    await expect(page.getByText('Vintage Champagne Bar')).toBeVisible();
  });
});
