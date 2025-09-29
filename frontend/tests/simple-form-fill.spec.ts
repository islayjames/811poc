import { test, expect } from '@playwright/test';

test.describe('Simple Form Fill Test', () => {
  test('should fill form with sample data and take screenshots', async ({ page }) => {
    // Navigate to the create ticket page
    await page.goto('http://localhost:3000/tickets/create');

    // Wait for form to load
    await expect(page.getByRole('heading', { name: 'Create New Ticket' })).toBeVisible();

    // Take initial screenshot
    await page.screenshot({
      path: '/home/james/dev/811poc-revert/frontend/empty-form.png',
      fullPage: true
    });

    console.log('Filling form with sample data...');

    // Fill Excavator Information
    await page.fill('[name="excavator.company"]', 'ABC Construction Inc.');
    await page.fill('[name="excavator.contact_name"]', 'John Smith');
    await page.fill('[name="excavator.phone"]', '(512) 555-0123');
    await page.fill('[name="excavator.email"]', 'john.smith@abcconstruction.com');

    // Fill Work Details
    await page.fill('[name="work.work_for"]', 'Private Property Owner');
    await page.fill('[name="work.type_of_work"]', 'Install new water line');

    // Fill required Site/Location Information
    await page.fill('[name="site.county"]', 'Harris');
    await page.fill('[name="site.city"]', 'Houston');
    await page.fill('[name="site.work_area_description"]', 'Installing new water service line from street to building');

    // Add some optional details for better test coverage
    await page.fill('[name="site.address"]', '1234 Main Street, Houston, TX 77002');
    await page.fill('[name="site.cross_street"]', 'Between Elm St and Oak Ave');
    await page.fill('[name="work.depth_inches"]', '48');
    await page.fill('[name="work.duration_days"]', '3');

    // Take screenshot of filled form
    await page.screenshot({
      path: '/home/james/dev/811poc-revert/frontend/filled-form.png',
      fullPage: true
    });

    console.log('Form filled successfully. Attempting to submit...');

    // Try to submit the form
    await page.click('button[type="submit"]');

    // Wait a moment to see what happens
    await page.waitForTimeout(2000);

    // Take screenshot after submission attempt
    await page.screenshot({
      path: '/home/james/dev/811poc-revert/frontend/after-submit.png',
      fullPage: true
    });

    // Log current URL to see if we redirected
    const currentUrl = page.url();
    console.log('Current URL after submit:', currentUrl);

    // Check if we're still on the create page or if we got redirected
    if (currentUrl.includes('/tickets/create')) {
      console.log('Still on create page - may have validation errors');

      // Look for any error messages
      const errorMessages = await page.locator('[role="alert"], .error, .text-red-500, .text-destructive').allTextContents();
      if (errorMessages.length > 0) {
        console.log('Found error messages:', errorMessages);
      }
    } else {
      console.log('Successfully redirected to:', currentUrl);

      // If we got redirected, look for our data on the new page
      const pageContent = await page.textContent('body');
      if (pageContent?.includes('ABC Construction Inc.')) {
        console.log('Successfully found company name on result page');
      }
    }
  });

  test('should demonstrate checkbox interactions', async ({ page }) => {
    await page.goto('http://localhost:3000/tickets/create');
    await expect(page.getByRole('heading', { name: 'Create New Ticket' })).toBeVisible();

    // Fill minimum required fields first
    await page.fill('[name="excavator.company"]', 'Test Company');
    await page.fill('[name="excavator.contact_name"]', 'Test Contact');
    await page.fill('[name="excavator.phone"]', '(555) 123-4567');
    await page.fill('[name="site.county"]', 'Test County');
    await page.fill('[name="site.city"]', 'Test City');
    await page.fill('[name="work.type_of_work"]', 'Test work');
    await page.fill('[name="site.work_area_description"]', 'Test work area');

    // Test work characteristics checkboxes
    console.log('Testing checkbox interactions...');

    // Click trenchless excavation checkbox (using ID selector for button role checkbox)
    await page.click('#work\\.is_trenchless');
    console.log('Checked trenchless excavation');

    // Click blasting checkbox
    await page.click('#work\\.is_blasting');
    console.log('Checked blasting/explosives');

    // Click site marked with white paint
    await page.click('#site\\.site_marked_white');
    console.log('Checked site marked with white paint');

    // Take screenshot showing checkboxes
    await page.screenshot({
      path: '/home/james/dev/811poc-revert/frontend/checkboxes-filled.png',
      fullPage: true
    });
  });
});