import { test, expect } from '@playwright/test';

test.describe('Debug Scrolling and Redirect Issues', () => {
  test('Debug scrolling behavior on tickets list', async ({ page }) => {
    console.log('🔍 Testing scrolling behavior...');

    // Navigate to tickets page
    await page.goto('http://localhost:3000/tickets');
    await page.waitForLoadState('networkidle');

    // Scroll down to middle of page
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(500);

    // Record initial scroll position
    const initialScroll = await page.evaluate(() => window.scrollY);
    console.log('📍 Initial scroll position:', initialScroll);

    // Wait and check if scroll position changes unexpectedly
    await page.waitForTimeout(2000);
    const afterWaitScroll = await page.evaluate(() => window.scrollY);
    console.log('📍 Scroll after 2s wait:', afterWaitScroll);

    if (afterWaitScroll !== initialScroll) {
      console.log('❌ UNEXPECTED SCROLL! Changed from', initialScroll, 'to', afterWaitScroll);
    }

    // Click on a filter or pagination
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    console.log('🔘 Found', buttonCount, 'buttons on page');

    // Try clicking a filter button
    const filterButton = page.locator('button:has-text("Status")').first();
    if (await filterButton.isVisible()) {
      console.log('🖱️ Clicking Status filter button...');
      await filterButton.click();
      await page.waitForTimeout(1000);
      const afterFilterScroll = await page.evaluate(() => window.scrollY);
      console.log('📍 Scroll after filter click:', afterFilterScroll);

      if (afterFilterScroll < 100) {
        console.log('❌ PAGE SCROLLED TO TOP after filter!');
      }
    }

    // Try pagination
    const nextButton = page.locator('button:has-text("Next")').first();
    if (await nextButton.isVisible()) {
      // Scroll down first
      await page.evaluate(() => window.scrollTo(0, 400));
      const beforePagination = await page.evaluate(() => window.scrollY);
      console.log('📍 Scroll before pagination:', beforePagination);

      console.log('🖱️ Clicking Next button...');
      await nextButton.click();
      await page.waitForTimeout(1000);

      const afterPaginationScroll = await page.evaluate(() => window.scrollY);
      console.log('📍 Scroll after pagination:', afterPaginationScroll);

      if (afterPaginationScroll < 100) {
        console.log('❌ PAGE SCROLLED TO TOP after pagination!');
      }
    }
  });

  test('Debug ticket detail page reload/redirect issues', async ({ page }) => {
    console.log('🔍 Testing ticket detail page behavior...');

    // Enable console logging
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('HomePage') || text.includes('Redirecting') || text.includes('router')) {
        console.log(`🌐 Browser console: ${text}`);
      }
    });

    // Track all navigation events
    const navigations: string[] = [];
    page.on('framenavigated', frame => {
      if (frame === page.mainFrame()) {
        const url = frame.url();
        navigations.push(url);
        console.log('🔄 Navigation:', url);
      }
    });

    // Track network requests to detect multiple API calls
    const apiCalls: string[] = [];
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/tickets/') && request.method() === 'GET') {
        apiCalls.push(url);
        console.log('📡 API call:', url);
      }
    });

    // Navigate to tickets list first
    console.log('📋 Going to tickets list...');
    await page.goto('http://localhost:3000/tickets');
    await page.waitForLoadState('networkidle');

    // Get first ticket link
    const firstTicketLink = page.locator('a[href*="/tickets/"]').first();
    const ticketHref = await firstTicketLink.getAttribute('href');
    console.log('🎯 Found ticket link:', ticketHref);

    // Clear tracking arrays
    navigations.length = 0;
    apiCalls.length = 0;

    // Click on ticket
    console.log('🖱️ Clicking ticket...');
    await firstTicketLink.click();

    // Wait longer to catch any redirects
    await page.waitForTimeout(5000);

    // Analyze what happened
    console.log('\n📊 ANALYSIS:');
    console.log('Total navigations:', navigations.length);
    console.log('Navigation URLs:', navigations);
    console.log('Total API calls to ticket detail:', apiCalls.length);
    console.log('API URLs:', apiCalls);

    // Check for duplicates
    const uniqueNavigations = new Set(navigations);
    if (uniqueNavigations.size < navigations.length) {
      console.log('❌ DUPLICATE NAVIGATIONS DETECTED!');
      console.log('   Same page loaded', navigations.length, 'times');
    }

    const uniqueApiCalls = new Set(apiCalls);
    if (uniqueApiCalls.size < apiCalls.length) {
      console.log('❌ DUPLICATE API CALLS DETECTED!');
      console.log('   Same API called', apiCalls.length, 'times');
    }

    // Check current URL
    const currentUrl = page.url();
    console.log('📍 Final URL:', currentUrl);

    // Check if Back button works properly
    const backButton = page.locator('button:has-text("Back")').first();
    if (await backButton.isVisible()) {
      console.log('🔙 Testing Back button...');
      await backButton.click();
      await page.waitForTimeout(2000);
      const afterBackUrl = page.url();
      console.log('📍 URL after Back:', afterBackUrl);

      if (afterBackUrl.includes('/tickets/')) {
        console.log('❌ Back button did not navigate away from detail page!');
      }
    }
  });

  test('Debug homepage redirect', async ({ page }) => {
    console.log('🔍 Testing homepage redirect...');

    // Track console messages
    page.on('console', msg => {
      console.log(`🌐 Browser: ${msg.text()}`);
    });

    // Track navigations
    const navigations: string[] = [];
    page.on('framenavigated', frame => {
      if (frame === page.mainFrame()) {
        navigations.push(frame.url());
        console.log('🔄 Navigation:', frame.url());
      }
    });

    // Go to homepage
    console.log('🏠 Going to homepage...');
    await page.goto('http://localhost:3000/');
    await page.waitForTimeout(3000);

    // Check results
    console.log('\n📊 ANALYSIS:');
    console.log('Total navigations:', navigations.length);
    console.log('All URLs:', navigations);

    const finalUrl = page.url();
    console.log('📍 Final URL:', finalUrl);

    if (navigations.length > 2) {
      console.log('❌ TOO MANY REDIRECTS!');
    }

    if (!finalUrl.includes('/tickets')) {
      console.log('❌ Did not redirect to /tickets!');
    }
  });
});
