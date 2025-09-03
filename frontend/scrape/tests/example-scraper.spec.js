const { test, expect } = require('@playwright/test');

test('example web scraping', async ({ page }) => {
  // Navigate to the target page
  await page.goto('https://quotes.toscrape.com/');

  // Wait for the page to load
  await expect(page.locator('h1')).toContainText('Quotes to Scrape');

  // Extract quotes data
  const quotes = await page.$$eval('.quote', quotes =>
    quotes.map(quote => ({
      text: quote.querySelector('.text')?.textContent?.trim(),
      author: quote.querySelector('.author')?.textContent?.trim(),
      tags: Array.from(quote.querySelectorAll('.tag')).map(tag => tag.textContent.trim())
    }))
  );

  // Log the extracted data
  console.log('Extracted quotes:', JSON.stringify(quotes, null, 2));

  // Verify we got some quotes
  expect(quotes.length).toBeGreaterThan(0);
  expect(quotes[0].text).toBeTruthy();
  expect(quotes[0].author).toBeTruthy();

  // Navigate to the next page
  const nextButton = page.locator('.next a');
  if (await nextButton.isVisible()) {
    await nextButton.click();
    await page.waitForLoadState('networkidle');

    // Extract quotes from the second page
    const moreQuotes = await page.$$eval('.quote', quotes =>
      quotes.map(quote => ({
        text: quote.querySelector('.text')?.textContent?.trim(),
        author: quote.querySelector('.author')?.textContent?.trim(),
        tags: Array.from(quote.querySelectorAll('.tag')).map(tag => tag.textContent.trim())
      }))
    );

    console.log('Page 2 quotes:', JSON.stringify(moreQuotes, null, 2));
  }
});
