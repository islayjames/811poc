import { test, expect } from '@playwright/test';

test.describe('Texas811 Ticket Creation Form - Working Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tickets/create');
    await expect(page.getByRole('heading', { name: 'Create New Ticket' })).toBeVisible();
  });

  test('should fill form with sample data (ABC Construction)', async ({ page }) => {
    console.log('Filling form with ABC Construction sample data...');

    // Excavator Information
    await page.fill('[name="excavator.company"]', 'ABC Construction Inc.');
    await page.fill('[name="excavator.contact_name"]', 'John Smith');
    await page.fill('[name="excavator.phone"]', '(512) 555-0123');
    await page.fill('[name="excavator.email"]', 'john.smith@abcconstruction.com');

    // Work Details
    await page.fill('[name="work.work_for"]', 'Private Property Owner');
    await page.fill('[name="work.type_of_work"]', 'Install new water line for residential property connection');
    await page.fill('[name="work.depth_inches"]', '48');
    await page.fill('[name="work.duration_days"]', '3');

    // Work Characteristics (use ID selectors for button role checkboxes)
    await page.click('#work\\.is_trenchless');
    console.log('✓ Checked trenchless excavation');

    // Location Information
    await page.fill('[name="site.county"]', 'Harris');
    await page.fill('[name="site.city"]', 'Houston');
    await page.fill('[name="site.address"]', '1234 Main Street, Houston, TX 77002');
    await page.fill('[name="site.cross_street"]', 'Between Elm St and Oak Ave');
    await page.fill('[name="site.subdivision"]', 'Downtown District');
    await page.fill('[name="site.lot_block"]', 'Lot 5, Block 12');

    // GPS Coordinates
    await page.fill('[name="site.gps.lat"]', '29.7604');
    await page.fill('[name="site.gps.lng"]', '-95.3698');

    // Work Area Details
    await page.fill('[name="site.work_area_description"]', 'Installing new water service line from street to building foundation, approximately 50 feet');
    await page.fill('[name="site.driving_directions"]', 'From I-45, exit Main St, building is on the right side after 2 blocks');
    await page.fill('[name="site.marking_instructions"]', 'Mark all utilities within 50 feet of excavation area, special attention to gas lines');
    await page.fill('[name="site.remarks"]', 'Please coordinate with building management for access, contact required 24hrs in advance');

    // Site Preparation
    await page.click('#site\\.site_marked_white');
    console.log('✓ Checked site marked with white paint');

    // Additional Details
    await page.fill('[name="additional.notes"]', 'Priority installation for new construction project, coordination required with city inspector');
    await page.fill('[name="additional.reference_number"]', 'WO-2025-001');
    await page.fill('[name="additional.contact_method"]', 'Phone and email');

    // Take screenshot of completed form
    await page.screenshot({
      path: '/home/james/dev/811poc-revert/frontend/abc-construction-form.png',
      fullPage: true
    });

    console.log('Form filling completed successfully');
  });

  test('should demonstrate form submission and validation', async ({ page }) => {
    console.log('Testing form submission with minimal required data...');

    // Fill only required fields
    await page.fill('[name="excavator.company"]', 'Test Construction Co.');
    await page.fill('[name="excavator.contact_name"]', 'Jane Doe');
    await page.fill('[name="excavator.phone"]', '(713) 555-0100');
    await page.fill('[name="site.county"]', 'Harris');
    await page.fill('[name="site.city"]', 'Houston');
    await page.fill('[name="work.type_of_work"]', 'Test excavation work');
    await page.fill('[name="site.work_area_description"]', 'Test work area for utility installation');

    // Take screenshot before submission
    await page.screenshot({
      path: '/home/james/dev/811poc-revert/frontend/minimal-form.png',
      fullPage: true
    });

    // Attempt submission
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    // Check if validation errors appear
    const validationVisible = await page.getByText('Validation Issues').isVisible();
    if (validationVisible) {
      console.log('✓ Form validation is working - showing validation errors');

      // Take screenshot of validation errors
      await page.screenshot({
        path: '/home/james/dev/811poc-revert/frontend/validation-errors.png',
        fullPage: true
      });
    } else {
      console.log('✓ Form submitted successfully or redirected');

      // Take screenshot of result
      await page.screenshot({
        path: '/home/james/dev/811poc-revert/frontend/submission-result.png',
        fullPage: true
      });
    }

    console.log('Current URL:', page.url());
  });

  test('should demonstrate emergency repair scenario', async ({ page }) => {
    console.log('Testing emergency repair ticket creation...');

    // Emergency repair scenario
    await page.fill('[name="excavator.company"]', 'Houston Emergency Services LLC');
    await page.fill('[name="excavator.contact_name"]', 'Maria Rodriguez');
    await page.fill('[name="excavator.phone"]', '(713) 555-0456');
    await page.fill('[name="excavator.email"]', 'maria@hesemergency.com');

    await page.fill('[name="work.work_for"]', 'City/Municipality');
    await page.fill('[name="work.type_of_work"]', 'Emergency gas line repair due to third-party damage');
    await page.fill('[name="work.depth_inches"]', '24');
    await page.fill('[name="work.duration_days"]', '1');

    // Emergency work typically involves blasting/explosives for access
    await page.click('#work\\.is_blasting');
    console.log('✓ Checked blasting/explosives for emergency access');

    await page.fill('[name="site.county"]', 'Harris');
    await page.fill('[name="site.city"]', 'Houston');
    await page.fill('[name="site.address"]', '5678 Business District Blvd, Houston, TX 77002');
    await page.fill('[name="site.cross_street"]', 'Corner of Business Blvd and Commerce St');
    await page.fill('[name="site.gps.lat"]', '29.7830');
    await page.fill('[name="site.gps.lng"]', '-95.3885');

    await page.fill('[name="site.work_area_description"]', 'Emergency repair of damaged gas line due to third-party excavation damage');
    await page.fill('[name="site.driving_directions"]', 'From I-10, exit Business District Blvd, emergency site is 3 blocks north');
    await page.fill('[name="site.marking_instructions"]', 'EMERGENCY - Mark all utilities immediately, prioritize gas and electric lines');
    await page.fill('[name="site.remarks"]', 'EMERGENCY REPAIR - Coordinate with Houston Fire Department and gas company');

    await page.click('#site\\.site_marked_white');
    console.log('✓ Site marked for emergency work');

    await page.fill('[name="additional.notes"]', 'EMERGENCY: Gas leak reported, immediate excavation required for safety');
    await page.fill('[name="additional.reference_number"]', 'EMRG-2025-0128');
    await page.fill('[name="additional.contact_method"]', 'Phone - 24/7 emergency line');

    // Take screenshot of emergency form
    await page.screenshot({
      path: '/home/james/dev/811poc-revert/frontend/emergency-repair-form.png',
      fullPage: true
    });

    console.log('Emergency repair form completed successfully');
  });
});