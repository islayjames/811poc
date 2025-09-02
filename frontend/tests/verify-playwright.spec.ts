import { test, expect } from '@playwright/test';

test('verify playwright works', async ({ page }) => {
  console.log('Starting test...');

  // Navigate to a simple page
  await page.goto('https://example.com');
  console.log('Navigated to example.com');

  // Check the title
  await expect(page).toHaveTitle(/Example Domain/);
  console.log('Title verified');

  // Take a screenshot as proof
  await page.screenshot({ path: 'test-screenshot.png' });
  console.log('Screenshot taken');

  // Check for content
  const heading = await page.textContent('h1');
  expect(heading).toBe('Example Domain');
  console.log('Content verified');

  console.log('Test completed successfully!');
});
