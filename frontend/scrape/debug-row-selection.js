#!/usr/bin/env node

const { chromium } = require('playwright');

/**
 * DEBUG SCRIPT: Test the row selection approach
 * This script tests the new row selection logic before running the full scraper
 */

const CONFIG = {
  credentials: {
    username: 'james.simmons@highpointe.tech',
    password: 'jgr6dvc8XBK!kaf8qjv'
  },
  company: 'BRIGHT STAR SOLUTIONS'
};

async function debugRowSelection() {
  console.log('🔬 DEBUG: Testing row selection approach');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Step 1: Login
    console.log('🔐 Logging in...');
    await page.goto('https://txgc.texas811.org/ui/login', { waitUntil: 'networkidle' });
    await page.locator('input[name="username"]').fill(CONFIG.credentials.username);
    await page.locator('input[name="password"]').fill(CONFIG.credentials.password);
    await page.getByRole('checkbox', { name: 'I agree to terms & conditions' }).click();
    await page.getByRole('button', { name: 'Login' }).click();
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Step 2: Navigate to search
    console.log('🔍 Navigating to search...');
    await page.getByText('Ticket Search').click();
    await page.waitForTimeout(1000);

    // Step 3: Search for company
    console.log('🎯 Performing search...');
    await page.getByRole('checkbox', { name: ' My Tickets' }).click();

    // Find excavator company field (using the corrected approach)
    const allInputs = await page.$$('.dx-texteditor-input');
    console.log(`Found ${allInputs.length} input fields`);

    // Look for input field around index 9 (as indicated in the problem description)
    const candidateInputs = allInputs.slice(9, 15); // Check inputs 9-14
    let companyInputFound = false;

    for (let i = 0; i < candidateInputs.length; i++) {
      try {
        const input = candidateInputs[i];
        await input.click();
        await page.waitForTimeout(300);

        // Check if dropdown opened (indicates this is a city/dropdown field)
        const dropdownVisible = await page.$('.dx-overlay-wrapper.dx-popup-wrapper:not([style*="display: none"])');
        if (dropdownVisible) {
          console.log(`   Input ${i + 9}: Dropdown field, skipping...`);
          await page.keyboard.press('Escape');
          continue;
        }

        // Try to fill company name
        await input.fill(CONFIG.company);
        await page.waitForTimeout(500);

        const value = await input.inputValue();
        if (value === CONFIG.company) {
          console.log(`✅ Found company field at input ${i + 9}: "${value}"`);
          companyInputFound = true;
          break;
        } else {
          console.log(`   Input ${i + 9}: Value="${value}" (doesn't match)`);
          await input.fill('');
        }
      } catch (error) {
        console.log(`   Input ${i + 9}: Error - ${error.message}`);
      }
    }

    if (!companyInputFound) {
      throw new Error('Could not find company input field');
    }

    // Perform search
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.waitForTimeout(3000);

    // Step 4: Analyze table structure
    console.log('📊 Analyzing search results...');
    const ticketRows = await page.$$('[role="row"]');
    const dataRows = ticketRows.slice(1);
    console.log(`Found ${dataRows.length} data rows`);

    if (dataRows.length === 0) {
      console.log('❌ No data rows found - search may have failed');
      return;
    }

    // Step 5: First analyze table structure more thoroughly
    console.log('🔍 Analyzing table structure in detail...');

    for (let rowIndex = 0; rowIndex < Math.min(5, dataRows.length); rowIndex++) {
      const row = dataRows[rowIndex];
      try {
        const rowText = await row.textContent();
        const rowIsVisible = await row.isVisible();
        const rowBoundingBox = await row.boundingBox();
        const gridCells = await row.$$('[role="gridcell"]');
        const divCells = await row.$$('div');
        const tdCells = await row.$$('td');

        console.log(`\n--- Row ${rowIndex + 1} Analysis ---`);
        console.log(`   Text: "${rowText.substring(0, 100)}..."`);
        console.log(`   Visible: ${rowIsVisible}`);
        console.log(`   Bounding box: ${JSON.stringify(rowBoundingBox)}`);
        console.log(`   GridCells: ${gridCells.length}`);
        console.log(`   Div cells: ${divCells.length}`);
        console.log(`   TD cells: ${tdCells.length}`);

        // Check if any gridcells are clickable
        if (gridCells.length > 0) {
          for (let cellIndex = 0; cellIndex < Math.min(3, gridCells.length); cellIndex++) {
            const cell = gridCells[cellIndex];
            const cellVisible = await cell.isVisible();
            const cellText = await cell.textContent();
            const cellBox = await cell.boundingBox();
            console.log(`     GridCell ${cellIndex}: visible=${cellVisible}, text="${cellText}", box=${JSON.stringify(cellBox)}`);
          }
        }

      } catch (error) {
        console.log(`   Row ${rowIndex + 1}: Analysis failed - ${error.message}`);
      }
    }

    // Step 6: Test row selection methods on first few rows
    console.log('\n🧪 Testing row selection methods...');

    for (let rowIndex = 0; rowIndex < Math.min(3, dataRows.length); rowIndex++) {
      console.log(`\n--- Testing Row ${rowIndex + 1} ---`);

      const row = dataRows[rowIndex];
      const rowText = await row.textContent();
      console.log(`Row content: "${rowText.substring(0, 100)}..."`);

      // Pre-check row visibility
      const rowVisible = await row.isVisible();
      console.log(`Row visible: ${rowVisible}`);

      if (!rowVisible) {
        console.log('   ⚠️ Row not visible, skipping selection tests');
        continue;
      }

      // Method 1: Click first gridcell with visibility check
      console.log('Method 1: Gridcell click...');
      try {
        const gridCell = await row.$('[role="gridcell"]');
        if (gridCell) {
          const cellVisible = await gridCell.isVisible();
          console.log(`   GridCell visible: ${cellVisible}`);

          if (cellVisible) {
            await gridCell.click({ timeout: 5000 });
            await page.waitForTimeout(1000);

            // Check if print menu is now available
            const printMenu = page.getByRole('menuitem', { name: 'Print ' });
            const isVisible = await printMenu.isVisible({ timeout: 2000 });
            console.log(`   Print menu visible after gridcell click: ${isVisible}`);

            if (isVisible) {
              console.log('   ✅ SUCCESS: Gridcell click enabled print menu!');
              break; // Success, no need to test other methods
            }
          } else {
            console.log('   ❌ GridCell not visible, cannot click');
          }
        } else {
          console.log('   ❌ No gridcell found in row');
        }
      } catch (error) {
        console.log(`   ❌ Gridcell click failed: ${error.message}`);
      }

      // Method 2: Try scrolling into view first, then click
      console.log('Method 2: Scroll into view then click...');
      try {
        await row.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);

        const gridCell = await row.$('[role="gridcell"]');
        if (gridCell && await gridCell.isVisible()) {
          await gridCell.click({ timeout: 5000 });
          await page.waitForTimeout(1000);

          const printMenu = page.getByRole('menuitem', { name: 'Print ' });
          const isVisible = await printMenu.isVisible({ timeout: 2000 });
          console.log(`   Print menu visible after scroll+click: ${isVisible}`);

          if (isVisible) {
            console.log('   ✅ SUCCESS: Scroll+click enabled print menu!');
            break;
          }
        } else {
          console.log('   ❌ GridCell still not visible after scroll');
        }
      } catch (error) {
        console.log(`   ❌ Scroll+click failed: ${error.message}`);
      }

      // Method 3: Try alternative selectors from table
      console.log('Method 3: Alternative cell selectors...');
      try {
        // Try clicking on the first div within the row
        const divCells = await row.$$('div');
        if (divCells.length > 0) {
          const firstDiv = divCells[0];
          const divVisible = await firstDiv.isVisible();
          console.log(`   First div visible: ${divVisible}`);

          if (divVisible) {
            await firstDiv.click({ timeout: 5000 });
            await page.waitForTimeout(1000);

            const printMenu = page.getByRole('menuitem', { name: 'Print ' });
            const isVisible = await printMenu.isVisible({ timeout: 2000 });
            console.log(`   Print menu visible after div click: ${isVisible}`);

            if (isVisible) {
              console.log('   ✅ SUCCESS: Div click enabled print menu!');
              break;
            }
          }
        }
      } catch (error) {
        console.log(`   ❌ Alternative selector failed: ${error.message}`);
      }

      console.log('   ❌ All methods failed for this row');
    }

    // Step 7: Test one complete extraction if possible
    console.log('\n🧪 Testing complete extraction process...');
    const printMenu = page.getByRole('menuitem', { name: 'Print ' });

    if (await printMenu.isVisible({ timeout: 2000 })) {
      try {
        console.log('Opening print menu...');
        await printMenu.locator('div').nth(1).click();

        console.log('Opening print popup...');
        const popupPromise = page.waitForEvent('popup', { timeout: 10000 });
        await page.getByText('Print with Positive Response').click();
        const popupPage = await popupPromise;

        console.log('Waiting for popup content...');
        await popupPage.waitForSelector('#tickets', { timeout: 15000 });

        console.log('✅ SUCCESS: Complete extraction workflow working!');

        // Quick test of data extraction
        const ticketId = await popupPage.$eval('#tickets h1', el => {
          const match = el.textContent.match(/Ticket\s+(\d+)/i);
          return match ? match[1] : 'unknown';
        });
        console.log(`Extracted ticket ID: ${ticketId}`);

        await popupPage.close();

      } catch (extractError) {
        console.log(`❌ Extraction test failed: ${extractError.message}`);
      }
    } else {
      console.log('❌ Print menu not available - row selection still not working');
    }

    console.log('\n🎯 Debug session complete!');

  } catch (error) {
    console.error('❌ Debug session failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the debug script
if (require.main === module) {
  debugRowSelection()
    .then(() => {
      console.log('✅ Debug script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Debug script failed:', error);
      process.exit(1);
    });
}

module.exports = { debugRowSelection };
