#!/usr/bin/env node

const { chromium } = require('playwright');

/**
 * DEBUG SCRIPT: Analyze the exact table structure to identify row selection offset issue
 */

async function debugTableStructure() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('🔐 Authenticating...');
    await page.goto('https://txgc.texas811.org/ui/login', { waitUntil: 'networkidle' });
    await page.locator('input[name="username"]').fill('james.simmons@highpointe.tech');
    await page.locator('input[name="password"]').fill('jgr6dvc8XBK!kaf8qjv');
    await page.getByRole('checkbox', { name: 'I agree to terms & conditions' }).click();
    await page.getByRole('button', { name: 'Login' }).click();
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    console.log('🔍 Performing search...');
    await page.getByText('Ticket Search').click();
    await page.waitForTimeout(1000);
    await page.getByRole('checkbox', { name: ' My Tickets' }).click();
    await page.waitForTimeout(500);

    // Fill company field
    const allInputs = await page.$$('.dx-texteditor-input');
    const targetInput = allInputs[9];
    await targetInput.fill('BRIGHT STAR SOLUTIONS');
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.waitForTimeout(3000);

    console.log('\n🎯 Analyzing table structure...');

    // Get the main data grid
    const mainDataGrid = page.locator('.dx-datagrid-borders');
    await mainDataGrid.waitFor({ state: 'visible', timeout: 5000 });

    // Analyze ALL tables in the data grid
    const allTables = await mainDataGrid.locator('table.dx-datagrid-table').all();
    console.log(`📊 Found ${allTables.length} tables in data grid`);

    for (let tableIndex = 0; tableIndex < allTables.length; tableIndex++) {
      const table = allTables[tableIndex];
      const rows = await table.locator('[role="row"]').all();
      console.log(`\n   Table ${tableIndex}: ${rows.length} rows`);

      // Show first few rows of each table
      for (let rowIndex = 0; rowIndex < Math.min(5, rows.length); rowIndex++) {
        const rowText = await rows[rowIndex].textContent();
        const ticketMatch = rowText.match(/(\d{10,})/);
        const ticketId = ticketMatch ? ticketMatch[1] : 'NO_TICKET_ID';
        console.log(`      Row ${rowIndex}: ${ticketId} - "${rowText.substring(0, 80)}..."`);
      }
    }

    // Focus on the table we're using (index 2)
    console.log('\n🎯 Detailed analysis of Table 2 (our target):');
    const ticketTable = allTables[2];
    const allRows = await ticketTable.locator('[role="row"]').all();
    console.log(`   Total rows: ${allRows.length}`);

    // Check if first row is actually a header
    const firstRowText = await allRows[0].textContent();
    console.log(`   First row: "${firstRowText}"`);
    const isFirstRowHeader = firstRowText.toLowerCase().includes('ticket') ||
                           firstRowText.toLowerCase().includes('date') ||
                           firstRowText.toLowerCase().includes('status');
    console.log(`   First row is header: ${isFirstRowHeader}`);

    // Analyze data rows (skipping header if it exists)
    const dataRows = isFirstRowHeader ? allRows.slice(1) : allRows;
    console.log(`   Data rows after header removal: ${dataRows.length}`);

    console.log('\n🔍 First 7 data rows analysis:');
    for (let i = 0; i < Math.min(7, dataRows.length); i++) {
      const row = dataRows[i];
      const rowText = await row.textContent();
      const ticketMatch = rowText.match(/(\d{10,})/g); // Get ALL ticket numbers
      const allTicketIds = ticketMatch || [];
      console.log(`   Data Row ${i}: [${allTicketIds.join(', ')}] - "${rowText.substring(0, 60)}..."`);
    }

    // Test clicking the first few rows to see what gets selected
    console.log('\n🖱️ Testing row selection:');
    for (let testIndex = 0; testIndex < Math.min(3, dataRows.length); testIndex++) {
      try {
        const testRow = dataRows[testIndex];
        await testRow.scrollIntoViewIfNeeded();

        const gridCells = await testRow.locator('[role="gridcell"]').all();
        console.log(`   Row ${testIndex}: ${gridCells.length} grid cells`);

        if (gridCells.length > 0) {
          const firstCell = gridCells[0];
          await firstCell.click();
          console.log(`   ✅ Successfully clicked row ${testIndex} first cell`);

          // Check if print menu becomes available
          await page.waitForTimeout(1000);
          const printMenuItem = page.getByRole('menuitem', { name: 'Print ' });
          const isMenuVisible = await printMenuItem.isVisible({ timeout: 2000 }).catch(() => false);
          console.log(`   Print menu visible after clicking row ${testIndex}: ${isMenuVisible}`);
        }

        await page.waitForTimeout(500);
      } catch (error) {
        console.log(`   ❌ Failed to click row ${testIndex}: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await browser.close();
  }
}

debugTableStructure();
