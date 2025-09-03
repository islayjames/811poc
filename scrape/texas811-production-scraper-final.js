#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

/**
 * TEXAS 811 PRODUCTION TICKET SCRAPER - FINAL VERSION WITH COMPREHENSIVE FIXES + RESPONSE EXTRACTION
 *
 * Fixes Applied:
 * 1. Comprehensive print dialog handling (multiple suppression methods)
 * 2. Proper starting position verification (detailed logging)
 * 3. Enhanced error recovery and timeout handling
 * 4. Multiple fallback strategies for content extraction
 * 5. Utility member response data extraction with multiple detection methods
 */

// Configuration
const CONFIG = {
  credentials: {
    username: 'james.simmons@highpointe.tech',
    password: 'jgr6dvc8XBK!kaf8qjv'
  },
  company: 'BRIGHT STAR SOLUTIONS',
  options: {
    headless: false,
    rateLimitMs: 2000, // Increased for stability
    maxRetries: 3,
    outputFile: `texas811-tickets-${new Date().toISOString().split('T')[0]}.json`,
    saveProgress: true
  }
};

/**
 * COMPREHENSIVE PRINT DIALOG SUPPRESSION
 */
async function setupPrintDialogSuppression(context) {
  try {
    console.log('🚫 Setting up comprehensive print dialog suppression...');

    // Method 1: Browser-level flags
    // Already set in launch options: --disable-print-preview

    // Method 2: Context-level permission override
    await context.overridePermissions('https://txgc.texas811.org', []);

    // Method 3: Script injection for all pages
    await context.addInitScript(() => {
      // Override window.print globally
      window.print = () => {
        console.log('Print intercepted and suppressed');
        return false;
      };

      // Prevent beforeprint events
      window.addEventListener('beforeprint', (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        console.log('beforeprint event intercepted');
        return false;
      });

      // Prevent afterprint events
      window.addEventListener('afterprint', (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        console.log('afterprint event intercepted');
        return false;
      });

      // Override CSS print media rules
      const style = document.createElement('style');
      style.textContent = '@media print { * { display: none !important; } }';
      document.head.appendChild(style);
    });

    console.log('✅ Print dialog suppression configured');
  } catch (error) {
    console.warn('⚠️ Print suppression setup warning:', error.message);
  }
}

/**
 * ENHANCED POPUP PRINT DIALOG HANDLING
 */
async function handlePopupPrintDialogs(popupPage) {
  try {
    console.log('   🚫 Applying popup print dialog suppression...');

    // Immediate dialog listener
    popupPage.on('dialog', async dialog => {
      console.log(`   📋 Dialog intercepted: ${dialog.type()} - "${dialog.message()}"`);
      try {
        await dialog.dismiss();
        console.log('   📋 Dialog dismissed successfully');
      } catch (dismissError) {
        console.warn('   ⚠️ Dialog dismiss failed:', dismissError.message);
      }
    });

    // Immediate script injection
    await popupPage.addInitScript(() => {
      window.print = () => false;
      window.addEventListener('beforeprint', (e) => { e.preventDefault(); return false; });
      window.addEventListener('afterprint', (e) => { e.preventDefault(); return false; });
    });

    // Multiple escape attempts with delays
    for (let i = 0; i < 3; i++) {
      await popupPage.keyboard.press('Escape');
      await popupPage.waitForTimeout(200);
    }

    // Look for and close any visible print dialogs
    const printDialogSelectors = [
      '[role="dialog"]',
      '.modal',
      '.popup',
      '.print-dialog',
      '#printDialog',
      '[class*="dialog"]',
      '[class*="Dialog"]',
      '[aria-modal="true"]'
    ];

    for (const selector of printDialogSelectors) {
      try {
        const dialogElement = await popupPage.$(selector);
        if (dialogElement) {
          console.log(`   🚫 Found dialog with selector: ${selector}`);

          // Try to find close buttons
          const closeSelectors = [
            `${selector} [aria-label*="close"]`,
            `${selector} [aria-label*="Close"]`,
            `${selector} button[title*="close"]`,
            `${selector} button[title*="Close"]`,
            `${selector} .close`,
            `${selector} .btn-close`,
            `${selector} button:has-text("Cancel")`,
            `${selector} button:has-text("Close")`
          ];

          for (const closeSelector of closeSelectors) {
            try {
              const closeBtn = await popupPage.$(closeSelector);
              if (closeBtn) {
                await closeBtn.click();
                console.log(`   ✅ Closed dialog using: ${closeSelector}`);
                break;
              }
            } catch (closeError) {
              // Continue trying other close methods
            }
          }
        }
      } catch (selectorError) {
        // Continue checking other selectors
      }
    }

    console.log('   ✅ Popup print dialog handling complete');

  } catch (error) {
    console.warn('   ⚠️ Popup dialog handling warning:', error.message);
  }
}

/**
 * ROBUST CONTENT EXTRACTION with multiple fallback methods
 */
async function extractTicketDataWithFallbacks(popupPage) {
  try {
    console.log('   📊 Starting ticket data extraction...');

    // Apply print dialog suppression first
    await handlePopupPrintDialogs(popupPage);

    // Wait for page to be ready with multiple strategies
    let contentReady = false;
    const readinessChecks = [
      { selector: '#tickets', timeout: 10000 },
      { selector: 'h1', timeout: 5000 },
      { selector: 'body', timeout: 3000 }
    ];

    for (const check of readinessChecks) {
      try {
        await popupPage.waitForSelector(check.selector, { timeout: check.timeout });
        console.log(`   ✅ Page ready (found: ${check.selector})`);
        contentReady = true;
        break;
      } catch (waitError) {
        console.log(`   ⏳ Waiting for ${check.selector}...`);
      }
    }

    if (!contentReady) {
      console.warn('   ⚠️ Page readiness checks failed, proceeding anyway...');
    }

    // Additional wait for content to stabilize
    await popupPage.waitForTimeout(2000);

    // Extract ticket data with comprehensive approach
    const ticketData = await popupPage.evaluate(() => {
      const getText = (element) => element?.textContent?.trim() || '';

      // Method 1: Look for #tickets container
      let root = document.querySelector('#tickets');
      let extractionMethod = 'tickets_container';

      // Method 2: Look for any container with ticket info
      if (!root) {
        const possibleContainers = ['main', '.content', '.ticket-content', 'body'];
        for (const containerSelector of possibleContainers) {
          const container = document.querySelector(containerSelector);
          if (container && getText(container).includes('Ticket')) {
            root = container;
            extractionMethod = `container_${containerSelector}`;
            break;
          }
        }
      }

      // Method 3: Use body as fallback
      if (!root) {
        root = document.body;
        extractionMethod = 'body_fallback';
      }

      if (!root) {
        return {
          extraction_success: false,
          extraction_method: 'no_root_found',
          error: 'No suitable root element found'
        };
      }

      // Helper functions for robust extraction
      const getByDtLabel = (label) => {
        const dt = Array.from(root.querySelectorAll('dt')).find(el =>
          getText(el).toLowerCase().includes(label.toLowerCase())
        );
        return dt ? getText(dt.nextElementSibling) : '';
      };

      const getTicketNumber = () => {
        // Method 1: Look for h1 with ticket pattern
        const h1Elements = Array.from(root.querySelectorAll('h1'));
        for (const h1 of h1Elements) {
          const match = getText(h1).match(/Ticket\s+(\d+)/i);
          if (match) return match[1];
        }

        // Method 2: Look anywhere in root for ticket number pattern
        const rootText = getText(root);
        const patterns = [
          /Ticket\s+(\d{10})/i,
          /Ticket\s+(\d+)/i,
          /(\d{10})/
        ];

        for (const pattern of patterns) {
          const match = rootText.match(pattern);
          if (match && match[1].length >= 10) {
            return match[1];
          }
        }

        return '';
      };

      const getCompanyInfo = () => {
        const headers = Array.from(root.querySelectorAll('h2'));
        const companySection = headers.find(h => getText(h).toLowerCase().includes('company information'));
        if (!companySection) return { name: '', address: '' };

        const nextDiv = companySection.nextElementSibling;
        if (!nextDiv) return { name: '', address: '' };

        const addressLines = Array.from(nextDiv.querySelectorAll('div')).map(d => getText(d));

        return {
          name: addressLines[0] || '',
          address: addressLines.slice(1).join(', ')
        };
      };

      const getGPSCoordinates = () => {
        const gpsDiv = root.querySelector('#callerSuppliedGps');
        if (!gpsDiv) return { lat: null, lng: null };

        const gpsText = getText(gpsDiv);
        const coords = gpsText.match(/([\d.-]+),\s*([\d.-]+)/);
        return coords ? {
          lat: parseFloat(coords[1]),
          lng: parseFloat(coords[2])
        } : { lat: null, lng: null };
      };

      const getUtilityMemberResponses = () => {
        const responses = [];

        // Method 1: Look for response tables or sections
        const responseSections = [
          // Common selectors for response sections
          root.querySelector('#memberResponses'),
          root.querySelector('#utilityResponses'),
          root.querySelector('.member-responses'),
          root.querySelector('.utility-responses'),
          ...Array.from(root.querySelectorAll('h2, h3, h4')).filter(h =>
            getText(h).toLowerCase().includes('member') ||
            getText(h).toLowerCase().includes('response') ||
            getText(h).toLowerCase().includes('utility')
          ).map(h => h.nextElementSibling)
        ].filter(el => el !== null);

        for (const section of responseSections) {
          if (!section) continue;

          // Look for table rows in response section
          const responseRows = section.querySelectorAll('tr');
          for (const row of responseRows) {
            const cells = Array.from(row.querySelectorAll('td, th'));
            if (cells.length < 2) continue;

            const rowText = cells.map(cell => getText(cell)).join(' | ');

            // Skip header rows
            if (rowText.toLowerCase().includes('member') && rowText.toLowerCase().includes('response')) {
              continue;
            }

            // Extract member/utility info from row
            const memberName = getText(cells[0]);
            const statusText = getText(cells[1]);

            if (memberName && statusText && memberName.length > 2) {
              const response = {
                member_code: memberName.split(' ')[0] || memberName,
                member_name: memberName,
                response_status: statusText.toLowerCase(),
                response_date: cells.length > 2 ? getText(cells[2]) : null,
                comments: cells.length > 3 ? getText(cells[3]) : null,
                contact_info: cells.length > 4 ? getText(cells[4]) : null,
                raw_row_data: rowText
              };

              // Normalize status
              if (statusText.toLowerCase().includes('clear')) {
                response.response_status = 'clear';
              } else if (statusText.toLowerCase().includes('not clear') || statusText.toLowerCase().includes('not_clear')) {
                response.response_status = 'not_clear';
              } else if (statusText.toLowerCase().includes('no response')) {
                response.response_status = 'no_response';
              }

              responses.push(response);
            }
          }

          // Method 2: Look for list items in response section
          const listItems = section.querySelectorAll('li, div');
          for (const item of listItems) {
            const itemText = getText(item);
            if (itemText.length < 10) continue;

            // Look for patterns like "COMPANY_CODE - Clear" or "Company Name: Not Clear"
            const patterns = [
              /^([A-Z0-9_]+)\s*[-:]\s*(clear|not clear|no response)/i,
              /^([^-:]+)\s*[-:]\s*(clear|not clear|no response)/i
            ];

            for (const pattern of patterns) {
              const match = itemText.match(pattern);
              if (match) {
                responses.push({
                  member_code: match[1].trim(),
                  member_name: match[1].trim(),
                  response_status: match[2].toLowerCase().replace(' ', '_'),
                  response_date: null,
                  comments: null,
                  contact_info: null,
                  raw_item_data: itemText
                });
                break;
              }
            }
          }
        }

        // Method 3: Look for response data in definition lists
        const definitionLists = root.querySelectorAll('dl');
        for (const dl of definitionLists) {
          const dts = Array.from(dl.querySelectorAll('dt'));
          for (const dt of dts) {
            const dtText = getText(dt).toLowerCase();
            if (dtText.includes('response') || dtText.includes('member') || dtText.includes('utility')) {
              const dd = dt.nextElementSibling;
              if (dd) {
                const responseText = getText(dd);
                if (responseText) {
                  responses.push({
                    member_code: getText(dt),
                    member_name: getText(dt),
                    response_status: responseText.toLowerCase(),
                    response_date: null,
                    comments: responseText,
                    contact_info: null,
                    raw_dl_data: `${getText(dt)}: ${responseText}`
                  });
                }
              }
            }
          }
        }

        // Method 4: Look for any text patterns that might indicate responses
        const allText = getText(root);
        const responsePatterns = [
          /([A-Z][A-Z0-9_]{2,})\s*[-:]\s*(clear|not clear|no response)/gi,
          /(clear|not clear|no response)\s*[-:]\s*([A-Z][A-Z0-9_]{2,})/gi
        ];

        for (const pattern of responsePatterns) {
          let match;
          while ((match = pattern.exec(allText)) !== null) {
            if (pattern.source.includes('clear.*[-:]')) {
              // Status first, then member
              responses.push({
                member_code: match[2],
                member_name: match[2],
                response_status: match[1].toLowerCase().replace(' ', '_'),
                response_date: null,
                comments: null,
                contact_info: null,
                raw_pattern_match: match[0]
              });
            } else {
              // Member first, then status
              responses.push({
                member_code: match[1],
                member_name: match[1],
                response_status: match[2].toLowerCase().replace(' ', '_'),
                response_date: null,
                comments: null,
                contact_info: null,
                raw_pattern_match: match[0]
              });
            }
          }
        }

        // Deduplicate responses based on member_code
        const uniqueResponses = [];
        const seenMembers = new Set();

        for (const response of responses) {
          if (!seenMembers.has(response.member_code)) {
            seenMembers.add(response.member_code);
            uniqueResponses.push(response);
          }
        }

        return uniqueResponses;
      };

      // Extract basic ticket info
      const ticketId = getTicketNumber();
      const companyInfo = getCompanyInfo();
      const gpsCoords = getGPSCoordinates();
      const utilityResponses = getUtilityMemberResponses();

      // Build comprehensive ticket data
      return {
        // Basic info
        ticket_id: ticketId,
        extraction_success: !!ticketId,
        extraction_method: extractionMethod,

        // Timestamps
        created_at: getByDtLabel('Date'),
        status: getByDtLabel('Type'),

        // Company info
        excavator_company: companyInfo.name,
        excavator_address: companyInfo.address,
        excavator_phone: getByDtLabel('Phone'),

        // Caller info
        caller_name: getByDtLabel('Contact'),
        caller_phone: getByDtLabel('Contact Phone'),
        caller_email: getByDtLabel('Contact Email'),

        // Location
        county: getByDtLabel('County'),
        city: getByDtLabel('City'),
        address: getByDtLabel('Street'),
        cross_street: getByDtLabel('Intersection'),

        // Work details
        work_description: getByDtLabel('Nature of Work'),
        work_type: getByDtLabel('Equipment Type'),
        work_start_date: getByDtLabel('Work Date'),
        work_duration_days: getByDtLabel('Duration'),

        // Location data
        gps_lat: gpsCoords.lat,
        gps_lng: gpsCoords.lng,

        // Utility member responses
        responses: utilityResponses,
        response_count: utilityResponses.length,

        // Metadata
        extraction_timestamp: new Date().toISOString(),
        page_title: document.title,
        content_length: getText(root).length
      };
    });

    console.log(`   📊 Extraction complete (method: ${ticketData?.extraction_method})`);
    if (ticketData?.responses && ticketData.responses.length > 0) {
      console.log(`   🏢 Found ${ticketData.responses.length} utility member responses:`);
      ticketData.responses.forEach((response, index) => {
        console.log(`      ${index + 1}. ${response.member_name}: ${response.response_status}`);
      });
    } else {
      console.log(`   🏢 No utility member responses found`);
    }
    return ticketData;

  } catch (error) {
    console.error('   ❌ Extraction failed:', error.message);
    return {
      extraction_success: false,
      extraction_method: 'error',
      error: error.message,
      extraction_timestamp: new Date().toISOString()
    };
  }
}

/**
 * AUTHENTICATION with enhanced retry logic
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
 * SEARCH with enhanced validation
 */
async function performSearch(page, companyName) {
  console.log(`🔍 Searching for tickets: ${companyName}`);

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
 * TICKET PROCESSING with comprehensive fixes
 */
async function processAllTicketsOnPage(page, pageNumber, allTickets) {
  console.log(`🔄 Processing page ${pageNumber} with comprehensive fixes`);

  try {
    await page.waitForTimeout(2000);

    // Find the correct ticket table
    console.log(`   🎯 Locating ticket data table...`);
    const mainDataGrid = page.locator('.dx-datagrid-borders');
    await mainDataGrid.waitFor({ state: 'visible', timeout: 5000 });

    const ticketTable = mainDataGrid.locator('table.dx-datagrid-table').nth(2);
    const isTableVisible = await ticketTable.isVisible();
    console.log(`   📊 Ticket data table visible: ${isTableVisible}`);

    if (!isTableVisible) {
      throw new Error('Ticket data table not visible');
    }

    // Get all ticket rows
    const ticketRows = await ticketTable.locator('[role="row"]').all();
    const dataRows = ticketRows.slice(1); // Remove header row

    console.log(`🎫 Found ${dataRows.length} tickets on page ${pageNumber}`);

    // CRITICAL: Verify we're starting from the correct position
    console.log(`   🔍 Verifying starting position (first 3 rows):`);
    for (let verifyIndex = 0; verifyIndex < Math.min(3, dataRows.length); verifyIndex++) {
      const verifyRow = dataRows[verifyIndex];
      const verifyText = await verifyRow.textContent();
      const ticketMatch = verifyText.match(/(\d{10})/);
      const ticketId = ticketMatch ? ticketMatch[1] : 'NO_ID';
      console.log(`      Row ${verifyIndex}: ${ticketId} - "${verifyText.substring(0, 50)}..."`);
    }

    // Process tickets with comprehensive error handling
    const MAX_TICKETS_TO_PROCESS = 5;
    const ticketsToProcess = Math.min(MAX_TICKETS_TO_PROCESS, dataRows.length);
    console.log(`   📋 Processing ${ticketsToProcess} tickets (starting from index 0)`);

    for (let i = 0; i < ticketsToProcess; i++) {
      const ticketStartTime = Date.now();
      console.log(`\n   🎫 Processing ticket ${i + 1}/${ticketsToProcess} (index ${i})`);

      try {
        const currentRow = dataRows[i];

        // Get expected ticket info
        const rowText = await currentRow.textContent();
        const ticketMatch = rowText.match(/(\d{10})/);
        const expectedTicketId = ticketMatch ? ticketMatch[1] : 'unknown';
        console.log(`      Expected: ${expectedTicketId}`);

        // Select row with enhanced error handling
        await currentRow.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);

        const gridCells = await currentRow.locator('[role="gridcell"]').all();
        if (gridCells.length === 0) {
          throw new Error('No gridcells found');
        }

        const firstCell = gridCells[0];
        if (!(await firstCell.isVisible())) {
          throw new Error('First gridcell not visible');
        }

        await firstCell.click({ timeout: 5000 });
        console.log(`      ✅ Row selected`);
        await page.waitForTimeout(1000);

        // Open print menu
        console.log(`      🖨️ Opening print menu...`);
        const printMenuItem = page.getByRole('menuitem', { name: 'Print ' });
        await printMenuItem.waitFor({ state: 'visible', timeout: 5000 });
        await printMenuItem.locator('div').nth(1).click();

        // Open popup with timeout handling
        console.log(`      📋 Opening print popup...`);
        let popupPage = null;

        try {
          const popupPromise = page.waitForEvent('popup', { timeout: 20000 });
          await page.getByText('Print with Positive Response').click();
          popupPage = await popupPromise;
          console.log(`      ✅ Popup opened successfully`);
        } catch (popupError) {
          console.error(`      ❌ Failed to open popup: ${popupError.message}`);
          continue;
        }

        // Extract data with comprehensive handling
        let ticketData = null;
        try {
          ticketData = await extractTicketDataWithFallbacks(popupPage);
        } catch (extractionError) {
          console.error(`      ❌ Data extraction failed: ${extractionError.message}`);
        }

        // Process results
        if (ticketData && ticketData.extraction_success) {
          ticketData.page_number = pageNumber;
          ticketData.ticket_index_on_page = i;
          ticketData.processing_time_ms = Date.now() - ticketStartTime;
          allTickets.push(ticketData);

          const extractedId = ticketData.ticket_id;
          const idMatches = extractedId === expectedTicketId;

          console.log(`      ✅ Extracted: ${extractedId} ${idMatches ? '(MATCH)' : '(MISMATCH!)'}`);

          if (!idMatches) {
            console.warn(`      ⚠️ ID MISMATCH: Expected ${expectedTicketId}, got ${extractedId}`);
          }
        } else {
          console.error(`      ❌ No valid data extracted for ticket ${i + 1}`);
        }

        // Clean up popup
        try {
          if (popupPage) {
            await popupPage.close();
          }
        } catch (closeError) {
          console.warn(`      ⚠️ Popup close warning: ${closeError.message}`);
        }

        await page.waitForTimeout(CONFIG.options.rateLimitMs);

      } catch (error) {
        console.error(`      ❌ Failed to process ticket ${i + 1}: ${error.message}`);

        // Debug screenshot on error
        try {
          await page.screenshot({
            path: `debug-ticket-error-${pageNumber}-${i+1}-${Date.now()}.png`,
            fullPage: false
          });
          console.log(`      📸 Debug screenshot saved`);
        } catch (screenshotError) {
          // Ignore screenshot errors
        }

        continue;
      }
    }

    console.log(`✅ Page ${pageNumber} processing complete`);

  } catch (error) {
    console.error(`❌ Failed to process page ${pageNumber}:`, error.message);
    throw error;
  }
}

/**
 * DATA PERSISTENCE
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
 * MAIN ORCHESTRATOR
 */
async function runTexas811Scraper() {
  const browser = await chromium.launch({
    headless: CONFIG.options.headless,
    args: [
      '--disable-print-preview',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ]
  });

  const context = await browser.newContext();

  // Apply comprehensive print dialog suppression
  await setupPrintDialogSuppression(context);

  const page = await context.newPage();

  const scrapingSession = {
    metadata: {
      scraping_started: new Date().toISOString(),
      company_filter: CONFIG.company,
      total_pages_processed: 0,
      total_tickets_extracted: 0,
      extraction_errors: 0,
      scraper_version: '1.0.4-comprehensive-fixes-with-responses',
      fixes_applied: [
        'comprehensive_print_dialog_suppression',
        'enhanced_starting_position_verification',
        'multiple_fallback_extraction_methods',
        'robust_error_recovery',
        'utility_member_response_extraction'
      ]
    },
    tickets: []
  };

  try {
    console.log('🚀 Starting Texas 811 scraper (COMPREHENSIVE FIXES VERSION)');
    console.log(`📊 Target: ${CONFIG.company}`);
    console.log(`🎯 Output: ${CONFIG.options.outputFile}`);
    console.log(`🔧 Fixes: Print dialog suppression, Starting position verification, Error recovery`);

    // Authentication
    await authenticateWithRetry(page);

    // Search
    await performSearch(page, CONFIG.company);

    // Process tickets
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

    console.log(`\n📊 Processing Results:`);
    console.log(`   Tickets Found: ${ticketsAfterPage - ticketsBeforePage}`);
    console.log(`   Success Rate: ${Math.round((ticketsAfterPage - ticketsBeforePage) / Math.min(5, scrapingSession.tickets.length || 1) * 100)}%`);

    // Logout
    console.log('\n🚪 Logging out...');
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

    console.log('\n🎉 Scraping completed successfully!');
    console.log(`📊 Final Results:`);
    console.log(`   Total Pages: ${scrapingSession.metadata.total_pages_processed}`);
    console.log(`   Total Tickets: ${scrapingSession.metadata.total_tickets_extracted}`);
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
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { runTexas811Scraper, extractTicketDataWithFallbacks };
