#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

/**
 * TEXAS 811 PRODUCTION TICKET SCRAPER
 *
 * Extracts comprehensive ticket data for compliance and reporting
 * Based on HTML analysis and field mapping requirements
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
 * PRECISE DATA EXTRACTION based on HTML structure analysis
 * Uses robust dt/dd selectors that match the actual HTML patterns
 */
async function extractTicketData(popupPage) {
  try {
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

  // DEBUG: Let's see what input fields are available
  const allInputs = await page.$$('.dx-texteditor-input');
  console.log(`🔍 Found ${allInputs.length} input fields on the page`);

  // Let's examine each input field to understand the structure
  for (let i = 0; i < allInputs.length; i++) {
    try {
      const inputInfo = await allInputs[i].evaluate((el, index) => {
        const parent = el.closest('.dx-textbox, .dx-selectbox, .dx-datebox');
        const parentClasses = parent ? parent.className : '';
        const placeholder = el.placeholder || '';
        const ariaLabel = el.getAttribute('aria-label') || '';
        const currentValue = el.value || '';

        return {
          index: index,
          placeholder,
          ariaLabel,
          currentValue,
          parentClasses: parentClasses.split(' ').filter(c => c.includes('dx')).join(' '),
          isTextbox: parentClasses.includes('dx-textbox'),
          isSelectbox: parentClasses.includes('dx-selectbox'),
          isDatebox: parentClasses.includes('dx-datebox')
        };
      }, i);

      console.log(`   Input ${i}:`, JSON.stringify(inputInfo, null, 2));
    } catch (e) {
      console.log(`   Input ${i}: Failed to analyze - ${e.message}`);
    }
  }

  // Based on the analysis above, let's identify the correct excavator company field
  // From the field analysis, we can see the pattern:
  // Input 0: Ticket Number field (has character limit, truncates to "BRIGHT STAR SOLUTION")
  // Input 1: This is likely another search field, NOT the excavator company
  // We need to find the actual excavator company field in the search form

  console.log('🎯 Looking for excavator company field specifically...');

  // Let's look for the excavator company field by examining the form structure
  // The excavator company should be one of the main search criteria fields
  let companyInputFound = false;
  let excavatorCompanyInput = null;

  // First, let's close any open dropdowns
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // Look for the excavator company field by checking the form layout
  // It should be among the first few non-dropdown text fields, but NOT the ticket number field
  const textboxInputs = [];

  for (let i = 0; i < allInputs.length; i++) {
    const inputDetails = await allInputs[i].evaluate(el => {
      const parent = el.closest('.dx-textbox, .dx-selectbox, .dx-datebox');
      return {
        isTextbox: parent && parent.className.includes('dx-textbox'),
        isSelectbox: parent && parent.className.includes('dx-selectbox'),
        isDatebox: parent && parent.className.includes('dx-datebox'),
        value: el.value || ''
      };
    });

    // Only consider pure textbox inputs (not dropdowns or date fields)
    if (inputDetails.isTextbox && !inputDetails.isSelectbox && !inputDetails.isDatebox) {
      // Skip inputs that already have dates or duration values
      if (!inputDetails.value || (!inputDetails.value.includes('/') && !inputDetails.value.includes('days'))) {
        textboxInputs.push({ index: i, input: allInputs[i], currentValue: inputDetails.value });
      }
    }
  }

  console.log(`Found ${textboxInputs.length} candidate text input fields:`, textboxInputs.map(t => `${t.index}:"${t.currentValue}"`));

  // The excavator company field is likely one of the first few empty textbox fields
  // But NOT the first one (which appears to be ticket number with character limit)

  // Focus on inputs 9 and later as you indicated that's where the excavator company field is
  const candidateInputs = textboxInputs.filter(t => t.index >= 9);
  console.log(`Focusing on inputs 9+ as excavator company candidates:`, candidateInputs.map(t => `${t.index}:"${t.currentValue}"`));

  for (let candidateIndex = 0; candidateIndex < candidateInputs.length; candidateIndex++) {
    const candidate = candidateInputs[candidateIndex];
    const i = candidate.index;

    // Skip inputs that already have values
    if (candidate.currentValue) {
      console.log(`   Skipping input ${i}: already has value: ${candidate.currentValue}`);
      continue;
    }

    console.log(`   Testing input ${i} as excavator company field...`);

    try {
      // Close any open dropdowns first
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Focus on this input
      await candidate.input.click();
      await page.waitForTimeout(500);

      // Check if a dropdown opened
      const dropdownVisible = await page.$('.dx-overlay-wrapper.dx-popup-wrapper:not([style*="display: none"])');
      if (dropdownVisible) {
        console.log(`   Input ${i} opened a dropdown (probably city field), skipping...`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        continue;
      }

      // Try to fill with company name
      await candidate.input.fill('');
      await page.waitForTimeout(200);
      await candidate.input.fill(companyName);
      await page.waitForTimeout(500);

      // Verify it was set correctly
      const newValue = await candidate.input.inputValue();
      if (newValue === companyName) {
        console.log(`✅ Found excavator company field at input ${i}: "${newValue}"`);
        excavatorCompanyInput = candidate.input;
        companyInputFound = true;
        break;
      } else {
        console.log(`   Input ${i} didn't accept company name correctly. Got: "${newValue}"`);
        // Clear it and continue
        await candidate.input.fill('');
      }

    } catch (error) {
      console.log(`   Input ${i} error: ${error.message}`);
      continue;
    }
  }

  if (!companyInputFound) {
    throw new Error('Could not find or fill the excavator company input field');
  }

  // Click search button
  await page.getByRole('button', { name: 'Search', exact: true }).click();

  // Wait for search results with proper validation
  console.log('⏳ Waiting for search results...');
  let resultsFound = false;
  let actualTicketCount = 0;

  for (let attempt = 0; attempt < 10; attempt++) {
    await page.waitForTimeout(1000);

    // Get all rows
    const allRows = await page.$$('[role="row"]');

    // Analyze the actual content of the rows to determine if they contain real ticket data
    let dataRowsWithContent = 0;

    for (let rowIndex = 1; rowIndex < allRows.length; rowIndex++) { // Skip header row
      try {
        const rowText = await allRows[rowIndex].textContent();
        const cells = await allRows[rowIndex].$$('div, td');

        // Check if this row has meaningful ticket data
        // Real ticket rows should have ticket numbers, dates, etc.
        if (rowText && rowText.trim().length > 10 && cells.length > 3) {
          // Look for patterns that indicate real ticket data
          const hasTicketNumber = /\d{10}/.test(rowText); // 10-digit ticket numbers
          const hasDate = /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(rowText); // Date patterns
          const hasCompanyName = rowText.toLowerCase().includes('bright star') || rowText.toLowerCase().includes('solutions');

          if (hasTicketNumber || hasDate || hasCompanyName) {
            dataRowsWithContent++;
          }
        }
      } catch (error) {
        // Skip rows that can't be analyzed
        continue;
      }
    }

    console.log(`⏳ Search attempt ${attempt + 1}/10: Found ${allRows.length - 1} table rows, ${dataRowsWithContent} with actual ticket data`);

    // Be much more strict about what constitutes "actual ticket data"
    // We need substantial ticket data, not just a few rows with some numbers
    if (dataRowsWithContent >= 5) {  // Require at least 5 real tickets
      resultsFound = true;
      actualTicketCount = dataRowsWithContent;
      console.log(`✅ Search completed - found ${actualTicketCount} actual tickets (not empty table rows)`);
      break;
    } else if (dataRowsWithContent > 0) {
      console.log(`⚠️  Found ${dataRowsWithContent} rows with some data, but not enough to be confident this is real ticket data`);
    } else if (allRows.length > 1) {
      console.log(`⚠️  Table has ${allRows.length - 1} rows but no actual ticket data detected`);
    }

    // If we're on the last attempt and still no good results, let's debug
    if (attempt === 9) {
      console.log(`🔍 DEBUGGING - Final attempt, analyzing table structure:`);
      for (let rowIndex = 1; rowIndex < Math.min(allRows.length, 6); rowIndex++) {
        try {
          const rowText = await allRows[rowIndex].textContent();
          console.log(`   Row ${rowIndex}: "${rowText.substring(0, 100)}..."`);
        } catch (e) {
          console.log(`   Row ${rowIndex}: Unable to read`);
        }
      }
    }
  }

  if (!resultsFound || actualTicketCount < 5) {
    console.log(`❌ Search validation failed. Found ${actualTicketCount} tickets, but need at least 5 to be confident.`);

    // Let's try clearing all search fields and starting over with a broader search
    console.log(`🔄 Attempting to clear search and try broader criteria...`);

    // Clear the company field we just filled
    if (excavatorCompanyInput) {
      await excavatorCompanyInput.fill('');
      console.log(`   Cleared excavator company field`);
    }

    // Uncheck "My Tickets" to see all tickets
    await page.getByRole('checkbox', { name: ' My Tickets' }).click();
    console.log(`   Unchecked 'My Tickets' filter`);
    await page.waitForTimeout(500);

    // Try search again
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.waitForTimeout(3000);

    // Check results again
    const broadRows = await page.$$('[role="row"]');
    console.log(`   Broader search returned ${broadRows.length - 1} rows`);

    if (broadRows.length < 10) {
      throw new Error(`Even broad search returned insufficient results. The search functionality may not be working correctly, or there may be no tickets in the system.`);
    } else {
      console.log(`⚠️  Broad search found tickets, but company-specific search failed. This suggests the excavator company field is still not correctly identified.`);
      throw new Error(`Company-specific search failed. The excavator company field (tried input ${excavatorCompanyInput ? 'found' : 'not found'}) may be incorrect. Need to identify the right field.`);
    }
  }
}

/**
 * ENHANCED ROW SELECTION based on working recording analysis
 * The working recording shows multiple ways to select rows - we implement all patterns
 */
async function selectTicketRow(page, rowIndex, totalRows) {
  console.log(`     \ud83c\udfaf Selecting ticket row ${rowIndex + 1}/${totalRows}`);\n
  // Get the specific row\n  const ticketRows = await page.$$('[role=\"row\"]');\n  const dataRows = ticketRows.slice(1); // Remove header row\n  const targetRow = dataRows[rowIndex];\n  \n  if (!targetRow) {\n    throw new Error(`Row ${rowIndex + 1} not found`);\n  }\n  \n  // Try multiple selection methods from the working recording:\n  const selectionMethods = [\n    // Method 1: Click on the first gridcell in the row (most common in recording)\n    async () => {\n      const gridCell = await targetRow.$('[role=\"gridcell\"]');\n      if (gridCell) {\n        await gridCell.click();\n        return 'gridcell';\n      }\n      throw new Error('No gridcell found');\n    },\n    \n    // Method 2: Use getByRole selector (from working recording line 30, 39, etc.)\n    async () => {\n      // Try to get row content to build a selector\n      const rowText = await targetRow.textContent();\n      const ticketMatch = rowText.match(/\\d{10}/);\n      \n      if (ticketMatch) {\n        const ticketNumber = ticketMatch[0];\n        const rowSelector = page.getByRole('row', { name: new RegExp(ticketNumber) });\n        const gridCell = rowSelector.getByRole('gridcell').first();\n        \n        if (await gridCell.isVisible({ timeout: 1000 })) {\n          await gridCell.click();\n          return `role-selector-${ticketNumber}`;\n        }\n      }\n      throw new Error('Role selector method failed');\n    },\n    \n    // Method 3: Direct row click (fallback)\n    async () => {\n      await targetRow.click();\n      return 'direct-row';\n    },\n    \n    // Method 4: Click using exact gridcell selector (from line 68)\n    async () => {\n      const exactCell = page.getByRole('gridcell', { name: '0', exact: true }).nth(rowIndex);\n      if (await exactCell.isVisible({ timeout: 1000 })) {\n        await exactCell.click();\n        return 'exact-gridcell';\n      }\n      throw new Error('Exact gridcell method failed');\n    }\n  ];\n  \n  // Try each method until one works\n  for (let methodIndex = 0; methodIndex < selectionMethods.length; methodIndex++) {\n    try {\n      const method = selectionMethods[methodIndex];\n      const methodName = await method();\n      console.log(`     \u2705 Row selected using method: ${methodName}`);\n      return methodName;\n    } catch (methodError) {\n      console.log(`     \u26a0\ufe0f  Method ${methodIndex + 1} failed: ${methodError.message}`);\n      if (methodIndex === selectionMethods.length - 1) {\n        throw new Error(`All row selection methods failed for row ${rowIndex + 1}`);\n      }\n    }\n  }\n}\n\n/**
 * DYNAMIC PAGINATION detection
 */
async function detectTotalPages(page) {
  try {
    const totalPages = await page.evaluate(() => {
      const pageButtons = Array.from(document.querySelectorAll('button'))
        .filter(btn => /^Page \d+$/.test(btn.textContent?.trim() || ''))
        .map(btn => parseInt(btn.textContent.match(/\d+/)[0]))
        .filter(num => !isNaN(num));

      return pageButtons.length > 0 ? Math.max(...pageButtons) : 1;
    });

    console.log(`📄 Detected ${totalPages} pages`);
    return totalPages;
  } catch (error) {
    console.error('❌ Could not detect pagination, assuming 1 page');
    return 1;
  }
}

/**
 * SYSTEMATIC TICKET PROCESSING for a single page
 * Uses the correct two-step selection process from the working recording
 */
async function processAllTicketsOnPage(page, pageNumber, allTickets) {
  console.log(`🔄 Processing page ${pageNumber}`);

  try {
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

    // Step 2.5: Debug table structure to understand what we're working with
    if (dataRows.length > 0 && dataRows.length < 5) {
      console.log(`   🔍 Debugging table structure (few rows detected):`);\n      for (let debugIndex = 0; debugIndex < Math.min(dataRows.length, 3); debugIndex++) {\n        try {\n          const rowText = await dataRows[debugIndex].textContent();\n          const cells = await dataRows[debugIndex].$$('[role=\"gridcell\"], td, div');\n          console.log(`     Row ${debugIndex + 1}: \"${rowText.substring(0, 100)}\" (${cells.length} cells)`);\n        } catch (debugError) {\n          console.log(`     Row ${debugIndex + 1}: Unable to analyze`);\n        }\n      }\n    }

    console.log(`🎫 Found ${dataRows.length} tickets on page ${pageNumber}`);

    // Limit to top 5 tickets for testing
    const MAX_TICKETS_TO_PROCESS = 5;
    const ticketsToProcess = Math.min(MAX_TICKETS_TO_PROCESS, dataRows.length);
    console.log(`   📋 Processing ${ticketsToProcess} tickets (limited for testing)`);

    // Step 4: Process each ticket using the corrected selection pattern
    for (let i = 0; i < ticketsToProcess; i++) {
      try {
        console.log(`   Processing ticket ${i + 1}/${dataRows.length}`);

        // Step 3a: Use the corrected row selection method
        const currentRow = dataRows[i];

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
        console.log(`     ✅ Selected row ${i + 1}`);

        await page.waitForTimeout(1000); // Wait for selection to register

        // Step 3b: Wait for print menu to become available
        console.log(`     🖨️  Waiting for print menu...`);
        try {
          await page.waitForSelector('[role="menuitem"]', { timeout: 5000 });
          const printMenuItem = page.getByRole('menuitem', { name: 'Print ' });
          await printMenuItem.waitFor({ state: 'visible', timeout: 3000 });

          // Click the print menu
          await printMenuItem.locator('div').nth(1).click();
          console.log(`     ✅ Print menu opened`);

        } catch (menuError) {
          console.log(`     ❌ Print menu not available: ${menuError.message}`);
          console.log(`     🔍 Debugging: Checking what menus are available...`);

          // Debug: List available menu items
          const availableMenus = await page.$$eval('[role="menuitem"]', elements =>
            elements.map(el => el.textContent?.trim()).filter(text => text)
          );
          console.log(`     Available menus: ${availableMenus.join(', ')}`);

          // Try alternative menu selectors from the working recording
          const altMenuSelectors = [
            '.dx-item.dx-menu-item.dx-menu-item-has-text.dx-menu-item-has-submenu.dx-state-hover > div > .dx-menu-item-popout-container > .dx-menu-item-popout',
            '.dx-menu-item-has-submenu',
            '[aria-label*="Print"]'
          ];

          let menuOpened = false;
          for (const selector of altMenuSelectors) {
            try {
              const altMenu = page.locator(selector).first();
              if (await altMenu.isVisible({ timeout: 1000 })) {
                await altMenu.click();
                console.log(`     ✅ Opened menu using alternative selector: ${selector}`);
                menuOpened = true;
                break;
              }
            } catch (altError) {
              continue;
            }
          }

          if (!menuOpened) {
            throw new Error(`Could not open print menu for ticket ${i + 1}`);
          }
        }

        // Step 3c: Open the print popup
        const popupPromise = page.waitForEvent('popup', { timeout: 10000 });
        await page.getByText('Print with Positive Response').click();
        const popupPage = await popupPromise;

        // Step 3d: Wait for popup to load and extract data
        await popupPage.waitForSelector('#tickets', { timeout: 15000 });

        // Extract comprehensive ticket data
        console.log(`     📊 Extracting ticket data...`);
        const ticketData = await extractTicketData(popupPage);

        if (ticketData && (ticketData.ticket_id || ticketData.ticket_id !== '')) {
          ticketData.page_number = pageNumber;
          ticketData.ticket_index_on_page = i;
          allTickets.push(ticketData);

          // Get row text for better logging
          const rowText = await dataRows[i].textContent();
          const ticketMatch = rowText.match(/\d{10}/);
          const actualTicketId = ticketMatch ? ticketMatch[0] : (ticketData.ticket_id || 'unknown');

          console.log(`     ✅ Extracted ticket: ${actualTicketId}`);
        } else {
          console.log(`     ⚠️  No valid data extracted for ticket ${i + 1}`);
        }

        await popupPage.close();
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
      scraper_version: '1.0.0'
    },
    tickets: []
  };

  try {
    console.log('🚀 Starting Texas 811 ticket scraper');
    console.log(`📊 Target: ${CONFIG.company}`);
    console.log(`🎯 Output: ${CONFIG.options.outputFile}`);

    // Step 1: Authenticate
    await authenticateWithRetry(page);

    // Step 2: Search for company tickets
    await performSearch(page, CONFIG.company);

    // Step 3: Process all pages
    const totalPages = await detectTotalPages(page);
    scrapingSession.metadata.total_pages = totalPages;

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      try {
        // Navigate to page (skip for page 1)
        if (pageNum > 1) {
          await page.getByRole('button', { name: `Page ${pageNum}` }).click();
          await page.waitForTimeout(2000);
        }

        // Process all tickets on this page
        const ticketsBeforePage = scrapingSession.tickets.length;
        await processAllTicketsOnPage(page, pageNum, scrapingSession.tickets);
        const ticketsAfterPage = scrapingSession.tickets.length;

        scrapingSession.metadata.total_pages_processed = pageNum;
        scrapingSession.metadata.total_tickets_extracted = ticketsAfterPage;

        // Save progress after each page
        if (CONFIG.options.saveProgress) {
          saveProgressData(scrapingSession);
        }

        console.log(`📊 Page ${pageNum} complete: ${ticketsAfterPage - ticketsBeforePage} tickets added`);

      } catch (pageError) {
        console.error(`❌ Page ${pageNum} failed: ${pageError.message}`);
        scrapingSession.metadata.extraction_errors++;
        // Continue with next page
      }
    }

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
