const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://quotes.toscrape.com/');
  await page.locator('div').filter({ hasText: '“It is our choices, Harry,' }).nth(3).click();
  await page.getByText('“There are only two ways to').click();
  await page.getByText('“The person, be it gentleman').click();
  await page.getByText('“The world as we have created').click();
  await page.getByText('“It is our choices, Harry,').click();
  await page.locator('div').filter({ hasText: '“The world as we have created' }).nth(2).click();
  await page.close();

  // ---------------------
  await context.close();
  await browser.close();
})();
