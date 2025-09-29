import { test, expect } from '@playwright/test';

test('Manual verification of Create Ticket button', async ({ page }) => {
  console.log('Starting manual verification test...');

  // Navigate to the tickets page
  console.log('Navigating to http://localhost:3001/tickets');
  await page.goto('http://localhost:3001/tickets', { waitUntil: 'networkidle', timeout: 30000 });

  // Wait a bit more to ensure everything loads
  await page.waitForTimeout(2000);

  // Take a screenshot of what we see
  console.log('Taking screenshot of tickets page...');
  await page.screenshot({
    path: 'ui-screenshots/tickets-page-manual.png',
    fullPage: true
  });

  // Get the page title and URL
  const title = await page.title();
  const url = page.url();
  console.log(`Page title: ${title}`);
  console.log(`Current URL: ${url}`);

  // Get all the text content on the page
  const bodyText = await page.locator('body').textContent();
  console.log(`Body text (first 500 chars): ${bodyText?.substring(0, 500)}`);

  // Look for any buttons on the page
  const buttons = await page.locator('button').all();
  console.log(`Found ${buttons.length} button elements`);

  for (let i = 0; i < buttons.length; i++) {
    const text = await buttons[i].textContent();
    console.log(`Button ${i + 1}: "${text}"`);
  }

  // Look for any links on the page
  const links = await page.locator('a').all();
  console.log(`Found ${links.length} link elements`);

  for (let i = 0; i < Math.min(links.length, 10); i++) {
    const text = await links[i].textContent();
    const href = await links[i].getAttribute('href');
    console.log(`Link ${i + 1}: "${text}" -> ${href}`);
  }

  // Try to find anything with "create" in the text (case insensitive)
  const createElements = await page.locator('*:has-text("create")').all();
  console.log(`Found ${createElements.length} elements with "create" in text`);

  // Look for common button patterns
  const possibleButtons = await page.locator('button, a[role="button"], [class*="button"], [class*="btn"]').all();
  console.log(`Found ${possibleButtons.length} possible button elements`);

  for (let i = 0; i < Math.min(possibleButtons.length, 10); i++) {
    const text = await possibleButtons[i].textContent();
    const tagName = await possibleButtons[i].evaluate(el => el.tagName);
    console.log(`Possible button ${i + 1} (${tagName}): "${text}"`);
  }

  // Check if there's an error message
  const errorElements = await page.locator('*:has-text("error")').all();
  if (errorElements.length > 0) {
    console.log('Found error messages on the page!');
    for (const error of errorElements) {
      const text = await error.textContent();
      console.log(`Error: ${text}`);
    }
  }
});