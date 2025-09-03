#!/usr/bin/env node

const { chromium } = require('playwright');

/**
 * DEBUG SCRIPT: Test correct row selection targeting the actual ticket data table
 */

const CONFIG = {
  credentials: {
    username: 'james.simmons@highpointe.tech',
    password: 'jgr6dvc8XBK!kaf8qjv'
  },
  company: 'BRIGHT STAR SOLUTIONS'
};

async function debugCorrectRowSelection() {
  console.log('🔬 DEBUG: Testing row selection on CORRECT ticket table');

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

    // Step 2: Target the CORRECT ticket table (the visible DevExtreme data grid)
    console.log('🎯 Finding the correct ticket data table...');

    // Look for the main DevExtreme data grid container
    const mainDataGrid = page.locator('.dx-datagrid-borders');
    await mainDataGrid.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ Found main DevExtreme data grid');

    // Within that grid, find the table containing actual ticket data
    const ticketTable = mainDataGrid.locator('table.dx-datagrid-table').nth(2); // 3rd table based on our analysis
    const isTableVisible = await ticketTable.isVisible();
    console.log(`📊 Ticket data table visible: ${isTableVisible}`);

    // Get ticket rows from the correct table
    const ticketRows = await ticketTable.locator('[role="row"]').all();
    const dataRows = ticketRows.slice(1); // Remove header row
    console.log(`🎫 Found ${dataRows.length} ticket data rows`);

    // Step 3: Analyze the actual ticket rows
    console.log('\\n🔍 Analyzing actual ticket rows:');
    for (let i = 0; i < Math.min(3, dataRows.length); i++) {
      const row = dataRows[i];
      const rowText = await row.textContent();
      const isVisible = await row.isVisible();
      const boundingBox = await row.boundingBox();
      const gridCells = await row.locator('[role="gridcell"]').all();

      console.log(`\\n   Row ${i + 1}:`);
      console.log(`      Text: "${rowText.substring(0, 100)}..."`);
      console.log(`      Visible: ${isVisible}`);
      console.log(`      Bounding box: ${boundingBox ? `${boundingBox.width}x${boundingBox.height}` : 'null'}`);
      console.log(`      GridCells: ${gridCells.length}`);

      // Analyze grid cells
      for (let cellIndex = 0; cellIndex < Math.min(3, gridCells.length); cellIndex++) {
        const cell = gridCells[cellIndex];
        const cellVisible = await cell.isVisible();
        const cellText = await cell.textContent();
        const cellBox = await cell.boundingBox();
        console.log(`         Cell ${cellIndex}: visible=${cellVisible}, text="${cellText}", size=${cellBox ? `${cellBox.width}x${cellBox.height}` : 'null'}`);
      }
    }

    // Step 4: Test row selection on correct table
    console.log('\\n🧪 Testing row selection on correct table...');

    for (let rowIndex = 0; rowIndex < Math.min(2, dataRows.length); rowIndex++) {
      console.log(`\\n--- Testing Row ${rowIndex + 1} ---`);

      const row = dataRows[rowIndex];
      const rowText = await row.textContent();
      console.log(`Row content: "${rowText.substring(0, 100)}..."`);

      // Method 1: Click first gridcell in the visible table
      console.log('Method 1: Click first gridcell in correct table...');
      try {
        const gridCells = await row.locator('[role="gridcell"]').all();
        if (gridCells.length > 0) {
          const firstCell = gridCells[0];
          const cellVisible = await firstCell.isVisible();
          console.log(`   First cell visible: ${cellVisible}`);

          if (cellVisible) {
            // Scroll into view first
            await firstCell.scrollIntoViewIfNeeded();
            await page.waitForTimeout(500);

            await firstCell.click({ timeout: 5000 });
            console.log('   ✅ Successfully clicked gridcell');

            // Wait a moment for selection to register
            await page.waitForTimeout(1000);

            // Check if print menu is now available
            const printMenu = page.getByRole('menuitem', { name: 'Print ' });
            const isPrintVisible = await printMenu.isVisible({ timeout: 3000 });
            console.log(`   Print menu visible: ${isPrintVisible}`);

            if (isPrintVisible) {
              console.log('   🎉 SUCCESS: Row selection enabled print menu!');

              // Test the complete workflow
              console.log('   🧪 Testing complete extraction workflow...');
              try {
                // Open print submenu
                await printMenu.locator('div').nth(1).click();
                await page.waitForTimeout(500);

                // Open print popup
                const popupPromise = page.waitForEvent('popup', { timeout: 10000 });
                await page.getByText('Print with Positive Response').click();
                const popupPage = await popupPromise;

                // Wait for popup to load
                await popupPage.waitForSelector('#tickets', { timeout: 15000 });

                // Extract basic ticket info
                const ticketId = await popupPage.$eval('#tickets h1', el => {
                  const match = el.textContent.match(/Ticket\\s+(\\d+)/i);
                  return match ? match[1] : 'unknown';
                });

                console.log(`   ✅ COMPLETE SUCCESS: Extracted ticket ID: ${ticketId}`);
                await popupPage.close();

                // Success - we can break here
                break;

              } catch (extractError) {
                console.log(`   ❌ Extraction failed: ${extractError.message}`);
              }
            } else {
              console.log('   ⚠️  Print menu not available after click');

              // Debug: Check what menus are available
              const availableMenus = await page.$$eval('[role="menuitem"]', elements =>
                elements.map(el => el.textContent?.trim()).filter(text => text)
              );
              console.log(`   Available menus: ${availableMenus.join(', ')}`);
            }
          } else {
            console.log('   ❌ First gridcell not visible');
          }
        } else {
          console.log('   ❌ No gridcells found in row');
        }
      } catch (error) {
        console.log(`   ❌ Method failed: ${error.message}`);
      }
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
  debugCorrectRowSelection()
    .then(() => {
      console.log('✅ Corrected debug script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Corrected debug script failed:', error);
      process.exit(1);
    });
}

module.exports = { debugCorrectRowSelection };
