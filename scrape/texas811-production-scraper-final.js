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

// Configuration - ENHANCED FOR BROWSER STABILITY
const CONFIG = {
  credentials: {
    username: 'james.simmons@highpointe.tech',
    password: 'jgr6dvc8XBK!kaf8qjv'
  },
  company: 'BRIGHTSTAR',
  options: {
    headless: false,
    rateLimitMs: 5000, // Increased for slow site
    maxRetries: 3,
    outputFile: `texas811-full-brightstar-${new Date().toISOString().split('T')[0]}.json`,
    saveProgress: true,
    // FULL EXTRACTION MODE: Process all available tickets
    testMode: false,
    maxTicketsToTest: null, // No limit - process all tickets
    searchOlderTickets: false, // Use default date range
    // BROWSER STABILITY SETTINGS - INCREASED FOR SLOW SITE
    popupTimeout: 60000, // 60 seconds for popup operations
    pageLoadTimeout: 45000, // 45 seconds for page navigation
    stabilityCheckInterval: 5000, // Check browser health every 5 seconds
    maxMemoryUsageMB: 2048, // Maximum memory before restart warning
    // RESPONSE TESTING SETTINGS
    enhancedResponseDebugging: true,
    captureResponseHTML: true
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
    console.log('   🚫 Print suppression already applied at context level');
    console.log('   ⚡ Popup inherits nuclear print prevention');

    // The context-level addInitScript should have already prevented all print operations
    // No additional handling needed - prevention was done before popup content loaded

    // Just wait a moment for page to stabilize
    await popupPage.waitForTimeout(500);

    console.log('   ✅ Nuclear print suppression active - no dialogs should appear');

  } catch (error) {
    console.warn('   ⚠️ Popup dialog handling warning:', error.message);
  }
}

/**
 * ENHANCED BROWSER HEALTH MONITORING with memory tracking
 */
async function checkBrowserHealth(page, context) {
  try {
    // Check if page is still accessible
    const isPageOpen = !page.isClosed();
    const isContextOpen = !context.isClosed;

    if (!isPageOpen || !isContextOpen) {
      throw new Error(`Browser resources closed - Page: ${isPageOpen}, Context: ${isContextOpen}`);
    }

    // Check page responsiveness with a simple evaluation
    await page.evaluate(() => document.title).catch(() => {
      throw new Error('Page evaluation failed - browser may be unresponsive');
    });

    // Memory monitoring
    try {
      const memoryInfo = await page.evaluate(() => {
        if (performance.memory) {
          return {
            usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024), // MB
            totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024), // MB
            jsHeapSizeLimit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) // MB
          };
        }
        return null;
      });

      if (memoryInfo) {
        console.log(`   📊 Memory usage: ${memoryInfo.usedJSHeapSize}MB / ${memoryInfo.totalJSHeapSize}MB (limit: ${memoryInfo.jsHeapSizeLimit}MB)`);

        // Warn if memory usage is getting high
        if (memoryInfo.usedJSHeapSize > CONFIG.options.maxMemoryUsageMB) {
          console.warn(`   ⚠️ High memory usage detected: ${memoryInfo.usedJSHeapSize}MB exceeds ${CONFIG.options.maxMemoryUsageMB}MB threshold`);
        }

        // Critical memory warning
        if (memoryInfo.usedJSHeapSize > (memoryInfo.jsHeapSizeLimit * 0.8)) {
          console.error(`   🚨 CRITICAL: Memory usage near limit (${memoryInfo.usedJSHeapSize}MB / ${memoryInfo.jsHeapSizeLimit}MB)`);
          throw new Error(`Memory usage critically high: ${memoryInfo.usedJSHeapSize}MB`);
        }
      }
    } catch (memoryError) {
      console.warn(`   ⚠️ Memory check failed: ${memoryError.message}`);
      if (memoryError.message.includes('Memory usage critically high')) {
        throw memoryError; // Re-throw critical memory errors
      }
    }

    console.log('   ✅ Browser health check passed');
    return true;
  } catch (error) {
    console.error(`   ❌ Browser health check failed: ${error.message}`);
    throw error;
  }
}

/**
 * CONTEXT STABILITY VERIFICATION
 */
async function verifyContextStability(page, context) {
  try {
    console.log('   🔍 Verifying browser context stability...');

    // Multiple stability checks
    const checks = [
      { name: 'Page accessibility', check: () => !page.isClosed() },
      { name: 'Context accessibility', check: () => !context.isClosed },
      { name: 'Page evaluation', check: async () => {
        try {
          await page.evaluate(() => 1 + 1);
          return true;
        } catch { return false; }
      }},
      { name: 'DOM access', check: async () => {
        try {
          await page.$('body');
          return true;
        } catch { return false; }
      }}
    ];

    for (const { name, check } of checks) {
      const result = await check();
      if (!result) {
        throw new Error(`Stability check failed: ${name}`);
      }
      console.log(`      ✅ ${name}: OK`);
    }

    console.log('   ✅ Context stability verified');
    return true;
  } catch (error) {
    console.error(`   ❌ Context stability check failed: ${error.message}`);
    throw new Error(`Browser context is unstable: ${error.message}`);
  }
}

/**
 * ENHANCED DETAILED RESPONSE DATA EXTRACTION
 * Extracts complete response data matching the reference structure:
 * - code, utility_name, date, username, status, comment, facilities
 */
function extractDetailedResponseData(root) {
  const responses = [];

  try {
    console.log(`     🔍 DETAILED EXTRACTION: Analyzing DOM for complete response structure...`);

    // Get text extraction helper function
    const getText = (element) => element?.textContent?.trim() || '';

    // Look for response status section header
    const statusHeaderText = ['response status as of', 'responses as of', 'member responses', 'utility responses'];
    let responseStatusAsOf = null;

    // Find the status timestamp
    const allText = getText(root).toLowerCase();
    const statusMatch = allText.match(/(response\s+status\s+as\s+of:?\s*)([a-z]+,\s+[a-z]+\s+\d+,\s+\d+\s+\d+:\d+\s+[ap]m)/i);
    if (statusMatch) {
      responseStatusAsOf = statusMatch[2];
      console.log(`     📅 Found response status timestamp: "${responseStatusAsOf}"`);
    }

    // Method 1: Enhanced table-based extraction with multi-column support
    const tables = root.querySelectorAll('table');
    console.log(`     📊 Found ${tables.length} tables to analyze for detailed responses`);

    for (const [tableIndex, table] of tables.entries()) {
      const rows = table.querySelectorAll('tr');
      console.log(`        Table ${tableIndex + 1}: Analyzing ${rows.length} rows`);

      let headerRow = null;
      let headerColumns = [];

      // Find header row and analyze column structure
      for (const [rowIndex, row] of rows.entries()) {
        const cells = Array.from(row.querySelectorAll('td, th'));
        const rowText = cells.map(cell => getText(cell).toLowerCase()).join(' ');

        // Check if this is a header row
        const isHeader = rowText.includes('member') || rowText.includes('utility') ||
                        rowText.includes('response') || rowText.includes('status') ||
                        rowText.includes('contact') || rowText.includes('date');

        if (isHeader && cells.length >= 3) {
          headerRow = row;
          headerColumns = cells.map(cell => getText(cell).toLowerCase());
          console.log(`           🏷️ Header row found: [${headerColumns.join(' | ')}]`);
          continue;
        }

        // Skip if we haven't found a header yet or if insufficient columns
        if (!headerRow || cells.length < 3) continue;

        // Extract data row with detailed field parsing
        const rowData = extractDetailedRowData(cells, headerColumns);
        if (rowData) {
          console.log(`           ✅ Extracted detailed response: ${rowData.code} - ${rowData.utility_name}`);
          responses.push(rowData);
        }
      }
    }

    // Method 2: Look for DevExtreme grids and other structured data
    const grids = root.querySelectorAll('.dx-datagrid, .dx-data-grid, [class*="grid"]');
    console.log(`     🏢 Found ${grids.length} grid structures to analyze`);

    for (const [gridIndex, grid] of grids.entries()) {
      const gridRows = grid.querySelectorAll('[role="row"], tr');
      console.log(`        Grid ${gridIndex + 1}: Analyzing ${gridRows.length} rows`);

      for (const row of gridRows) {
        const cells = Array.from(row.querySelectorAll('[role="gridcell"], td, th'));
        if (cells.length >= 3) {
          const rowData = extractDetailedRowData(cells, []);
          if (rowData) {
            console.log(`           ✅ Grid extraction: ${rowData.code} - ${rowData.utility_name}`);
            responses.push(rowData);
          }
        }
      }
    }

    // Method 3: Smart text parsing for detailed response patterns
    parseDetailedResponsePatterns(root, responses);

    // Add global response status timestamp to all responses
    if (responseStatusAsOf) {
      responses.forEach(response => {
        response.response_status_as_of = responseStatusAsOf;
      });
    }

    console.log(`     🎯 DETAILED EXTRACTION COMPLETE: Found ${responses.length} detailed responses`);
    return responses;

  } catch (error) {
    console.error(`     ❌ Error in detailed response extraction: ${error.message}`);
    return responses;
  }
}

/**
 * Extract detailed response data from a table/grid row
 */
function extractDetailedRowData(cells, headerColumns) {
  const getText = (element) => element?.textContent?.trim() || '';

  try {
    if (cells.length < 3) return null;

    // Get cell texts
    const cellTexts = cells.map(cell => getText(cell));
    const joinedText = cellTexts.join(' ').toLowerCase();

    // Skip obvious header rows
    if (joinedText.includes('member') && joinedText.includes('response')) return null;
    if (joinedText.includes('utility') && joinedText.includes('status')) return null;

    // Extract basic utility info from first column
    const utilityInfo = cellTexts[0];
    if (!utilityInfo || utilityInfo.length < 3) return null;

    // Parse utility code and name
    let code = '';
    let utilityName = '';

    // Try to extract code (usually all caps, alphanumeric)
    const codeMatch = utilityInfo.match(/([A-Z][A-Z0-9_]{2,})/);
    if (codeMatch) {
      code = codeMatch[1];
      // Remove code from name
      utilityName = utilityInfo.replace(code, '').trim();
    } else {
      // Use first word as code
      const words = utilityInfo.split(/\s+/);
      code = words[0];
      utilityName = words.slice(1).join(' ');
    }

    // Extract status from appropriate column
    let status = null;
    let statusText = '';

    // Look for status indicators in columns
    for (let i = 1; i < cellTexts.length; i++) {
      const cellText = cellTexts[i].toLowerCase();
      if (cellText.includes('clear') || cellText.includes('located') || cellText.includes('positive') || cellText.includes('negative')) {
        statusText = cellTexts[i];
        break;
      }
    }

    // Normalize status
    if (statusText.toLowerCase().includes('clear') && !statusText.toLowerCase().includes('not')) {
      status = 'Clear';
    } else if (statusText.toLowerCase().includes('located')) {
      status = 'Located';
    } else if (statusText.toLowerCase().includes('positive')) {
      status = 'Positive';
    } else if (statusText.toLowerCase().includes('negative')) {
      status = 'Negative';
    }

    // Extract date and username from text patterns
    let date = null;
    let username = null;

    // Look for date patterns (Month Day, Year Time AM/PM)
    const fullRowText = cellTexts.join(' ');
    const dateMatch = fullRowText.match(/([A-Z][a-z]+\s+\d+,\s+\d+\s+\d+:\d+\s+[AP]M)/);
    if (dateMatch) {
      date = dateMatch[1];
    }

    // Look for username patterns (usually short alphanumeric with dots)
    const usernameMatch = fullRowText.match(/\b([a-z]+(?:\.[a-z]+)*)\b/);
    if (usernameMatch && usernameMatch[1].includes('.')) {
      username = usernameMatch[1];
    }

    // Extract facilities (look for utility type keywords)
    const facilities = [];
    const facilityKeywords = {
      'electric': 'Electric',
      'gas': 'Gas',
      'phone': 'Phone',
      'fiber': 'Fiber',
      'cable': 'Cable',
      'water': 'Water',
      'sewer': 'Sewer',
      'telecom': 'Telecom'
    };

    const lowerText = fullRowText.toLowerCase();
    Object.entries(facilityKeywords).forEach(([keyword, facility]) => {
      if (lowerText.includes(keyword)) {
        facilities.push(facility);
      }
    });

    // If no specific facilities found, try to infer from utility name
    if (facilities.length === 0) {
      const lowerUtility = utilityName.toLowerCase();
      if (lowerUtility.includes('electric') || lowerUtility.includes('power') || code.includes('CPTEN')) {
        facilities.push('Electric');
      } else if (lowerUtility.includes('gas') || lowerUtility.includes('atmos')) {
        facilities.push('Gas');
      } else if (lowerUtility.includes('comcast') || lowerUtility.includes('cable')) {
        facilities.push('Phone', 'Fiber');
      } else if (lowerUtility.includes('att') || lowerUtility.includes('verizon') || lowerUtility.includes('frontier')) {
        facilities.push('Phone');
      }
    }

    // Only return if we have meaningful data
    if (!code || !utilityName || !status) return null;

    return {
      code: code,
      utility_name: utilityName,
      date: date,
      username: username,
      status: status,
      comment: null, // Will be extracted if present in additional columns
      facilities: facilities.length > 0 ? facilities : ['Unknown'],
      extraction_method: 'detailed_multi_column'
    };

  } catch (error) {
    console.error(`        ❌ Error extracting row data: ${error.message}`);
    return null;
  }
}

/**
 * Parse detailed response patterns from text content
 */
function parseDetailedResponsePatterns(root, responses) {
  const getText = (element) => element?.textContent?.trim() || '';

  try {
    const allText = getText(root);

    // Look for structured response blocks in text
    const responseBlocks = allText.split(/\n\s*\n/);

    for (const block of responseBlocks) {
      if (block.length < 20) continue;

      // Look for utility code patterns with detailed info
      const detailedPattern = /([A-Z][A-Z0-9_]{2,})\s+([^,\n]+?)(?:,\s*|\s+)(September|October|November|December|January|February|March|April|May|June|July|August)\s+(\d+,\s+\d+\s+\d+:\d+\s+[AP]M)\s+([a-z]+(?:\.[a-z]+)*)\s+(Clear|Located|Positive|Negative)/gi;

      let match;
      while ((match = detailedPattern.exec(block)) !== null) {
        const [, code, utilityName, , fullDate, username, status] = match;

        responses.push({
          code: code,
          utility_name: utilityName.trim(),
          date: fullDate,
          username: username,
          status: status,
          comment: null,
          facilities: inferFacilitiesFromName(utilityName),
          extraction_method: 'detailed_text_pattern'
        });
      }
    }
  } catch (error) {
    console.error(`     ❌ Error in text pattern parsing: ${error.message}`);
  }
}

/**
 * Infer facility types from utility name
 */
function inferFacilitiesFromName(utilityName) {
  const name = utilityName.toLowerCase();
  const facilities = [];

  if (name.includes('electric') || name.includes('power') || name.includes('centerpoint')) {
    facilities.push('Electric');
  }
  if (name.includes('gas') || name.includes('atmos')) {
    facilities.push('Gas');
  }
  if (name.includes('comcast') || name.includes('cable')) {
    facilities.push('Phone', 'Fiber');
  }
  if (name.includes('phone') || name.includes('telecom') || name.includes('att') || name.includes('verizon')) {
    facilities.push('Phone');
  }
  if (name.includes('fiber') || name.includes('internet')) {
    facilities.push('Fiber');
  }
  if (name.includes('water')) {
    facilities.push('Water');
  }
  if (name.includes('sewer')) {
    facilities.push('Sewer');
  }

  return facilities.length > 0 ? facilities : ['Unknown'];
}

/**
 * ROBUST CONTENT EXTRACTION with multiple fallback methods and stability checks
 */
async function extractTicketDataWithFallbacks(popupPage) {
  try {
    console.log('   📊 Starting ticket data extraction...');
    console.log('   🎯 ENTERING extractTicketDataWithFallbacks - preparing for comprehensive response debugging...');

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
        const debugLog = []; // Capture debug output to return

        // ENHANCED DEBUG: Comprehensive DOM analysis for response extraction testing
        debugLog.push('🔍 ENHANCED RESPONSE DEBUGGING: Starting comprehensive analysis...');
        debugLog.push(`   📄 Page title: ${document.title}`);
        debugLog.push(`   📊 Root content length: ${getText(root).length} chars`);
        debugLog.push(`   🎯 Testing Mode: Looking for multi-column, multi-line response structures`);

        // CRITICAL: Log current URL and page state
        debugLog.push(`   🌐 Current URL: ${window.location.href}`);
        debugLog.push(`   📄 Document ready state: ${document.readyState}`);
        debugLog.push(`   📊 Root element tag: ${root.tagName}`);
        debugLog.push(`   🎯 Starting comprehensive DOM analysis for responses...`);

        // Log all headers to find response sections
        const allHeaders = Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        debugLog.push(`   📋 Found ${allHeaders.length} headers:`);
        allHeaders.forEach((h, i) => {
          const headerText = getText(h).substring(0, 100);
          debugLog.push(`      ${i+1}. ${h.tagName}: "${headerText}"`);
        });

        // ENHANCED: Look for table structures specifically
        const allTables = Array.from(root.querySelectorAll('table'));
        debugLog.push(`   🗂️ Found ${allTables.length} tables in DOM:`);
        allTables.forEach((table, i) => {
          const tableRows = table.querySelectorAll('tr');
          const tableCells = table.querySelectorAll('td, th');
          const tableText = getText(table).substring(0, 200);
          debugLog.push(`      Table ${i+1}: ${tableRows.length} rows, ${tableCells.length} cells`);
          debugLog.push(`         Content preview: "${tableText}"`);

          // Look for response-related content in this table
          const hasResponseKeywords = /member|response|utility|clear|not clear|positive|negative/i.test(tableText);
          debugLog.push(`         Contains response keywords: ${hasResponseKeywords}`);
        });

        // CRITICAL ANALYSIS: Look specifically for the "Members" section that we know exists
        debugLog.push(`   🎯 CRITICAL: Looking specifically for Members section...`);
        const membersHeader = allHeaders.find(h => getText(h).toLowerCase().includes('member'));
        if (membersHeader) {
          debugLog.push(`   ✅ Found Members header: "${getText(membersHeader)}"`);
          const membersSection = membersHeader.nextElementSibling;
          if (membersSection) {
            debugLog.push(`   🔍 Members section tag: ${membersSection.tagName}`);
            debugLog.push(`   🔍 Members section class: ${membersSection.className || 'no-class'}`);
            debugLog.push(`   🔍 Members section content: "${getText(membersSection).substring(0, 500)}"`);

            // FIXED EXTRACTION: Parse DL format with paired DIV elements
            debugLog.push(`   🔧 FIXING: Extracting utility members from DL format...`);

            const memberDivs = Array.from(membersSection.querySelectorAll('div'));
            debugLog.push(`   🔍 Found ${memberDivs.length} DIV elements in Members section`);

            // Process DIVs in pairs: Code + Name
            let currentMember = {};

            memberDivs.forEach((div, i) => {
              const divText = getText(div).trim();
              debugLog.push(`      Processing DIV ${i+1}: "${divText}"`);

              if (divText.startsWith('Code:')) {
                // Extract member code
                const code = divText.replace('Code:', '').trim();
                if (code && code.length > 0) {
                  currentMember.code = code;
                  debugLog.push(`         ✅ Found member code: "${code}"`);
                }
              } else if (divText.startsWith('Name:')) {
                // Extract member name
                const name = divText.replace('Name:', '').trim();
                if (name && name.length > 0) {
                  currentMember.name = name;
                  debugLog.push(`         ✅ Found member name: "${name}"`);

                  // If we have both code and name, create a response
                  if (currentMember.code && currentMember.name) {
                    const response = {
                      member_code: currentMember.code,
                      member_name: currentMember.name,
                      response_status: 'positive', // From "Positive Response" header
                      response_date: null,
                      comments: null,
                      contact_info: null,
                      extraction_method: 'dl_format_fixed',
                      total_columns: 2,
                      raw_code_text: `Code: ${currentMember.code}`,
                      raw_name_text: `Name: ${currentMember.name}`
                    };

                    responses.push(response);
                    debugLog.push(`         ✅ EXTRACTED RESPONSE: ${currentMember.code} - ${currentMember.name}`);

                    // Reset for next member
                    currentMember = {};
                  }
                }
              }
            });

            debugLog.push(`   🎯 EXTRACTION COMPLETE: Found ${responses.length} utility member responses`);

          } else {
            debugLog.push(`   ❌ No next sibling found after Members header`);
          }
        } else {
          debugLog.push(`   ❌ No Members header found in page`);
        }

        // ENHANCED: Look for column structures (divs with column classes)
        const columnElements = Array.from(root.querySelectorAll('[class*="col"], [class*="column"], .dx-column, .grid-column'));
        debugLog.push(`   📊 Found ${columnElements.length} potential column elements:`);
        columnElements.slice(0, 10).forEach((col, i) => {
          const colText = getText(col).substring(0, 100);
          const className = col.className;
          console.log(`      Column ${i+1}: class="${className}", text="${colText}"`);
        });

        // ENHANCED: Look for grid structures (DevExtreme grids)
        const gridElements = Array.from(root.querySelectorAll('.dx-datagrid, .dx-data-grid, [class*="grid"]'));
        console.log(`   🏢 Found ${gridElements.length} potential grid structures:`);
        gridElements.forEach((grid, i) => {
          const gridRows = grid.querySelectorAll('[role="row"], tr');
          const gridCells = grid.querySelectorAll('[role="gridcell"], td, th');
          console.log(`      Grid ${i+1}: ${gridRows.length} rows, ${gridCells.length} cells`);

          // Analyze first few rows for structure
          Array.from(gridRows).slice(0, 3).forEach((row, rowIndex) => {
            const rowCells = row.querySelectorAll('[role="gridcell"], td, th');
            const rowText = getText(row).substring(0, 150);
            console.log(`         Row ${rowIndex}: ${rowCells.length} cells, text="${rowText}"`);

            // Check each cell for response data
            Array.from(rowCells).forEach((cell, cellIndex) => {
              const cellText = getText(cell);
              if (cellText.length > 5 && /member|response|utility|clear|not clear|positive|negative/i.test(cellText)) {
                console.log(`            Cell ${cellIndex}: "${cellText.substring(0, 50)}"`);
              }
            });
          });
        });

        // Log any elements containing key response terms
        const responseKeywords = ['member', 'response', 'utility', 'clear', 'not clear', 'positive', 'negative'];
        responseKeywords.forEach(keyword => {
          const elements = Array.from(root.querySelectorAll('*')).filter(el =>
            getText(el).toLowerCase().includes(keyword) && getText(el).length < 200
          );
          if (elements.length > 0) {
            console.log(`   🔑 Elements containing "${keyword}": ${elements.length}`);
            elements.slice(0, 3).forEach((el, i) => {
              console.log(`      ${i+1}. ${el.tagName}: "${getText(el).substring(0, 80)}"`);
            });
          }
        });

        // ENHANCED METHOD 1: Comprehensive response section detection
        console.log(`   🔍 METHOD 1: Looking for response sections with enhanced detection...`);

        const responseSections = [
          // Common selectors for response sections
          root.querySelector('#memberResponses'),
          root.querySelector('#utilityResponses'),
          root.querySelector('.member-responses'),
          root.querySelector('.utility-responses'),
          root.querySelector('#responses'),
          root.querySelector('.responses'),
          root.querySelector('[data-section="responses"]'),
          ...Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6')).filter(h => {
            const headerText = getText(h).toLowerCase();
            return headerText.includes('member') ||
                   headerText.includes('response') ||
                   headerText.includes('utility') ||
                   headerText.includes('notifications') ||
                   headerText.includes('contacts');
          }).map(h => h.nextElementSibling),
          // Look for sections after headers containing response keywords
          ...Array.from(root.querySelectorAll('section, div, article')).filter(section => {
            const sectionText = getText(section).toLowerCase();
            const hasResponseContent = /member.*response|utility.*member|positive.*response|negative.*response/i.test(sectionText);
            const isReasonableSize = sectionText.length > 50 && sectionText.length < 5000;
            return hasResponseContent && isReasonableSize;
          })
        ].filter(el => el !== null);

        debugLog.push(`   📂 Found ${responseSections.length} potential response sections`);

        // Enhanced section analysis
        responseSections.forEach((section, i) => {
          const sectionText = getText(section);
          const sectionTag = section.tagName;
          const sectionClass = section.className || 'no-class';
          const sectionId = section.id || 'no-id';

          console.log(`   📋 Section ${i+1}: ${sectionTag} (class="${sectionClass}", id="${sectionId}")`);
          console.log(`      Length: ${sectionText.length} chars`);
          console.log(`      Preview: "${sectionText.substring(0, 150)}"`);

          // Look for 3-column structure within this section
          const tables = section.querySelectorAll('table');
          const rows = section.querySelectorAll('tr');
          const divs = section.querySelectorAll('div');
          const columns = section.querySelectorAll('[class*="col"], .column, .dx-column');

          console.log(`      Structure: ${tables.length} tables, ${rows.length} rows, ${divs.length} divs, ${columns.length} columns`);

          // Check for 3-column patterns
          if (tables.length > 0) {
            tables.forEach((table, tableIndex) => {
              const tableRows = table.querySelectorAll('tr');
              console.log(`         Table ${tableIndex + 1}: ${tableRows.length} rows`);

              // Check first few rows for column count
              Array.from(tableRows).slice(0, 3).forEach((row, rowIndex) => {
                const cells = row.querySelectorAll('td, th');
                console.log(`            Row ${rowIndex + 1}: ${cells.length} cells`);
                if (cells.length === 3) {
                  console.log(`               ✅ 3-COLUMN STRUCTURE DETECTED!`);
                  Array.from(cells).forEach((cell, cellIndex) => {
                    const cellText = getText(cell);
                    console.log(`                  Column ${cellIndex + 1}: "${cellText.substring(0, 80)}"`);
                  });
                }
              });
            });
          }
        });

        for (const section of responseSections) {
          if (!section) continue;

          console.log(`   🔍 METHOD 2: Processing response section with enhanced 3-column analysis...`);

          // ENHANCED: Look for table rows in response section with detailed column analysis
          const responseRows = section.querySelectorAll('tr');
          console.log(`      Found ${responseRows.length} table rows in section`);

          for (const [rowIndex, row] of responseRows.entries()) {
            const cells = Array.from(row.querySelectorAll('td, th'));
            console.log(`         Row ${rowIndex + 1}: ${cells.length} cells`);

            if (cells.length < 2) {
              console.log(`            Skipping - insufficient cells`);
              continue;
            }

            const rowText = cells.map(cell => getText(cell)).join(' | ');
            console.log(`            Full row text: "${rowText}"`);

            // Skip header rows with enhanced detection
            const isHeaderRow = rowText.toLowerCase().includes('member') &&
                               (rowText.toLowerCase().includes('response') ||
                                rowText.toLowerCase().includes('status') ||
                                rowText.toLowerCase().includes('contact'));

            if (isHeaderRow) {
              console.log(`            ✅ HEADER ROW DETECTED - skipping`);
              continue;
            }

            // ENHANCED: Analyze each cell for multi-line content
            const cellAnalysis = cells.map((cell, cellIndex) => {
              const cellText = getText(cell);
              const cellLines = cellText.split('\n').filter(line => line.trim().length > 0);
              const cellHTML = cell.innerHTML;

              console.log(`               Cell ${cellIndex + 1}:`);
              console.log(`                  Text length: ${cellText.length} chars`);
              console.log(`                  Lines: ${cellLines.length}`);
              console.log(`                  Content: "${cellText.substring(0, 100)}"`);

              if (cellLines.length > 1) {
                console.log(`                  ✅ MULTI-LINE CELL DETECTED:`);
                cellLines.forEach((line, lineIndex) => {
                  console.log(`                     Line ${lineIndex + 1}: "${line.trim()}"`);
                });
              }

              return {
                text: cellText,
                lines: cellLines,
                html: cellHTML,
                isMultiLine: cellLines.length > 1
              };
            });

            // ENHANCED: Extract member/utility info with 3-column structure support
            if (cells.length >= 3) {
              console.log(`            ✅ 3-COLUMN STRUCTURE CONFIRMED - extracting data...`);

              // Column 1: Member/Utility Information
              const col1Analysis = cellAnalysis[0];
              const memberName = col1Analysis.text.trim();

              // Column 2: Response Status/Type
              const col2Analysis = cellAnalysis[1];
              const statusText = col2Analysis.text.trim();

              // Column 3: Contact/Additional Information
              const col3Analysis = cellAnalysis[2];
              const contactInfo = col3Analysis.text.trim();

              console.log(`               Column 1 (Member): "${memberName}"`);
              console.log(`               Column 2 (Status): "${statusText}"`);
              console.log(`               Column 3 (Contact): "${contactInfo}"`);

              if (memberName && statusText && memberName.length > 2) {
                const response = {
                  // Basic extraction
                  member_code: memberName.split(' ')[0] || memberName,
                  member_name: memberName,
                  response_status: statusText.toLowerCase(),

                  // Enhanced 3-column data
                  contact_info: contactInfo,
                  response_date: cells.length > 3 ? getText(cells[3]) : null,
                  comments: cells.length > 4 ? getText(cells[4]) : null,

                  // Multi-line field preservation
                  member_info_lines: col1Analysis.lines,
                  status_info_lines: col2Analysis.lines,
                  contact_info_lines: col3Analysis.lines,

                  // Raw data for debugging
                  raw_row_data: rowText,
                  raw_column_data: {
                    column_1: col1Analysis.text,
                    column_2: col2Analysis.text,
                    column_3: col3Analysis.text
                  },

                  // Structure metadata
                  extraction_method: 'enhanced_3_column',
                  has_multi_line_fields: cellAnalysis.some(cell => cell.isMultiLine),
                  total_columns: cells.length
                };

                // Enhanced status normalization
                if (statusText.toLowerCase().includes('clear') && !statusText.toLowerCase().includes('not clear')) {
                  response.response_status = 'clear';
                } else if (statusText.toLowerCase().includes('not clear') || statusText.toLowerCase().includes('not_clear')) {
                  response.response_status = 'not_clear';
                } else if (statusText.toLowerCase().includes('no response')) {
                  response.response_status = 'no_response';
                } else if (statusText.toLowerCase().includes('positive')) {
                  response.response_status = 'positive';
                } else if (statusText.toLowerCase().includes('negative')) {
                  response.response_status = 'negative';
                }

                console.log(`               ✅ RESPONSE EXTRACTED: ${response.member_name} -> ${response.response_status}`);
                responses.push(response);
              } else {
                console.log(`               ❌ Insufficient data - skipping row`);
              }
            } else {
              // Handle 2-column structure (legacy support)
              console.log(`            📋 2-COLUMN STRUCTURE - using legacy extraction...`);
              const memberName = getText(cells[0]);
              const statusText = getText(cells[1]);

              if (memberName && statusText && memberName.length > 2) {
                const response = {
                  member_code: memberName.split(' ')[0] || memberName,
                  member_name: memberName,
                  response_status: statusText.toLowerCase(),
                  response_date: null,
                  comments: null,
                  contact_info: null,
                  raw_row_data: rowText,
                  extraction_method: 'legacy_2_column',
                  total_columns: cells.length
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

        // Method 4: ENHANCED DETAILED RESPONSE EXTRACTION
        console.log(`   🎯 METHOD 4: Enhanced detailed response extraction for complete field capture...`);

        // Look for structured response data with detailed fields
        try {
          console.log(`   🎯 ENHANCED EXTRACTION: Starting detailed extraction for ticket...`);
          const detailedResponses = extractDetailedResponseData(root);
          if (detailedResponses.length > 0) {
            console.log(`   ✅ ENHANCED EXTRACTION: Found ${detailedResponses.length} detailed responses`);
            detailedResponses.forEach((resp, i) => {
              console.log(`      ${i+1}. ${resp.code} - ${resp.utility_name} (${resp.status}) [${resp.extraction_method}]`);
              if (resp.date) console.log(`         Date: ${resp.date}`);
              if (resp.username) console.log(`         Username: ${resp.username}`);
              if (resp.facilities && resp.facilities.length > 0) console.log(`         Facilities: [${resp.facilities.join(', ')}]`);
            });
            responses.push(...detailedResponses);
          } else {
            console.log(`   ⚠️  ENHANCED EXTRACTION: No detailed responses found, falling back to legacy methods`);
          }
        } catch (error) {
          console.log(`   ❌ Enhanced extraction failed: ${error.message}`);
          console.log(`   Stack: ${error.stack}`);
        }

        // Method 5: Legacy text pattern extraction (fallback)
        const allText = getText(root);
        console.log(`   📋 METHOD 5: Analyzing ${allText.length} chars of text for response patterns...`);

        const responsePatterns = [
          // Enhanced patterns to catch more variations
          /([A-Z][A-Z0-9_]{2,})\s*[-:]\s*(clear|not clear|no response|positive|negative)/gi,
          /(clear|not clear|no response|positive|negative)\s*[-:]\s*([A-Z][A-Z0-9_]{2,})/gi,
          // Common utility codes
          /(TGC|ATMOS|CENTERPOINT|CPS|COMCAST|AT&T|VERIZON|FRONTIER|ONCOR)\s*[-:]\s*(clear|not clear|no response|positive|negative)/gi,
          /(clear|not clear|no response|positive|negative)\s*[-:]\s*(TGC|ATMOS|CENTERPOINT|CPS|COMCAST|AT&T|VERIZON|FRONTIER|ONCOR)/gi
        ];

        for (const pattern of responsePatterns) {
          let match;
          while ((match = pattern.exec(allText)) !== null) {
            console.log(`   🎯 Found response pattern: "${match[0]}"`);

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

        // ENHANCED METHOD 5: Comprehensive page analysis and HTML capture
        console.log(`   🔍 METHOD 5: Comprehensive analysis and HTML capture...`);
        console.log(`   📊 Current responses found: ${responses.length}`);

        if (responses.length === 0) {
          console.log('   🚨 NO RESPONSES FOUND - Performing deep analysis...');

          // Save more comprehensive debugging information
          const debugText = allText.substring(0, 3000);
          console.log(`   📄 DEBUG CONTENT (first 3000 chars):`);
          console.log(debugText);

          // Enhanced pattern analysis
          const debugPatterns = [
            { name: 'Utility Codes', pattern: /[A-Z]{2,}/g },
            { name: 'Response Keywords', pattern: /(clear|not clear|positive|negative|response|member|utility)/gi },
            { name: 'Company Names', pattern: /(atmos|centerpoint|oncor|tgc|comcast|at&t|verizon|frontier)/gi },
            { name: 'Phone Numbers', pattern: /\(\d{3}\)\s*\d{3}-\d{4}/g },
            { name: 'Email Addresses', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g }
          ];

          debugPatterns.forEach(({ name, pattern }) => {
            const matches = [...allText.matchAll(pattern)];
            if (matches.length > 0) {
              console.log(`   🔍 ${name}: ${matches.slice(0, 15).map(m => m[0]).join(', ')}`);
            }
          });

          // Capture HTML structure for offline analysis
          if (window.CONFIG && window.CONFIG.options && window.CONFIG.options.captureResponseHTML) {
            console.log('   📋 Capturing HTML structure for analysis...');

            // Get the raw HTML of potential response areas
            const htmlCaptures = {
              full_page_html: document.documentElement.outerHTML.substring(0, 10000),
              body_html: document.body ? document.body.innerHTML.substring(0, 5000) : 'no body',
              tables_html: Array.from(document.querySelectorAll('table')).map((table, i) => ({
                index: i,
                html: table.outerHTML.substring(0, 2000),
                text: table.textContent.substring(0, 500)
              })),
              grids_html: Array.from(document.querySelectorAll('.dx-datagrid, [class*="grid"]')).map((grid, i) => ({
                index: i,
                html: grid.outerHTML.substring(0, 2000),
                text: grid.textContent.substring(0, 500)
              }))
            };

            // Store in window for access from outside
            window._debugHTMLCapture = htmlCaptures;
            console.log('   ✅ HTML structure captured to window._debugHTMLCapture');
          }
        } else {
          console.log(`   ✅ SUCCESS: Found ${responses.length} responses using enhanced extraction`);
          console.log(`   🎯 DETAILED DEBUGGING COMPLETE - check above for comprehensive DOM analysis`);

          // Log summary of extraction methods used
          const methodCounts = {};
          responses.forEach(resp => {
            const method = resp.extraction_method || 'unknown';
            methodCounts[method] = (methodCounts[method] || 0) + 1;
          });

          console.log('   📊 Extraction method summary:');
          Object.entries(methodCounts).forEach(([method, count]) => {
            console.log(`      ${method}: ${count} responses`);
          });

          // Log multi-line field detection
          const multiLineResponses = responses.filter(resp => resp.has_multi_line_fields);
          console.log(`   📋 Multi-line fields detected: ${multiLineResponses.length}/${responses.length} responses`);

          // Log column structure analysis
          const columnCounts = {};
          responses.forEach(resp => {
            const cols = resp.total_columns || 'unknown';
            columnCounts[cols] = (columnCounts[cols] || 0) + 1;
          });

          console.log('   🏢 Column structure summary:');
          Object.entries(columnCounts).forEach(([cols, count]) => {
            console.log(`      ${cols} columns: ${count} responses`);
          });
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

        return { responses: uniqueResponses, debugOutput: debugLog };
      };

      // Extract basic ticket info
      const ticketId = getTicketNumber();
      const companyInfo = getCompanyInfo();
      const gpsCoords = getGPSCoordinates();
      const utilityResponsesResult = getUtilityMemberResponses();
      const utilityResponses = utilityResponsesResult.responses;
      const responseDebugOutput = utilityResponsesResult.debugOutput;

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
        content_length: getText(root).length,

        // Debug output from response extraction
        response_debug_output: responseDebugOutput
      };
    });

    console.log(`   📊 Extraction complete (method: ${ticketData?.extraction_method})`);

    // Log the detailed response debugging output
    if (ticketData?.response_debug_output && ticketData.response_debug_output.length > 0) {
      console.log(`   🔍 RESPONSE EXTRACTION DEBUG OUTPUT:`);
      ticketData.response_debug_output.forEach(line => {
        console.log(`   ${line}`);
      });
    } else {
      console.log(`   ⚠️ No response debug output captured`);
    }

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
      await page.waitForTimeout(1000);

      // Fill username and password
      await page.locator('input[name="username"]').fill(CONFIG.credentials.username);
      await page.locator('input[name="password"]').fill(CONFIG.credentials.password);

      // Try multiple checkbox selector strategies to handle UI changes
      let checkboxClicked = false;
      const checkboxSelectors = [
        () => page.getByRole('checkbox', { name: /agree.*terms/i }),
        () => page.getByRole('checkbox', { name: /terms.*conditions/i }),
        () => page.getByRole('checkbox', { name: 'I agree to terms & conditions' }),
        () => page.locator('input[type="checkbox"][name*="agree"]'),
        () => page.locator('input[type="checkbox"][name*="terms"]')
      ];

      for (const getCheckbox of checkboxSelectors) {
        try {
          const checkbox = getCheckbox();
          await checkbox.waitFor({ timeout: 3000 });
          const isVisible = await checkbox.isVisible();
          if (isVisible) {
            await checkbox.click();
            console.log('✅ Terms & conditions checkbox clicked');
            checkboxClicked = true;
            break;
          }
        } catch (selectorError) {
          // Try next selector
          continue;
        }
      }

      if (!checkboxClicked) {
        throw new Error('Could not find or click terms & conditions checkbox');
      }

      // Click login button
      await page.getByRole('button', { name: 'Login' }).click();

      // Wait for navigation to dashboard
      await page.waitForURL('**/dashboard', { timeout: 10000 });
      console.log('✅ Authentication successful');
      return;

    } catch (error) {
      console.error(`❌ Authentication attempt ${attempt} failed:`, error.message);

      if (attempt === CONFIG.options.maxRetries) {
        // Save debug screenshot on final failure
        try {
          const screenshotPath = `/tmp/auth-final-failure.png`;
          await page.screenshot({ path: screenshotPath, fullPage: true });
          console.log(`📸 Debug screenshot saved: ${screenshotPath}`);
        } catch (screenshotError) {
          // Screenshot error is not critical
        }
        throw new Error(`Authentication failed after ${CONFIG.options.maxRetries} attempts: ${error.message}`);
      }

      console.log(`⏳ Waiting 2 seconds before retry...`);
      await page.waitForTimeout(2000);
    }
  }
}

/**
 * SEARCH with enhanced validation and date filtering for response testing
 */
async function performSearch(page, companyName) {
  console.log(`🔍 Searching for tickets: ${companyName}`);

  if (CONFIG.options.testMode) {
    console.log(`🧪 TESTING MODE: Searching for older tickets with utility responses`);
  }

  await page.getByText('Ticket Search').click();
  await page.waitForTimeout(1000);

  await page.getByRole('checkbox', { name: ' My Tickets' }).click();
  await page.waitForTimeout(500);

  // For testing mode, set a date range to find older tickets with responses
  if (CONFIG.options.testMode) {
    console.log(`📅 Setting date range to find tickets with responses...`);

    try {
      // Look for date input fields and set them to search for tickets from 2-4 weeks ago
      const dateInputs = await page.$$('input[type="text"]');
      console.log(`   Found ${dateInputs.length} text input fields`);

      // Try to find and set "From Date" field (usually around 30 days ago)
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 30); // 30 days ago
      const fromDateStr = fromDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

      // Try to find and set "To Date" field (usually around 14 days ago)
      const toDate = new Date();
      toDate.setDate(toDate.getDate() - 14); // 14 days ago
      const toDateStr = toDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

      console.log(`   Date range: ${fromDateStr} to ${toDateStr}`);

      // Try to locate date fields by examining nearby labels or placeholders
      for (let i = 6; i < Math.min(dateInputs.length, 12); i++) {
        try {
          const input = dateInputs[i];
          const placeholder = await input.getAttribute('placeholder');
          const value = await input.inputValue();

          console.log(`   Input ${i}: placeholder="${placeholder}", value="${value}"`);

          // Look for date-related placeholders
          if (placeholder && /date|from|to/i.test(placeholder)) {
            if (/from|start/i.test(placeholder)) {
              await input.fill(fromDateStr);
              console.log(`   ✅ Set from date: ${fromDateStr}`);
            } else if (/to|end/i.test(placeholder)) {
              await input.fill(toDateStr);
              console.log(`   ✅ Set to date: ${toDateStr}`);
            }
            await page.waitForTimeout(500);
          }
        } catch (dateError) {
          console.log(`   ⚠️ Error with date input ${i}: ${dateError.message}`);
        }
      }

    } catch (dateSetupError) {
      console.log(`   ⚠️ Could not set date range: ${dateSetupError.message}`);
      console.log(`   📝 Proceeding with default search (may get recent tickets without responses)`);
    }
  }

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
 * PAGINATION SUPPORT FUNCTIONS - UPDATED FOR PAGE NUMBER CLICKING
 */
async function checkForNextPage(page) {
  try {
    console.log('   🔍 Getting total number of pages from pagination info...');

    // Get pagination info from page text
    const pageBody = await page.textContent('body');
    const pageInfoMatch = pageBody.match(/Page\s+(\d+)\s+of\s+(\d+)\s*\((\d+)\s+items\)/i);

    if (pageInfoMatch) {
      const currentPage = parseInt(pageInfoMatch[1]);
      const totalPages = parseInt(pageInfoMatch[2]);
      const totalItems = parseInt(pageInfoMatch[3]);

      console.log(`   📊 Pagination Info: Page ${currentPage} of ${totalPages} (${totalItems} items)`);
      console.log(`   📄 Will process pages 1 through ${totalPages}`);

      return totalPages;
    } else {
      console.log('   ⚠️ Could not parse pagination info from page text');
      console.log('   📄 Defaulting to 1 page only');
      return 1;
    }
  } catch (error) {
    console.warn(`   ⚠️ Error getting total pages: ${error.message}`);
    return 1;
  }
}

async function navigateToPage(page, pageNumber) {
  try {
    console.log(`   🔄 Attempting to navigate to page ${pageNumber} with stability checks...`);

    // STABILITY CHECK: Verify browser health before navigation
    await verifyContextStability(page, page.context());

    // Additional safety check - ensure page is not closed
    if (page.isClosed()) {
      throw new Error('Cannot navigate - page has been closed');
    }

    // DevExtreme pagination selectors for specific page numbers
    const devExtremePageSelectors = [
      // DevExtreme page buttons
      '.dx-page',
      '.dx-pager .dx-page-index',
      '.dx-pager-page',
      '.dx-pager .dx-pages .dx-button',
      '.dx-pages .dx-button'
    ];

    // Method 1: Try DevExtreme-specific page button selectors
    console.log(`   🔍 Looking for DevExtreme page ${pageNumber} buttons...`);
    for (const selector of devExtremePageSelectors) {
      try {
        const elements = await page.$$(selector);
        console.log(`   📋 Found ${elements.length} elements with selector: ${selector}`);

        for (let i = 0; i < elements.length; i++) {
          const element = page.locator(selector).nth(i);
          const text = await element.textContent().catch(() => '') || '';
          const isVisible = await element.isVisible().catch(() => false);
          const isEnabled = await element.isEnabled().catch(() => false);
          const classes = await element.getAttribute('class').catch(() => '') || '';

          console.log(`      Element ${i}: text="${text.trim()}", visible=${isVisible}, enabled=${isEnabled}`);

          if (text.trim() === pageNumber.toString() && isVisible && isEnabled && !classes.includes('dx-state-disabled')) {
            console.log(`   🖱️ Clicking DevExtreme page ${pageNumber} button: ${selector}`);

            // STABILITY CHECK: Verify browser before clicking
            if (page.isClosed()) {
              throw new Error('Page closed before navigation click');
            }

            await element.click();

            // Extended wait with stability monitoring
            await page.waitForTimeout(5000);

            // Verify page is still accessible after navigation
            if (page.isClosed()) {
              throw new Error('Page closed during navigation');
            }

            // Verify navigation worked
            const newPageText = await page.textContent('body');
            const newPageMatch = newPageText.match(/Page\s+(\d+)\s+of\s+(\d+)/i);
            const currentPageNum = newPageMatch ? parseInt(newPageMatch[1]) : 0;

            if (currentPageNum === pageNumber) {
              console.log(`   ✅ Successfully navigated to page ${pageNumber}`);
              return true;
            } else {
              console.log(`   ⚠️ Navigation may have failed - current page: ${currentPageNum}, expected: ${pageNumber}`);
            }
          }
        }
      } catch (error) {
        console.log(`   ❌ Error with selector ${selector}: ${error.message}`);
        continue;
      }
    }

    // Method 2: Try standard button selectors with exact text matching
    console.log(`   🔄 Trying standard button selectors for page ${pageNumber}...`);
    const standardSelectors = [
      `button:has-text("${pageNumber}")`,
      `button[aria-label="Page ${pageNumber}"]`,
      `button[value="${pageNumber}"]`,
      `button[data-page="${pageNumber}"]`,
      `.page-link:has-text("${pageNumber}")`,
      `.pagination button:has-text("${pageNumber}")`
    ];

    for (const selector of standardSelectors) {
      try {
        const button = await page.$(selector);
        if (button) {
          const isVisible = await button.isVisible();
          const isEnabled = await button.isEnabled();
          console.log(`   📋 Found button with ${selector}: visible=${isVisible}, enabled=${isEnabled}`);

          if (isVisible && isEnabled) {
            console.log(`   🖱️ Clicking page ${pageNumber} button: ${selector}`);
            await button.click();
            await page.waitForTimeout(3000);

            // Verify navigation
            const newPageText = await page.textContent('body');
            const newPageMatch = newPageText.match(/Page\s+(\d+)\s+of\s+(\d+)/i);
            const currentPageNum = newPageMatch ? parseInt(newPageMatch[1]) : 0;

            if (currentPageNum === pageNumber) {
              console.log(`   ✅ Successfully navigated to page ${pageNumber}`);
              return true;
            }
          }
        }
      } catch (error) {
        console.log(`   ❌ Selector ${selector} failed: ${error.message}`);
        continue;
      }
    }

    // Method 3: Use Playwright's text locator
    console.log(`   🔄 Trying Playwright text locator for page ${pageNumber}...`);
    try {
      // Look for buttons with exact page number text
      const pageButton = page.locator(`button >> text="${pageNumber}"`).first();
      const isVisible = await pageButton.isVisible({ timeout: 2000 }).catch(() => false);
      console.log(`   📄 Text locator button visible: ${isVisible}`);

      if (isVisible) {
        await pageButton.click({ timeout: 5000 });
        await page.waitForTimeout(3000);

        // Verify navigation
        const newPageText = await page.textContent('body');
        const newPageMatch = newPageText.match(/Page\s+(\d+)\s+of\s+(\d+)/i);
        const currentPageNum = newPageMatch ? parseInt(newPageMatch[1]) : 0;

        if (currentPageNum === pageNumber) {
          console.log(`   ✅ Successfully navigated to page ${pageNumber} via text locator`);
          return true;
        }
      }
    } catch (textError) {
      console.log(`   ❌ Text locator failed: ${textError.message}`);
    }

    // Method 4: Use getByText approach
    console.log(`   🔄 Trying getByText approach for page ${pageNumber}...`);
    try {
      const pageButton = page.getByText(pageNumber.toString(), { exact: true }).first();
      const isVisible = await pageButton.isVisible({ timeout: 2000 }).catch(() => false);
      console.log(`   📄 getByText button visible: ${isVisible}`);

      if (isVisible) {
        await pageButton.click({ timeout: 5000 });
        await page.waitForTimeout(3000);

        // Verify navigation
        const newPageText = await page.textContent('body');
        const newPageMatch = newPageText.match(/Page\s+(\d+)\s+of\s+(\d+)/i);
        const currentPageNum = newPageMatch ? parseInt(newPageMatch[1]) : 0;

        if (currentPageNum === pageNumber) {
          console.log(`   ✅ Successfully navigated to page ${pageNumber} via getByText`);
          return true;
        }
      }
    } catch (getByTextError) {
      console.log(`   ❌ getByText failed: ${getByTextError.message}`);
    }

    // Method 5: Comprehensive button search with evaluation
    console.log(`   🔄 Trying comprehensive button search for page ${pageNumber}...`);
    try {
      const found = await page.evaluate((targetPage) => {
        // Find all buttons on the page
        const allButtons = Array.from(document.querySelectorAll('button'));
        console.log(`Searching ${allButtons.length} buttons for page ${targetPage}`);

        // Look for buttons with the target page number
        for (const btn of allButtons) {
          const text = btn.textContent?.trim() || '';
          const isVisible = btn.offsetParent !== null;
          const isEnabled = !btn.disabled && !btn.classList.contains('dx-state-disabled');

          if (text === targetPage.toString() && isVisible && isEnabled) {
            console.log(`Found matching button: "${text}" - clicking...`);
            btn.click();
            return true;
          }
        }

        // Also try to find in pagination containers specifically
        const paginationContainers = [
          ...document.querySelectorAll('.dx-pager'),
          ...document.querySelectorAll('.pagination'),
          ...document.querySelectorAll('[class*="pager"]'),
          ...document.querySelectorAll('[class*="page"]')
        ];

        for (const container of paginationContainers) {
          const buttons = container.querySelectorAll('button');
          for (const btn of buttons) {
            const text = btn.textContent?.trim() || '';
            const isVisible = btn.offsetParent !== null;
            const isEnabled = !btn.disabled && !btn.classList.contains('dx-state-disabled');

            if (text === targetPage.toString() && isVisible && isEnabled) {
              console.log(`Found matching pagination button: "${text}" - clicking...`);
              btn.click();
              return true;
            }
          }
        }

        return false;
      }, pageNumber);

      if (found) {
        await page.waitForTimeout(3000);

        // Verify navigation
        const newPageText = await page.textContent('body');
        const newPageMatch = newPageText.match(/Page\s+(\d+)\s+of\s+(\d+)/i);
        const currentPageNum = newPageMatch ? parseInt(newPageMatch[1]) : 0;

        if (currentPageNum === pageNumber) {
          console.log(`   ✅ Successfully navigated to page ${pageNumber} via comprehensive search`);
          return true;
        } else {
          console.log(`   ⚠️ Click executed but page didn't change. Current: ${currentPageNum}, Expected: ${pageNumber}`);
        }
      }
    } catch (evalError) {
      console.log(`   ❌ Comprehensive search failed: ${evalError.message}`);
    }

    throw new Error(`Could not find or click page ${pageNumber} button`);
  } catch (error) {
    console.error(`   ❌ Failed to navigate to page ${pageNumber}: ${error.message}`);
    throw error;
  }
}

/**
 * TICKET PROCESSING with comprehensive fixes
 */
async function processAllTicketsOnPage(page, pageNumber, allTickets, maxTickets = null) {
  console.log(`🔄 Processing page ${pageNumber} with comprehensive fixes`);

  try {
    await page.waitForTimeout(2000);

    // DEBUG: Comprehensive table detection
    console.log(`   🎯 DEBUGGING: Comprehensive table analysis...`);

    // Check all available data grids
    const allDataGrids = await page.$$('.dx-datagrid-borders');
    console.log(`   🔍 Found ${allDataGrids.length} data grids total`);

    for (let i = 0; i < allDataGrids.length; i++) {
      const grid = page.locator('.dx-datagrid-borders').nth(i);
      const tables = await grid.locator('table.dx-datagrid-table').all();
      console.log(`   📊 Grid ${i}: Contains ${tables.length} tables`);

      for (let j = 0; j < tables.length; j++) {
        const table = grid.locator('table.dx-datagrid-table').nth(j);
        const rows = await table.locator('[role="row"]').all();
        console.log(`      Table ${j}: ${rows.length} rows (including header)`);

        if (rows.length > 1) {
          // Check if this looks like a ticket table by examining first data row
          const firstDataRow = rows[1];
          const rowText = await firstDataRow.textContent();
          const hasTicketPattern = /\d{10}/.test(rowText);
          console.log(`      Table ${j} first data row: "${rowText.substring(0, 80)}..."`);
          console.log(`      Table ${j} has ticket pattern: ${hasTicketPattern}`);
        }
      }
    }

    // Use the main data grid (should be the first one) - CRITICAL: Don't require visibility
    const mainDataGrid = page.locator('.dx-datagrid-borders').first();

    // Wait for the element to exist but don't require visibility
    try {
      await mainDataGrid.waitFor({ state: 'attached', timeout: 30000 });
      console.log('   ✅ Data grid found and attached to DOM');
    } catch (attachError) {
      console.log('   ❌ Data grid not found, trying alternative approach...');

      // Alternative: Look for any data grid
      const anyDataGrid = page.locator('[role="group"][aria-label*="Data grid"]').first();
      try {
        await anyDataGrid.waitFor({ state: 'attached', timeout: 30000 });
        console.log('   ✅ Alternative data grid found');
        // Use the alternative grid
        const mainDataGrid = anyDataGrid;
      } catch (altError) {
        throw new Error('No data grid found with either method');
      }
    }

    // Check if it's visible (but don't require it)
    const isVisible = await mainDataGrid.isVisible().catch(() => false);
    console.log(`   📊 Data grid visibility: ${isVisible}`);

    // Check all tables in the main grid to find the right one
    const allTables = await mainDataGrid.locator('table.dx-datagrid-table').all();
    console.log(`   🔍 Main grid contains ${allTables.length} tables`);

    let ticketTable = null;
    let bestTableIndex = -1;
    let maxTicketRows = 0;

    for (let i = 0; i < allTables.length; i++) {
      const table = mainDataGrid.locator('table.dx-datagrid-table').nth(i);
      const rows = await table.locator('[role="row"]').all();

      if (rows.length > 1) {
        // Check first few rows for ticket patterns
        let ticketRowCount = 0;
        for (let r = 1; r < Math.min(rows.length, 4); r++) {
          const rowText = await rows[r].textContent();
          if (/\d{10}/.test(rowText)) {
            ticketRowCount++;
          }
        }

        console.log(`   📋 Table ${i}: ${rows.length} total rows, ${ticketRowCount} appear to be tickets`);

        if (ticketRowCount > maxTicketRows) {
          maxTicketRows = ticketRowCount;
          bestTableIndex = i;
          ticketTable = table;
        }
      }
    }

    if (!ticketTable) {
      throw new Error('No suitable ticket table found');
    }

    console.log(`   ✅ Selected table ${bestTableIndex} as ticket table`);

    const isTableVisible = await ticketTable.isVisible().catch(() => false);
    const isTableAttached = await ticketTable.isEnabled().catch(() => false);
    console.log(`   📊 Selected ticket table - visible: ${isTableVisible}, attached: ${isTableAttached}`);

    // Don't require visibility - many DevExtreme grids are initially hidden
    console.log('   ⚡ Proceeding with table access regardless of visibility state');

    // Get all ticket rows with enhanced debugging
    const ticketRows = await ticketTable.locator('[role="row"]').all();
    console.log(`   📊 Total rows in selected table: ${ticketRows.length}`);

    // Check the header row
    if (ticketRows.length > 0) {
      const headerText = await ticketRows[0].textContent();
      console.log(`   📋 Header row: "${headerText.substring(0, 100)}..."`);
    }

    // CRITICAL FIX: Enhanced header detection with comprehensive debugging
    let dataRows;
    let headerRowDetected = false;

    console.log(`   🔍 DEBUGGING: Analyzing all ${ticketRows.length} rows for header detection...`);

    // Step 1: Analyze ALL rows to understand the table structure
    for (let i = 0; i < Math.min(ticketRows.length, 5); i++) {
      const rowText = await ticketRows[i].textContent();
      const hasTicketPattern = /\d{10}/.test(rowText);
      const hasHeaderKeywords = /ticket|date|status|company|type|work/i.test(rowText);
      const rowLength = rowText.length;

      console.log(`   📋 Row ${i} analysis:`);
      console.log(`      Text: "${rowText.substring(0, 80)}..."`);
      console.log(`      Length: ${rowLength} chars`);
      console.log(`      Has 10-digit pattern: ${hasTicketPattern}`);
      console.log(`      Has header keywords: ${hasHeaderKeywords}`);
      console.log(`      Likely header: ${hasHeaderKeywords && !hasTicketPattern}`);
    }

    // Step 2: Enhanced header detection logic
    if (ticketRows.length > 0) {
      const firstRowText = await ticketRows[0].textContent();
      const hasTicketPattern = /\d{10}/.test(firstRowText);
      const hasHeaderKeywords = /ticket|date|status|company|type|work|county|city/i.test(firstRowText);
      const isVeryShort = firstRowText.trim().length < 20; // Headers are often short
      const hasOnlyColumnNames = /^[a-zA-Z\s,]+$/.test(firstRowText.trim()); // Only letters, spaces, commas

      // Multiple criteria for header detection
      const isLikelyHeader = (!hasTicketPattern && hasHeaderKeywords) ||
                           (isVeryShort && hasOnlyColumnNames) ||
                           (hasHeaderKeywords && !hasTicketPattern);

      console.log(`   🔍 ENHANCED First row analysis:`);
      console.log(`      Full text: "${firstRowText}"`);
      console.log(`      Has 10-digit ticket pattern: ${hasTicketPattern}`);
      console.log(`      Has header keywords: ${hasHeaderKeywords}`);
      console.log(`      Is very short (< 20 chars): ${isVeryShort}`);
      console.log(`      Has only column names: ${hasOnlyColumnNames}`);
      console.log(`      *** FINAL DECISION - Is likely header: ${isLikelyHeader} ***`);

      if (isLikelyHeader) {
        // First row is a header, remove it
        dataRows = ticketRows.slice(1);
        headerRowDetected = true;
        console.log(`   📋 ✅ HEADER ROW DETECTED AND REMOVED`);
        console.log(`   📋 Data processing will start from row index 1 (second row)`);
      } else {
        // First row contains ticket data, keep all rows
        dataRows = ticketRows;
        console.log(`   📋 ✅ NO HEADER ROW - FIRST ROW CONTAINS DATA`);
        console.log(`   📋 Data processing will start from row index 0 (first row)`);
      }
    } else {
      dataRows = ticketRows;
      console.log(`   📋 ⚠️ No rows found in table`);
    }

    console.log(`   📊 FINAL ANALYSIS:`);
    console.log(`      Total rows found: ${ticketRows.length}`);
    console.log(`      Header row detected: ${headerRowDetected}`);
    console.log(`      Data rows available: ${dataRows.length}`);
    console.log(`      Processing will start from: ${headerRowDetected ? 'second row (index 1)' : 'first row (index 0)'}`);

    // Step 3: Verify each data row contains ticket data and log which tickets we'll process
    let validTicketRows = 0;
    console.log(`   🎫 TICKET VERIFICATION - Checking first ${Math.min(dataRows.length, 10)} data rows:`);
    for (let i = 0; i < Math.min(dataRows.length, 10); i++) {
      const rowText = await dataRows[i].textContent();
      const hasTicketId = /\d{10}/.test(rowText);
      const ticketMatch = rowText.match(/0?(\d{10})/); // Allow optional leading zero
      const ticketId = ticketMatch ? ticketMatch[1] : 'NO_ID_FOUND';

      console.log(`   🎫 Data Row ${i}: ${hasTicketId ? '✅' : '❌'} Ticket ID: ${ticketId}`);
      console.log(`      Text: "${rowText.substring(0, 60)}..."`);
      if (hasTicketId) validTicketRows++;
    }

    console.log(`🎫 FINAL COUNT: ${dataRows.length} total rows, ${validTicketRows} confirmed tickets on page ${pageNumber}`);

    // CRITICAL: Verify we're starting from the correct position and show ALL tickets we'll process
    console.log(`   🔍 CRITICAL VERIFICATION - All tickets that will be processed:`);
    for (let verifyIndex = 0; verifyIndex < Math.min(dataRows.length, 10); verifyIndex++) {
      const verifyRow = dataRows[verifyIndex];
      const verifyText = await verifyRow.textContent();
      const ticketMatch = verifyText.match(/0?(\d{10})/); // Allow optional leading zero
      const ticketId = ticketMatch ? ticketMatch[1] : 'NO_ID_FOUND';
      console.log(`      🎫 Will process Row ${verifyIndex}: ${ticketId}`);
      console.log(`         Full text: "${verifyText.substring(0, 100)}..."`);
    }

    // Show summary of what we're about to do
    console.log(`   📊 PROCESSING SUMMARY:`);
    console.log(`      Original table rows: ${ticketRows.length}`);
    console.log(`      Header row removed: ${headerRowDetected}`);
    console.log(`      Final data rows: ${dataRows.length}`);
    console.log(`      Valid tickets found: ${validTicketRows}`);
    console.log(`      *** STARTING TICKET PROCESSING FROM INDEX 0 OF DATA ROWS ***`);

    if (dataRows.length > 0) {
      const firstDataRowText = await dataRows[0].textContent();
      const firstTicketMatch = firstDataRowText.match(/0?(\d{10})/); // Allow optional leading zero
      const firstTicketId = firstTicketMatch ? firstTicketMatch[1] : 'NO_ID';
      console.log(`      🎯 FIRST TICKET TO BE PROCESSED: ${firstTicketId}`);
    }

    // Process tickets with comprehensive error handling
    // TESTING MODE: Limit to 8 tickets for response extraction testing
    const MAX_TICKETS_TO_PROCESS = CONFIG.options.testMode ?
                                   Math.min(CONFIG.options.maxTicketsToTest, maxTickets || dataRows.length) :
                                   (maxTickets || dataRows.length);
    const ticketsToProcess = Math.min(MAX_TICKETS_TO_PROCESS, dataRows.length);

    if (CONFIG.options.testMode) {
      console.log(`   🧪 TESTING MODE: Limited to ${CONFIG.options.maxTicketsToTest} tickets for response extraction testing`);
    }
    console.log(`   📋 Processing ${ticketsToProcess} tickets from ${dataRows.length} available data rows (starting from index 0)`);

    for (let i = 0; i < ticketsToProcess; i++) {
      const ticketStartTime = Date.now();
      console.log(`\n   🎫 Processing ticket ${i + 1}/${ticketsToProcess} (data row index ${i})`);

      try {
        const currentRow = dataRows[i];

        // Get expected ticket info with enhanced debugging
        const rowText = await currentRow.textContent();
        const ticketMatch = rowText.match(/0?(\d{10})/); // Allow optional leading zero
        const expectedTicketId = ticketMatch ? ticketMatch[1] : 'unknown';

        console.log(`      🎯 TICKET PROCESSING DETAILS:`);
        console.log(`         Processing position: ${i + 1} of ${ticketsToProcess}`);
        console.log(`         Data row index: ${i}`);
        console.log(`         Expected ticket ID: ${expectedTicketId}`);
        console.log(`         Row text preview: "${rowText.substring(0, 80)}..."`);

        if (i === 0) {
          console.log(`      🚨 THIS IS THE FIRST TICKET BEING PROCESSED - SHOULD NOT BE MISSING!`);
        }

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

        // Open popup with enhanced timeout and stability handling
        console.log(`      📋 Opening print popup with stability checks...`);
        let popupPage = null;

        try {
          // STABILITY CHECK: Verify browser health before popup operation
          await checkBrowserHealth(page, page.context());

          const popupPromise = page.waitForEvent('popup', { timeout: CONFIG.options.popupTimeout });

          // Check if browser is still responsive before clicking
          const isPageResponsive = await page.evaluate(() => {
            return document.readyState === 'complete' || document.readyState === 'interactive';
          }).catch(() => false);

          if (!isPageResponsive) {
            throw new Error('Page became unresponsive before popup operation');
          }

          await page.getByText('Print with Positive Response').click();
          popupPage = await popupPromise;

          // Verify popup is accessible
          if (popupPage.isClosed()) {
            throw new Error('Popup was closed immediately after opening');
          }

          console.log(`      ✅ Popup opened successfully with stability verification`);
        } catch (popupError) {
          console.error(`      ❌ Failed to open popup: ${popupError.message}`);

          // Enhanced error recovery
          if (popupError.message.includes('Target page, context or browser has been closed')) {
            console.error(`      🚨 CRITICAL: Browser was closed during popup operation!`);
            console.error(`      🔄 This indicates a browser stability issue that needs investigation`);
            throw new Error('Browser closed during popup operation - stopping extraction');
          }

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

        // Clean up popup with stability verification
        try {
          if (popupPage && !popupPage.isClosed()) {
            await popupPage.close();
            console.log(`      ✅ Popup closed successfully`);
          } else if (popupPage) {
            console.log(`      ℹ️ Popup was already closed`);
          }
        } catch (closeError) {
          console.warn(`      ⚠️ Popup close warning: ${closeError.message}`);

          // Check for critical browser issues
          if (closeError.message.includes('browser has been closed')) {
            throw new Error('Browser closed during popup cleanup');
          }
        }

        // Extended rate limiting with stability check
        await page.waitForTimeout(CONFIG.options.rateLimitMs);

        // Periodic browser health check during long operations
        if ((i + 1) % 3 === 0) { // Every 3 tickets
          try {
            await checkBrowserHealth(page, page.context());
            console.log(`      ⚡ Periodic browser health check passed (after ticket ${i + 1})`);

            // Garbage collection suggestion for memory optimization
            if ((i + 1) % 6 === 0) { // Every 6 tickets
              try {
                await page.evaluate(() => {
                  if (window.gc) {
                    window.gc();
                    console.log('Manual garbage collection triggered');
                  }
                });
                console.log(`      🧹 Memory cleanup suggested after ticket ${i + 1}`);
              } catch (gcError) {
                // Garbage collection is optional, don't fail if not available
                console.log(`      ℹ️ Garbage collection not available (this is normal)`);
              }
            }
          } catch (healthError) {
            console.error(`      🚨 Browser health deteriorated after ticket ${i + 1}: ${healthError.message}`);
            throw new Error(`Browser became unhealthy during processing: ${healthError.message}`);
          }
        }

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
    timeout: 60000, // Extended browser launch timeout
    args: [
      // NUCLEAR OPTION: Complete print system disable
      '--disable-print-preview',
      '--disable-print-preview-sticky-settings',
      '--kiosk-printing',
      '--print-to-pdf-no-header',
      '--disable-printing',
      '--disable-print-preview',

      // System-level dialog suppression
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-plugins',
      '--disable-popup-blocking',
      '--disable-translate',
      '--disable-features=VizDisplayCompositor',

      // ENHANCED STABILITY: Memory and resource management
      '--max-old-space-size=4096', // Increase memory limit
      '--memory-pressure-off', // Disable memory pressure
      '--max-web-media-player-count=1', // Limit media players
      '--aggressive-cache-discard', // Better memory management
      '--disable-background-media-processing',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=ScriptStreaming',

      // ENHANCED STABILITY: Process isolation and crash prevention
      '--disable-dev-shm-usage',
      '--disable-features=VizDisplayCompositor,VizHitTestDrawQuad',
      '--disable-ipc-flooding-protection',
      '--disable-features=TranslateUI',
      '--disable-component-extensions-with-background-pages',
      '--disable-default-apps',
      '--disable-hang-monitor',
      '--disable-prompt-on-repost',
      '--disable-sync',
      '--disable-web-resources',

      // ENHANCED STABILITY: Long-running operation support
      '--disable-features=MediaRouter',
      '--disable-domain-reliability',
      '--disable-background-networking',
      '--disable-breakpad',
      '--disable-client-side-phishing-detection',
      '--disable-cloud-import',
      '--disable-default-apps',
      '--disable-desktop-notifications',
      '--disable-device-discovery-notifications'
    ]
  });

  const context = await browser.newContext({
    // ENHANCED STABILITY: Context-level timeout and resource management
    viewport: { width: 1280, height: 720 }, // Fixed viewport for stability
    // Disable unnecessary features for stability
    acceptDownloads: false,
    ignoreHTTPSErrors: true
  });

  // ENHANCED STABILITY: Set extended timeouts
  context.setDefaultTimeout(CONFIG.options.pageLoadTimeout);
  context.setDefaultNavigationTimeout(CONFIG.options.pageLoadTimeout);

  // NUCLEAR PREVENTION: Completely override print before ANY page loads
  await context.addInitScript(() => {
    // Immediately lock down print functions before page content executes
    console.log('🚫 NUCLEAR PRINT SUPPRESSION ACTIVE');

    // Method 1: Completely seal the print function
    if (window.print) {
      Object.defineProperty(window, 'print', {
        value: () => {
          console.log('🚫 PRINT BLOCKED');
          return false;
        },
        writable: false,
        configurable: false,
        enumerable: false
      });
    }

    // Method 2: Block ALL potential print triggers
    const printEvents = ['beforeprint', 'afterprint', 'print'];
    printEvents.forEach(eventType => {
      window.addEventListener(eventType, (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        e.stopPropagation();
        console.log(`🚫 BLOCKED ${eventType}`);
        return false;
      }, { capture: true, passive: false });

      // Also override the event handler properties
      Object.defineProperty(window, `on${eventType}`, {
        value: null,
        writable: false,
        configurable: false
      });
    });

    // Method 3: Override media query for print
    if (window.matchMedia) {
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = (query) => {
        if (query.includes('print')) {
          console.log('🚫 BLOCKED print media query');
          return { matches: false, addListener: () => {}, removeListener: () => {} };
        }
        return originalMatchMedia(query);
      };
    }

    // Method 4: Block CSS print styles
    const style = document.createElement('style');
    style.innerHTML = '@media print { * { display: none !important; } }';
    style.setAttribute('data-print-blocker', 'true');

    // Ensure it gets added even if head doesn't exist yet
    const addStyle = () => {
      const target = document.head || document.documentElement || document.body;
      if (target && !document.querySelector('[data-print-blocker]')) {
        target.appendChild(style);
        console.log('🚫 Print CSS blocker applied');
      }
    };

    // Add immediately and also when DOM is ready
    addStyle();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', addStyle);
    }

    console.log('✅ NUCLEAR PRINT SUPPRESSION INSTALLED');
  });

  // Apply additional print dialog suppression
  await setupPrintDialogSuppression(context);

  const page = await context.newPage();

  const scrapingSession = {
    metadata: {
      scraping_started: new Date().toISOString(),
      company_filter: CONFIG.company,
      total_pages_processed: 0,
      total_tickets_extracted: 0,
      extraction_errors: 0,
      scraper_version: '1.0.7-multi-page-support',
      fixes_applied: [
        'nuclear_print_prevention_context_level',
        'complete_print_system_disable_browser_args',
        'sealed_print_function_overrides',
        'multi_page_pagination_support',
        'comprehensive_response_extraction_debugging'
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

    // Process tickets with multi-page support using individual page number clicking
    let totalTicketsProcessed = 0;

    console.log('🔬 MULTI-PAGE VALIDATION: Processing all available pages...');

    // Get total number of pages from the pagination info
    const totalPages = await checkForNextPage(page);
    console.log(`📄 Found ${totalPages} total pages to process`);

    // TESTING MODE: Limit total processing for focused response testing
    let totalTicketsCollected = 0;
    const maxTicketsForTesting = CONFIG.options.testMode ? CONFIG.options.maxTicketsToTest : Infinity;

    console.log(`🧪 RESPONSE EXTRACTION TESTING MODE:`);
    console.log(`   Target: ${maxTicketsForTesting} tickets maximum`);
    console.log(`   Focus: Multi-column, multi-line response structure analysis`);
    console.log(`   Pages to process: Until ${maxTicketsForTesting} tickets collected or all pages done`);

    // Process each page sequentially (1, 2, 3, 4, 5, 6, 7, 8) with stability monitoring
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      // Check if we've collected enough tickets for testing
      if (CONFIG.options.testMode && totalTicketsCollected >= maxTicketsForTesting) {
        console.log(`\n🧪 TESTING COMPLETE: Collected ${totalTicketsCollected} tickets - stopping extraction`);
        break;
      }

      console.log(`\n📄 Processing page ${pageNum} of ${totalPages} with enhanced stability...`);
      console.log(`   🎯 Tickets collected so far: ${totalTicketsCollected}/${maxTicketsForTesting}`);

      // STABILITY CHECK: Monitor browser health before each page
      try {
        await verifyContextStability(page, context);
      } catch (stabilityError) {
        console.error(`❌ Browser instability detected before page ${pageNum}: ${stabilityError.message}`);
        console.error(`🚨 STOPPING extraction to prevent browser crash`);
        throw new Error(`Browser became unstable at page ${pageNum}: ${stabilityError.message}`);
      }

      // Navigate to the specific page (except page 1 which we're already on)
      if (pageNum > 1) {
        console.log(`🔄 Navigating to page ${pageNum} with enhanced stability monitoring...`);
        try {
          await navigateToPage(page, pageNum);

          // Extended wait with stability verification
          await page.waitForTimeout(CONFIG.options.pageLoadTimeout / 4); // Initial wait

          // Verify browser stability after navigation
          await verifyContextStability(page, context);

          // Additional stabilization wait
          await page.waitForTimeout(CONFIG.options.pageLoadTimeout / 4);

          console.log(`✅ Successfully navigated to page ${pageNum} with stability verification`);
        } catch (navError) {
          console.error(`❌ Failed to navigate to page ${pageNum}: ${navError.message}`);

          // Check if this is a critical browser stability issue
          if (navError.message.includes('browser has been closed') ||
              navError.message.includes('Target page, context or browser has been closed')) {
            console.error(`🚨 CRITICAL: Browser closed during navigation! Stopping extraction.`);
            throw navError; // Stop the entire process for browser closure
          }

          console.log(`⚠️ Skipping page ${pageNum} due to navigation failure`);
          continue;
        }
      } else {
        console.log(`📄 Starting with page 1 (already loaded)`);

        // Even for page 1, verify stability
        try {
          await verifyContextStability(page, context);
        } catch (page1Error) {
          console.error(`❌ Page 1 stability check failed: ${page1Error.message}`);
          throw page1Error;
        }
      }

      // Process all tickets on this page with stability monitoring
      const ticketsBeforePage = scrapingSession.tickets.length;
      try {
        // Final stability check before ticket processing
        await verifyContextStability(page, context);

        console.log(`📊 Starting ticket extraction on page ${pageNum} with browser health verified`);

        // Calculate remaining tickets needed for testing
        const remainingTicketsNeeded = CONFIG.options.testMode ?
                                      Math.max(0, maxTicketsForTesting - totalTicketsCollected) :
                                      Infinity;

        await processAllTicketsOnPage(page, pageNum, scrapingSession.tickets, remainingTicketsNeeded);

        // Post-processing stability check
        await verifyContextStability(page, context);

      } catch (processError) {
        console.error(`❌ Failed to process page ${pageNum}: ${processError.message}`);

        // Check if this is a critical stability issue
        if (processError.message.includes('browser has been closed') ||
            processError.message.includes('Target page, context or browser has been closed') ||
            processError.message.includes('Browser became unstable')) {
          console.error(`🚨 CRITICAL: Browser stability failure during page ${pageNum} processing!`);
          console.error(`🔄 This indicates the browser closed prematurely during extraction`);
          throw processError; // Stop entire process for critical stability issues
        }

        console.log(`⚠️ Continuing to next page...`);
        continue;
      }

      const ticketsAfterPage = scrapingSession.tickets.length;
      const ticketsOnThisPage = ticketsAfterPage - ticketsBeforePage;
      totalTicketsProcessed += ticketsOnThisPage;
      totalTicketsCollected = ticketsAfterPage; // Update total collected

      console.log(`✅ Page ${pageNum} complete: ${ticketsOnThisPage} tickets processed`);
      console.log(`📊 Running total: ${totalTicketsProcessed} tickets from ${pageNum} pages`);

      // Check if we've reached the testing limit
      if (CONFIG.options.testMode && totalTicketsCollected >= maxTicketsForTesting) {
        console.log(`🧪 TESTING LIMIT REACHED: Collected ${totalTicketsCollected} tickets - will stop after this page`);
      }
    }

    const currentPageNum = totalPages; // For compatibility with existing metadata

    scrapingSession.metadata.total_pages_processed = totalPages;
    scrapingSession.metadata.total_tickets_extracted = totalTicketsProcessed;

    // Save progress
    if (CONFIG.options.saveProgress) {
      saveProgressData(scrapingSession);
    }

    console.log(`\n📊 Processing Results:`);
    console.log(`   Total Tickets Processed: ${totalTicketsProcessed}`);
    console.log(`   Pages Processed: ${totalPages}`);
    console.log(`   Average Tickets Per Page: ${Math.round(totalTicketsProcessed / Math.max(1, totalPages) * 10) / 10}`);

    if (CONFIG.options.testMode) {
      console.log(`\n🧪 RESPONSE EXTRACTION TESTING RESULTS:`);
      console.log(`   Target tickets for testing: ${CONFIG.options.maxTicketsToTest}`);
      console.log(`   Actual tickets collected: ${totalTicketsProcessed}`);
      console.log(`   Testing completion: ${Math.round((totalTicketsProcessed / CONFIG.options.maxTicketsToTest) * 100)}%`);

      // Analyze response extraction across all tickets
      const responseAnalysis = {
        total_tickets: scrapingSession.tickets.length,
        tickets_with_responses: 0,
        total_responses: 0,
        extraction_methods: {},
        column_structures: {},
        multi_line_responses: 0,
        response_statuses: {},
        tickets_with_3_columns: 0,
        tickets_with_multi_line: 0
      };

      scrapingSession.tickets.forEach(ticket => {
        if (ticket.responses && ticket.responses.length > 0) {
          responseAnalysis.tickets_with_responses++;
          responseAnalysis.total_responses += ticket.responses.length;

          ticket.responses.forEach(response => {
            // Count extraction methods
            const method = response.extraction_method || 'unknown';
            responseAnalysis.extraction_methods[method] = (responseAnalysis.extraction_methods[method] || 0) + 1;

            // Count column structures
            const cols = response.total_columns || 'unknown';
            responseAnalysis.column_structures[cols] = (responseAnalysis.column_structures[cols] || 0) + 1;

            // Count response statuses
            const status = response.response_status || 'unknown';
            responseAnalysis.response_statuses[status] = (responseAnalysis.response_statuses[status] || 0) + 1;

            // Check for 3-column structure
            if (response.total_columns === 3) {
              responseAnalysis.tickets_with_3_columns++;
            }

            // Check for multi-line fields
            if (response.has_multi_line_fields) {
              responseAnalysis.multi_line_responses++;
            }
          });
        }
      });

      console.log(`\n🏢 DETAILED RESPONSE ANALYSIS:`);
      console.log(`   Tickets with responses: ${responseAnalysis.tickets_with_responses}/${responseAnalysis.total_tickets} (${Math.round((responseAnalysis.tickets_with_responses / Math.max(1, responseAnalysis.total_tickets)) * 100)}%)`);
      console.log(`   Total utility responses found: ${responseAnalysis.total_responses}`);
      console.log(`   Average responses per ticket: ${Math.round((responseAnalysis.total_responses / Math.max(1, responseAnalysis.total_tickets)) * 10) / 10}`);

      console.log(`\n📊 EXTRACTION METHOD ANALYSIS:`);
      Object.entries(responseAnalysis.extraction_methods).forEach(([method, count]) => {
        console.log(`   ${method}: ${count} responses (${Math.round((count / Math.max(1, responseAnalysis.total_responses)) * 100)}%)`);
      });

      console.log(`\n🏗️ COLUMN STRUCTURE ANALYSIS:`);
      Object.entries(responseAnalysis.column_structures).forEach(([cols, count]) => {
        console.log(`   ${cols} columns: ${count} responses (${Math.round((count / Math.max(1, responseAnalysis.total_responses)) * 100)}%)`);
      });

      console.log(`\n📋 MULTI-LINE FIELD ANALYSIS:`);
      console.log(`   Responses with multi-line fields: ${responseAnalysis.multi_line_responses}/${responseAnalysis.total_responses} (${Math.round((responseAnalysis.multi_line_responses / Math.max(1, responseAnalysis.total_responses)) * 100)}%)`);

      console.log(`\n📈 RESPONSE STATUS DISTRIBUTION:`);
      Object.entries(responseAnalysis.response_statuses).forEach(([status, count]) => {
        console.log(`   ${status}: ${count} responses (${Math.round((count / Math.max(1, responseAnalysis.total_responses)) * 100)}%)`);
      });

      // Store analysis in session metadata
      scrapingSession.metadata.response_testing_analysis = responseAnalysis;

    } else {
      console.log(`   Expected Total (8 per page): ${totalPages * 8} tickets`);
      console.log(`   Actual vs Expected: ${totalTicketsProcessed}/${totalPages * 8} (${Math.round((totalTicketsProcessed / Math.max(1, totalPages * 8)) * 100)}% success rate)`);
    }

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
    console.log(`   Expected Tickets (8/page): ${scrapingSession.metadata.total_pages_processed * 8}`);
    console.log(`   Success Rate: ${Math.round((scrapingSession.metadata.total_tickets_extracted / Math.max(1, scrapingSession.metadata.total_pages_processed * 8)) * 100)}%`);
    console.log(`   Duration: ${scrapingSession.metadata.total_duration_seconds} seconds`);
    console.log(`📄 Data saved to: ${CONFIG.options.outputFile}`);

    return scrapingSession;

  } catch (error) {
    console.error('❌ Scraping failed:', error);
    scrapingSession.metadata.scraping_failed = new Date().toISOString();
    scrapingSession.metadata.error_message = error.message;

    // Enhanced error reporting for browser stability issues
    if (error.message.includes('browser has been closed') ||
        error.message.includes('Target page, context or browser has been closed')) {
      scrapingSession.metadata.failure_type = 'browser_stability_failure';
      scrapingSession.metadata.stability_recommendation = 'Browser closed prematurely - consider increasing timeouts or memory limits';
    } else if (error.message.includes('Browser became unstable')) {
      scrapingSession.metadata.failure_type = 'browser_health_failure';
      scrapingSession.metadata.stability_recommendation = 'Browser health checks failed - consider system resource optimization';
    } else {
      scrapingSession.metadata.failure_type = 'other_failure';
    }

    saveProgressData(scrapingSession);
    throw error;

  } finally {
    console.log('🔧 Performing browser cleanup...');
    try {
      // Enhanced cleanup sequence
      if (page && !page.isClosed()) {
        console.log('   🧹 Closing page...');
        await page.close();
      }
      if (context && !context.isGone) {
        console.log('   🧹 Closing context...');
        await context.close();
      }
      if (browser) {
        console.log('   🧹 Closing browser...');
        await browser.close();
      }
      console.log('   ✅ Browser cleanup completed');
    } catch (cleanupError) {
      console.warn(`   ⚠️ Browser cleanup warning: ${cleanupError.message}`);
    }
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
