const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  // START LOGIN
  await page.goto('https://txgc.texas811.org/ui/login');
  await page.locator('input[name="username"]').click();
  await page.locator('input[name="username"]').fill('james.simmons@highpointe.tech');
  await page.locator('input[name="password"]').click();
  await page.locator('input[name="password"]').fill('jgr6dvc8XBK!kaf8qjv');
  await page.getByRole('checkbox', { name: 'I agree to terms & conditions' }).click();
  await page.getByRole('button', { name: 'Login' }).click();
  await page.goto('https://txgc.texas811.org/ui/dashboard');
  // END LOGIN
  // START FILTER TICKETS
  await page.getByText('Ticket Search').click();
  await page.getByRole('checkbox', { name: ' My Tickets' }).click();
  await page.locator('.ng-untouched.ng-pristine.ng-valid.dx-show-invalid-badge.dx-textbox.dx-texteditor.dx-editor-outlined.dx-texteditor-empty.dx-widget.dx-state-hover > .dx-texteditor-container > .dx-texteditor-input-container > .dx-texteditor-input').click();
  await page.locator('.ng-untouched.ng-pristine.ng-valid.dx-show-invalid-badge.dx-textbox.dx-texteditor.dx-editor-outlined.dx-texteditor-empty.dx-widget.dx-state-hover > .dx-texteditor-container > .dx-texteditor-input-container > .dx-texteditor-input').fill('BRIGHT STAR SOLUTIONS');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  // END FILTER TICKETS
  // START PRINT ALL TICKETS
  // START PRINTING PAGE OF TICKETS
  await page.getByLabel('Data grid with 21 rows and 19').locator('div').filter({ hasText: '02574581677Update09/02/2025' }).first().click(); // This is the grid of tickets (one page worth); need to extract the items in this list and then iterate through each one
  // START PRINT SINGLE TICKET
  await page.getByRole('row', { name: '0 2574581677 Update 09/02/' }).getByRole('gridcell').first().click(); // Select a ticket from the list
  await page.getByRole('menuitem', { name: 'Print ' }).locator('div').nth(1).click();  // Reference the print dropdown menu at the top of the list
  const page1Promise = page.waitForEvent('popup');
  await page.getByText('Print with Positive Response').click(); // Chose the "Print with Positive Response" option
  const page1 = await page1Promise; // Will open a new page with a clean table for scraping
  await page1.locator('#tickets').click(); // *** This is the table of full ticket data; need to extract multiple fields from this table
  await page1.close(); // Close the print ticket page that opened
  // END PRINT SINGLE TICKET
  // START PRINT SINGLE TICKET
  await page.getByRole('row', { name: '0 2574581593 Update 09/02/' }).getByRole('gridcell').first().click(); // Select another ticket from the list
  await page.locator('.dx-item.dx-menu-item.dx-menu-item-has-text.dx-menu-item-has-submenu.dx-state-hover > div > .dx-menu-item-popout-container > .dx-menu-item-popout').click(); // Another way to reference the print dropdown menu at the top of the list
  const page2Promise = page.waitForEvent('popup');
  await page.getByText('Print with Positive Response').click(); // Chose the "Print with Positive Response" option
  const page2 = await page2Promise; // Will open a new page with a clean table for scraping
  await page2.locator('#tickets').click(); // *** This is the table of full ticket data; need to extract multiple fields from this table
  await page2.close(); // Close the print ticket page that opened
  // END PRINT SINGLE TICKET

  await page.getByRole('navigation', { name: 'Page Navigation' }).click(); // Reference the page navigation bar at the bottom of the list; no "next page" button, just one button per page of results; will need to review this control to get the total number of pages
  await page.getByRole('button', { name: 'Page 2' }).click(); // Click the page number to go to
  // END PRINTING PAGE OF TICKETS
  // START PRINTING PAGE OF TICKETS
  await page.getByLabel('Data grid with 21 rows and 19').locator('div').filter({ hasText: '02574563173Normal09/02/2025' }).first().click();  // This is the grid of tickets (one page worth); need to extract the items in this list and then iterate through each one
  // START PRINT SINGLE TICKET
  await page.getByRole('row', { name: '0 2574563173 Normal 09/02/' }).getByRole('gridcell').first().click(); // Reference the print dropdown menu at the top of the list on the second page
  await page.locator('.dx-item.dx-menu-item.dx-menu-item-has-text.dx-menu-item-has-submenu.dx-state-hover > div > .dx-menu-item-popout-container > .dx-menu-item-popout').click(); // Another way to reference the print dropdown menu at the top of the list
  const page2Promise = page.waitForEvent('popup'); // I don't know how this got captured - but leaving it in case it was a bug/error condition of the page
  const page3Promise = page.waitForEvent('popup');
  await page.getByText('Print with Positive Response').click(); // Chose the "Print with Positive Response" option
  const page3 = await page3Promise;  // Will open a new page with a clean table for scraping
  await page3.locator('#tickets').click(); //*** This is the table of full ticket data; need to extract multiple fields from this table
  await page3.close(); // Close the print ticket page that opened
  // END PRINT SINGLE TICKET
  await page.getByRole('button', { name: 'Page 3' }).click(); // Navigating to the next page
  // END PRINTING PAGE OF TICKETS
  // START PRINTING PAGE OF TICKETS
  await page.getByLabel('Data grid with 21 rows and 19').locator('div').filter({ hasText: '02574144994Emergency08/29/' }).first().click(); // This is the grid of tickets (one page worth); need to extract the items in this list and then iterate through each one
  // START PRINT SINGLE TICKET
  await page.getByRole('gridcell', { name: '0', exact: true }).nth(1).click(); // Select a ticket from the list
  await page.locator('.dx-item.dx-menu-item.dx-menu-item-has-text.dx-menu-item-has-submenu.dx-state-hover > div > .dx-menu-item-popout-container > .dx-menu-item-popout').click(); // Reference the print dropdown menu at the top of the list
  const page4Promise = page.waitForEvent('popup');
  await page.getByText('Print with Positive Response').click(); // Chose the "Print with Positive Response" option
  const page4 = await page4Promise; // Will open a new page with a clean table for scraping
  await page4.locator('#tickets').click(); // *** This is the table of full ticket data; need to extract multiple fields from this table
  await page4.close(); // Close the print ticket page that opened
  // END PRINT SINGLE TICKET
  // END PRINTING PAGE OF TICKETS
  // END PRINT ALL TICKETS
  // START LOGOUT
  await page.getByRole('button', { name: 'mat-icons mi-arrow_drop_down' }).click(); // Reference the dropdown menu at the top of the page
  await page.getByText('Sign Out').click();
  await page.getByRole('button', { name: 'Yes' }).click();
  await page.close();
  // DONE
  // ---------------------
  await context.close();
  await browser.close();
})();
