import { test, expect } from '@playwright/test';

test.describe('Create Ticket Button - Simple Navigation Test', () => {
  test('should have Create Ticket button that navigates to create page', async ({ page }) => {
    // Mock the API to prevent Internal Server Error
    await page.route('**/api/tickets*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tickets: [],
          total: 0
        })
      });
    });

    // Navigate to tickets list page
    await page.goto('/tickets');

    // Wait for page to be fully loaded
    await page.waitForLoadState('domcontentloaded');

    // Take screenshot of tickets list page
    await page.screenshot({
      path: '/home/james/dev/811poc-revert/ui-screenshots/test-tickets-list.png',
      fullPage: true
    });

    // Find the Create Ticket button
    const createButton = page.locator('button:has-text("Create Ticket")');

    // Verify button exists and is visible
    await expect(createButton).toBeVisible({ timeout: 10000 });
    console.log('✓ Create Ticket button is visible');

    // Verify button is enabled
    await expect(createButton).toBeEnabled();
    console.log('✓ Create Ticket button is enabled');

    // Click the Create Ticket button
    await createButton.click();
    console.log('✓ Clicked Create Ticket button');

    // Wait for navigation to complete
    await page.waitForURL('**/tickets/create', { timeout: 10000 });
    console.log('✓ Navigated to create ticket page');

    // Verify we're on the create ticket page by checking URL
    expect(page.url()).toContain('/tickets/create');
    console.log('✓ URL contains /tickets/create');

    // Take screenshot of create ticket page
    await page.screenshot({
      path: '/home/james/dev/811poc-revert/ui-screenshots/test-create-ticket-page.png',
      fullPage: true
    });
    console.log('✓ Screenshot captured');

    // Verify we see the create ticket page (check for typical form elements)
    const hasHeading = await page.locator('h1, h2, h3').count() > 0;
    expect(hasHeading).toBeTruthy();
    console.log('✓ Page has heading elements');
  });
});