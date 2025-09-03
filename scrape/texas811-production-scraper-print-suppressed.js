#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs');

/**
 * TEXAS 811 PRODUCTION TICKET SCRAPER - PRINT SUPPRESSION VERSION
 *
 * Implementation based on the sophisticated print dialog suppression strategy:
 * - Context-level addInitScript for window.print override
 * - PostMessage signaling system for print requests
 * - Print media emulation to capture print-ready HTML
 * - Starting position verification and fixes
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
    rateLimitMs: 500,
    maxRetries: 3,
    outputFile: `texas811-all-tickets-${new Date().toISOString().split('T')[0]}.json`,
    saveProgress: true
  }
};

/**
 * SOPHISTICATED PRINT SUPPRESSION SETUP
 * Based on the reference implementation for intercepting print dialogs
 */
async function setupAdvancedPrintSuppression(context) {
  console.log('🚫 Setting up advanced print dialog suppression...');

  // Context-level addInitScript - runs before ANY page scripts execute
  await context.addInitScript(() => {
    // Make a stable channel to notify the automation layer
    window.__playwrightPrintIntercepted = false;

    // Hardened override: non-writable, non-configurable
    Object.defineProperty(window, 'print', {
      configurable: false,
      enumerable: false,
      writable: false,
      value: () => {
        // Flag + postMessage so Playwright can react
        window.__playwrightPrintIntercepted = true;
        try {
          window.postMessage({ type: '__PW_PRINT_REQUEST__' }, '*');
        } catch (e) {
          console.log('Print postMessage failed:', e);
        }
        // Do NOT open the native dialog
        console.log('Print intercepted and suppressed via hardened override');
      }
    });

    // Also override any print media CSS that might interfere
    const style = document.createElement('style');
    style.textContent = `
      @media print {
        /* Prevent any print-specific hiding that might break extraction */
        * { visibility: visible !important; }
      }
    `;
    if (document.head) {
      document.head.appendChild(style);
    } else {
      // If head doesn't exist yet, wait for it
      document.addEventListener('DOMContentLoaded', () => {
        document.head.appendChild(style);
      });
    }
  });

  console.log('✅ Advanced print suppression configured');
}

/**
 * SETUP PRINT REQUEST LISTENER
 * Listens for postMessage signals from intercepted print calls
 */
async function setupPrintRequestListener(page) {
  // Add script to forward window.postMessage to Playwright via console
  await page.addInitScript(() => {
    window.addEventListener('message', (evt) => {
      if (evt?.data?.type === '__PW_PRINT_REQUEST__') {
        // Minimal, reliable signal out to Playwright
        console.log('__PW_PRINT_REQUEST__');
      }
    }, true);
  });
}

/**
 * EXTRACT DATA DIRECTLY (No print signal waiting needed)
 * Since print suppression works, go straight to data extraction
 */
async function handleDataExtraction(popupPage) {
  try {
    console.log('   📊 Extracting ticket data directly...');

    // Wait a moment for page to fully load
    await popupPage.waitForTimeout(1000);

    // Extract ticket data immediately (no print signal waiting)
    return await extractTicketDataFromPrintMode(popupPage, false);

  } catch (error) {
    console.error('   ❌ Data extraction failed:', error.message);
    return {
      extraction_success: false,
      extraction_method: 'error',
      error: error.message,
      extraction_timestamp: new Date().toISOString()
    };
  }
}

/**
 * EXTRACT TICKET DATA FROM PRINT-READY DOM
 * Extract comprehensive ticket data from the print-optimized layout
 */
async function extractTicketDataFromPrintMode(popupPage, isPrintMode = true) {
  try {
    console.log(`   📊 Extracting ticket data (print mode: ${isPrintMode})...`);

    // Additional wait for DOM to stabilize
    await popupPage.waitForTimeout(1000);

    const ticketData = await popupPage.evaluate((printMode) => {
      const getText = (element) => element?.textContent?.trim() || '';

      // In print mode, content might be reorganized - look for various containers
      const possibleRoots = [
        document.querySelector('#tickets'),
        document.querySelector('main'),
        document.querySelector('.content'),
        document.querySelector('.ticket-content'),
        document.querySelector('body')
      ];

      let root = possibleRoots.find(el => el && getText(el).length > 100);
      if (!root) {
        root = document.body;
      }

      if (!root) {
        return {
          extraction_success: false,
          extraction_method: 'no_root_found',
          print_mode: printMode,
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
        // Look for ticket number in various places
        const patterns = [
          /Ticket\s+(\d{10})/i,
          /Ticket\s+(\d+)/i,
          /(\d{10})/
        ];

        const rootText = getText(root);
        for (const pattern of patterns) {
          const match = rootText.match(pattern);
          if (match && match[1].length >= 10) {
            return match[1];
          }
        }

        // Also check page title
        const titleMatch = document.title.match(/(\d{10})/);
        return titleMatch ? titleMatch[1] : '';
      };

      const getCompanyInfo = () => {
        const headers = Array.from(root.querySelectorAll('h2, h3'));
        const companySection = headers.find(h =>
          getText(h).toLowerCase().includes('company') ||
          getText(h).toLowerCase().includes('excavator')
        );

        if (!companySection) return { name: '', address: '' };

        const nextElement = companySection.nextElementSibling;
        if (!nextElement) return { name: '', address: '' };

        const lines = Array.from(nextElement.querySelectorAll('div, p')).map(d => getText(d));

        return {
          name: lines[0] || '',
          address: lines.slice(1).join(', ')
        };
      };

      const getGPSCoordinates = () => {
        // Look for GPS coordinates in various formats
        const rootText = getText(root);
        const gpsPatterns = [
          /([\d.-]+),\s*([\d.-]+)/,
          /Lat:\s*([\d.-]+).*Lng:\s*([\d.-]+)/i,
          /Latitude:\s*([\d.-]+).*Longitude:\s*([\d.-]+)/i
        ];

        for (const pattern of gpsPatterns) {
          const match = rootText.match(pattern);
          if (match) {
            const lat = parseFloat(match[1]);
            const lng = parseFloat(match[2]);
            if (!isNaN(lat) && !isNaN(lng)) {
              return { lat, lng };
            }
          }
        }

        return { lat: null, lng: null };
      };

      // Extract all ticket information
      const ticketId = getTicketNumber();
      const companyInfo = getCompanyInfo();
      const gpsCoords = getGPSCoordinates();

      return {
        // Basic info
        ticket_id: ticketId,
        extraction_success: !!ticketId,
        extraction_method: printMode ? 'print_mode_emulation' : 'fallback_extraction',
        print_mode: printMode,

        // Timestamps
        created_at: getByDtLabel('Date'),
        status: getByDtLabel('Type') || getByDtLabel('Status'),

        // Company info
        excavator_company: companyInfo.name,
        excavator_address: companyInfo.address,
        excavator_phone: getByDtLabel('Phone'),

        // Caller info
        caller_name: getByDtLabel('Contact') || getByDtLabel('Caller'),
        caller_phone: getByDtLabel('Contact Phone') || getByDtLabel('Caller Phone'),
        caller_email: getByDtLabel('Contact Email') || getByDtLabel('Email'),

        // Location
        county: getByDtLabel('County'),
        city: getByDtLabel('City'),
        address: getByDtLabel('Street') || getByDtLabel('Address'),
        cross_street: getByDtLabel('Intersection') || getByDtLabel('Cross Street'),

        // Work details
        work_description: getByDtLabel('Nature of Work') || getByDtLabel('Work Description'),
        work_type: getByDtLabel('Equipment Type') || getByDtLabel('Work Type'),
        work_start_date: getByDtLabel('Work Date') || getByDtLabel('Start Date'),
        work_duration_days: getByDtLabel('Duration'),

        // Location data
        gps_lat: gpsCoords.lat,
        gps_lng: gpsCoords.lng,

        // Metadata
        extraction_timestamp: new Date().toISOString(),
        page_title: document.title,
        content_length: getText(root).length,
        dom_ready_state: document.readyState
      };

    }, isPrintMode);

    console.log(`   📊 Extraction complete (${ticketData?.extraction_method})`);
    return ticketData;

  } catch (error) {
    console.error('   ❌ Print mode extraction failed:', error.message);
    return {
      extraction_success: false,
      extraction_method: 'error',
      print_mode: isPrintMode,
      error: error.message,
      extraction_timestamp: new Date().toISOString()
    };
  }
}

/**
 * AUTHENTICATION with retry logic
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
 * PERFORM SEARCH for company tickets
 */
async function performSearch(page, companyName) {
  console.log(`🔍 Searching for tickets: ${companyName}`);

  await page.getByText('Ticket Search').click();
  await page.waitForTimeout(1000);

  await page.getByRole('checkbox', { name: ' My Tickets' }).click();
  await page.waitForTimeout(500);

  // Find company input field - targeting input 9 based on previous successful runs
  const allInputs = await page.$$('.dx-texteditor-input');
  const targetInput = allInputs[9]; // Zero-based, so this is the 10th input

  if (!targetInput) {
    throw new Error('Could not find company input field at expected position');
  }

  await targetInput.click();
  await page.waitForTimeout(300);
  await targetInput.fill(companyName);
  await page.waitForTimeout(500);

  const value = await targetInput.inputValue();
  if (value !== companyName) {
    throw new Error(`Company name not filled correctly. Expected: ${companyName}, Got: ${value}`);
  }

  console.log(`✅ Company field filled: "${value}"`);

  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.waitForTimeout(3000);

  console.log('✅ Search completed successfully');
}

/**
 * DETECT PAGINATION CONTROLS
 */
async function detectPagination(page) {
  try {
    console.log('   🔍 Looking for pagination controls...');

    // Look for the actual pagination structure (.dx-pager)
    const pager = page.locator('.dx-pager');
    const isPagerVisible = await pager.isVisible({ timeout: 3000 }).catch(() => false);

    if (!isPagerVisible) {
      console.log('   📄 No pagination controls found - single page only');
      return { hasPages: false, totalPages: 1, currentPage: 1 };
    }

    // Get pagination text to extract total pages and items
    const pagerText = await pager.textContent();
    console.log(`   📄 Pager text: "${pagerText}"`);

    // Parse "Page 1 of 3 (21 items)" format
    const pageMatch = pagerText.match(/Page\s+(\d+)\s+of\s+(\d+)\s+\((\d+)\s+items\)/);
    if (pageMatch) {
      const currentPage = parseInt(pageMatch[1]);
      const totalPages = parseInt(pageMatch[2]);
      const totalItems = parseInt(pageMatch[3]);

      console.log(`   📄 Detected ${totalPages} total pages with ${totalItems} items`);

      // Get all page elements
      const pageElements = await page.$$('.dx-page');
      const pageNumbers = [];
      for (const pageEl of pageElements) {
        const pageText = await pageEl.textContent();
        const pageNum = parseInt(pageText);
        if (!isNaN(pageNum)) {
          pageNumbers.push(pageNum);
        }
      }

      return {
        hasPages: totalPages > 1,
        totalPages: totalPages,
        currentPage: currentPage,
        totalItems: totalItems,
        pageNumbers: pageNumbers.sort((a, b) => a - b)
      };
    }

    console.log('   ⚠️ Could not parse pagination format');
    return { hasPages: false, totalPages: 1, currentPage: 1 };

  } catch (error) {
    console.warn('   ⚠️ Pagination detection failed:', error.message);
    return { hasPages: false, totalPages: 1, currentPage: 1 };
  }
}

/**
 * NAVIGATE TO PAGE
 */
async function navigateToPage(page, pageNumber) {
  try {
    console.log(`   🔄 Navigating to page ${pageNumber}...`);

    // Find the specific page element to click
    const pageElements = await page.$$('.dx-page');
    let targetPageElement = null;

    for (const pageEl of pageElements) {
      const pageText = await pageEl.textContent();
      const pageNum = parseInt(pageText);
      if (pageNum === pageNumber) {
        targetPageElement = pageEl;
        break;
      }
    }

    if (!targetPageElement) {
      throw new Error(`Page ${pageNumber} element not found`);
    }

    // Check if it's already selected
    const className = await targetPageElement.getAttribute('class');
    if (className?.includes('dx-selection')) {
      console.log(`   ℹ️ Already on page ${pageNumber}`);
      return true;
    }

    // Click the page element
    await targetPageElement.click();
    await page.waitForTimeout(3000); // Wait for page to load

    console.log(`   ✅ Successfully navigated to page ${pageNumber}`);
    return true;

  } catch (error) {
    console.error(`   ❌ Failed to navigate to page ${pageNumber}:`, error.message);
    return false;
  }
}

/**
 * PROCESS TICKETS with advanced print suppression
 */
async function processAllTicketsOnPage(page, pageNumber, allTickets) {
  console.log(`🔄 Processing page ${pageNumber} with advanced print suppression`);

  try {
    await page.waitForTimeout(2000);

    // Find the correct ticket table
    console.log(`   🎯 Locating ticket data table...`);
    const mainDataGrid = page.locator('.dx-datagrid-borders');
    await mainDataGrid.waitFor({ state: 'visible', timeout: 5000 });

    // Use the 3rd table (index 2) which contains actual ticket data
    const ticketTable = mainDataGrid.locator('table.dx-datagrid-table').nth(2);
    const isTableVisible = await ticketTable.isVisible();
    console.log(`   📊 Ticket data table visible: ${isTableVisible}`);

    if (!isTableVisible) {
      throw new Error('Ticket data table not visible');
    }

    // Get all ticket rows
    const ticketRows = await ticketTable.locator('[role="row"]').all();

    // Check if first row is actually a header by looking for column names, not content
    const firstRowText = await ticketRows[0].textContent();
    const isActualHeader = /^(Attachments|Number|Ticket Type|Creation)/i.test(firstRowText.trim());

    console.log(`   🔍 First row analysis: "${firstRowText.substring(0, 50)}..."`);
    console.log(`   📊 First row is header: ${isActualHeader}`);

    const dataRows = isActualHeader ? ticketRows.slice(1) : ticketRows; // Only remove header if it's actually a header

    console.log(`🎫 Found ${dataRows.length} tickets on page ${pageNumber}`);

    // VERIFY STARTING POSITION - ensure we start from first ticket
    console.log(`   🔍 Verifying starting position (first 3 rows):`);
    for (let verifyIndex = 0; verifyIndex < Math.min(3, dataRows.length); verifyIndex++) {
      const verifyRow = dataRows[verifyIndex];
      const verifyText = await verifyRow.textContent();
      const ticketMatch = verifyText.match(/(\d{10})/);
      const ticketId = ticketMatch ? ticketMatch[1] : 'NO_ID';
      console.log(`      Row ${verifyIndex}: ${ticketId} - "${verifyText.substring(0, 50)}..."`);
    }

    // Process ALL tickets starting from index 0 (first ticket)
    const ticketsToProcess = dataRows.length;
    console.log(`   📋 Processing ALL ${ticketsToProcess} tickets (starting from index 0 - FIRST ticket)`);

    for (let i = 0; i < ticketsToProcess; i++) {
      const ticketStartTime = Date.now();
      console.log(`\n   🎫 Processing ticket ${i + 1}/${ticketsToProcess} (row index ${i})`);

      try {
        const currentRow = dataRows[i];

        // Get expected ticket info for verification
        const rowText = await currentRow.textContent();
        const ticketMatch = rowText.match(/(0?\d{10})/); // Handle leading zeros
        const expectedTicketId = ticketMatch ? ticketMatch[1] : 'unknown';
        console.log(`      Expected ID: ${expectedTicketId}`);

        // Select the row by clicking the first gridcell
        await currentRow.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);

        const gridCells = await currentRow.locator('[role="gridcell"]').all();
        if (gridCells.length === 0) {
          throw new Error('No gridcells found in row');
        }

        const firstCell = gridCells[0];
        if (!(await firstCell.isVisible())) {
          throw new Error('First gridcell not visible');
        }

        await firstCell.click({ timeout: 5000 });
        console.log(`      ✅ Row selected successfully`);
        await page.waitForTimeout(1000);

        // Open print menu
        console.log(`      🖨️ Opening print menu...`);
        const printMenuItem = page.getByRole('menuitem', { name: 'Print ' });
        await printMenuItem.waitFor({ state: 'visible', timeout: 5000 });
        await printMenuItem.locator('div').nth(1).click();

        // Open popup and handle print request
        console.log(`      📋 Opening print popup with advanced suppression...`);
        let popupPage = null;

        try {
          const popupPromise = page.waitForEvent('popup', { timeout: 20000 });
          await page.getByText('Print with Positive Response').click();
          popupPage = await popupPromise;
          console.log(`      ✅ Popup opened successfully`);

          // Extract data directly (no print signal waiting needed)
          const ticketData = await handleDataExtraction(popupPage);

          if (ticketData && ticketData.extraction_success) {
            ticketData.page_number = pageNumber;
            ticketData.ticket_index_on_page = i;
            ticketData.processing_time_ms = Date.now() - ticketStartTime;
            allTickets.push(ticketData);

            const extractedId = ticketData.ticket_id;
            // Normalize both IDs by removing leading zeros for comparison
            const normalizeId = (id) => id ? id.replace(/^0+/, '') : '';
            const normalizedExtracted = normalizeId(extractedId);
            const normalizedExpected = normalizeId(expectedTicketId);
            const idMatches = normalizedExtracted === normalizedExpected;

            console.log(`      ✅ SUCCESS: ${extractedId} ${idMatches ? '(MATCH)' : '(MISMATCH!)'}`);
            console.log(`      📄 Method: ${ticketData.extraction_method}`);

            if (!idMatches) {
              console.warn(`      ⚠️ ID MISMATCH: Expected ${expectedTicketId}, got ${extractedId}`);
            }
          } else {
            console.error(`      ❌ No valid data extracted for ticket ${i + 1}`);
          }

        } catch (popupError) {
          console.error(`      ❌ Popup handling failed: ${popupError.message}`);
        }

        // Clean up popup
        try {
          if (popupPage) {
            await popupPage.close();
          }
        } catch (closeError) {
          console.warn(`      ⚠️ Popup close warning: ${closeError.message}`);
        }

        // Rate limiting between tickets
        await page.waitForTimeout(CONFIG.options.rateLimitMs);

      } catch (error) {
        console.error(`      ❌ Failed to process ticket ${i + 1}: ${error.message}`);
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
async function runTexas811ScraperWithPrintSuppression() {
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

  // Apply the sophisticated print dialog suppression
  await setupAdvancedPrintSuppression(context);

  const page = await context.newPage();

  const scrapingSession = {
    metadata: {
      scraping_started: new Date().toISOString(),
      company_filter: CONFIG.company,
      total_pages_processed: 0,
      total_tickets_extracted: 0,
      extraction_errors: 0,
      scraper_version: '2.0.0-advanced-print-suppression',
      features: [
        'context_level_print_override',
        'postmessage_signal_system',
        'print_media_emulation',
        'starting_position_verification',
        'hardened_window_print_replacement'
      ]
    },
    tickets: []
  };

  try {
    console.log('🚀 Starting Texas 811 scraper (ADVANCED PRINT SUPPRESSION)');
    console.log(`📊 Target: ${CONFIG.company}`);
    console.log(`🎯 Output: ${CONFIG.options.outputFile}`);
    console.log(`🔧 Features: Advanced print suppression, Print media emulation, Position verification`);

    // Authentication
    await authenticateWithRetry(page);

    // Search
    await performSearch(page, CONFIG.company);

    // Detect pagination
    console.log('\n🔍 Detecting pagination...');
    const paginationInfo = await detectPagination(page);
    scrapingSession.metadata.pagination_detected = paginationInfo;

    console.log(`📄 Found ${paginationInfo.totalPages} pages to process`);

    // Process all pages
    let totalPagesProcessed = 0;
    for (let currentPage = 1; currentPage <= paginationInfo.totalPages; currentPage++) {
      console.log(`\n📄 === PAGE ${currentPage} of ${paginationInfo.totalPages} ===`);

      // Navigate to page if not the first one
      if (currentPage > 1) {
        const navigationSuccess = await navigateToPage(page, currentPage);
        if (!navigationSuccess) {
          console.error(`❌ Failed to navigate to page ${currentPage}, stopping pagination`);
          break;
        }
      }

      // Process tickets on current page
      const ticketsBeforePage = scrapingSession.tickets.length;
      try {
        await processAllTicketsOnPage(page, currentPage, scrapingSession.tickets);
        const ticketsAfterPage = scrapingSession.tickets.length;
        const ticketsProcessedThisPage = ticketsAfterPage - ticketsBeforePage;

        console.log(`✅ Page ${currentPage} complete: ${ticketsProcessedThisPage} tickets processed`);
        totalPagesProcessed = currentPage;

        // Save progress after each page
        if (CONFIG.options.saveProgress) {
          scrapingSession.metadata.total_pages_processed = totalPagesProcessed;
          scrapingSession.metadata.total_tickets_extracted = scrapingSession.tickets.length;
          saveProgressData(scrapingSession);
        }

      } catch (pageError) {
        console.error(`❌ Failed to process page ${currentPage}:`, pageError.message);
        // Continue to next page instead of stopping completely
        continue;
      }
    }

    scrapingSession.metadata.total_pages_processed = totalPagesProcessed;
    scrapingSession.metadata.total_tickets_extracted = scrapingSession.tickets.length;

    // Save progress
    if (CONFIG.options.saveProgress) {
      saveProgressData(scrapingSession);
    }

    console.log(`\n📊 Processing Results:`);
    console.log(`   Pages Processed: ${totalPagesProcessed}/${paginationInfo.totalPages}`);
    console.log(`   Tickets Extracted: ${scrapingSession.metadata.total_tickets_extracted}`);
    console.log(`   Success Rate: ${totalPagesProcessed === paginationInfo.totalPages ? '100%' : 'Partial'}`);

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
    console.log(`   Success Rate: ${Math.round(scrapingSession.metadata.total_tickets_extracted / (scrapingSession.metadata.total_tickets_extracted || 1) * 100)}%`);
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
  runTexas811ScraperWithPrintSuppression()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { runTexas811ScraperWithPrintSuppression };
