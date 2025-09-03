#!/usr/bin/env node

const { chromium } = require('playwright');

/**
 * DEBUG SCRIPT: Find the actual ticket data table
 * This script analyzes all tables on the page to identify the correct ticket data table
 */

const CONFIG = {
  credentials: {
    username: 'james.simmons@highpointe.tech',
    password: 'jgr6dvc8XBK!kaf8qjv'
  },
  company: 'BRIGHT STAR SOLUTIONS'
};

async function findTicketTable() {
  console.log('🔬 DEBUG: Finding the actual ticket data table');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Step 1: Login and search (same as before)
    console.log('🔐 Logging in...');
    await page.goto('https://txgc.texas811.org/ui/login', { waitUntil: 'networkidle' });
    await page.locator('input[name="username"]').fill(CONFIG.credentials.username);
    await page.locator('input[name="password"]').fill(CONFIG.credentials.password);
    await page.getByRole('checkbox', { name: 'I agree to terms & conditions' }).click();
    await page.getByRole('button', { name: 'Login' }).click();
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    console.log('🔍 Navigating to search...');
    await page.getByText('Ticket Search').click();
    await page.waitForTimeout(1000);

    console.log('🎯 Performing search...');
    await page.getByRole('checkbox', { name: ' My Tickets' }).click();

    // Find and fill company field
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

    // Step 2: Analyze ALL tables and grids on the page
    console.log('📊 Analyzing all data structures on the page...');

    const tableAnalysis = await page.evaluate(() => {
      const analysis = {
        grids: [],
        tables: [],
        roleRows: [],
        dataGrids: []
      };

      // Find all elements with role="grid"
      const grids = document.querySelectorAll('[role="grid"]');
      grids.forEach((grid, index) => {
        const rows = grid.querySelectorAll('[role="row"]');
        const gridVisible = grid.offsetParent !== null;
        const boundingRect = grid.getBoundingClientRect();

        analysis.grids.push({
          index: index,
          selector: `grid-${index}`,
          visible: gridVisible,
          className: grid.className,
          rowCount: rows.length,
          dimensions: {
            width: boundingRect.width,
            height: boundingRect.height,
            top: boundingRect.top,
            left: boundingRect.left
          },
          sampleText: grid.textContent?.substring(0, 200) + '...'
        });
      });

      // Find all table elements
      const tables = document.querySelectorAll('table');
      tables.forEach((table, index) => {
        const rows = table.querySelectorAll('tr');
        const tableVisible = table.offsetParent !== null;
        const boundingRect = table.getBoundingClientRect();

        analysis.tables.push({
          index: index,
          selector: `table-${index}`,
          visible: tableVisible,
          className: table.className,
          rowCount: rows.length,
          dimensions: {
            width: boundingRect.width,
            height: boundingRect.height,
            top: boundingRect.top,
            left: boundingRect.left
          },
          sampleText: table.textContent?.substring(0, 200) + '...'
        });
      });

      // Find all elements that contain role="row" (regardless of parent)
      const allRows = document.querySelectorAll('[role="row"]');
      const rowParents = new Set();
      allRows.forEach(row => {
        if (row.parentElement) {
          rowParents.add(row.parentElement);
        }
      });

      rowParents.forEach((parent, index) => {
        const rows = parent.querySelectorAll('[role="row"]');
        const parentVisible = parent.offsetParent !== null;
        const boundingRect = parent.getBoundingClientRect();

        analysis.roleRows.push({
          index: index,
          tagName: parent.tagName,
          className: parent.className,
          visible: parentVisible,
          rowCount: rows.length,
          dimensions: {
            width: boundingRect.width,
            height: boundingRect.height,
            top: boundingRect.top,
            left: boundingRect.left
          },
          sampleText: parent.textContent?.substring(0, 200) + '...'
        });
      });

      // Look for DevExtreme data grids specifically
      const dxDataGrids = document.querySelectorAll('.dx-datagrid, .dx-data-grid');
      dxDataGrids.forEach((grid, index) => {
        const rows = grid.querySelectorAll('[role="row"]');
        const gridVisible = grid.offsetParent !== null;
        const boundingRect = grid.getBoundingClientRect();

        analysis.dataGrids.push({
          index: index,
          selector: `.dx-datagrid-${index}`,
          visible: gridVisible,
          className: grid.className,
          rowCount: rows.length,
          dimensions: {
            width: boundingRect.width,
            height: boundingRect.height,
            top: boundingRect.top,
            left: boundingRect.left
          },
          sampleText: grid.textContent?.substring(0, 200) + '...'
        });
      });

      return analysis;
    });

    console.log('\\n📊 TABLE ANALYSIS RESULTS:\\n');

    console.log(`Found ${tableAnalysis.grids.length} elements with role="grid":`);
    tableAnalysis.grids.forEach(grid => {
      console.log(`   Grid ${grid.index}: visible=${grid.visible}, rows=${grid.rowCount}, size=${grid.dimensions.width}x${grid.dimensions.height}`);
      console.log(`      Classes: ${grid.className}`);
      console.log(`      Sample: ${grid.sampleText.substring(0, 100)}...`);
      console.log('');
    });

    console.log(`Found ${tableAnalysis.tables.length} table elements:`);
    tableAnalysis.tables.forEach(table => {
      console.log(`   Table ${table.index}: visible=${table.visible}, rows=${table.rowCount}, size=${table.dimensions.width}x${table.dimensions.height}`);
      console.log(`      Classes: ${table.className}`);
      console.log(`      Sample: ${table.sampleText.substring(0, 100)}...`);
      console.log('');
    });

    console.log(`Found ${tableAnalysis.roleRows.length} containers with role="row" children:`);
    tableAnalysis.roleRows.forEach(container => {
      console.log(`   Container ${container.index}: ${container.tagName}, visible=${container.visible}, rows=${container.rowCount}`);
      console.log(`      Classes: ${container.className}`);
      console.log(`      Size: ${container.dimensions.width}x${container.dimensions.height}`);
      console.log(`      Sample: ${container.sampleText.substring(0, 100)}...`);
      console.log('');
    });

    console.log(`Found ${tableAnalysis.dataGrids.length} DevExtreme data grids:`);
    tableAnalysis.dataGrids.forEach(grid => {
      console.log(`   DataGrid ${grid.index}: visible=${grid.visible}, rows=${grid.rowCount}, size=${grid.dimensions.width}x${grid.dimensions.height}`);
      console.log(`      Classes: ${grid.className}`);
      console.log(`      Sample: ${grid.sampleText.substring(0, 100)}...`);
      console.log('');
    });

    // Step 3: Try to find the best candidate for ticket data
    console.log('🎯 Identifying best candidate for ticket data table...');

    // Look for patterns that suggest ticket data
    const ticketDataPatterns = await page.evaluate(() => {
      const patterns = [];

      // Look for elements containing ticket-like data
      const elementsWithTicketNumbers = document.querySelectorAll('*');

      for (const element of elementsWithTicketNumbers) {
        const text = element.textContent || '';

        // Look for 10-digit numbers (ticket IDs)
        const ticketMatches = text.match(/\\d{10}/g);
        if (ticketMatches && ticketMatches.length > 1) { // Multiple ticket numbers suggests a table
          const rect = element.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0 && element.offsetParent !== null;

          patterns.push({
            tagName: element.tagName,
            className: element.className,
            id: element.id,
            visible: isVisible,
            ticketCount: ticketMatches.length,
            sampleTickets: ticketMatches.slice(0, 3),
            dimensions: {
              width: rect.width,
              height: rect.height,
              top: rect.top,
              left: rect.left
            },
            sampleText: text.substring(0, 300) + '...'
          });
        }
      }

      return patterns.sort((a, b) => b.ticketCount - a.ticketCount); // Sort by ticket count
    });

    console.log(`\\n🎫 Found ${ticketDataPatterns.length} elements with multiple ticket numbers:`);
    ticketDataPatterns.forEach((pattern, index) => {
      console.log(`   Pattern ${index + 1}: ${pattern.tagName}${pattern.className ? '.' + pattern.className.split(' ')[0] : ''}`);
      console.log(`      Visible: ${pattern.visible}`);
      console.log(`      Tickets found: ${pattern.ticketCount}`);
      console.log(`      Sample tickets: ${pattern.sampleTickets.join(', ')}`);
      console.log(`      Size: ${pattern.dimensions.width}x${pattern.dimensions.height}`);
      console.log(`      Sample text: ${pattern.sampleText.substring(0, 150)}...`);
      console.log('');
    });

    if (ticketDataPatterns.length > 0 && ticketDataPatterns[0].visible) {
      console.log('✅ RECOMMENDATION: Use the first visible pattern for ticket data extraction');
      console.log(`   Element: ${ticketDataPatterns[0].tagName}${ticketDataPatterns[0].className ? '.' + ticketDataPatterns[0].className.split(' ')[0] : ''}`);
      console.log(`   Contains ${ticketDataPatterns[0].ticketCount} tickets`);
    } else {
      console.log('❌ No suitable ticket data table found');
    }

    console.log('\\n🎯 Debug session complete!');

  } catch (error) {
    console.error('❌ Debug session failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the debug script
if (require.main === module) {
  findTicketTable()
    .then(() => {
      console.log('✅ Table finder debug script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Table finder debug script failed:', error);
      process.exit(1);
    });
}

module.exports = { findTicketTable };
