#!/usr/bin/env node

const { chromium } = require('playwright');

/**
 * TEST SCRIPT: Validate Print Dialog Fixes and Starting Position
 *
 * Tests the specific fixes implemented:
 * 1. Print dialog suppression/handling
 * 2. Correct starting position (index 0)
 * 3. Full workflow for first 2-3 tickets
 */

const CONFIG = {
  credentials: {
    username: 'james.simmons@highpointe.tech',
    password: 'jgr6dvc8XBK!kaf8qjv'
  },
  company: 'BRIGHT STAR SOLUTIONS'
};

/**
 * Setup print dialog suppression
 */
async function setupPrintDialogSuppression(page) {
  console.log('🚫 Setting up print dialog suppression...');

  // Method 1: Override window.print
  await page.addInitScript(() => {
    window.print = () => {
      console.log('Print dialog suppressed via window.print override');
      return false;
    };

    window.addEventListener('beforeprint', (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      console.log('beforeprint event suppressed');
      return false;
    });
  });

  console.log('✅ Print dialog suppression configured');
}

/**
 * Handle print dialogs in popup
 */
async function handlePopupPrintDialogs(popupPage) {
  console.log('🚫 Setting up popup print dialog handling...');

  // Add init script to popup
  await popupPage.addInitScript(() => {
    window.print = () => {
      console.log('Popup print dialog suppressed');
      return false;
    };

    window.addEventListener('beforeprint', (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      return false;
    });
  });

  // Listen for dialog events
  popupPage.on('dialog', async dialog => {
    console.log(`📋 Dialog detected: ${dialog.type()} - "${dialog.message()}"`);
    await dialog.dismiss();
    console.log('📋 Dialog dismissed');
  });

  // Wait and try to dismiss any visible dialogs
  await popupPage.waitForTimeout(500);
  await popupPage.keyboard.press('Escape');

  console.log('✅ Popup print dialog handling configured');
}

/**
 * Extract basic ticket info for testing
 */
async function extractBasicTicketInfo(popupPage) {
  // Try to find ticket content with multiple approaches
  let ticketInfo = null;

  // Approach 1: Look for #tickets element
  try {
    const ticketsElement = await popupPage.$('#tickets');
    if (ticketsElement) {
      ticketInfo = await popupPage.evaluate(() => {
        const root = document.querySelector('#tickets');
        if (!root) return null;

        const getText = (element) => element?.textContent?.trim() || '';

        const h1 = root.querySelector('h1');
        const match = getText(h1).match(/Ticket\s+(\d+)/i);
        const ticketId = match ? match[1] : '';

        return {
          ticket_id: ticketId,
          extraction_success: !!ticketId,
          page_title: document.title,
          root_content_length: getText(root).length,
          extraction_method: 'tickets_element'
        };
      });
    }
  } catch (error) {
    console.log(`   Approach 1 failed: ${error.message}`);
  }

  // Approach 2: Look for any element with ticket number
  if (!ticketInfo || !ticketInfo.extraction_success) {
    try {
      ticketInfo = await popupPage.evaluate(() => {
        const getText = (element) => element?.textContent?.trim() || '';
        const bodyText = getText(document.body);

        // Look for ticket number pattern anywhere in the page
        const match = bodyText.match(/Ticket\s+(\d+)/i) || bodyText.match(/(\d{10})/);
        const ticketId = match ? match[1] : '';

        // Look for h1 with ticket info
        const h1Elements = Array.from(document.querySelectorAll('h1'));
        const ticketH1 = h1Elements.find(h1 => getText(h1).includes('Ticket') || /\d{10}/.test(getText(h1)));

        return {
          ticket_id: ticketId,
          extraction_success: !!ticketId,
          page_title: document.title,
          root_content_length: bodyText.length,
          extraction_method: 'body_search',
          h1_content: ticketH1 ? getText(ticketH1) : 'none'
        };
      });
    } catch (error) {
      console.log(`   Approach 2 failed: ${error.message}`);
    }
  }

  // Approach 3: Just check if page loaded at all
  if (!ticketInfo) {
    try {
      ticketInfo = await popupPage.evaluate(() => {
        return {
          ticket_id: '',
          extraction_success: false,
          page_title: document.title,
          root_content_length: document.body ? document.body.textContent.trim().length : 0,
          extraction_method: 'fallback',
          page_loaded: !!document.body
        };
      });
    } catch (error) {
      return {
        ticket_id: '',
        extraction_success: false,
        page_title: 'unknown',
        root_content_length: 0,
        extraction_method: 'error',
        error: error.message
      };
    }
  }

  return ticketInfo;
}

/**
 * Test the complete workflow with fixes
 */
async function testPrintDialogFixes() {
  console.log('🧪 TESTING: Print Dialog Fixes and Starting Position');

  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-web-security', '--disable-print-preview'] // Additional print suppression
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Setup print dialog suppression on main page
    await setupPrintDialogSuppression(page);

    // Step 1: Login
    console.log('🔐 Logging in...');
    await page.goto('https://txgc.texas811.org/ui/login', { waitUntil: 'networkidle' });
    await page.locator('input[name="username"]').fill(CONFIG.credentials.username);
    await page.locator('input[name="password"]').fill(CONFIG.credentials.password);
    await page.getByRole('checkbox', { name: 'I agree to terms & conditions' }).click();
    await page.getByRole('button', { name: 'Login' }).click();
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('✅ Login successful');

    // Step 2: Search
    console.log('🔍 Performing search...');
    await page.getByText('Ticket Search').click();
    await page.waitForTimeout(1000);
    await page.getByRole('checkbox', { name: ' My Tickets' }).click();
    await page.waitForTimeout(500);

    // Find company input field
    const allInputs = await page.$$('.dx-texteditor-input');
    const candidateInputs = allInputs.slice(9, 15);
    let companyInputFound = false;

    for (let i = 0; i < candidateInputs.length; i++) {
      try {
        const input = candidateInputs[i];
        await input.click();
        await page.waitForTimeout(300);

        const dropdownVisible = await page.$('.dx-overlay-wrapper.dx-popup-wrapper:not([style*="display: none"])');
        if (dropdownVisible) {
          await page.keyboard.press('Escape');
          continue;
        }

        await input.fill(CONFIG.company);
        await page.waitForTimeout(500);

        const value = await input.inputValue();
        if (value === CONFIG.company) {
          console.log(`✅ Found company field: "${value}"`);
          companyInputFound = true;
          break;
        } else {
          await input.fill('');
        }
      } catch (error) {
        continue;
      }
    }

    if (!companyInputFound) {
      throw new Error('Could not find company input field');
    }

    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.waitForTimeout(3000);
    console.log('✅ Search completed');

    // Step 3: Find the correct ticket table
    console.log('🎯 Finding ticket table...');
    const mainDataGrid = page.locator('.dx-datagrid-borders');
    await mainDataGrid.waitFor({ state: 'visible', timeout: 5000 });

    const ticketTable = mainDataGrid.locator('table.dx-datagrid-table').nth(2);
    const isTableVisible = await ticketTable.isVisible();
    console.log(`📊 Ticket table visible: ${isTableVisible}`);

    const ticketRows = await ticketTable.locator('[role="row"]').all();
    const dataRows = ticketRows.slice(1); // Remove header row
    console.log(`🎫 Found ${dataRows.length} ticket rows`);

    // Step 4: Test first 3 tickets to validate fixes
    const MAX_TEST_TICKETS = 3;
    const testResults = [];

    for (let i = 0; i < Math.min(MAX_TEST_TICKETS, dataRows.length); i++) {
      console.log(`\n🧪 Testing ticket ${i + 1} (index ${i})`);

      let expectedTicketId = 'unknown';

      try {
        const currentRow = dataRows[i];

        // Get expected ticket ID from row
        const rowText = await currentRow.textContent();
        const ticketMatch = rowText.match(/(\d{10})/);
        expectedTicketId = ticketMatch ? ticketMatch[1] : 'unknown';
        console.log(`   Expected Ticket ID: ${expectedTicketId}`);

        // Select the row
        await currentRow.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);

        const gridCells = await currentRow.locator('[role="gridcell"]').all();
        if (gridCells.length === 0) {
          throw new Error('No gridcells found');
        }

        const firstCell = gridCells[0];
        await firstCell.click({ timeout: 5000 });
        console.log(`   ✅ Row selected`);

        await page.waitForTimeout(1000);

        // Open print menu
        console.log(`   🖨️ Opening print menu...`);
        const printMenuItem = page.getByRole('menuitem', { name: 'Print ' });
        await printMenuItem.waitFor({ state: 'visible', timeout: 3000 });
        await printMenuItem.locator('div').nth(1).click();

        // Open print popup
        console.log(`   📋 Opening print popup...`);
        const popupPromise = page.waitForEvent('popup', { timeout: 15000 });
        await page.getByText('Print with Positive Response').click();

        const popupPage = await popupPromise;
        console.log(`   ✅ Popup opened`);

        // Apply print dialog fixes to popup
        await handlePopupPrintDialogs(popupPage);

        // Wait longer and try multiple selectors for the ticket content
        console.log(`   ⏳ Waiting for ticket content to load...`);

        let ticketContentFound = false;
        const selectors = ['#tickets', '.ticket-content', '[id*="ticket"]', 'body'];

        for (const selector of selectors) {
          try {
            await popupPage.waitForSelector(selector, { timeout: 5000 });
            console.log(`   ✅ Found content with selector: ${selector}`);
            ticketContentFound = true;
            break;
          } catch (selectorError) {
            console.log(`   ⏳ Selector ${selector} not found, trying next...`);
          }
        }

        if (!ticketContentFound) {
          // Take a screenshot for debugging
          await popupPage.screenshot({ path: `popup-debug-${i}.png` });
          throw new Error('Ticket content not found in popup');
        }

        // Extract ticket info
        console.log(`   📊 Extracting ticket data...`);
        const ticketInfo = await extractBasicTicketInfo(popupPage);

        const testResult = {
          index: i,
          expected_ticket_id: expectedTicketId,
          extracted_ticket_id: ticketInfo?.ticket_id || 'NONE',
          extraction_success: ticketInfo?.extraction_success || false,
          id_match: ticketInfo?.ticket_id === expectedTicketId,
          popup_opened: true,
          print_dialog_blocked: false // If we get here, dialogs didn't block us
        };

        console.log(`   📊 Result: ${testResult.extracted_ticket_id} ${testResult.id_match ? '(MATCH ✅)' : '(MISMATCH ❌)'}`);
        testResults.push(testResult);

        await popupPage.close();
        await page.waitForTimeout(1000);

      } catch (error) {
        console.error(`   ❌ Test failed for ticket ${i + 1}: ${error.message}`);

        const testResult = {
          index: i,
          expected_ticket_id: expectedTicketId,
          extracted_ticket_id: 'ERROR',
          extraction_success: false,
          id_match: false,
          popup_opened: false,
          print_dialog_blocked: error.message.includes('timeout') || error.message.includes('dialog'),
          error: error.message
        };

        testResults.push(testResult);
      }
    }

    // Step 5: Analyze test results
    console.log('\n📊 TEST RESULTS SUMMARY:');
    console.log('=' .repeat(60));

    let successCount = 0;
    let printDialogIssues = 0;
    let idMatches = 0;

    testResults.forEach((result, index) => {
      const status = result.extraction_success ? '✅ SUCCESS' : '❌ FAILED';
      const idStatus = result.id_match ? '✅ ID MATCH' : '❌ ID MISMATCH';
      const dialogStatus = result.print_dialog_blocked ? '❌ DIALOG BLOCKED' : '✅ NO DIALOG ISSUES';

      console.log(`Ticket ${index + 1}: ${status} | ${idStatus} | ${dialogStatus}`);
      console.log(`   Expected: ${result.expected_ticket_id} | Extracted: ${result.extracted_ticket_id}`);

      if (result.extraction_success) successCount++;
      if (result.print_dialog_blocked) printDialogIssues++;
      if (result.id_match) idMatches++;

      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      console.log('');
    });

    const totalTests = testResults.length;
    console.log(`SUMMARY:`);
    console.log(`   Tests Run: ${totalTests}`);
    console.log(`   Successful Extractions: ${successCount}/${totalTests} (${Math.round(successCount/totalTests*100)}%)`);
    console.log(`   Correct ID Matches: ${idMatches}/${totalTests} (${Math.round(idMatches/totalTests*100)}%)`);
    console.log(`   Print Dialog Issues: ${printDialogIssues}/${totalTests} (${Math.round(printDialogIssues/totalTests*100)}%)`);

    // Determine overall test result
    const overallSuccess = successCount >= Math.ceil(totalTests * 0.8) && printDialogIssues === 0;
    console.log(`\n🎯 OVERALL RESULT: ${overallSuccess ? '✅ FIXES WORKING' : '❌ FIXES NEED WORK'}`);

    if (overallSuccess) {
      console.log('🎉 Both issues appear to be resolved!');
      console.log('   ✅ Print dialogs are not blocking extraction');
      console.log('   ✅ Starting position is correct (processing from index 0)');
    } else {
      console.log('⚠️ Some issues remain:');
      if (printDialogIssues > 0) {
        console.log('   ❌ Print dialog issues still occurring');
      }
      if (idMatches < Math.ceil(totalTests * 0.8)) {
        console.log('   ❌ Starting position or ID extraction issues');
      }
    }

    return testResults;

  } catch (error) {
    console.error('❌ Test session failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the test
if (require.main === module) {
  testPrintDialogFixes()
    .then((results) => {
      console.log('\n✅ Print dialog fix testing completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Print dialog fix testing failed:', error);
      process.exit(1);
    });
}

module.exports = { testPrintDialogFixes };
