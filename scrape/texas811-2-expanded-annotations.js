/**
 * TEXAS 811 TICKET SCRAPER - LLM CONVERSION TEMPLATE
 *
 * BUSINESS OBJECTIVE: Extract detailed ticket information for BRIGHT STAR SOLUTIONS
 * from Texas 811 system for compliance and reporting purposes
 *
 * SCRAPING WORKFLOW:
 * 1. Authenticate with credentials
 * 2. Navigate to ticket search
 * 3. Filter for company tickets ("BRIGHT STAR SOLUTIONS")
 * 4. Iterate through all pages of results
 * 5. For each ticket on each page:
 *    - Open ticket print view (popup)
 *    - Extract comprehensive ticket data from #tickets table
 *    - Close popup and continue
 * 6. Clean logout
 *
 * DATA TO EXTRACT from each ticket (#tickets table):
 * - Ticket Number
 * - Status (Update/Normal/Emergency)
 * - Date/Time information
 * - Location details (address, coordinates)
 * - Contact information
 * - Work description
 * - Utility companies involved
 * - Response requirements
 * - Any additional metadata in the table
 *
 * EXPECTED OUTPUT STRUCTURE:
 * {
 *   "scraping_session": {
 *     "timestamp": "2024-01-01T00:00:00Z",
 *     "company_filter": "BRIGHT STAR SOLUTIONS",
 *     "total_pages": 3,
 *     "total_tickets": 42
 *   },
 *   "tickets": [
 *     {
 *       "ticket_number": "2574581677",
 *       "status": "Update",
 *       "date": "09/02/2025",
 *       "location": "...",
 *       "contact_info": "...",
 *       "work_description": "...",
 *       "utilities": [...],
 *       "page_number": 1,
 *       "extraction_timestamp": "2024-01-01T00:00:00Z"
 *     }
 *   ]
 * }
 *
 * CONVERSION INSTRUCTIONS FOR LLM:
 * 1. Replace manual pagination with automated loop detection
 * 2. Replace individual ticket clicks with systematic iteration
 * 3. Extract complete data from #tickets table instead of just clicking
 * 4. Add comprehensive error handling for authentication, network, popups
 * 5. Implement data persistence (JSON file output)
 * 6. Add progress logging and resumability
 * 7. Make credentials configurable (environment variables)
 * 8. Add rate limiting to respect server resources
 */

const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false // LLM_CONVERT: Change to true for production
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  // =============================================================================
  // AUTHENTICATION SECTION
  // LLM_CONVERT: Wrap in try-catch, make credentials configurable via env vars
  // LLM_CONVERT: Add login success verification before proceeding
  // =============================================================================

  // LLM_ACTION: Keep navigation, add timeout and error handling
  await page.goto('https://txgc.texas811.org/ui/login');

  // LLM_CONVERT: These credential operations need to be:
  // 1. Made configurable (process.env.TEXAS811_USERNAME)
  // 2. Secured (don't hardcode credentials)
  // 3. Validated (check if login actually succeeded)
  await page.locator('input[name="username"]').click();
  await page.locator('input[name="username"]').fill('james.simmons@highpointe.tech'); // SECURITY: Move to env var
  await page.locator('input[name="password"]').click();
  await page.locator('input[name="password"]').fill('jgr6dvc8XBK!kaf8qjv'); // SECURITY: Move to env var
  await page.getByRole('checkbox', { name: 'I agree to terms & conditions' }).click();
  await page.getByRole('button', { name: 'Login' }).click();

  // LLM_CONVERT: Add login verification here
  // Example: await page.waitForSelector('[data-testid="dashboard"]', { timeout: 10000 });
  await page.goto('https://txgc.texas811.org/ui/dashboard');

  // =============================================================================
  // TICKET SEARCH & FILTERING SECTION
  // LLM_CONVERT: Make company name parameterizable, add search result verification
  // =============================================================================

  // LLM_ACTION: Keep these navigation steps, add error handling
  await page.getByText('Ticket Search').click();
  await page.getByRole('checkbox', { name: ' My Tickets' }).click();

  // LLM_CONVERT: This selector is fragile - find a more robust one
  // LLM_CONVERT: Make company name configurable (process.env.COMPANY_NAME)
  await page.locator('.ng-untouched.ng-pristine.ng-valid.dx-show-invalid-badge.dx-textbox.dx-texteditor.dx-editor-outlined.dx-texteditor-empty.dx-widget.dx-state-hover > .dx-texteditor-container > .dx-texteditor-input-container > .dx-texteditor-input').click();
  await page.locator('.ng-untouched.ng-pristine.ng-valid.dx-show-invalid-badge.dx-textbox.dx-texteditor.dx-editor-outlined.dx-texteditor-empty.dx-widget.dx-state-hover > .dx-texteditor-container > .dx-texteditor-input-container > .dx-texteditor-input').fill('BRIGHT STAR SOLUTIONS'); // PARAMETERIZE: Make this configurable
  await page.getByRole('button', { name: 'Search', exact: true }).click();

  // LLM_CONVERT: Add wait for search results and verify results found
  // Example: await page.waitForSelector('[data-grid-results]', { timeout: 15000 });

  // =============================================================================
  // PAGINATION & TICKET PROCESSING SECTION
  // LLM_CONVERT: This manual approach needs to become automated loops:
  // 1. Detect total number of pages dynamically
  // 2. Loop through each page
  // 3. For each page, detect all tickets and loop through them
  // 4. Extract data systematically instead of manual clicks
  // =============================================================================

  /*
   * CURRENT APPROACH (MANUAL): User recorded clicking through 3 specific pages
   * and manually processing a few tickets on each page
   *
   * LLM_REPLACEMENT_NEEDED:
   * 1. Auto-detect total pages: const totalPages = await page.$$eval('.pagination button', btns => btns.length);
   * 2. Loop: for (let pageNum = 1; pageNum <= totalPages; pageNum++)
   * 3. Get all tickets on page: const ticketRows = await page.$$('[data-ticket-row]');
   * 4. Loop through tickets: for (const ticketRow of ticketRows)
   * 5. Extract data instead of just clicking
   */

  // PAGE 1 PROCESSING - MANUAL EXAMPLE (CONVERT TO AUTOMATED)
  // LLM_CONVERT: This click on the grid is exploratory - replace with data extraction
  // INTENT: User is identifying the ticket grid container
  await page.getByLabel('Data grid with 21 rows and 19').locator('div').filter({ hasText: '02574581677Update09/02/2025' }).first().click();

  // TICKET PROCESSING PATTERN - MANUAL EXAMPLES (CONVERT TO LOOPS)
  // LLM_CONVERT: These individual ticket operations need to become:
  // 1. Get all ticket rows on current page
  // 2. For each ticket row, extract basic info (ticket number, status, date)
  // 3. Click to select ticket, open print view, extract detailed data
  // 4. Store extracted data in structured format

  // EXAMPLE TICKET 1 - MANUAL PROCESSING
  // LLM_CONVERT: This pattern repeats - needs to be in a loop
  await page.getByRole('row', { name: '0 2574581677 Update 09/02/' }).getByRole('gridcell').first().click();
  // LLM_ACTION: Keep the print menu navigation pattern
  await page.getByRole('menuitem', { name: 'Print ' }).locator('div').nth(1).click();
  const page1Promise = page.waitForEvent('popup');
  await page.getByText('Print with Positive Response').click();
  const page1 = await page1Promise;

  // *** CRITICAL DATA EXTRACTION POINT ***
  // LLM_CONVERT: This click needs to become comprehensive data extraction
  // CURRENT: await page1.locator('#tickets').click();
  // LLM_REPLACEMENT: Extract all data from #tickets table
  /*
   * EXAMPLE REPLACEMENT CODE:
   * const ticketData = await page1.evaluate(() => {
   *   const ticketsTable = document.querySelector('#tickets');
   *   if (!ticketsTable) return null;
   *
   *   // Extract all relevant data from the table
   *   return {
   *     ticket_number: ticketsTable.querySelector('[data-field="ticket-number"]')?.textContent?.trim(),
   *     status: ticketsTable.querySelector('[data-field="status"]')?.textContent?.trim(),
   *     date: ticketsTable.querySelector('[data-field="date"]')?.textContent?.trim(),
   *     location: ticketsTable.querySelector('[data-field="location"]')?.textContent?.trim(),
   *     contact_info: ticketsTable.querySelector('[data-field="contact"]')?.textContent?.trim(),
   *     work_description: ticketsTable.querySelector('[data-field="work-desc"]')?.textContent?.trim(),
   *     utilities: Array.from(ticketsTable.querySelectorAll('[data-field="utility"]')).map(u => u.textContent?.trim()),
   *     // Add all other relevant fields from the table
   *   };
   * });
   *
   * // Store the extracted data
   * allTickets.push({
   *   ...ticketData,
   *   page_number: currentPage,
   *   extraction_timestamp: new Date().toISOString()
   * });
   */
  await page1.locator('#tickets').click(); // REPLACE WITH DATA EXTRACTION
  await page1.close();

  // EXAMPLE TICKET 2 - MANUAL PROCESSING (SAME PATTERN TO CONVERT)
  await page.getByRole('row', { name: '0 2574581593 Update 09/02/' }).getByRole('gridcell').first().click();
  await page.locator('.dx-item.dx-menu-item.dx-menu-item-has-text.dx-menu-item-has-submenu.dx-state-hover > div > .dx-menu-item-popout-container > .dx-menu-item-popout').click();
  const page2Promise = page.waitForEvent('popup');
  await page.getByText('Print with Positive Response').click();
  const page2 = await page2Promise;
  await page2.locator('#tickets').click(); // REPLACE WITH DATA EXTRACTION
  await page2.close();

  // PAGINATION - MANUAL NAVIGATION (CONVERT TO AUTOMATED)
  // LLM_CONVERT: This manual page navigation needs to become automated
  // CURRENT: Hardcoded page numbers
  // LLM_REPLACEMENT: Dynamic page detection and looping
  await page.getByRole('navigation', { name: 'Page Navigation' }).click();
  await page.getByRole('button', { name: 'Page 2' }).click();

  // PAGE 2 PROCESSING - MANUAL EXAMPLE (SAME PATTERN AS PAGE 1)
  await page.getByLabel('Data grid with 21 rows and 19').locator('div').filter({ hasText: '02574563173Normal09/02/2025' }).first().click();
  await page.getByRole('row', { name: '0 2574563173 Normal 09/02/' }).getByRole('gridcell').first().click();
  await page.locator('.dx-item.dx-menu-item.dx-menu-item-has-text.dx-menu-item-has-submenu.dx-state-hover > div > .dx-menu-item-popout-container > .dx-menu-item-popout').click();
  const page2Promise = page.waitForEvent('popup'); // LLM_NOTE: Duplicate variable name - needs cleanup
  const page3Promise = page.waitForEvent('popup');
  await page.getByText('Print with Positive Response').click();
  const page3 = await page3Promise;
  await page3.locator('#tickets').click(); // REPLACE WITH DATA EXTRACTION
  await page3.close();
  await page.getByRole('button', { name: 'Page 3' }).click();

  // PAGE 3 PROCESSING - MANUAL EXAMPLE (SAME PATTERN)
  await page.getByLabel('Data grid with 21 rows and 19').locator('div').filter({ hasText: '02574144994Emergency08/29/' }).first().click();
  await page.getByRole('gridcell', { name: '0', exact: true }).nth(1).click();
  await page.locator('.dx-item.dx-menu-item.dx-menu-item-has-text.dx-menu-item-has-submenu.dx-state-hover > div > .dx-menu-item-popout-container > .dx-menu-item-popout').click();
  const page4Promise = page.waitForEvent('popup');
  await page.getByText('Print with Positive Response').click();
  const page4 = await page4Promise;
  await page4.locator('#tickets').click(); // REPLACE WITH DATA EXTRACTION
  await page4.close();

  // =============================================================================
  // SESSION CLEANUP SECTION
  // LLM_ACTION: Keep logout process, add error handling
  // =============================================================================
  await page.getByRole('button', { name: 'mat-icons mi-arrow_drop_down' }).click();
  await page.getByText('Sign Out').click();
  await page.getByRole('button', { name: 'Yes' }).click();
  await page.close();

  // ---------------------
  await context.close();
  await browser.close();
})();

/**
 * LLM CONVERSION CHECKLIST - COMPREHENSIVE:
 *
 * AUTHENTICATION & SECURITY:
 * [ ] Move credentials to environment variables (process.env.TEXAS811_USERNAME)
 * [ ] Add login success verification
 * [ ] Implement session timeout handling
 * [ ] Add retry logic for authentication failures
 *
 * SEARCH & FILTERING:
 * [ ] Make company name parameterizable
 * [ ] Add search result validation
 * [ ] Handle "no results found" scenarios
 * [ ] Improve selector robustness for search fields
 *
 * PAGINATION AUTOMATION:
 * [ ] Replace manual page clicks with dynamic page detection
 * [ ] Implement: const totalPages = await page.$$eval('.pagination button', btns => btns.length);
 * [ ] Add pagination loop: for (let pageNum = 1; pageNum <= totalPages; pageNum++)
 * [ ] Handle edge cases (single page, empty results)
 *
 * TICKET DATA EXTRACTION:
 * [ ] Replace all .locator('#tickets').click() with comprehensive data extraction
 * [ ] Extract complete ticket information from #tickets table
 * [ ] Structure data according to expected output format
 * [ ] Handle popup windows systematically (waitForEvent, extraction, close)
 * [ ] Add ticket-level error handling (missing data, popup failures)
 *
 * DATA MANAGEMENT:
 * [ ] Implement structured data storage (JSON array)
 * [ ] Add data validation and cleanup
 * [ ] Include metadata (page number, extraction timestamp)
 * [ ] Implement data persistence (save to file)
 * [ ] Add deduplication logic for ticket numbers
 *
 * ERROR HANDLING & ROBUSTNESS:
 * [ ] Wrap all operations in try-catch blocks
 * [ ] Add network timeout handling
 * [ ] Implement retry logic for transient failures
 * [ ] Handle popup blocking scenarios
 * [ ] Add graceful degradation for missing elements
 *
 * PRODUCTION READINESS:
 * [ ] Change headless: false to headless: true
 * [ ] Add rate limiting between requests
 * [ ] Implement progress logging and status updates
 * [ ] Add resumability (skip already processed tickets)
 * [ ] Configure for scheduled execution
 *
 * EXAMPLE AUTOMATED STRUCTURE:
 *
 * const scrapedData = {
 *   session: { timestamp: new Date().toISOString(), company: 'BRIGHT STAR SOLUTIONS' },
 *   tickets: []
 * };
 *
 * // Auto-detect pagination
 * const totalPages = await detectTotalPages(page);
 *
 * // Loop through all pages
 * for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
 *   await navigateToPage(page, pageNum);
 *   const ticketRows = await page.$$('[data-ticket-row]'); // Find robust selector
 *
 *   // Process all tickets on current page
 *   for (let i = 0; i < ticketRows.length; i++) {
 *     try {
 *       const ticketData = await processTicket(page, i);
 *       scrapedData.tickets.push(ticketData);
 *       console.log(`Processed ticket ${ticketData.ticket_number} on page ${pageNum}`);
 *     } catch (error) {
 *       console.error(`Failed to process ticket ${i} on page ${pageNum}:`, error);
 *     }
 *   }
 * }
 *
 * // Save data
 * fs.writeFileSync('texas811-tickets.json', JSON.stringify(scrapedData, null, 2));
 */
