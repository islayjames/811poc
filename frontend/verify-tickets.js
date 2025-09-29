const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  console.log('Navigating to tickets page...');
  await page.goto('http://localhost:3000/tickets');

  // Wait for the page to load - wait for any content
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000); // Give it extra time for API calls

  // Take a screenshot
  await page.screenshot({ path: '/tmp/tickets-page.png', fullPage: true });

  // Look for the ticket count
  try {
    const ticketCountElement = await page.locator('text=/\\d+ tickets?/').first();
    const ticketCountText = await ticketCountElement.textContent();
    console.log('Ticket count found:', ticketCountText);
  } catch (error) {
    console.log('Could not find ticket count text');
  }

  // Check if there are BRIGHT STAR SOLUTIONS tickets visible
  try {
    const brightStarTickets = await page.locator('text=/BRIGHT STAR SOLUTIONS/i').count();
    console.log('BRIGHT STAR SOLUTIONS tickets visible:', brightStarTickets);
  } catch (error) {
    console.log('No BRIGHT STAR SOLUTIONS tickets found');
  }

  // Get the pagination info
  try {
    const paginationText = await page.locator('text=/Showing \\d+ to \\d+ of \\d+ results/').textContent();
    console.log('Pagination info:', paginationText);
  } catch (error) {
    console.log('No pagination info found');
  }

  // Check if there are any error messages
  try {
    const errorMessage = await page.locator('[role="alert"], .text-red-500').textContent();
    console.log('Error message:', errorMessage);
  } catch (error) {
    console.log('No error messages found');
  }

  await browser.close();
})();