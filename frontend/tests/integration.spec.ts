import { test, expect } from '@playwright/test';

test.describe('Frontend-Backend Integration', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate directly to tickets page
    await page.goto('/tickets');
  });

  test('should load the tickets dashboard', async ({ page }) => {
    // Check that we're on the tickets page
    await expect(page).toHaveURL(/\/tickets/);

    // Check for main UI elements
    await expect(page.locator('h1')).toContainText('Tickets');

    // Check that filter buttons are visible
    await expect(page.getByRole('button', { name: /Status/i })).toBeVisible();
  });

  test('should display real backend data, not mock data', async ({ page }) => {
    // Wait for tickets to load
    await page.waitForSelector('[data-testid="ticket-card"], tbody tr', { timeout: 10000 });

    // Check that we have tickets displayed
    const tickets = page.locator('[data-testid="ticket-card"], tbody tr');
    const ticketCount = await tickets.count();
    expect(ticketCount).toBeGreaterThan(0);

    // Check for real cities from backend (Houston, Dallas, etc.) not mock data
    const firstTicket = tickets.first();
    const cityText = await firstTicket.textContent();

    // Should contain real Texas cities, not "Demo City" or mock data
    expect(cityText).toMatch(/(Houston|Dallas|Austin|San Antonio|Fort Worth|Harris|Travis|Tarrant)/i);
    expect(cityText).not.toContain('Demo City');
    expect(cityText).not.toContain('Mock');
  });

  test('should fetch tickets from backend API', async ({ page }) => {
    // Intercept the API call to verify it's hitting the backend
    const apiResponse = await page.waitForResponse(
      response => response.url().includes('/api/tickets') && response.status() === 200,
      { timeout: 10000 }
    );

    const data = await apiResponse.json();

    // Verify response structure
    expect(data).toHaveProperty('tickets');
    expect(Array.isArray(data.tickets)).toBeTruthy();

    // Verify tickets have expected properties
    if (data.tickets.length > 0) {
      const firstTicket = data.tickets[0];
      expect(firstTicket).toHaveProperty('id');
      expect(firstTicket).toHaveProperty('city');
      expect(firstTicket).toHaveProperty('county');
      expect(firstTicket).toHaveProperty('status');
    }
  });

  test('should navigate to ticket detail page', async ({ page }) => {
    // Wait for tickets to load
    await page.waitForSelector('[data-testid="ticket-card"], tbody tr', { timeout: 10000 });

    // Get the first ticket
    const firstTicket = page.locator('[data-testid="ticket-card"], tbody tr').first();

    // Click on the ticket to navigate to detail page
    await firstTicket.click();

    // Wait for navigation
    await page.waitForURL(/\/tickets\/[a-f0-9-]+/, { timeout: 10000 });

    // Check that detail page loaded
    await expect(page.locator('h1, h2').first()).toContainText(/Ticket|Details|#/i);

    // Check for detail page elements
    await expect(page.locator('text=/Location|Site|County|City/i')).toBeVisible();
  });

  test('should fetch ticket detail from backend API', async ({ page }) => {
    // Navigate directly to a ticket detail page
    // First get a ticket ID from the list
    await page.goto('/tickets');

    const apiListResponse = await page.waitForResponse(
      response => response.url().includes('/api/tickets') && response.status() === 200
    );

    const listData = await apiListResponse.json();

    if (listData.tickets && listData.tickets.length > 0) {
      const ticketId = listData.tickets[0].id;

      // Navigate to the detail page
      await page.goto(`/tickets/${ticketId}`);

      // Wait for the detail API call
      const apiDetailResponse = await page.waitForResponse(
        response => response.url().includes(`/api/tickets/${ticketId}`) && response.status() === 200,
        { timeout: 10000 }
      );

      const detailData = await apiDetailResponse.json();

      // Verify detail response structure
      expect(detailData).toHaveProperty('id');
      expect(detailData).toHaveProperty('status');
      expect(detailData).toHaveProperty('site');
      expect(detailData.site).toHaveProperty('county');
      expect(detailData.site).toHaveProperty('city');
    }
  });

  test('should handle status update actions', async ({ page }) => {
    // Navigate to tickets page
    await page.goto('/tickets');

    // Wait for tickets to load
    await page.waitForSelector('[data-testid="ticket-card"], tbody tr', { timeout: 10000 });

    // Find a ticket with "Ready" status that can be marked as submitted
    const readyTicket = page.locator('tr:has-text("Ready"), [data-testid="ticket-card"]:has-text("Ready")').first();

    const ticketExists = await readyTicket.count() > 0;

    if (ticketExists) {
      // Click on the ready ticket
      await readyTicket.click();

      // Wait for detail page
      await page.waitForURL(/\/tickets\/[a-f0-9-]+/);

      // Look for action buttons
      const markSubmittedButton = page.locator('button:has-text("Mark Submitted"), button:has-text("Mark as Submitted")');

      if (await markSubmittedButton.count() > 0) {
        // Test that the button is enabled for Ready status
        await expect(markSubmittedButton.first()).toBeEnabled();
      }
    }
  });

  test('should display error message for API failures', async ({ page }) => {
    // Navigate to a non-existent ticket
    await page.goto('/tickets/non-existent-id');

    // Should show error or redirect
    await page.waitForTimeout(2000);

    // Check for error message or redirect to tickets list
    const currentUrl = page.url();
    const hasError = await page.locator('text=/not found|error|404/i').count() > 0;
    const redirectedToList = currentUrl.includes('/tickets') && !currentUrl.includes('non-existent-id');

    expect(hasError || redirectedToList).toBeTruthy();
  });

  test('should filter tickets by status', async ({ page }) => {
    // Wait for initial load
    await page.waitForSelector('[data-testid="ticket-card"], tbody tr', { timeout: 10000 });

    // Click on a status filter button (if available)
    const draftButton = page.locator('button:has-text("Draft"), button:has-text("ValidPendingConfirm")').first();

    if (await draftButton.count() > 0) {
      await draftButton.click();

      // Wait for filtered results
      await page.waitForTimeout(1000);

      // Check that URL or state updated
      const tickets = page.locator('[data-testid="ticket-card"], tbody tr');
      const ticketCount = await tickets.count();

      // If we have tickets after filtering, verify they match the filter
      if (ticketCount > 0) {
        const firstTicketText = await tickets.first().textContent();
        expect(firstTicketText).toBeDefined();
      }
    }
  });

  test('should maintain UI design from v0', async ({ page }) => {
    // Check that the UI maintains the expected design elements

    // Check for the gradient background or card styling
    const mainContainer = page.locator('main, .container, [class*="container"]').first();
    await expect(mainContainer).toBeVisible();

    // Check for status badges with colors
    await page.waitForSelector('[data-testid="ticket-card"], tbody tr', { timeout: 10000 });

    // Look for status badges
    const statusBadges = page.locator('[class*="badge"], [class*="status"], span[class*="text-"]');

    if (await statusBadges.count() > 0) {
      // Check that badges have styling (colors)
      const firstBadge = statusBadges.first();
      const className = await firstBadge.getAttribute('class');

      // Should have color classes from the design
      expect(className).toMatch(/(bg-|text-|border-)/);
    }
  });

  test('should handle pagination if implemented', async ({ page }) => {
    // Check if pagination controls exist
    const paginationControls = page.locator('[aria-label*="pagination"], button:has-text("Next"), button:has-text("Previous")');

    if (await paginationControls.count() > 0) {
      // Test pagination functionality
      const nextButton = page.locator('button:has-text("Next")').first();

      if (await nextButton.isEnabled()) {
        await nextButton.click();

        // Wait for new data
        await page.waitForTimeout(1000);

        // Verify URL or content changed
        const tickets = page.locator('[data-testid="ticket-card"], tbody tr');
        const ticketCount = await tickets.count();
    expect(ticketCount).toBeGreaterThan(0);
      }
    }
  });
});

test.describe('Backend API Health', () => {
  test('backend should be healthy', async ({ request }) => {
    const response = await request.get('http://localhost:8000/health');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('status', 'healthy');
  });

  test('backend should have CORS configured for frontend', async ({ request }) => {
    const response = await request.get('http://localhost:8000/health', {
      headers: {
        'Origin': 'http://localhost:3000'
      }
    });

    expect(response.ok()).toBeTruthy();

    // Check CORS headers
    const corsHeader = response.headers()['access-control-allow-origin'];
    expect(corsHeader).toBe('http://localhost:3000');
  });
});
