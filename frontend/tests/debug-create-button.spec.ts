import { test, expect } from '@playwright/test';

test('Debug Create Ticket button with console logs', async ({ page }) => {
  // Listen for console messages
  page.on('console', msg => {
    console.log(`BROWSER CONSOLE [${msg.type()}]:`, msg.text());
  });

  // Listen for page errors
  page.on('pageerror', error => {
    console.log('BROWSER ERROR:', error.message);
  });

  // Listen for network requests
  page.on('requestfailed', request => {
    console.log('FAILED REQUEST:', request.url(), request.failure()?.errorText);
  });

  console.log('Navigating to tickets page...');
  await page.goto('http://localhost:3001/tickets', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  console.log('Looking for Create Ticket button...');
  const createButton = page.locator('button:has-text("Create Ticket")');
  await expect(createButton).toBeVisible();

  // Get button attributes
  const buttonHTML = await createButton.evaluate(el => el.outerHTML);
  console.log('Button HTML:', buttonHTML);

  // Check if button has any event listeners
  const hasClickHandler = await createButton.evaluate(el => {
    // @ts-ignore
    return typeof el.onclick === 'function' || el.getAttribute('onclick') !== null;
  });
  console.log('Has click handler:', hasClickHandler);

  // Check if router.push exists
  const routerExists = await page.evaluate(() => {
    // @ts-ignore
    return typeof window !== 'undefined';
  });
  console.log('Window exists:', routerExists);

  console.log('Clicking button...');

  // Try clicking and wait for navigation
  const [response] = await Promise.all([
    page.waitForResponse(response => response.url().includes('/create'), { timeout: 5000 }).catch(() => null),
    page.waitForURL('**/create', { timeout: 5000 }).catch(() => null),
    createButton.click()
  ]);

  await page.waitForTimeout(2000);

  const finalUrl = page.url();
  console.log('Final URL:', finalUrl);

  // Take screenshot
  await page.screenshot({
    path: 'ui-screenshots/debug-after-click.png',
    fullPage: true
  });

  // Check what happened
  if (finalUrl.includes('/create')) {
    console.log('✓ SUCCESS: Navigation worked!');
  } else {
    console.log('✗ FAILED: Navigation did not occur');
    console.log('Button might not be wired up correctly');
  }
});