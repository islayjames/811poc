# Playwright Web Session Recorder

This project provides tools for recording web sessions using Playwright, which can then be converted into automated scraping scripts.

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Install browser binaries**:
   ```bash
   npm run install-browsers
   ```

## Recording Methods

### Method 1: Using Playwright's Built-in Code Generator (Recommended)

The easiest way to record a session is using Playwright's `codegen` feature:

```bash
# Record a session on example.com
node codegen-record.js https://example.com

# Or use the npm script
npm run codegen https://example.com

# Specify output file
node codegen-record.js https://example.com --output my-scraper.spec.js

# Use a different browser
node codegen-record.js https://example.com --browser firefox
```

**How it works:**
1. Opens a browser window and the Playwright Inspector
2. Navigate and interact with the webpage normally
3. Your actions are automatically converted to Playwright code
4. Close the browser when finished
5. The generated test file is saved automatically

### Method 2: Custom Session Recorder

For more advanced recording with additional features:

```bash
# Record with custom recorder
node record-session.js https://example.com

# Or use the npm script
npm run record https://example.com
```

**Features:**
- Records actions to JSON file
- Captures video of the session
- Generates trace files for debugging
- Creates a Playwright test script automatically

## Output Files

After recording, you'll get:

- **Test Script** (`recorded-test.spec.js`): Ready-to-run Playwright test
- **Actions JSON** (`recordings/actions.json`): Raw action data
- **Video** (`recordings/videos/`): MP4 recording of the session
- **Trace** (`recordings/trace.zip`): Detailed trace for debugging

## Running Recorded Tests

```bash
# Run all tests
npm test

# Run a specific test file
npx playwright test recorded-test.spec.js

# Run with UI mode
npx playwright test --ui

# Run in headed mode (visible browser)
npx playwright test --headed
```

## Customizing for Scraping

The generated test files can be modified for scraping:

```javascript
const { test, expect } = require('@playwright/test');

test('scrape data', async ({ page }) => {
  await page.goto('https://example.com');

  // Your recorded actions...
  await page.click('#search-button');
  await page.fill('#search-input', 'search term');

  // Add data extraction
  const results = await page.$$eval('.result-item', items =>
    items.map(item => ({
      title: item.querySelector('h2')?.textContent,
      link: item.querySelector('a')?.href,
      description: item.querySelector('.description')?.textContent
    }))
  );

  // Save or process the data
  console.log(results);
});
```

## Advanced Configuration

Edit `playwright.config.js` to customize:

- Browser types and devices
- Screenshots and video recording
- Network conditions
- Viewport sizes
- Timeouts and retries

## Troubleshooting

1. **Browser not launching**: Make sure browsers are installed with `npm run install-browsers`
2. **Permission errors**: Check that the scripts are executable (`chmod +x *.js`)
3. **Selector issues**: Use the Playwright Inspector to find better selectors
4. **Timing issues**: Add `await page.waitForSelector()` or `await page.waitForTimeout()`

## Examples

### Recording a login flow:
```bash
node codegen-record.js https://login.example.com --output login-flow.spec.js
```

### Recording with Firefox:
```bash
node codegen-record.js https://example.com --browser firefox
```

### Creating a scraper for e-commerce:
```bash
node codegen-record.js https://shop.example.com --output product-scraper.spec.js
```

## Next Steps

1. Record your target website's navigation flow
2. Modify the generated test to extract data instead of just interacting
3. Add error handling and retry logic
4. Set up scheduling to run the scraper periodically
5. Store extracted data in a database or file

## Useful Playwright Commands

```bash
# Show test report
npx playwright show-report

# Debug a test
npx playwright test --debug

# Generate trace viewer
npx playwright show-trace recordings/trace.zip

# Update snapshots
npx playwright test --update-snapshots
```
