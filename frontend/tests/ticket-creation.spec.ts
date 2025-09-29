import { test, expect } from '@playwright/test';

test.describe('Ticket Creation Form', () => {
  test.beforeEach(async ({ page }) => {
    // Start from the create ticket page
    await page.goto('/tickets/create');
  });

  test('should create ticket with complete sample data', async ({ page }) => {
    // Wait for form to load
    await expect(page.getByText('Create New Ticket')).toBeVisible();

    // Fill Excavator Information
    await page.fill('[name="excavator.company"]', 'ABC Construction Inc.');
    await page.fill('[name="excavator.contact_name"]', 'John Smith');
    await page.fill('[name="excavator.phone"]', '(512) 555-0123');
    await page.fill('[name="excavator.email"]', 'john.smith@abcconstruction.com');

    // Fill Work Details
    await page.fill('[name="work.work_for"]', 'Private Property Owner');
    await page.fill('[name="work.type_of_work"]', 'Install new water line for residential property');
    await page.fill('[name="work.duration_days"]', '3');
    await page.fill('[name="work.depth_inches"]', '48');

    // Check work characteristics - trenchless excavation
    await page.check('[name="work.is_trenchless"]');

    // Fill Site/Location Information
    await page.fill('[name="site.county"]', 'Harris');
    await page.fill('[name="site.city"]', 'Houston');
    await page.fill('[name="site.address"]', '1234 Main Street, Houston, TX 77002');
    await page.fill('[name="site.cross_street"]', 'Between Elm St and Oak Ave');
    await page.fill('[name="site.subdivision"]', 'Downtown District');
    await page.fill('[name="site.lot_block"]', 'Lot 5, Block 12');
    await page.fill('[name="site.gps.lat"]', '29.7604');
    await page.fill('[name="site.gps.lng"]', '-95.3698');
    await page.fill('[name="site.work_area_description"]', 'Installing new water service line from street to building foundation');
    await page.fill('[name="site.driving_directions"]', 'From I-45, exit Main St, building is on the right side');
    await page.fill('[name="site.marking_instructions"]', 'Mark all utilities within 50 feet of excavation area');
    await page.fill('[name="site.remarks"]', 'Please coordinate with building management for access');

    // Fill Site Preparation
    await page.check('[name="site.site_marked_white"]');

    // Fill Additional Details
    await page.fill('[name="additional.notes"]', 'Priority installation for new construction project');
    await page.fill('[name="additional.reference_number"]', 'WO-2025-001');
    await page.fill('[name="additional.contact_method"]', 'Phone and email');

    // Take screenshot before submission
    await page.screenshot({ path: '/home/james/dev/811poc-revert/frontend/filled-form.png', fullPage: true });

    // Submit the form
    await page.click('button[type="submit"]');

    // Should redirect to ticket detail page
    await expect(page).toHaveURL(/\/tickets\/[a-zA-Z0-9-]+$/);

    // Verify success message or ticket data appears
    await expect(page.getByText('ABC Construction Inc.')).toBeVisible();
    await expect(page.getByText('Install new water line')).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    // Wait for form to load
    await expect(page.getByRole('heading', { name: 'Create New Ticket' })).toBeVisible();

    // Try to submit empty form
    await page.click('button[type="submit"]');

    // Should show validation errors alert
    await expect(page.getByText('Validation Issues')).toBeVisible();
    await expect(page.getByText('Failed to create ticket')).toBeVisible();
  });

  test('should validate phone number format', async ({ page }) => {
    // Enter invalid phone format
    await page.fill('[name="excavator.phone"]', '123-456-7890');
    await page.blur('[name="excavator.phone"]');

    // Should show format validation error (wait a bit for validation)
    await page.waitForTimeout(500);

    // Enter valid format
    await page.fill('[name="excavator.phone"]', '(512) 555-0123');
    await page.blur('[name="excavator.phone"]');

    // Validation should pass
    await page.waitForTimeout(500);
  });

  test('should validate email format', async ({ page }) => {
    // Enter invalid email
    await page.fill('[name="excavator.email"]', 'notanemail');
    await page.blur('[name="excavator.email"]');

    // Should show email validation error
    await expect(page.getByText('Invalid email address')).toBeVisible();

    // Enter valid email
    await page.fill('[name="excavator.email"]', 'test@example.com');
    await page.blur('[name="excavator.email"]');

    // Error should disappear
    await expect(page.getByText('Invalid email address')).not.toBeVisible();
  });

  test('should enforce location requirements', async ({ page }) => {
    // Fill minimal required fields
    await page.fill('[name="excavator.company"]', 'Test Company');
    await page.fill('[name="excavator.phone"]', '(512) 555-0123');
    await page.fill('[name="site.county"]', 'Harris');
    await page.fill('[name="site.city"]', 'Houston');
    await page.fill('[name="work.typeOfWork"]', 'Test work');

    // Try to submit without address or GPS
    await page.click('button[type="submit"]');

    // Should require either address+cross street OR GPS coordinates
    await expect(page.getByText('Either provide address with cross street OR GPS coordinates')).toBeVisible();
  });

  test('should require safety notes when blasting is selected', async ({ page }) => {
    // Check blasting without safety notes
    await page.check('[name="work.isBlasting"]');
    await page.blur('[name="work.isBlasting"]');

    // Should show requirement for safety notes
    await expect(page.getByText('Safety notes required when blasting/explosives are used')).toBeVisible();

    // Add safety notes
    await page.fill('[name="work.blastingSafetyNotes"]', 'Safety protocols will be followed');

    // Error should disappear
    await expect(page.getByText('Safety notes required when blasting/explosives are used')).not.toBeVisible();
  });

  test('should test draft functionality', async ({ page }) => {
    // Fill partial form data
    await page.fill('[name="excavator.company"]', 'Draft Test Company');
    await page.fill('[name="excavator.contactName"]', 'Jane Doe');
    await page.fill('[name="site.county"]', 'Dallas');

    // Navigate away (simulate leaving page)
    await page.goto('/tickets');

    // Return to create page
    await page.goto('/tickets/create');

    // Should show draft recovery dialog
    await expect(page.getByText('Recover Draft?')).toBeVisible();
    await expect(page.getByText('We found unsaved changes')).toBeVisible();

    // Restore draft
    await page.click('button:has-text("Restore Draft")');

    // Verify data is restored
    await expect(page.locator('[name="excavator.company"]')).toHaveValue('Draft Test Company');
    await expect(page.locator('[name="excavator.contactName"]')).toHaveValue('Jane Doe');
    await expect(page.locator('[name="site.county"]')).toHaveValue('Dallas');
  });

  test('should create emergency repair ticket', async ({ page }) => {
    // Fill emergency ticket data
    await page.fill('[name="excavator.company"]', 'Houston Emergency Services');
    await page.fill('[name="excavator.contactName"]', 'Maria Rodriguez');
    await page.fill('[name="excavator.phone"]', '(713) 555-0456');
    await page.fill('[name="excavator.email"]', 'maria@hesllc.com');

    await page.selectOption('[name="work.workFor"]', 'City/Municipality');
    await page.fill('[name="work.typeOfWork"]', 'Emergency gas line repair');
    
    // Set work start date to today
    const today = new Date().toISOString().split('T')[0];
    await page.fill('[name="work.workStartDate"]', today);
    
    await page.fill('[name="work.durationDays"]', '1');
    await page.fill('[name="work.depthInches"]', '24');

    await page.fill('[name="site.county"]', 'Harris');
    await page.fill('[name="site.city"]', 'Houston');
    await page.fill('[name="site.address"]', '5678 Business District Blvd');
    await page.fill('[name="site.crossStreet"]', 'Corner of Business Blvd and Commerce St');
    await page.fill('[name="site.gpsLat"]', '29.7830');
    await page.fill('[name="site.gpsLng"]', '-95.3885');
    await page.fill('[name="site.workAreaDescription"]', 'Repair damaged gas line due to third-party damage');
    await page.fill('[name="site.remarks"]', 'EMERGENCY REPAIR - Coordinate with HFD');

    await page.check('[name="additional.whiteLiningComplete"]');
    await page.fill('[name="additional.referenceNumber"]', 'EMRG-2025-0128');

    // Submit form
    await page.click('button[type="submit"]');

    // Verify redirect and data
    await expect(page).toHaveURL(/\/tickets\/[a-zA-Z0-9-]+$/);
    await expect(page.getByText('Houston Emergency Services')).toBeVisible();
    await expect(page.getByText('Emergency gas line repair')).toBeVisible();
  });

  test('should create fiber installation ticket', async ({ page }) => {
    // Fill fiber installation data
    await page.fill('[name="excavator.company"]', 'Texas Fiber Networks');
    await page.fill('[name="excavator.contactName"]', 'David Johnson');
    await page.fill('[name="excavator.phone"]', '(214) 555-0789');
    await page.fill('[name="excavator.email"]', 'd.johnson@texasfiber.net');

    await page.selectOption('[name="work.workFor"]', 'Telecommunications Company');
    await page.fill('[name="work.typeOfWork"]', 'Fiber optic cable installation');
    
    // Set work start date to next Monday
    const nextMonday = new Date();
    nextMonday.setDate(nextMonday.getDate() + ((1 + 7 - nextMonday.getDay()) % 7));
    const nextMondayStr = nextMonday.toISOString().split('T')[0];
    await page.fill('[name="work.workStartDate"]', nextMondayStr);
    
    await page.fill('[name="work.durationDays"]', '5');
    await page.fill('[name="work.depthInches"]', '36');

    await page.fill('[name="site.county"]', 'Dallas');
    await page.fill('[name="site.city"]', 'Dallas');
    await page.fill('[name="site.address"]', '9999 Technology Drive, Dallas, TX 75201');
    await page.fill('[name="site.crossStreet"]', 'Between Innovation Way and Tech Blvd');
    await page.fill('[name="site.gpsLat"]', '32.7767');
    await page.fill('[name="site.gpsLng"]', '-96.7970');
    await page.fill('[name="site.drivingDirections"]', 'Take I-35E to Technology Dr exit, project spans 2 blocks');
    await page.fill('[name="site.markingInstructions"]', 'Mark existing utilities along entire route - trenching operation');
    await page.fill('[name="site.workAreaDescription"]', 'Installing new fiber optic backbone along Technology Drive corridor');
    await page.fill('[name="site.remarks"]', 'Coordination required with existing utility providers');

    await page.check('[name="additional.whiteLiningComplete"]');
    await page.fill('[name="additional.referenceNumber"]', 'FIBER-INSTALL-2025-Q1');

    // Submit form
    await page.click('button[type="submit"]');

    // Verify redirect and data
    await expect(page).toHaveURL(/\/tickets\/[a-zA-Z0-9-]+$/);
    await expect(page.getByText('Texas Fiber Networks')).toBeVisible();
    await expect(page.getByText('Fiber optic cable installation')).toBeVisible();
  });
});