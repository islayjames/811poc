#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

/**
 * TEXAS 811 PRODUCTION TICKET SCRAPER - PRINT DIALOG & INDEXING FIXES
 *
 * Fixed Issues:
 * 1. Print dialog handling (suppress browser print dialog)
 * 2. Correct starting position (ensure we start from first ticket)
 */

// Configuration
const CONFIG = {
  credentials: {
    username: 'james.simmons@highpointe.tech',
    password: 'jgr6dvc8XBK!kaf8qjv'
  },
  company: 'BRIGHT STAR SOLUTIONS',
  options: {
    headless: false, // Enable headed mode for debugging
    rateLimitMs: 1000,
    maxRetries: 3,
    outputFile: `texas811-tickets-${new Date().toISOString().split('T')[0]}.json`,
    saveProgress: true
  }
};

/**
 * PRINT DIALOG HANDLER - Suppress browser print dialog
 */
async function setupPrintDialogHandling(page) {
  // Method 1: Disable print preview via CDP (Chrome DevTools Protocol)
  try {
    const client = await page.context().newCDPSession(page);

    // Disable print preview and auto-print behavior
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: '/tmp'
    });

    // Override print function to prevent native dialog
    await page.addInitScript(() => {
      window.print = () => {
        console.log('Print dialog suppressed');
        return false;
      };
    });

    console.log('✅ Print dialog suppression configured');
  } catch (error) {
    console.warn('⚠️ CDP print suppression failed, using alternative method');
  }
}

/**
 * HANDLE PRINT DIALOG IN POPUP - Dismiss any dialogs that appear
 */
async function handlePrintDialogInPopup(popupPage) {
  try {
    // Set up print dialog suppression on the popup page
    await popupPage.addInitScript(() => {
      // Override print to prevent dialog
      window.print = () => {
        console.log('Popup print dialog suppressed');
        return false;
      };

      // Prevent beforeprint event
      window.addEventListener('beforeprint', (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        return false;
      });
    });

    // Listen for any dialog events and dismiss them
    popupPage.on('dialog', async dialog => {
      console.log(`📋 Dismissing dialog: ${dialog.type()} - ${dialog.message()}`);
      await dialog.dismiss();
    });

    // Wait a moment for any auto-triggered print dialogs
    await popupPage.waitForTimeout(500);

    // Check for and dismiss any visible print dialogs using common selectors
    const printDialogSelectors = [
      '[role="dialog"][aria-label*="Print"]',
      '.print-dialog',
      '#printDialog',
      '[class*="print-dialog"]',
      '[class*="PrintDialog"]'
    ];

    for (const selector of printDialogSelectors) {
      try {
        const dialog = await popupPage.$(selector);
        if (dialog) {
          console.log(`🚫 Found print dialog with selector: ${selector}`);

          // Try to find and click cancel/close button
          const closeButton = await popupPage.$(`${selector} [aria-label="Close"], ${selector} button:has-text("Cancel"), ${selector} button:has-text("Close"), ${selector} .close`);
          if (closeButton) {
            await closeButton.click();
            console.log('✅ Dismissed print dialog');
          }
        }
      } catch (error) {
        // Continue checking other selectors
      }
    }

    // Press Escape key as a general dialog dismissal
    await popupPage.keyboard.press('Escape');

  } catch (error) {
    console.warn('⚠️ Print dialog handling warning:', error.message);
  }
}

/**
 * PRECISE DATA EXTRACTION with enhanced error handling
 */
async function extractTicketData(popupPage) {
  try {
    // First, handle any print dialogs that might be blocking
    await handlePrintDialogInPopup(popupPage);

    // Wait for the ticket content to be fully loaded
    await popupPage.waitForSelector('#tickets', { timeout: 15000 });

    const ticketData = await popupPage.evaluate(() => {
      const root = document.querySelector('#tickets');
      if (!root) return null;

      // Helper functions for extraction
      const getText = (element) => element?.textContent?.trim() || '';

      const getByDtLabel = (label) => {
        const dt = Array.from(root.querySelectorAll('dt')).find(el =>
          getText(el).toLowerCase().includes(label.toLowerCase())
        );
        return dt ? getText(dt.nextElementSibling) : '';
      };

      const getTicketNumber = () => {
        const h1 = root.querySelector('h1');
        const match = getText(h1).match(/Ticket\s+(\d+)/i);
        return match ? match[1] : '';
      };

      const getCompanyInfo = () => {
        const headers = Array.from(root.querySelectorAll('h2'));
        const companySection = headers.find(h => getText(h).toLowerCase().includes('company information'));
        if (!companySection) return {};

        const nextDiv = companySection.nextElementSibling;
        if (!nextDiv) return {};

        const addressLines = Array.from(nextDiv.querySelectorAll('div')).map(d => getText(d));

        return {
          name: addressLines[0] || '',
          address: addressLines.slice(1).join(', ')
        };
      };

      const getGPSCoordinates = () => {
        const gpsDiv = root.querySelector('#callerSuppliedGps');
        const gpsText = getText(gpsDiv);

        // Parse "1: 31.67118, -94.42766, 2: 31.67335, -94.42511"
        const coords = gpsText.match(/([\d.-]+),\s*([\d.-]+)/);
        return coords ? {
          lat: parseFloat(coords[1]),
          lng: parseFloat(coords[2])
        } : { lat: null, lng: null };
      };

      const getMembers = () => {
        const members = [];

        // Find Members section by text content
        const headers = Array.from(root.querySelectorAll('h2'));
        const membersHeader = headers.find(h => getText(h).toLowerCase().includes('members'));
        if (!membersHeader) return members;

        // Try desktop view first (more reliable)
        const desktopContainer = membersHeader.parentElement.querySelector('.hidden.md\\:block');
        if (desktopContainer) {
          const rows = desktopContainer.querySelectorAll('.flex:not(.bg-slate-200)');
          rows.forEach(row => {
            const cells = row.querySelectorAll('div');
            if (cells.length >= 2) {
              members.push({
                code: getText(cells[0]),
                name: getText(cells[1])
              });
            }
          });
        } else {
          // Fallback to mobile view - look for dt/dd pairs after Members header
          let currentEl = membersHeader.nextElementSibling;
          while (currentEl) {
            if (currentEl.classList?.contains('w-full')) {
              const dts = currentEl.querySelectorAll('dt');
              const codeDt = Array.from(dts).find(dt => getText(dt).toLowerCase().includes('code'));
              const nameDt = Array.from(dts).find(dt => getText(dt).toLowerCase().includes('name'));

              if (codeDt && nameDt) {
                members.push({
                  code: getText(codeDt.nextElementSibling),
                  name: getText(nameDt.nextElementSibling)
                });
              }
            }
            currentEl = currentEl.nextElementSibling;
            if (currentEl?.tagName === 'HR') break; // Stop at next section
          }
        }

        return members;
      };

      const getResponses = () => {
        const responses = [];

        // Look for Positive Response section
        const headers = Array.from(root.querySelectorAll('h2'));
        const responseHeader = headers.find(h => getText(h).toLowerCase().includes('positive response'));
        if (!responseHeader) return responses;

        // Find Response Status header
        const h3s = Array.from(root.querySelectorAll('h3'));
        const statusHeader = h3s.find(h => getText(h).toLowerCase().includes('response status'));
        if (!statusHeader) return responses;

        // Try desktop view first
        const desktopContainer = statusHeader.parentElement.querySelector('.hidden.md\\:block');
        if (desktopContainer) {
          const rows = desktopContainer.querySelectorAll('.flex:not(.bg-slate-200)');
          rows.forEach(row => {
            const cells = row.querySelectorAll('div');
            if (cells.length >= 3) {
              const nameCell = getText(cells[1]);
              const facilitiesCell = getText(cells[2]);

              // Extract response details from the name cell (contains nested info)
              const responseMatch = nameCell.match(/^([^\n]+)/);
              const statusMatch = nameCell.match(/:\s*(\w+)/);
              const dateMatch = nameCell.match(/(\w+ \d+, \d+ \d+:\d+ \w+)/);
              const userMatch = nameCell.match(/by ([^:]+):/);
              const commentMatch = nameCell.match(/Comment: (.+)/);

              responses.push({
                code: getText(cells[0]),
                name: responseMatch ? responseMatch[1] : '',
                facilities: facilitiesCell,
                status: statusMatch ? statusMatch[1] : '',
                date: dateMatch ? dateMatch[1] : '',
                user: userMatch ? userMatch[1] : '',
                comment: commentMatch ? commentMatch[1] : ''
              });
            }
          });
        } else {
          // Fallback to mobile view - look after Response Status header
          let currentEl = statusHeader.nextElementSibling;
          while (currentEl && currentEl.tagName !== 'HR') {
            if (currentEl.classList?.contains('w-full')) {
              const dts = currentEl.querySelectorAll('dt');
              const codeDt = Array.from(dts).find(dt => getText(dt).toLowerCase().includes('code'));
              const nameDt = Array.from(dts).find(dt => getText(dt).toLowerCase().includes('name'));
              const facilitiesDt = Array.from(dts).find(dt => getText(dt).toLowerCase().includes('facilities'));

              if (codeDt && nameDt && facilitiesDt) {
                const nameText = getText(nameDt.nextElementSibling);
                const statusMatch = nameText.match(/:\s*(\w+)/);
                const dateMatch = nameText.match(/(\w+ \d+, \d+ \d+:\d+ \w+)/);
                const userMatch = nameText.match(/by ([^:]+):/);
                const commentMatch = nameText.match(/Comment: (.+)/);

                responses.push({
                  code: getText(codeDt.nextElementSibling),
                  name: nameText.split('\n')[0],
                  facilities: getText(facilitiesDt.nextElementSibling),
                  status: statusMatch ? statusMatch[1] : '',
                  date: dateMatch ? dateMatch[1] : '',
                  user: userMatch ? userMatch[1] : '',
                  comment: commentMatch ? commentMatch[1] : ''
                });
              }
            }
            currentEl = currentEl.nextElementSibling;
          }
        }

        return responses;
      };

      // Extract company info
      const companyInfo = getCompanyInfo();
      const gpsCoords = getGPSCoordinates();

      // Build the complete ticket data structure
      return {
        // Basic ticket info
        ticket_id: getTicketNumber(),
        created_at: getByDtLabel('Date'),
        status: getByDtLabel('Type'),
        updated_at: (() => {
          const h3s = Array.from(root.querySelectorAll('h3'));
          const statusHeader = h3s.find(h => getText(h).toLowerCase().includes('response status'));
          if (statusHeader) {
            const match = getText(statusHeader).match(/as of (.+)$/i);
            return match ? match[1] : '';
          }
          return '';
        })(),

        // Company information
        excavator_company: companyInfo.name,
        excavator_address: companyInfo.address,
        excavator_phone: getByDtLabel('Phone'),

        // Caller information
        caller_name: getByDtLabel('Contact'),
        caller_phone: getByDtLabel('Contact Phone'),
        caller_email: getByDtLabel('Contact Email'),

        // Work location
        county: getByDtLabel('County'),
        city: getByDtLabel('City'),
        address: getByDtLabel('Street'),
        cross_street: getByDtLabel('Intersection'),

        // Work details
        work_description: getByDtLabel('Nature of Work'),
        work_type: getByDtLabel('Equipment Type'),
        work_start_date: getByDtLabel('Work Date'),
        work_duration_days: getByDtLabel('Duration'),

        // Work specifications
        white_lining_complete: getByDtLabel('White Lined'),
        boring_crossing: getByDtLabel('Directional Boring'),
        explosives_used: getByDtLabel('Explosives'),

        // Location data
        gps_lat: gpsCoords.lat,
        gps_lng: gpsCoords.lng,

        // Detailed information
        driving_directions: (() => {
          const headers = Array.from(root.querySelectorAll('h2'));
          const drivingHeader = headers.find(h => getText(h).toLowerCase().includes('driving directions'));
          return drivingHeader ? getText(drivingHeader.nextElementSibling) : '';
        })(),
        marking_instructions: (() => {
          const headers = Array.from(root.querySelectorAll('h2'));
          const instructionsHeader = headers.find(h => getText(h).toLowerCase().includes('work site locate instructions'));
          return instructionsHeader ? getText(instructionsHeader.nextElementSibling) : '';
        })(),
        remarks: getText(root.querySelector('#additionalInformation')),

        // Related entities
        members: getMembers(),
        responses_in: getResponses(),

        // Metadata
        extraction_timestamp: new Date().toISOString()
      };
    });

    return ticketData;

  } catch (error) {
    console.error('❌ Data extraction failed:', error);
    return null;
  }
}

/**
 * ROBUST AUTHENTICATION with retry logic
 */
async function authenticateWithRetry(page) {
  for (let attempt = 1; attempt <= CONFIG.options.maxRetries; attempt++) {
    try {
      console.log(`🔐 Authentication attempt ${attempt}/${CONFIG.options.maxRetries}`);

      await page.goto('https://txgc.texas811.org/ui/login', { waitUntil: 'networkidle' });
      await page.locator('input[name="username"]').fill(CONFIG.credentials.username);
      await page.locator('input[name="password"]').fill(CONFIG.credentials.password);
      await page.getByRole('checkbox', { name: 'I agree to terms & conditions' }).click();
      await page.getByRole('button', { name: 'Login' }).click();

      // Wait for dashboard to confirm login success
      await page.waitForURL('**/dashboard', { timeout: 10000 });
      console.log('✅ Authentication successful');
      return;

    } catch (error) {
      console.error(`❌ Authentication attempt ${attempt} failed:`, error.message);
      if (attempt === CONFIG.options.maxRetries) {
        throw new Error(`Authentication failed after ${CONFIG.options.maxRetries} attempts`);
      }
      await page.waitForTimeout(2000);
    }
  }
}

/**
 * ROBUST SEARCH with validation
 */
async function performSearch(page, companyName) {
  console.log(`🔍 Searching for tickets: ${companyName}`);

  await page.getByText('Ticket Search').click();
  await page.waitForTimeout(1000);

  await page.getByRole('checkbox', { name: ' My Tickets' }).click();
  await page.waitForTimeout(500);

  // Find company input field (based on our debug analysis)
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

      await input.fill(companyName);
      await page.waitForTimeout(500);

      const value = await input.inputValue();
      if (value === companyName) {
        console.log(`✅ Found company field at input ${i + 9}: "${value}"`);
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

  console.log('✅ Search completed successfully');
}

/**
 * CORRECTED TICKET PROCESSING with proper starting position and print dialog handling
 */
async function processAllTicketsOnPage(page, pageNumber, allTickets) {
  console.log(`🔄 Processing page ${pageNumber}`);

  try {
    // Set up print dialog handling for the main page
    await setupPrintDialogHandling(page);

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Step 1: Find and focus the correct DevExtreme data grid
    console.log(`   🎯 Finding correct ticket data table...`);
    const mainDataGrid = page.locator('.dx-datagrid-borders');
    await mainDataGrid.waitFor({ state: 'visible', timeout: 5000 });
    console.log(`   ✅ Found main DevExtreme data grid`);

    // Step 2: Target the specific table containing ticket data (3rd table based on analysis)
    const ticketTable = mainDataGrid.locator('table.dx-datagrid-table').nth(2);
    const isTableVisible = await ticketTable.isVisible();
    console.log(`   📊 Ticket data table visible: ${isTableVisible}`);

    if (!isTableVisible) {
      throw new Error('Ticket data table not visible');
    }

    // Step 3: Get ticket rows from the correct table
    const ticketRows = await ticketTable.locator('[role="row"]').all();
    const dataRows = ticketRows.slice(1); // Remove header row

    console.log(`🎫 Found ${dataRows.length} tickets on page ${pageNumber}`);

    // Debug: Log first few rows to verify we're targeting correctly
    console.log(`   🔍 Verifying row targeting (first 3 rows):`);
    for (let debugIndex = 0; debugIndex < Math.min(3, dataRows.length); debugIndex++) {
      const debugRow = dataRows[debugIndex];
      const debugText = await debugRow.textContent();
      const ticketMatch = debugText.match(/(\d{10})/);
      const ticketId = ticketMatch ? ticketMatch[1] : 'NO_ID_FOUND';
      console.log(`      Row ${debugIndex}: Ticket ${ticketId} - "${debugText.substring(0, 50)}..."`);
    }

    // Step 4: Process tickets starting from index 0 (first ticket)
    const MAX_TICKETS_TO_PROCESS = 5;
    const ticketsToProcess = Math.min(MAX_TICKETS_TO_PROCESS, dataRows.length);
    console.log(`   📋 Processing ${ticketsToProcess} tickets starting from index 0`);

    // CRITICAL: Start from index 0 to ensure we process the first ticket
    for (let i = 0; i < ticketsToProcess; i++) {
      try {
        console.log(`\n   🎫 Processing ticket ${i + 1}/${ticketsToProcess} (index ${i})`);

        // Get current row (starting from 0)
        const currentRow = dataRows[i];

        // Debug: Show which row we're about to process
        const rowText = await currentRow.textContent();
        const ticketMatch = rowText.match(/(\d{10})/);
        const expectedTicketId = ticketMatch ? ticketMatch[1] : 'unknown';
        console.log(`      Target: Ticket ${expectedTicketId}`);

        // Ensure row is visible and scroll into view if needed
        await currentRow.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);

        // Click the first gridcell to select the row
        const gridCells = await currentRow.locator('[role="gridcell"]').all();
        if (gridCells.length === 0) {
          throw new Error(`No gridcells found in row ${i + 1}`);
        }

        const firstCell = gridCells[0];
        const cellVisible = await firstCell.isVisible();
        if (!cellVisible) {
          throw new Error(`First gridcell not visible in row ${i + 1}`);
        }

        await firstCell.click({ timeout: 5000 });
        console.log(`      ✅ Selected row ${i + 1} (ticket ${expectedTicketId})`);

        await page.waitForTimeout(1000); // Wait for selection to register

        // Step 4b: Wait for print menu to become available
        console.log(`      🖨️  Opening print menu...`);
        await page.waitForSelector('[role="menuitem"]', { timeout: 5000 });
        const printMenuItem = page.getByRole('menuitem', { name: 'Print ' });
        await printMenuItem.waitFor({ state: 'visible', timeout: 3000 });

        // Click the print menu
        await printMenuItem.locator('div').nth(1).click();
        console.log(`      ✅ Print menu opened`);

        // Step 4c: Open the print popup with enhanced error handling
        console.log(`      📋 Opening print popup...`);
        const popupPromise = page.waitForEvent('popup', { timeout: 15000 });
        await page.getByText('Print with Positive Response').click();

        let popupPage;
        try {
          popupPage = await popupPromise;
          console.log(`      ✅ Print popup opened`);
        } catch (popupError) {
          console.error(`      ❌ Failed to open popup: ${popupError.message}`);
          continue;
        }

        // Step 4d: Handle print dialog and extract data
        try {
          // Set up comprehensive print dialog handling on popup
          await handlePrintDialogInPopup(popupPage);

          // Wait for popup to load ticket content
          await popupPage.waitForSelector('#tickets', { timeout: 15000 });

          // Extract comprehensive ticket data
          console.log(`      📊 Extracting ticket data...`);
          const ticketData = await extractTicketData(popupPage);

          if (ticketData && (ticketData.ticket_id || ticketData.ticket_id !== '')) {
            ticketData.page_number = pageNumber;
            ticketData.ticket_index_on_page = i;
            allTickets.push(ticketData);

            // Verify we extracted the expected ticket
            const extractedId = ticketData.ticket_id || 'unknown';
            const idMatches = extractedId === expectedTicketId;

            console.log(`      ✅ Extracted ticket: ${extractedId} ${idMatches ? '(CORRECT)' : '(ID MISMATCH!)'}`);

            if (!idMatches) {
              console.warn(`      ⚠️  Expected ${expectedTicketId}, got ${extractedId}`);
            }
          } else {
            console.log(`      ⚠️  No valid data extracted for ticket ${i + 1}`);
          }

          await popupPage.close();

        } catch (extractionError) {
          console.error(`      ❌ Data extraction failed: ${extractionError.message}`);

          // Close popup if it's still open
          try {
            await popupPage.close();
          } catch (closeError) {
            // Ignore close errors
          }
        }

        await page.waitForTimeout(CONFIG.options.rateLimitMs);

      } catch (error) {
        console.error(`     ❌ Failed to process ticket ${i + 1}: ${error.message}`);

        // Debug: Take a screenshot if processing fails
        try {
          await page.screenshot({
            path: `debug-ticket-${pageNumber}-${i+1}-${Date.now()}.png`,
            fullPage: false
          });
          console.log(`     📸 Debug screenshot saved for ticket ${i + 1}`);
        } catch (screenshotError) {
          // Ignore screenshot errors
        }

        // Continue with next ticket instead of failing completely
        continue;
      }
    }

    console.log(`✅ Completed page ${pageNumber}: ${ticketsToProcess} tickets processed`);

  } catch (error) {
    console.error(`❌ Failed to process page ${pageNumber}:`, error.message);
    throw error;
  }
}

/**
 * INCREMENTAL DATA PERSISTENCE
 */
function saveProgressData(scrapingSession) {
  try {
    fs.writeFileSync(CONFIG.options.outputFile, JSON.stringify(scrapingSession, null, 2));
    console.log(`💾 Progress saved: ${scrapingSession.tickets.length} tickets`);
  } catch (error) {
    console.error('❌ Failed to save progress:', error.message);
  }
}

/**
 * MAIN SCRAPER ORCHESTRATION
 */
async function runTexas811Scraper() {
  const browser = await chromium.launch({ headless: CONFIG.options.headless });
  const context = await browser.newContext();
  const page = await context.newPage();

  const scrapingSession = {
    metadata: {
      scraping_started: new Date().toISOString(),
      company_filter: CONFIG.company,
      total_pages_processed: 0,
      total_tickets_extracted: 0,
      extraction_errors: 0,
      scraper_version: '1.0.2-print-dialog-fix'
    },
    tickets: []
  };

  try {
    console.log('🚀 Starting Texas 811 ticket scraper (PRINT DIALOG & INDEXING FIXES)');
    console.log(`📊 Target: ${CONFIG.company}`);
    console.log(`🎯 Output: ${CONFIG.options.outputFile}`);

    // Step 1: Authenticate
    await authenticateWithRetry(page);

    // Step 2: Search for company tickets
    await performSearch(page, CONFIG.company);

    // Step 3: Process tickets (single page for testing)
    const pageNum = 1;
    const ticketsBeforePage = scrapingSession.tickets.length;
    await processAllTicketsOnPage(page, pageNum, scrapingSession.tickets);
    const ticketsAfterPage = scrapingSession.tickets.length;

    scrapingSession.metadata.total_pages_processed = pageNum;
    scrapingSession.metadata.total_tickets_extracted = ticketsAfterPage;

    // Save progress
    if (CONFIG.options.saveProgress) {
      saveProgressData(scrapingSession);
    }

    console.log(`📊 Page ${pageNum} complete: ${ticketsAfterPage - ticketsBeforePage} tickets added`);

    // Step 4: Clean logout
    console.log('🚪 Logging out...');
    await page.getByRole('button', { name: 'mat-icons mi-arrow_drop_down' }).click();
    await page.getByText('Sign Out').click();
    await page.getByRole('button', { name: 'Yes' }).click();

    // Final metadata
    scrapingSession.metadata.scraping_completed = new Date().toISOString();
    scrapingSession.metadata.total_duration_seconds = Math.floor(
      (new Date(scrapingSession.metadata.scraping_completed) -
       new Date(scrapingSession.metadata.scraping_started)) / 1000
    );

    // Final save
    saveProgressData(scrapingSession);

    console.log('🎉 Scraping completed successfully!');
    console.log(`📊 Final Results:`);
    console.log(`   Total Pages: ${scrapingSession.metadata.total_pages_processed}`);
    console.log(`   Total Tickets: ${scrapingSession.metadata.total_tickets_extracted}`);
    console.log(`   Errors: ${scrapingSession.metadata.extraction_errors}`);
    console.log(`   Duration: ${scrapingSession.metadata.total_duration_seconds} seconds`);
    console.log(`📄 Data saved to: ${CONFIG.options.outputFile}`);

    return scrapingSession;

  } catch (error) {
    console.error('❌ Scraping failed:', error);
    scrapingSession.metadata.scraping_failed = new Date().toISOString();
    scrapingSession.metadata.error_message = error.message;
    saveProgressData(scrapingSession);
    throw error;

  } finally {
    await browser.close();
  }
}

// CLI execution
if (require.main === module) {
  runTexas811Scraper()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runTexas811Scraper, extractTicketData };
