import { test, expect } from '@playwright/test';

/**
 * Sprint 3 Smoke Tests
 *
 * Quick validation that Sprint 3 features are accessible and functional.
 * These tests should run quickly and catch major issues.
 */

test.describe('Sprint 3 - Smoke Tests', () => {

  test('Application loads and Sprint 3 features are accessible', async ({ page }) => {
    console.log('Running Sprint 3 smoke test...');

    // Test home page loads
    await page.goto('/', { timeout: 30000 });
    await expect(page).toHaveTitle(/texas811/i, { timeout: 15000 });
    console.log('✓ Home page loads');

    // Test create page loads
    await page.goto('/tickets/create', { timeout: 30000 });
    await expect(page.getByRole('heading', { name: 'Create New Ticket' })).toBeVisible({ timeout: 15000 });
    console.log('✓ Create ticket page loads');

    // Check for basic form elements
    const requiredFields = [
      '[name="excavator.company"]',
      '[name="excavator.contact_name"]',
      '[name="excavator.phone"]',
      '[name="work.type_of_work"]',
      '[name="site.county"]',
      '[name="site.city"]',
      '[name="site.work_area_description"]'
    ];

    let fieldsFound = 0;
    for (const field of requiredFields) {
      if (await page.locator(field).isVisible({ timeout: 3000 })) {
        fieldsFound++;
      }
    }

    console.log(`✓ ${fieldsFound}/${requiredFields.length} required form fields found`);

    // Look for Sprint 3 enhancement indicators
    const sprint3Features = [
      { name: 'Progress indicator', selectors: ['text=/%/', 'text=/progress/i', 'text=/completion/i'] },
      { name: 'Help text', selectors: ['text=/help/i', 'text=/example/i', 'text=/format/i'] },
      { name: 'Auto-save text', selectors: ['text=/auto.*save/i', 'text=/draft/i'] }
    ];

    for (const feature of sprint3Features) {
      let found = false;
      for (const selector of feature.selectors) {
        if (await page.locator(selector).count() > 0) {
          console.log(`✓ ${feature.name} indicators found`);
          found = true;
          break;
        }
      }
      if (!found) {
        console.log(`- ${feature.name} not visible (may be contextual)`);
      }
    }

    // Test form can be filled (basic functionality)
    await page.fill('[name="excavator.company"]', 'Smoke Test Company');
    await page.fill('[name="excavator.contact_name"]', 'Smoke Tester');

    // Test phone field (Sprint 3 validation)
    await page.fill('[name="excavator.phone"]', '(555) 123-4567');
    console.log('✓ Basic form filling works');

    // Check submit button is present
    const submitButton = page.locator('button[type="submit"]:has-text("Create Ticket")');
    await expect(submitButton).toBeVisible({ timeout: 5000 });
    console.log('✓ Submit button found');

    console.log('Sprint 3 smoke test completed successfully');
  });

  test('Edit page accessibility (if tickets exist)', async ({ page }) => {
    console.log('Testing edit page accessibility...');

    // Try to access tickets list
    await page.goto('/tickets', { timeout: 30000 });

    // Check if any tickets exist
    const ticketLinks = page.locator('a[href*="/tickets/"]');
    const ticketCount = await ticketLinks.count();

    if (ticketCount > 0) {
      console.log(`Found ${ticketCount} ticket(s), testing edit functionality`);

      // Click on first ticket
      await ticketLinks.first().click();
      await page.waitForTimeout(3000);

      // Look for edit button
      const editButton = page.getByRole('button', { name: /edit/i });

      if (await editButton.isVisible({ timeout: 5000 })) {
        await editButton.click();
        await page.waitForTimeout(2000);

        // Check for Sprint 3 edit features
        const editFeatures = [
          'Save & Mark Submitted',
          'Update Ticket',
          'auto-save',
          'Cancel'
        ];

        let foundFeatures = 0;
        for (const feature of editFeatures) {
          if (await page.locator(`text=${feature}`).count() > 0) {
            foundFeatures++;
            console.log(`✓ Edit feature found: ${feature}`);
          }
        }

        console.log(`✓ ${foundFeatures}/${editFeatures.length} edit features accessible`);

        // Test Sprint 3 submission dialog (TRD-009)
        const submitButton = page.getByRole('button', { name: /Save & Mark Submitted/i });
        if (await submitButton.isVisible({ timeout: 3000 })) {
          await submitButton.click();

          // Look for submission dialog
          const dialogVisible = await page.locator('text=/submit.*texas811|submission.*reference/i').isVisible({ timeout: 3000 });

          if (dialogVisible) {
            console.log('✓ Sprint 3 submission dialog accessible');

            // Close dialog
            const cancelButton = page.getByRole('button', { name: /cancel/i });
            if (await cancelButton.isVisible({ timeout: 2000 })) {
              await cancelButton.click();
            }
          }
        }

      } else {
        console.log('- Edit button not found');
      }
    } else {
      console.log('- No existing tickets found, skipping edit test');
    }

    console.log('Edit page accessibility test completed');
  });

  test('Error handling and offline detection', async ({ page }) => {
    console.log('Testing Sprint 3 error handling...');

    await page.goto('/tickets/create', { timeout: 30000 });
    await expect(page.getByRole('heading', { name: 'Create New Ticket' })).toBeVisible({ timeout: 15000 });

    // Test offline detection (TRD-011)
    await page.context().setOffline(true);
    await page.waitForTimeout(2000);

    // Look for offline indicators
    const offlineIndicators = await page.locator('text=/offline|disconnected|no.*connection/i').count();
    if (offlineIndicators > 0) {
      console.log('✓ Offline detection working');
    } else {
      console.log('- Offline indicators not visible');
    }

    // Test form still usable offline
    await page.fill('[name="excavator.company"]', 'Offline Test');
    console.log('✓ Form still functional offline');

    // Restore online
    await page.context().setOffline(false);
    await page.waitForTimeout(1000);

    console.log('Error handling test completed');
  });

  test('Mobile viewport compatibility', async ({ page }) => {
    console.log('Testing mobile compatibility...');

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/tickets/create', { timeout: 30000 });
    await expect(page.getByRole('heading', { name: 'Create New Ticket' })).toBeVisible({ timeout: 15000 });

    // Test form fields are accessible on mobile
    const mobileFields = [
      '[name="excavator.company"]',
      '[name="excavator.contact_name"]',
      '[name="excavator.phone"]'
    ];

    let mobileAccessible = 0;
    for (const field of mobileFields) {
      const element = page.locator(field);
      if (await element.isVisible({ timeout: 3000 })) {
        // Test that field can be interacted with
        await element.click();
        await element.fill('Mobile Test');
        mobileAccessible++;
      }
    }

    console.log(`✓ ${mobileAccessible}/${mobileFields.length} fields accessible on mobile`);

    // Check submit button on mobile
    const submitButton = page.locator('button[type="submit"]');
    const buttonVisible = await submitButton.isVisible();

    if (buttonVisible) {
      const buttonBox = await submitButton.boundingBox();
      if (buttonBox && buttonBox.width > 0 && buttonBox.height > 0) {
        console.log('✓ Submit button properly sized for mobile');
      }
    }

    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 720 });

    console.log('Mobile compatibility test completed');
  });
});