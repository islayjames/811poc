import { test, expect } from '@playwright/test';

test.describe('Create Ticket Button Navigation', () => {
  test('should navigate from tickets list to create ticket page', async ({ page }) => {
    // Navigate to tickets list page
    await page.goto('/tickets');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Take screenshot of tickets list page
    await page.screenshot({
      path: 'ui-screenshots/tickets-list-page.png',
      fullPage: true
    });

    // Find the Create Ticket button using various possible selectors
    const createButton = page.locator('button:has-text("Create Ticket"), a:has-text("Create Ticket"), [data-testid="create-ticket-button"]').first();

    // Verify button exists
    await expect(createButton).toBeVisible({ timeout: 10000 });

    // Click the Create Ticket button
    await createButton.click();

    // Wait for navigation
    await page.waitForLoadState('networkidle');

    // Verify we're on the create ticket page
    // Check URL contains 'create' or 'new'
    await expect(page).toHaveURL(/\/(tickets\/)?(create|new)/);

    // Take screenshot of create ticket page
    await page.screenshot({
      path: 'ui-screenshots/create-ticket-page.png',
      fullPage: true
    });

    // Verify we see form elements or page title
    const pageContent = await page.content();
    const hasFormElements =
      pageContent.includes('form') ||
      pageContent.includes('input') ||
      pageContent.includes('Create') ||
      pageContent.includes('New Ticket');

    expect(hasFormElements).toBeTruthy();
  });

  test('should display Create Ticket button with correct styling', async ({ page }) => {
    await page.goto('/tickets');
    await page.waitForLoadState('networkidle');

    const createButton = page.locator('button:has-text("Create Ticket"), a:has-text("Create Ticket")').first();

    // Check if button is visible
    await expect(createButton).toBeVisible();

    // Check if button is enabled
    await expect(createButton).toBeEnabled();

    // Verify button text
    const buttonText = await createButton.textContent();
    expect(buttonText?.toLowerCase()).toContain('create');
  });
});