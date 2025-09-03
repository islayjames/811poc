const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://txgc.texas811.org/ui/login');
  await page.locator('input[name="username"]').click();
  await page.locator('input[name="username"]').fill('james.simmons@highpointe.tech');
  await page.locator('input[name="password"]').click();
  await page.locator('input[name="password"]').fill('jgr6dvc8XBK!kaf8qjv');
  await page.getByRole('checkbox', { name: 'I agree to terms & conditions' }).click();
  await page.getByRole('button', { name: 'Login' }).click();
  await page.goto('https://txgc.texas811.org/ui/dashboard');
  await page.locator('iframe[name="intercom-banner-frame"]').contentFrame().getByTestId('banner-contents').click();
  await page.locator('iframe[name="intercom-banner-frame"]').contentFrame().getByRole('button', { name: 'Close' }).click();
  await page.getByRole('treeitem', { name: 'Ticket Search' }).locator('div').first().click();
  await page.locator('.ng-untouched.ng-pristine.ng-valid.dx-show-invalid-badge.dx-textbox.dx-texteditor.dx-editor-outlined.dx-texteditor-empty.dx-widget.dx-state-hover > .dx-texteditor-container > .dx-texteditor-input-container > .dx-texteditor-input').click();
  await page.locator('.ng-untouched.ng-pristine.ng-valid.dx-show-invalid-badge.dx-textbox.dx-texteditor.dx-editor-outlined.dx-texteditor-empty.dx-widget.dx-state-hover > .dx-texteditor-container > .dx-texteditor-input-container > .dx-texteditor-input').fill('BRIGHT STAR SOLUTIONS');
  await page.locator('.ng-untouched.ng-pristine.ng-valid.dx-show-invalid-badge.dx-textbox.dx-texteditor.dx-editor-outlined.dx-texteditor-empty.dx-widget.dx-state-hover > .dx-texteditor-container > .dx-texteditor-input-container > .dx-texteditor-input').press('Enter');
  await page.locator('.ng-untouched.ng-pristine.ng-valid.dx-show-invalid-badge.dx-textbox.dx-texteditor.dx-editor-outlined.dx-texteditor-empty.dx-widget.dx-state-hover > .dx-texteditor-container > .dx-texteditor-input-container > .dx-texteditor-input').click();
  await page.locator('.ng-untouched.ng-pristine.ng-valid.dx-show-invalid-badge.dx-textbox.dx-texteditor.dx-editor-outlined.dx-texteditor-empty.dx-widget.dx-state-hover > .dx-texteditor-container > .dx-texteditor-input-container > .dx-texteditor-input').click();
  await page.getByLabel('Data grid with 21 rows and 19').locator('div').filter({ hasText: '02574581677Update09/02/2025' }).first().click();
  await page.getByRole('row', { name: '0 2574581677 Update 09/02/' }).getByRole('gridcell').first().click();
  await page.getByRole('menuitem', { name: 'Print ' }).locator('div').nth(1).click();
  const page1Promise = page.waitForEvent('popup');
  await page.getByText('Print with Positive Response').click();
  const page1 = await page1Promise;
  await page1.locator('#tickets').click();
  await page1.close();
  await page.getByRole('row', { name: '0 2574581593 Update 09/02/' }).getByRole('gridcell').first().click();
  await page.locator('.dx-item.dx-menu-item.dx-menu-item-has-text.dx-menu-item-has-submenu.dx-state-hover > div > .dx-menu-item-popout-container > .dx-menu-item-popout').click();
  const page2Promise = page.waitForEvent('popup');
  await page.getByText('Print with Positive Response').click();
  const page2 = await page2Promise;
  await page2.locator('#tickets').click();
  await page2.close();
  await page.getByRole('navigation', { name: 'Page Navigation' }).click();
  await page.getByRole('button', { name: 'Page 2' }).click();
  await page.getByRole('row', { name: '0 2574254555 Emergency 08/30/' }).getByRole('gridcell').first().click();
  await page.locator('.dx-item.dx-menu-item.dx-menu-item-has-text.dx-menu-item-has-submenu.dx-state-hover > div > .dx-menu-item-popout-container > .dx-menu-item-popout').click();
  const page3Promise = page.waitForEvent('popup');
  await page.getByText('Print with Positive Response').click();
  const page3 = await page3Promise;
  await page3.locator('#tickets').click();
  await page3.close();
  await page.getByRole('button', { name: 'mat-icons mi-menu' }).click();
  await page.getByRole('button', { name: 'mat-icons mi-menu' }).click();
  await page.getByRole('treeitem', { name: 'Home' }).locator('i').click();
  await page.getByRole('button', { name: 'mat-icons mi-arrow_drop_down' }).click();
  await page.getByText('Sign Out').click();
  await page.getByRole('button', { name: 'Yes' }).click();
  await page.close();

  // ---------------------
  await context.close();
  await browser.close();
})();
