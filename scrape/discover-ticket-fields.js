#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs');

/**
 * FIELD DISCOVERY SCRIPT for Texas 811 #tickets table
 *
 * This script will:
 * 1. Login to the system
 * 2. Search for tickets
 * 3. Open ONE ticket's print view
 * 4. Analyze the #tickets table structure
 * 5. Report all available fields and their sample data
 * 6. Generate extraction code templates
 */

(async () => {
  const browser = await chromium.launch({
    headless: false // Keep visible to see what's happening
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('🔍 Starting field discovery...');

    // Login process
    console.log('📝 Logging in...');
    await page.goto('https://txgc.texas811.org/ui/login');
    await page.locator('input[name="username"]').fill('james.simmons@highpointe.tech');
    await page.locator('input[name="password"]').fill('jgr6dvc8XBK!kaf8qjv');
    await page.getByRole('checkbox', { name: 'I agree to terms & conditions' }).click();
    await page.getByRole('button', { name: 'Login' }).click();
    await page.goto('https://txgc.texas811.org/ui/dashboard');

    // Navigate to ticket search
    console.log('🎯 Searching for tickets...');
    await page.getByText('Ticket Search').click();
    await page.getByRole('checkbox', { name: ' My Tickets' }).click();
    await page.locator('.ng-untouched.ng-pristine.ng-valid.dx-show-invalid-badge.dx-textbox.dx-texteditor.dx-editor-outlined.dx-texteditor-empty.dx-widget.dx-state-hover > .dx-texteditor-container > .dx-texteditor-input-container > .dx-texteditor-input').click();
    await page.locator('.ng-untouched.ng-pristine.ng-valid.dx-show-invalid-badge.dx-textbox.dx-texteditor.dx-editor-outlined.dx-texteditor-empty.dx-widget.dx-state-hover > .dx-texteditor-container > .dx-texteditor-input-container > .dx-texteditor-input').fill('BRIGHT STAR SOLUTIONS');
    await page.getByRole('button', { name: 'Search', exact: true }).click();

    // Wait for results and select the first ticket
    console.log('🎫 Opening first ticket for analysis...');
    await page.waitForTimeout(3000); // Wait for search results

    // Click on the first row to select it
    const firstTicketRow = await page.locator('[role="row"]').nth(1); // Skip header row
    await firstTicketRow.click();

    // Open print menu
    await page.getByRole('menuitem', { name: 'Print ' }).locator('div').nth(1).click();

    // Open print popup
    const popupPromise = page.waitForEvent('popup');
    await page.getByText('Print with Positive Response').click();
    const popupPage = await popupPromise;

    console.log('📊 Analyzing #tickets table structure...');

    // *** FIELD DISCOVERY LOGIC ***
    const fieldAnalysis = await popupPage.evaluate(() => {
      const ticketsTable = document.querySelector('#tickets');
      if (!ticketsTable) {
        return { error: '#tickets table not found' };
      }

      const analysis = {
        tableFound: true,
        innerHTML: ticketsTable.innerHTML.substring(0, 1000), // First 1000 chars
        structure: {},
        allText: ticketsTable.textContent,
        fieldSuggestions: []
      };

      // Analyze table structure
      const rows = ticketsTable.querySelectorAll('tr');
      analysis.structure.totalRows = rows.length;
      analysis.structure.rowAnalysis = [];

      rows.forEach((row, index) => {
        const cells = row.querySelectorAll('td, th');
        const rowData = {
          rowIndex: index,
          cellCount: cells.length,
          cells: []
        };

        cells.forEach((cell, cellIndex) => {
          rowData.cells.push({
            cellIndex,
            tagName: cell.tagName,
            textContent: cell.textContent?.trim(),
            className: cell.className,
            innerHTML: cell.innerHTML?.substring(0, 200)
          });
        });

        analysis.structure.rowAnalysis.push(rowData);
      });

      // Look for common field patterns
      const textContent = ticketsTable.textContent.toLowerCase();
      const commonFields = [
        'ticket number', 'ticket id', 'number',
        'status', 'priority', 'type',
        'date', 'time', 'created', 'updated',
        'address', 'location', 'street', 'city', 'state', 'zip',
        'contact', 'phone', 'email', 'name',
        'company', 'contractor', 'excavator',
        'work', 'description', 'project',
        'utility', 'utilities', 'member',
        'response', 'required', 'positive'
      ];

      commonFields.forEach(field => {
        if (textContent.includes(field)) {
          analysis.fieldSuggestions.push(field);
        }
      });

      return analysis;
    });

    // Save analysis results
    const analysisFile = 'ticket-field-analysis.json';
    fs.writeFileSync(analysisFile, JSON.stringify(fieldAnalysis, null, 2));

    console.log('✅ Field analysis complete!');
    console.log(`📄 Analysis saved to: ${analysisFile}`);
    console.log('\n📊 Quick Summary:');
    console.log(`   Table found: ${fieldAnalysis.tableFound}`);
    console.log(`   Total rows: ${fieldAnalysis.structure?.totalRows || 'N/A'}`);
    console.log(`   Detected field keywords: ${fieldAnalysis.fieldSuggestions?.join(', ') || 'None'}`);

    // Generate extraction template based on analysis
    const extractionTemplate = generateExtractionTemplate(fieldAnalysis);
    fs.writeFileSync('ticket-extraction-template.js', extractionTemplate);
    console.log(`🔧 Extraction template saved to: ticket-extraction-template.js`);

    // Keep popup open for manual inspection
    console.log('\n🔍 Popup is open for manual inspection.');
    console.log('   1. Look at the #tickets table structure');
    console.log('   2. Identify the exact fields you need');
    console.log('   3. Note the selectors for each field');
    console.log('   4. Press Ctrl+C to close when done');

    // Keep script running until interrupted
    let running = true;
    process.on('SIGINT', async () => {
      console.log('\n🛑 Closing analysis session...');
      running = false;
      await popupPage.close();
      await browser.close();
      console.log('✅ Analysis complete!');
      process.exit(0);
    });

    while (running) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

  } catch (error) {
    console.error('❌ Field discovery failed:', error);
  } finally {
    await browser.close();
  }
})();

function generateExtractionTemplate(analysis) {
  return `// GENERATED TICKET DATA EXTRACTION TEMPLATE
// Based on field analysis of #tickets table

const extractTicketData = async (popupPage) => {
  try {
    const ticketData = await popupPage.evaluate(() => {
      const table = document.querySelector('#tickets');
      if (!table) return null;

      // CUSTOMIZE THESE SELECTORS based on your field analysis
      return {
        // Basic ticket info
        ticket_number: table.querySelector('td:contains("ticket")')?.textContent?.trim(),
        status: table.querySelector('td:contains("status")')?.textContent?.trim(),
        priority: table.querySelector('td:contains("priority")')?.textContent?.trim(),

        // Date/time fields
        created_date: table.querySelector('td:contains("date")')?.textContent?.trim(),
        work_date: table.querySelector('td:contains("work")')?.textContent?.trim(),

        // Location fields
        address: table.querySelector('td:contains("address")')?.textContent?.trim(),
        city: table.querySelector('td:contains("city")')?.textContent?.trim(),
        state: table.querySelector('td:contains("state")')?.textContent?.trim(),
        zip_code: table.querySelector('td:contains("zip")')?.textContent?.trim(),

        // Contact fields
        contact_name: table.querySelector('td:contains("contact")')?.textContent?.trim(),
        phone: table.querySelector('td:contains("phone")')?.textContent?.trim(),
        email: table.querySelector('td:contains("email")')?.textContent?.trim(),

        // Work details
        work_description: table.querySelector('td:contains("description")')?.textContent?.trim(),
        excavator_company: table.querySelector('td:contains("excavator")')?.textContent?.trim(),

        // Utility information
        utilities: Array.from(table.querySelectorAll('td:contains("utility")')).map(el => el.textContent?.trim()),

        // Response requirements
        positive_response_required: table.querySelector('td:contains("positive")')?.textContent?.trim(),

        // Raw data for debugging
        full_table_text: table.textContent?.trim(),
        extraction_timestamp: new Date().toISOString()
      };
    });

    return ticketData;
  } catch (error) {
    console.error('Data extraction failed:', error);
    return null;
  }
};

// Usage in main scraper:
// const ticketData = await extractTicketData(popupPage);
// allTickets.push(ticketData);

module.exports = { extractTicketData };
`;
}
