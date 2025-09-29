import { test, expect } from '@playwright/test';

/**
 * Sprint 2 E2E Tests - Complete Create→Edit→Update Workflow
 *
 * This test suite validates the complete end-to-end workflow for Sprint 2:
 * 1. Complete Create Flow
 * 2. Edit Navigation
 * 3. Edit Functionality with auto-save
 * 4. API-to-UI Workflow (simulating CustomGPT creation)
 *
 * Tests use the actual form field names (snake_case) as defined in the form components.
 */

test.describe('Sprint 2 - Complete Create→Edit→Update Workflow', () => {

  test.beforeEach(async ({ page }) => {
    // Ensure we're starting from a clean state
    await page.goto('/');
  });

  test('Complete Create Flow - All Required Fields', async ({ page }) => {
    // Navigate to create page
    await page.goto('/tickets/create');
    await expect(page.getByRole('heading', { name: 'Create New Ticket' })).toBeVisible();

    // Fill Excavator Information section
    await page.fill('[name="excavator.company"]', 'ABC Construction Inc.');
    await page.fill('[name="excavator.contact_name"]', 'John Smith');
    await page.fill('[name="excavator.phone"]', '(512) 555-0123');
    await page.fill('[name="excavator.email"]', 'john.smith@abcconstruction.com');

    // Fill Work Details section
    await page.fill('[name="work.work_for"]', 'Private Property Owner');
    await page.fill('[name="work.type_of_work"]', 'Install new water line for residential property');
    await page.fill('[name="work.duration_days"]', '3');
    await page.fill('[name="work.depth_inches"]', '48');

    // Set work characteristics (custom checkboxes need click, not check)
    await page.click('#work\\.is_trenchless');
    // Don't check blasting to avoid additional requirements

    // Fill Location Information section (all fields)
    await page.fill('[name="site.county"]', 'Harris');
    await page.fill('[name="site.city"]', 'Houston');
    await page.fill('[name="site.address"]', '1234 Main Street');
    await page.fill('[name="site.cross_street"]', 'Between Elm St and Oak Ave');
    await page.fill('[name="site.subdivision"]', 'Downtown District');
    await page.fill('[name="site.lot_block"]', 'Lot 5, Block 12');

    // GPS coordinates (Texas location)
    await page.fill('[name="site.gps.lat"]', '29.7604');
    await page.fill('[name="site.gps.lng"]', '-95.3698');

    // Required work area description
    await page.fill('[name="site.work_area_description"]', 'Installing new water service line from street to building foundation. Excavation will be approximately 50 feet long, 2 feet wide, and 4 feet deep.');

    // Optional fields
    await page.fill('[name="site.driving_directions"]', 'From I-45, exit Main St, building is on the right side');
    await page.fill('[name="site.marking_instructions"]', 'Mark all utilities within 50 feet of excavation area');
    await page.fill('[name="site.remarks"]', 'Please coordinate with building management for access');

    // Site preparation (custom checkbox needs click, not check)
    await page.click('#site\\.site_marked_white');

    // Verify form is filled before submission
    await expect(page.locator('[name="excavator.company"]')).toHaveValue('ABC Construction Inc.');
    await expect(page.locator('[name="site.county"]')).toHaveValue('Harris');
    await expect(page.locator('[name="site.work_area_description"]')).toHaveValue(/Installing new water service line/);

    // Submit the form
    const submitButton = page.locator('button[type="submit"]:has-text("Create Ticket")');
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // Should redirect to ticket detail page
    await expect(page).toHaveURL(/\/tickets\/[a-zA-Z0-9-]+$/);

    // Verify success - should see the created ticket data
    await expect(page.getByText('ABC Construction Inc.')).toBeVisible();
    await expect(page.getByText(/Install new water line/)).toBeVisible();
  });

  test('Edit Navigation - From Detail to Edit Page', async ({ page }) => {
    // First create a ticket to edit
    await page.goto('/tickets/create');
    await expect(page.getByRole('heading', { name: 'Create New Ticket' })).toBeVisible();

    // Fill minimal required fields
    await page.fill('[name="excavator.company"]', 'Edit Test Company');
    await page.fill('[name="excavator.contact_name"]', 'Jane Doe');
    await page.fill('[name="excavator.phone"]', '(713) 555-0123');
    await page.fill('[name="work.work_for"]', 'Test Work');
    await page.fill('[name="work.type_of_work"]', 'Test excavation work');
    await page.fill('[name="site.county"]', 'Harris');
    await page.fill('[name="site.city"]', 'Houston');
    await page.fill('[name="site.work_area_description"]', 'Test work area description');

    // Submit to create the ticket
    await page.click('button[type="submit"]:has-text("Create Ticket")');
    await expect(page).toHaveURL(/\/tickets\/[a-zA-Z0-9-]+$/);

    // Now test the edit navigation
    const editButton = page.getByRole('button', { name: /edit/i });
    await expect(editButton).toBeVisible();
    await editButton.click();

    // Should navigate to edit page
    await expect(page).toHaveURL(/\/tickets\/[a-zA-Z0-9-]+\/edit$/);
    await expect(page.getByText('Edit Ticket')).toBeVisible();

    // Verify data is pre-populated correctly
    await expect(page.locator('[name="excavator.company"]')).toHaveValue('Edit Test Company');
    await expect(page.locator('[name="excavator.contact_name"]')).toHaveValue('Jane Doe');
    await expect(page.locator('[name="site.county"]')).toHaveValue('Harris');
    await expect(page.locator('[name="site.city"]')).toHaveValue('Houston');
  });

  test('Edit Functionality - Modify Fields and Save', async ({ page }) => {
    // Create a ticket first
    await page.goto('/tickets/create');

    // Fill initial data
    await page.fill('[name="excavator.company"]', 'Original Company');
    await page.fill('[name="excavator.contact_name"]', 'Original Contact');
    await page.fill('[name="excavator.phone"]', '(512) 555-0001');
    await page.fill('[name="excavator.email"]', 'original@example.com');
    await page.fill('[name="work.work_for"]', 'Original Work For');
    await page.fill('[name="work.type_of_work"]', 'Original work description');
    await page.fill('[name="site.county"]', 'Original County');
    await page.fill('[name="site.city"]', 'Original City');
    await page.fill('[name="site.address"]', 'Original Address');
    await page.fill('[name="site.work_area_description"]', 'Original work area description');

    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/tickets\/[a-zA-Z0-9-]+$/);

    // Navigate to edit
    await page.click('button:has-text("Edit")');
    await expect(page).toHaveURL(/\/tickets\/[a-zA-Z0-9-]+\/edit$/);

    // Modify multiple fields
    await page.fill('[name="excavator.company"]', 'Updated Company');
    await page.fill('[name="excavator.contact_name"]', 'Updated Contact');
    await page.fill('[name="excavator.email"]', 'updated@example.com');
    await page.fill('[name="work.type_of_work"]', 'Updated work description with more details');
    await page.fill('[name="site.county"]', 'Updated County');
    await page.fill('[name="site.address"]', 'Updated Address 123');
    await page.fill('[name="site.cross_street"]', 'Updated Cross Street');

    // Test manual save
    const updateButton = page.locator('button[type="submit"]:has-text("Update Ticket")');
    await expect(updateButton).toBeEnabled();
    await updateButton.click();

    // Should redirect back to detail page
    await expect(page).toHaveURL(/\/tickets\/[a-zA-Z0-9-]+$/);

    // Verify updates are visible on detail page
    await expect(page.getByText('Updated Company')).toBeVisible();
    await expect(page.getByText('Updated Contact')).toBeVisible();
    await expect(page.getByText(/Updated work description/)).toBeVisible();
  });

  test('Auto-Save Features - Status Updates and Save Now', async ({ page }) => {
    // Create and navigate to edit
    await page.goto('/tickets/create');

    await page.fill('[name="excavator.company"]', 'Auto Save Test Company');
    await page.fill('[name="excavator.contact_name"]', 'Auto Save Contact');
    await page.fill('[name="excavator.phone"]', '(713) 555-9999');
    await page.fill('[name="work.work_for"]', 'Auto Save Work');
    await page.fill('[name="work.type_of_work"]', 'Auto save test work');
    await page.fill('[name="site.county"]', 'Test County');
    await page.fill('[name="site.city"]', 'Test City');
    await page.fill('[name="site.work_area_description"]', 'Auto save test area');

    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/tickets\/[a-zA-Z0-9-]+$/);

    // Navigate to edit mode
    await page.click('button:has-text("Edit")');
    await expect(page).toHaveURL(/\/tickets\/[a-zA-Z0-9-]+\/edit$/);

    // Make a change to trigger auto-save
    await page.fill('[name="excavator.company"]', 'Auto Save Updated Company');

    // Wait for auto-save status to appear (auto-save is enabled in edit mode)
    await expect(page.getByText(/Auto-save every 30 seconds/)).toBeVisible();

    // Look for "Save Now" button when there are unsaved changes
    const saveNowButton = page.locator('button:has-text("Save Now")');

    // The button should appear when there are unsaved changes
    await expect(saveNowButton).toBeVisible();

    // Click Save Now to manually trigger save
    await saveNowButton.click();

    // Wait for save indication
    await expect(page.getByText(/Draft saved/)).toBeVisible({ timeout: 10000 });

    // Test Save Draft functionality
    await page.fill('[name="site.remarks"]', 'Draft save test remarks');

    const saveDraftButton = page.locator('button:has-text("Save Draft")');
    await expect(saveDraftButton).toBeVisible();
    await saveDraftButton.click();

    // Should show some indication of draft being saved
    await page.waitForTimeout(1000); // Allow time for save operation
  });

  test('API-to-UI Workflow - CustomGPT Creation Simulation', async ({ page }) => {
    // Simulate creating a ticket via API (like CustomGPT would do)
    // This represents the workflow where CustomGPT creates a ticket with partial data
    // and the user completes it via the UI

    // Create API request to simulate CustomGPT ticket creation
    const apiResponse = await page.request.post('/api/tickets', {
      data: {
        excavator: {
          company: 'CustomGPT Created Company',
          contact_name: 'API Created Contact',
          phone: '(555) 123-0000',
          email: 'api@customgpt.com'
        },
        work: {
          work_for: 'Municipality',
          type_of_work: 'Fiber optic cable installation via API',
          duration_days: 5,
          depth_inches: 36
        },
        site: {
          county: 'Dallas',
          city: 'Dallas',
          address: '1234 API Street',
          // Missing some required fields intentionally
          work_area_description: 'API-created work area requiring completion'
        },
        additional: {
          notes: 'Created via CustomGPT API simulation'
        }
      }
    });

    // Skip this test if API is not available (we're in mock mode or backend is down)
    if (!apiResponse.ok()) {
      console.log('Skipping API test - backend not available or in mock mode');
      test.skip();
      return;
    }

    const responseData = await apiResponse.json();

    // Navigate to the created ticket's edit page
    const ticketId = responseData.ticket_id;
    expect(ticketId).toBeTruthy();

    await page.goto(`/tickets/${ticketId}/edit`);
    await expect(page.getByText('Edit Ticket')).toBeVisible();

    // Verify API-created data is pre-populated
    await expect(page.locator('[name="excavator.company"]')).toHaveValue('CustomGPT Created Company');
    await expect(page.locator('[name="excavator.contact_name"]')).toHaveValue('API Created Contact');
    await expect(page.locator('[name="work.type_of_work"]')).toHaveValue('Fiber optic cable installation via API');
    await expect(page.locator('[name="site.county"]')).toHaveValue('Dallas');

    // Complete the missing required fields
    await page.fill('[name="site.cross_street"]', 'Between API Ave and GPT Blvd');
    await page.fill('[name="site.gps.lat"]', '32.7767');
    await page.fill('[name="site.gps.lng"]', '-96.7970');
    await page.fill('[name="site.driving_directions"]', 'Take API highway to GPT exit');
    await page.fill('[name="site.marking_instructions"]', 'Mark utilities for API installation');

    // Add site preparation
    await page.click('#site\\.site_marked_white');

    // Save the completed ticket
    await page.click('button[type="submit"]:has-text("Update Ticket")');

    // Should redirect to detail page
    await expect(page).toHaveURL(/\/tickets\/[a-zA-Z0-9-]+$/);

    // Verify both API data and user-completed data are present
    await expect(page.getByText('CustomGPT Created Company')).toBeVisible();
    await expect(page.getByText('API Created Contact')).toBeVisible();
    await expect(page.getByText(/Fiber optic cable installation/)).toBeVisible();
    await expect(page.getByText(/Between API Ave and GPT Blvd/)).toBeVisible();
  });

  test('Error Handling and Loading States', async ({ page }) => {
    // Test edit page loading states and error handling

    // Try to access edit page for non-existent ticket
    await page.goto('/tickets/non-existent-ticket-id/edit');

    // Should show error state
    await expect(page.getByText('Error Loading Ticket')).toBeVisible();
    await expect(page.getByText(/could not be found/)).toBeVisible();

    // Test retry functionality
    const retryButton = page.getByRole('button', { name: /retry/i });
    await expect(retryButton).toBeVisible();

    // Test back to list functionality
    const backButton = page.getByRole('button', { name: /back to list/i });
    await expect(backButton).toBeVisible();
    await backButton.click();

    await expect(page).toHaveURL('/tickets');
  });

  test('Form Validation in Edit Mode', async ({ page }) => {
    // Create a valid ticket first
    await page.goto('/tickets/create');

    await page.fill('[name="excavator.company"]', 'Validation Test Company');
    await page.fill('[name="excavator.contact_name"]', 'Validation Contact');
    await page.fill('[name="excavator.phone"]', '(555) 123-4567');
    await page.fill('[name="work.work_for"]', 'Validation Work');
    await page.fill('[name="work.type_of_work"]', 'Validation test work');
    await page.fill('[name="site.county"]', 'Test County');
    await page.fill('[name="site.city"]', 'Test City');
    await page.fill('[name="site.work_area_description"]', 'Validation test area');

    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/tickets\/[a-zA-Z0-9-]+$/);

    // Navigate to edit
    await page.click('button:has-text("Edit")');
    await expect(page).toHaveURL(/\/tickets\/[a-zA-Z0-9-]+\/edit$/);

    // Test validation by clearing required fields
    await page.fill('[name="excavator.company"]', '');
    await page.fill('[name="excavator.contact_name"]', '');
    await page.fill('[name="site.county"]', '');

    // Try to submit with missing required fields
    await page.click('button[type="submit"]:has-text("Update Ticket")');

    // Should show validation errors
    await expect(page.getByText('Validation Issues')).toBeVisible();

    // Test phone validation
    await page.fill('[name="excavator.phone"]', 'invalid-phone');
    await page.blur('[name="excavator.phone"]');

    // Wait for validation to trigger
    await page.waitForTimeout(500);

    // Fix the phone format
    await page.fill('[name="excavator.phone"]', '(555) 123-4567');

    // Test email validation
    await page.fill('[name="excavator.email"]', 'invalid-email');
    await page.blur('[name="excavator.email"]');

    // Should show email validation error
    await expect(page.getByText('Invalid email')).toBeVisible({ timeout: 5000 });

    // Fix email format
    await page.fill('[name="excavator.email"]', 'valid@example.com');
    await page.blur('[name="excavator.email"]');

    // Error should disappear
    await expect(page.getByText('Invalid email')).not.toBeVisible();
  });

  test('Navigation Breadcrumbs and Cancel Functionality', async ({ page }) => {
    // Create a ticket to edit
    await page.goto('/tickets/create');

    await page.fill('[name="excavator.company"]', 'Navigation Test Company');
    await page.fill('[name="excavator.contact_name"]', 'Nav Contact');
    await page.fill('[name="excavator.phone"]', '(555) 555-5555');
    await page.fill('[name="work.work_for"]', 'Navigation Work');
    await page.fill('[name="work.type_of_work"]', 'Navigation test work');
    await page.fill('[name="site.county"]', 'Nav County');
    await page.fill('[name="site.city"]', 'Nav City');
    await page.fill('[name="site.work_area_description"]', 'Navigation test area');

    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/tickets\/[a-zA-Z0-9-]+$/);

    // Navigate to edit
    await page.click('button:has-text("Edit")');
    await expect(page).toHaveURL(/\/tickets\/[a-zA-Z0-9-]+\/edit$/);

    // Test breadcrumb navigation
    await expect(page.getByText('Tickets')).toBeVisible();
    await expect(page.getByText('Edit')).toBeVisible();

    // Test cancel without changes
    const cancelButton = page.getByRole('button', { name: /cancel/i });
    await expect(cancelButton).toBeVisible();
    await cancelButton.click();

    // Should navigate back to detail page
    await expect(page).toHaveURL(/\/tickets\/[a-zA-Z0-9-]+$/);

    // Go back to edit and make changes
    await page.click('button:has-text("Edit")');
    await page.fill('[name="excavator.company"]', 'Changed Company Name');

    // Test cancel with unsaved changes
    await page.click('button:has-text("Cancel")');

    // Should show unsaved changes dialog
    await expect(page.getByText('Unsaved Changes')).toBeVisible();
    await expect(page.getByText(/Your changes will be lost/)).toBeVisible();

    // Test continue editing
    await page.click('button:has-text("Continue Editing")');
    await expect(page.locator('[name="excavator.company"]')).toHaveValue('Changed Company Name');

    // Test discard changes
    await page.click('button:has-text("Cancel")');
    await page.click('button:has-text("Discard Changes")');

    // Should navigate back to detail page
    await expect(page).toHaveURL(/\/tickets\/[a-zA-Z0-9-]+$/);

    // Original data should be preserved
    await expect(page.getByText('Navigation Test Company')).toBeVisible();
  });

});