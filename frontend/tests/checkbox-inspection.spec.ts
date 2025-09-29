import { test, expect } from '@playwright/test';

test('inspect checkbox elements', async ({ page }) => {
  await page.goto('http://localhost:3000/tickets/create');
  await expect(page.getByRole('heading', { name: 'Create New Ticket' })).toBeVisible();

  // Get all checkbox elements and their info
  const checkboxInfo = await page.evaluate(() => {
    const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"], button[role="checkbox"]'));
    return checkboxes.map((el, index) => ({
      index,
      tagName: el.tagName,
      type: el.type || 'none',
      name: el.name || 'none',
      id: el.id || 'none',
      role: el.getAttribute('role') || 'none',
      nextSiblingText: el.nextElementSibling?.textContent?.trim() || 'none',
      parentText: el.parentElement?.textContent?.trim().substring(0, 50) || 'none',
      className: el.className || 'none'
    }));
  });

  console.log('Checkbox elements found:', JSON.stringify(checkboxInfo, null, 2));

  // Take screenshot showing the work characteristics section
  await page.screenshot({
    path: '/home/james/dev/811poc-revert/frontend/checkbox-inspection.png',
    fullPage: true
  });

  // Try to find checkboxes by their labels
  const trenchlessCheckbox = page.locator('label:has-text("Trenchless excavation")').locator('input[type="checkbox"], button[role="checkbox"]');
  const blastingCheckbox = page.locator('label:has-text("Blasting/explosives will be used")').locator('input[type="checkbox"], button[role="checkbox"]');
  const whiteMarkedCheckbox = page.locator('label:has-text("Site has been marked with white paint/flags")').locator('input[type="checkbox"], button[role="checkbox"]');

  console.log('Testing checkbox interactions...');

  if (await trenchlessCheckbox.count() > 0) {
    await trenchlessCheckbox.click();
    console.log('Clicked trenchless checkbox');
  }

  if (await blastingCheckbox.count() > 0) {
    await blastingCheckbox.click();
    console.log('Clicked blasting checkbox');
  }

  if (await whiteMarkedCheckbox.count() > 0) {
    await whiteMarkedCheckbox.click();
    console.log('Clicked white marked checkbox');
  }

  // Take final screenshot
  await page.screenshot({
    path: '/home/james/dev/811poc-revert/frontend/checkboxes-clicked.png',
    fullPage: true
  });
});