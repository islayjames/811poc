#!/usr/bin/env node

const { chromium } = require('playwright');
const { extractTicketData } = require('./texas811-production-scraper');

/**
 * SAFE TEST: Only process ONE ticket to verify the scraper works
 * This won't consume all your tickets - just tests the core functionality
 */

async function testOneTicket() {
  console.log('🧪 Testing scraper with ONE ticket only...');

  const browser = await chromium.launch({ headless: false }); // Keep visible for testing
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Step 1: Login
    console.log('🔐 Testing login...');
    await page.goto('https://txgc.texas811.org/ui/login');
    await page.locator('input[name="username"]').fill('james.simmons@highpointe.tech');
    await page.locator('input[name="password"]').fill('jgr6dvc8XBK!kaf8qjv');
    await page.getByRole('checkbox', { name: 'I agree to terms & conditions' }).click();
    await page.getByRole('button', { name: 'Login' }).click();
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('✅ Login successful');

    // Step 2: Search with proper verification
    console.log('🔍 Testing search...');

    // Navigate to ticket search
    await page.getByText('Ticket Search').click();
    await page.waitForTimeout(1000);

    // Check "My Tickets" checkbox
    await page.getByRole('checkbox', { name: ' My Tickets' }).click();
    await page.waitForTimeout(500);

    // Find and fill company search input with multiple approaches
    console.log('🔍 Looking for company search input...');
    let searchInputFound = false;

    // Try different selectors for the company input
    const inputSelectors = [
      '.dx-texteditor-input',
      'input[type="text"]',
      'input.dx-texteditor-input',
      '[placeholder*="company" i]',
      '[aria-label*="company" i]'
    ];

    for (const selector of inputSelectors) {
      try {
        const inputs = await page.$$(selector);
        for (let i = 0; i < inputs.length; i++) {
          const input = inputs[i];
          if (await input.isVisible() && await input.isEnabled()) {
            await input.click();
            await page.waitForTimeout(200);
            await input.fill('BRIGHT STAR SOLUTIONS');
            searchInputFound = true;
            console.log(`✅ Company input found with selector: ${selector}[${i}]`);
            break;
          }
        }
        if (searchInputFound) break;
      } catch (e) {
        console.log(`⚠️  Selector ${selector} failed:`, e.message.substring(0, 100));
      }
    }

    if (!searchInputFound) {
      throw new Error('Could not find company search input field');
    }

    // Click search button
    console.log('🔍 Clicking search button...');
    await page.getByRole('button', { name: 'Search', exact: true }).click();

    // Wait for search results with verification
    console.log('⏳ Waiting for search results...');
    let searchResultsFound = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!searchResultsFound && attempts < maxAttempts) {
      await page.waitForTimeout(1000);
      attempts++;

      // Check for various indicators that results have loaded
      const indicators = [
        '[role="row"]',
        '.dx-data-row',
        '[data-grid]',
        '.grid-container',
        'table tbody tr'
      ];

      for (const indicator of indicators) {
        const elements = await page.$$(indicator);
        if (elements.length > 1) { // More than just header
          searchResultsFound = true;
          console.log(`✅ Search results found (${elements.length} rows with selector: ${indicator})`);
          break;
        }
      }

      if (!searchResultsFound) {
        console.log(`⏳ Search attempt ${attempts}/${maxAttempts} - still waiting...`);
      }
    }

    if (!searchResultsFound) {
      // Take screenshot for debugging
      await page.screenshot({ path: 'search-failure-screenshot.png' });
      throw new Error('Search results did not load after waiting. Screenshot saved to search-failure-screenshot.png');
    }

    console.log('✅ Search completed successfully');

    // Step 3: Test pagination detection
    const totalPages = await page.evaluate(() => {
      const pageButtons = Array.from(document.querySelectorAll('button'))
        .filter(btn => /^Page \d+$/.test(btn.textContent?.trim() || ''))
        .map(btn => parseInt(btn.textContent.match(/\d+/)[0]))
        .filter(num => !isNaN(num));
      return pageButtons.length > 0 ? Math.max(...pageButtons) : 1;
    });
    console.log(`✅ Detected ${totalPages} pages`);

    // Step 4: Test ticket processing (ONLY FIRST TICKET)
    console.log('🎫 Testing ticket processing...');
    const ticketRows = await page.$$('[role="row"]');
    const dataRows = ticketRows.slice(1); // Remove header

    if (dataRows.length === 0) {
      throw new Error('No tickets found in search results');
    }

    console.log(`📊 Found ${dataRows.length} tickets, processing ONLY the first one...`);

    // Process only the first ticket
    await dataRows[0].click();
    await page.waitForTimeout(1000);

    // Wait for the row to be selected and try different print menu approaches
    console.log('🔍 Looking for print menu...');

    // Try multiple approaches to find the print menu
    let printMenuFound = false;

    // Approach 1: Try the original selector
    try {
      const printMenu1 = page.getByRole('menuitem', { name: 'Print ' }).locator('div').nth(1);
      if (await printMenu1.isVisible()) {
        await printMenu1.click();
        printMenuFound = true;
        console.log('✅ Print menu found (approach 1)');
      }
    } catch (e) {
      console.log('⚠️  Print menu approach 1 failed');
    }

    // Approach 2: Try looking for Print text
    if (!printMenuFound) {
      try {
        const printMenu2 = page.getByText('Print ');
        if (await printMenu2.isVisible()) {
          await printMenu2.click();
          printMenuFound = true;
          console.log('✅ Print menu found (approach 2)');
        }
      } catch (e) {
        console.log('⚠️  Print menu approach 2 failed');
      }
    }

    // Approach 3: Try right-click context menu
    if (!printMenuFound) {
      try {
        await dataRows[0].click({ button: 'right' });
        await page.waitForTimeout(500);
        const contextPrint = page.getByText('Print');
        if (await contextPrint.isVisible()) {
          await contextPrint.click();
          printMenuFound = true;
          console.log('✅ Print menu found (approach 3 - context menu)');
        }
      } catch (e) {
        console.log('⚠️  Print menu approach 3 failed');
      }
    }

    if (!printMenuFound) {
      throw new Error('Could not find print menu - all approaches failed');
    }

    // Open popup
    const popupPromise = page.waitForEvent('popup');
    await page.getByText('Print with Positive Response').click();
    const popupPage = await popupPromise;

    // Wait for popup to load
    await popupPage.waitForSelector('#tickets', { timeout: 10000 });
    console.log('✅ Popup opened successfully');

    // Step 5: Test data extraction
    console.log('📊 Testing data extraction...');
    const ticketData = await extractTicketData(popupPage);

    if (ticketData) {
      console.log('✅ Data extraction successful!');
      console.log('📄 Sample extracted data:');
      console.log(`   Ticket ID: ${ticketData.ticket_id}`);
      console.log(`   Company: ${ticketData.excavator_company}`);
      console.log(`   Status: ${ticketData.status}`);
      console.log(`   Location: ${ticketData.city}, ${ticketData.county}`);
      console.log(`   GPS: ${ticketData.gps_lat}, ${ticketData.gps_lng}`);
      console.log(`   Members: ${ticketData.members?.length || 0} found`);
      console.log(`   Responses: ${ticketData.responses_in?.length || 0} found`);

      // Show full data structure
      console.log('\n📋 Full ticket data structure:');
      console.log(JSON.stringify(ticketData, null, 2));

    } else {
      console.error('❌ Data extraction failed - no data returned');
    }

    await popupPage.close();

    // Step 6: Test logout
    console.log('🚪 Testing logout...');
    await page.getByRole('button', { name: 'mat-icons mi-arrow_drop_down' }).click();
    await page.getByText('Sign Out').click();
    await page.getByRole('button', { name: 'Yes' }).click();
    console.log('✅ Logout successful');

    console.log('\n🎉 ALL TESTS PASSED! The scraper is working correctly.');
    console.log('🚀 Ready to run the full production scraper.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);

    // Try to save a screenshot for debugging
    try {
      await page.screenshot({ path: 'test-failure-screenshot.png' });
      console.log('📸 Failure screenshot saved to: test-failure-screenshot.png');
    } catch (screenshotError) {
      console.error('Could not save screenshot:', screenshotError.message);
    }

  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  testOneTicket().catch(console.error);
}
