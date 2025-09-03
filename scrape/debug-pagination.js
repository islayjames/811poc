#!/usr/bin/env node

const { chromium } = require('playwright');

/**
 * DEBUG SCRIPT: Analyze pagination controls to understand why detection is failing
 */

async function debugPagination() {
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

    const allInputs = await page.$$('.dx-texteditor-input');
    const targetInput = allInputs[9];
    await targetInput.fill('BRIGHT STAR SOLUTIONS');
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.waitForTimeout(3000);

    console.log('\n🔍 Analyzing pagination controls...');

    // Check for the exact selector from the original recording
    console.log('\n1. Looking for navigation with name "Page Navigation":');
    try {
      const pageNavigation = page.getByRole('navigation', { name: 'Page Navigation' });
      const isVisible = await pageNavigation.isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`   Found: ${isVisible}`);

      if (isVisible) {
        const navText = await pageNavigation.textContent();
        console.log(`   Navigation text: "${navText}"`);
      }
    } catch (error) {
      console.log(`   Error: ${error.message}`);
    }

    // Look for any navigation elements
    console.log('\n2. Looking for ANY navigation elements:');
    const allNavs = await page.$$('nav, [role="navigation"]');
    console.log(`   Found ${allNavs.length} navigation elements`);

    for (let i = 0; i < allNavs.length; i++) {
      const nav = allNavs[i];
      const navText = await nav.textContent();
      const navClass = await nav.getAttribute('class');
      const navRole = await nav.getAttribute('role');
      console.log(`   Nav ${i}: class="${navClass}" role="${navRole}" text="${navText?.substring(0, 100)}..."`);
    }

    // Look for pagination-related elements
    console.log('\n3. Looking for pagination-related elements:');
    const paginationSelectors = [
      '[class*="page"]',
      '[class*="pagination"]',
      '[class*="nav"]',
      'button[class*="page"]',
      '.dx-pages',
      '.dx-page',
      '.dx-pager'
    ];

    for (const selector of paginationSelectors) {
      try {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          console.log(`   ${selector}: ${elements.length} elements found`);
          for (let i = 0; i < Math.min(3, elements.length); i++) {
            const element = elements[i];
            const text = await element.textContent();
            const className = await element.getAttribute('class');
            console.log(`      ${i}: class="${className}" text="${text?.substring(0, 50)}..."`);
          }
        }
      } catch (error) {
        // Continue to next selector
      }
    }

    // Look for buttons that might be page buttons
    console.log('\n4. Looking for buttons that might be page navigation:');
    const allButtons = await page.$$('button');
    console.log(`   Found ${allButtons.length} buttons total`);

    const pageButtons = [];
    for (const button of allButtons) {
      const buttonText = await button.textContent();
      const buttonClass = await button.getAttribute('class');

      // Check if button text contains numbers or page-related words
      if (buttonText && (
        buttonText.match(/page/i) ||
        buttonText.match(/^\d+$/) ||
        buttonText.match(/next|prev|first|last/i)
      )) {
        pageButtons.push({
          text: buttonText,
          class: buttonClass,
          isVisible: await button.isVisible()
        });
      }
    }

    console.log(`   Found ${pageButtons.length} potential page buttons:`);
    pageButtons.forEach((btn, i) => {
      console.log(`      ${i}: "${btn.text}" class="${btn.class}" visible=${btn.isVisible}`);
    });

    // Check the data grid label for total count
    console.log('\n5. Checking data grid for total count:');
    try {
      const dataGrids = await page.$$('[aria-label*="rows"]');
      for (let i = 0; i < dataGrids.length; i++) {
        const label = await dataGrids[i].getAttribute('aria-label');
        console.log(`   DataGrid ${i}: "${label}"`);
      }
    } catch (error) {
      console.log(`   Error checking data grids: ${error.message}`);
    }

    // Take a screenshot to see what's on screen
    await page.screenshot({ path: 'pagination-debug.png', fullPage: true });
    console.log('\n📸 Screenshot saved as pagination-debug.png');

  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    // Don't close immediately - let user see the page
    console.log('\n⏸️ Pausing for manual inspection...');
    await page.waitForTimeout(10000);
    await browser.close();
  }
}

debugPagination();
