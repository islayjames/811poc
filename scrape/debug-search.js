#!/usr/bin/env node

const { chromium } = require('playwright');

/**
 * DEBUG: Focus specifically on the search form to understand why company name isn't being entered
 */

async function debugSearch() {
  console.log('🔍 Debugging search form...');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Login
    console.log('🔐 Logging in...');
    await page.goto('https://txgc.texas811.org/ui/login');
    await page.locator('input[name="username"]').fill('james.simmons@highpointe.tech');
    await page.locator('input[name="password"]').fill('jgr6dvc8XBK!kaf8qjv');
    await page.getByRole('checkbox', { name: 'I agree to terms & conditions' }).click();
    await page.getByRole('button', { name: 'Login' }).click();
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('✅ Login successful');

    // Navigate to search
    console.log('🔍 Navigating to ticket search...');
    await page.getByText('Ticket Search').click();
    await page.waitForTimeout(2000);

    // Check My Tickets
    console.log('☑️  Checking My Tickets checkbox...');
    await page.getByRole('checkbox', { name: ' My Tickets' }).click();
    await page.waitForTimeout(1000);

    // Debug: Take screenshot before searching for input
    await page.screenshot({ path: 'debug-before-input-search.png' });
    console.log('📸 Screenshot saved: debug-before-input-search.png');

    // Debug: Show all input elements on page
    const allInputs = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      return inputs.map((input, index) => ({
        index,
        type: input.type,
        name: input.name || '',
        id: input.id || '',
        className: input.className || '',
        placeholder: input.placeholder || '',
        value: input.value || '',
        visible: !input.hidden && input.offsetParent !== null,
        enabled: !input.disabled
      }));
    });

    console.log('📋 All input elements found:');
    allInputs.forEach(input => {
      console.log(`   [${input.index}] ${input.type} - ${input.className.substring(0, 50)} - visible:${input.visible} - enabled:${input.enabled}`);
      if (input.placeholder) console.log(`       placeholder: "${input.placeholder}"`);
      if (input.value) console.log(`       current value: "${input.value}"`);
    });

    // Debug: Show all dx-texteditor elements
    const dxEditors = await page.evaluate(() => {
      const editors = Array.from(document.querySelectorAll('.dx-texteditor-input, .dx-textbox, [class*="dx-text"]'));
      return editors.map((editor, index) => ({
        index,
        tagName: editor.tagName,
        className: editor.className,
        visible: !editor.hidden && editor.offsetParent !== null,
        enabled: !editor.disabled,
        value: editor.value || '',
        textContent: editor.textContent?.trim() || '',
        placeholder: editor.placeholder || ''
      }));
    });

    console.log('📋 All dx-texteditor elements found:');
    dxEditors.forEach(editor => {
      console.log(`   [${editor.index}] ${editor.tagName} - visible:${editor.visible} - enabled:${editor.enabled}`);
      console.log(`       className: ${editor.className.substring(0, 100)}`);
      if (editor.placeholder) console.log(`       placeholder: "${editor.placeholder}"`);
      if (editor.value) console.log(`       value: "${editor.value}"`);
    });

    // Try to find the company input field more methodically
    console.log('🎯 Attempting to find and fill company search field...');

    // Method 1: Look for visible text inputs that might be the company field
    const textInputs = await page.$$('input[type="text"], .dx-texteditor-input, .dx-textbox input');
    console.log(`📝 Found ${textInputs.length} potential text input fields`);

    for (let i = 0; i < textInputs.length; i++) {
      try {
        const input = textInputs[i];
        const isVisible = await input.isVisible();
        const isEnabled = await input.isEnabled();

        console.log(`   Testing input ${i}: visible=${isVisible}, enabled=${isEnabled}`);

        if (isVisible && isEnabled) {
          console.log(`   🧪 Trying input ${i}...`);

          // Clear any existing value
          await input.click();
          await page.keyboard.selectAll();
          await page.keyboard.press('Delete');

          // Type the company name
          await input.type('BRIGHT STAR SOLUTIONS', { delay: 100 });

          // Verify it was entered
          const currentValue = await input.inputValue();
          console.log(`   📝 After typing, input ${i} value: "${currentValue}"`);

          if (currentValue.includes('BRIGHT STAR SOLUTIONS')) {
            console.log(`   ✅ Successfully entered company name in input ${i}!`);

            // Take screenshot showing the filled form
            await page.screenshot({ path: 'debug-form-filled.png' });
            console.log('📸 Screenshot saved: debug-form-filled.png');

            // Now try the search
            console.log('🔍 Clicking search button...');
            await page.getByRole('button', { name: 'Search', exact: true }).click();

            // Wait and see what happens
            await page.waitForTimeout(5000);

            // Take screenshot of results
            await page.screenshot({ path: 'debug-search-results.png' });
            console.log('📸 Screenshot saved: debug-search-results.png');

            // Check for actual ticket data
            const ticketRows = await page.$$('[role="row"]');
            console.log(`📊 Found ${ticketRows.length} rows after search`);

            if (ticketRows.length > 1) {
              // Get text from first few rows to see what we actually got
              for (let r = 0; r < Math.min(3, ticketRows.length); r++) {
                const rowText = await ticketRows[r].textContent();
                console.log(`   Row ${r}: ${rowText.substring(0, 100)}...`);
              }
            }

            break;
          } else {
            console.log(`   ❌ Input ${i} didn't accept the company name`);
          }
        }
      } catch (e) {
        console.log(`   ❌ Input ${i} failed: ${e.message}`);
      }
    }

    console.log('\n🎯 Waiting for manual inspection...');
    console.log('   Check the browser window and form state');
    console.log('   Press Ctrl+C to exit when done');

    // Keep browser open for manual inspection
    await new Promise(() => {}); // Keep alive until Ctrl+C

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    await page.screenshot({ path: 'debug-error-screenshot.png' });
    console.log('📸 Error screenshot saved: debug-error-screenshot.png');

  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  debugSearch().catch(console.error);
}
