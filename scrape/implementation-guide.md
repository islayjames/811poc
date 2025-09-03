# Texas 811 Scraper - Implementation Guide

## 🎯 **Systematic Approach to Fix All Key Issues**

Based on your recorded script, here's how to tackle each major issue:

## **1. 🔍 FIELD DISCOVERY (First Step)**

**Problem:** We don't know the exact structure of the `#tickets` table.

**Solution:** Run the field discovery script to analyze the table structure:

```bash
node discover-ticket-fields.js
```

This will:
- ✅ Login and open one ticket popup
- ✅ Analyze the `#tickets` table structure
- ✅ Generate `ticket-field-analysis.json` with complete table structure
- ✅ Create `ticket-extraction-template.js` with starter extraction code
- ✅ Keep popup open for manual inspection

**What You Need to Do:**
1. Run the discovery script
2. When popup opens, **manually inspect the `#tickets` table**
3. **Document the exact field locations** (which row/column contains what data)
4. **Share your required fields list** so I can map them to selectors

---

## **2. 📊 DATA EXTRACTION IMPLEMENTATION**

**Problem:** Script only clicks `#tickets` but doesn't extract data.

**Solution Pattern:**

### **Current (Broken):**
```javascript
await page1.locator('#tickets').click(); // Just clicking - NO DATA
await page1.close();
```

### **Fixed (Data Extraction):**
```javascript
// Extract comprehensive ticket data
const ticketData = await page1.evaluate(() => {
  const table = document.querySelector('#tickets');
  if (!table) return null;

  return {
    // Map YOUR required fields to actual table selectors
    ticket_number: table.querySelector('selector-for-ticket-number')?.textContent?.trim(),
    status: table.querySelector('selector-for-status')?.textContent?.trim(),
    date: table.querySelector('selector-for-date')?.textContent?.trim(),
    // ... all your other fields
  };
});

// Store the extracted data
allTickets.push({
  ...ticketData,
  page_number: currentPageNumber,
  extraction_timestamp: new Date().toISOString()
});

await page1.close();
```

**Implementation Steps:**
1. ✅ Run field discovery to get selectors
2. ✅ Replace all `#tickets` clicks with data extraction
3. ✅ Store extracted data in structured format
4. ✅ Add error handling for missing fields

---

## **3. 🔄 AUTOMATED PAGINATION**

**Problem:** Manual hardcoded page navigation.

**Current (Manual):**
```javascript
await page.getByRole('button', { name: 'Page 2' }).click();
await page.getByRole('button', { name: 'Page 3' }).click();
```

**Fixed (Automated):**
```javascript
// Detect total pages dynamically
const totalPages = await page.evaluate(() => {
  const pageButtons = document.querySelectorAll('.pagination button, .page-navigation button');
  const pageNumbers = Array.from(pageButtons)
    .map(btn => parseInt(btn.textContent))
    .filter(num => !isNaN(num));
  return Math.max(...pageNumbers) || 1;
});

console.log(`📄 Found ${totalPages} pages to process`);

// Loop through all pages
for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
  console.log(`🔄 Processing page ${pageNum}/${totalPages}`);

  if (pageNum > 1) {
    await page.getByRole('button', { name: `Page ${pageNum}` }).click();
    await page.waitForTimeout(2000); // Wait for page load
  }

  // Process all tickets on this page
  await processAllTicketsOnPage(page, pageNum);
}
```

---

## **4. 🎫 SYSTEMATIC TICKET PROCESSING**

**Problem:** Manual individual ticket selection.

**Current (Manual):**
```javascript
await page.getByRole('row', { name: '0 2574581677 Update 09/02/' }).click();
await page.getByRole('row', { name: '0 2574581593 Update 09/02/' }).click();
```

**Fixed (Automated):**
```javascript
async function processAllTicketsOnPage(page, pageNumber) {
  // Find all ticket rows on current page
  const ticketRows = await page.$$('[role="row"]'); // Skip header
  const dataRows = ticketRows.slice(1); // Remove header row

  console.log(`🎫 Found ${dataRows.length} tickets on page ${pageNumber}`);

  for (let i = 0; i < dataRows.length; i++) {
    try {
      console.log(`   Processing ticket ${i + 1}/${dataRows.length}`);

      // Click to select ticket
      await dataRows[i].click();

      // Open print menu
      await page.getByRole('menuitem', { name: 'Print ' }).locator('div').nth(1).click();

      // Open popup
      const popupPromise = page.waitForEvent('popup');
      await page.getByText('Print with Positive Response').click();
      const popupPage = await popupPromise;

      // EXTRACT DATA (not just click)
      const ticketData = await extractTicketData(popupPage);

      if (ticketData) {
        allTickets.push({
          ...ticketData,
          page_number: pageNumber,
          ticket_index_on_page: i,
          extraction_timestamp: new Date().toISOString()
        });
        console.log(`     ✅ Extracted ticket: ${ticketData.ticket_number}`);
      }

      await popupPage.close();

      // Rate limiting
      await page.waitForTimeout(1000);

    } catch (error) {
      console.error(`     ❌ Failed to process ticket ${i}: ${error.message}`);
      // Continue with next ticket
    }
  }
}
```

---

## **5. 🔧 ROBUST SELECTOR STRATEGY**

**Problem:** Fragile CSS selectors that will break.

**Current (Fragile):**
```javascript
'.ng-untouched.ng-pristine.ng-valid.dx-show-invalid-badge.dx-textbox.dx-texteditor.dx-editor-outlined.dx-texteditor-empty.dx-widget.dx-state-hover > .dx-texteditor-container > .dx-texteditor-input-container > .dx-texteditor-input'
```

**Fixed (Robust):**
```javascript
// Multiple selector strategies with fallbacks
async function findCompanySearchInput(page) {
  const selectors = [
    'input[placeholder*="company"]',
    'input[name*="company"]',
    '.dx-texteditor-input',
    '[data-field="company"] input',
    'input[type="text"]' // Last resort
  ];

  for (const selector of selectors) {
    const element = await page.$(selector);
    if (element && await element.isVisible()) {
      return element;
    }
  }

  throw new Error('Could not find company search input');
}

// Usage
const companyInput = await findCompanySearchInput(page);
await companyInput.fill('BRIGHT STAR SOLUTIONS');
```

---

## **6. 🛡️ COMPREHENSIVE ERROR HANDLING**

**Problem:** No error handling for network, authentication, or extraction failures.

**Solution:**

```javascript
async function robustTicketScraper() {
  const maxRetries = 3;
  let allTickets = [];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🚀 Scraping attempt ${attempt}/${maxRetries}`);

      // Authentication with retry
      await authenticateWithRetry(page);

      // Search with validation
      await performSearchWithValidation(page, 'BRIGHT STAR SOLUTIONS');

      // Process all pages with error recovery
      const totalPages = await detectTotalPages(page);

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        try {
          await processPageWithErrorRecovery(page, pageNum, allTickets);
        } catch (pageError) {
          console.error(`❌ Page ${pageNum} failed: ${pageError.message}`);
          // Continue with next page
        }
      }

      // Success - break retry loop
      break;

    } catch (error) {
      console.error(`❌ Attempt ${attempt} failed: ${error.message}`);

      if (attempt === maxRetries) {
        throw new Error(`All ${maxRetries} attempts failed`);
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  return allTickets;
}
```

---

## **7. 💾 DATA PERSISTENCE & STRUCTURE**

**Problem:** No data storage or structured output.

**Solution:**

```javascript
// Structured data container
const scrapingSession = {
  metadata: {
    scraping_started: new Date().toISOString(),
    company_filter: process.env.COMPANY_NAME || 'BRIGHT STAR SOLUTIONS',
    total_pages_processed: 0,
    total_tickets_extracted: 0,
    extraction_errors: 0
  },
  tickets: []
};

// Save data incrementally (in case of crashes)
function saveProgressData() {
  const filename = `texas811-tickets-${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(filename, JSON.stringify(scrapingSession, null, 2));
  console.log(`💾 Progress saved: ${scrapingSession.tickets.length} tickets`);
}

// Save after each page
await processPageWithErrorRecovery(page, pageNum, scrapingSession.tickets);
saveProgressData();
```

---

## **🚀 IMPLEMENTATION PRIORITY**

1. **IMMEDIATE:** Run field discovery script to understand `#tickets` structure
2. **HIGH:** Share your required field list for mapping
3. **HIGH:** Implement data extraction for `#tickets` table
4. **MEDIUM:** Add automated pagination detection
5. **MEDIUM:** Implement systematic ticket processing loops
6. **LOW:** Add robust error handling and retry logic

## **📋 YOUR ACTION ITEMS**

1. **Run:** `node discover-ticket-fields.js`
2. **Inspect:** The `#tickets` table when popup opens
3. **Document:** What fields you need (share your list!)
4. **Review:** The generated `ticket-field-analysis.json`
5. **Confirm:** Field mappings in `ticket-extraction-template.js`

Once you complete step 1-3, I can create the complete production scraper with all fixes implemented!

## **🔧 WHAT WE'LL BUILD**

```javascript
// Final scraper will be structured like this:
const results = await texasTicketScraper({
  company: 'BRIGHT STAR SOLUTIONS',
  credentials: {
    username: process.env.TEXAS811_USERNAME,
    password: process.env.TEXAS811_PASSWORD
  },
  options: {
    headless: true,
    outputFile: 'tickets.json',
    maxRetries: 3,
    rateLimitMs: 1000
  }
});

console.log(`Extracted ${results.totalTickets} tickets from ${results.totalPages} pages`);
```

**Ready to start with field discovery?** 🚀
