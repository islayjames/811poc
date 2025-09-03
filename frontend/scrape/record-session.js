#!/usr/bin/env node

const { chromium, firefox, webkit } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

/**
 * Session Recorder - Records web interactions for later automation
 */
class SessionRecorder {
  constructor(options = {}) {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.actions = [];
    this.options = {
      browserType: options.browserType || 'chromium',
      headless: options.headless || false,
      viewport: options.viewport || { width: 1280, height: 720 },
      recordVideo: options.recordVideo || true,
      recordTrace: options.recordTrace || true,
      outputDir: options.outputDir || './recordings',
      ...options
    };
  }

  async start(url) {
    console.log('🎬 Starting session recording...');

    // Ensure output directory exists
    if (!fs.existsSync(this.options.outputDir)) {
      fs.mkdirSync(this.options.outputDir, { recursive: true });
    }

    // Choose browser
    const browsers = { chromium, firefox, webkit };
    const browserType = browsers[this.options.browserType];

    if (!browserType) {
      throw new Error(`Unsupported browser type: ${this.options.browserType}`);
    }

    // Launch browser
    this.browser = await browserType.launch({
      headless: this.options.headless,
      slowMo: 100 // Add slight delay to see actions
    });

    // Create context with recording options
    const contextOptions = {
      viewport: this.options.viewport,
    };

    if (this.options.recordVideo) {
      contextOptions.recordVideo = {
        dir: path.join(this.options.outputDir, 'videos'),
        size: this.options.viewport
      };
    }

    if (this.options.recordTrace) {
      contextOptions.ignoreHTTPSErrors = true;
    }

    this.context = await this.browser.newContext(contextOptions);

    // Start tracing if enabled
    if (this.options.recordTrace) {
      await this.context.tracing.start({
        screenshots: true,
        snapshots: true,
        sources: true
      });
    }

    // Create page
    this.page = await this.context.newPage();

    // Set up action recording
    await this.setupActionRecording();

    // Navigate to initial URL
    if (url) {
      console.log(`📍 Navigating to: ${url}`);
      await this.recordAction('goto', { url });
      await this.page.goto(url);
    }

    console.log('✅ Recording started! Interact with the page...');
    console.log('   Press Ctrl+C to stop recording');

    // Keep the script running
    return this.page;
  }

  async setupActionRecording() {
    // Record navigation
    this.page.on('framenavigated', (frame) => {
      if (frame === this.page.mainFrame()) {
        this.recordAction('navigation', { url: frame.url() });
      }
    });

    // Record clicks
    this.page.on('click', (element) => {
      // This doesn't actually work as expected, we'll use evaluate instead
    });

    // Inject recording script
    await this.page.addInitScript(() => {
      // This script runs in the browser context
      window.playwrightRecorder = {
        actions: [],
        recordAction: (type, data) => {
          const action = {
            type,
            timestamp: Date.now(),
            ...data
          };
          window.playwrightRecorder.actions.push(action);
          console.log('🎥 Recorded:', action);
        }
      };

      // Record clicks
      document.addEventListener('click', (event) => {
        const selector = window.playwrightRecorder.getSelector(event.target);
        window.playwrightRecorder.recordAction('click', {
          selector,
          position: { x: event.clientX, y: event.clientY },
          text: event.target.textContent?.trim().substring(0, 50)
        });
      });

      // Record input changes
      document.addEventListener('input', (event) => {
        const selector = window.playwrightRecorder.getSelector(event.target);
        window.playwrightRecorder.recordAction('fill', {
          selector,
          value: event.target.value
        });
      });

      // Record form submissions
      document.addEventListener('submit', (event) => {
        const selector = window.playwrightRecorder.getSelector(event.target);
        window.playwrightRecorder.recordAction('submit', {
          selector
        });
      });

      // Helper to generate CSS selector
      window.playwrightRecorder.getSelector = (element) => {
        if (element.id) return `#${element.id}`;
        if (element.className) {
          const classes = element.className.split(' ').filter(c => c).join('.');
          if (classes) return `.${classes}`;
        }

        // Generate path-based selector
        let path = element.tagName.toLowerCase();
        let parent = element.parentElement;
        while (parent && parent.tagName !== 'HTML') {
          const siblings = Array.from(parent.children);
          const index = siblings.indexOf(element) + 1;
          path = `${parent.tagName.toLowerCase()}:nth-child(${index}) > ${path}`;
          element = parent;
          parent = element.parentElement;
        }
        return path;
      };
    });
  }

  recordAction(type, data) {
    const action = {
      type,
      timestamp: Date.now(),
      ...data
    };
    this.actions.push(action);
    console.log(`🎥 Recorded: ${type}`, data);
  }

  async stop() {
    console.log('🛑 Stopping recording...');

    // Get recorded actions from the page
    if (this.page) {
      try {
        const browserActions = await this.page.evaluate(() => {
          return window.playwrightRecorder ? window.playwrightRecorder.actions : [];
        });
        this.actions.push(...browserActions);
      } catch (e) {
        console.warn('Could not retrieve browser actions:', e.message);
      }
    }

    // Stop tracing
    if (this.context && this.options.recordTrace) {
      const tracePath = path.join(this.options.outputDir, 'trace.zip');
      await this.context.tracing.stop({ path: tracePath });
      console.log(`📝 Trace saved to: ${tracePath}`);
    }

    // Save actions
    const actionsPath = path.join(this.options.outputDir, 'actions.json');
    fs.writeFileSync(actionsPath, JSON.stringify(this.actions, null, 2));
    console.log(`📋 Actions saved to: ${actionsPath}`);

    // Generate Playwright test script
    await this.generateTestScript();

    // Close browser
    if (this.browser) {
      await this.browser.close();
    }

    console.log('✅ Recording stopped and saved!');
  }

  async generateTestScript() {
    const testScript = `// Generated Playwright test script
const { test, expect } = require('@playwright/test');

test('recorded session', async ({ page }) => {
${this.actions.map(action => this.actionToCode(action)).filter(Boolean).join('\n')}
});
`;

    const testPath = path.join(this.options.outputDir, 'recorded-test.spec.js');
    fs.writeFileSync(testPath, testScript);
    console.log(`🧪 Test script saved to: ${testPath}`);
  }

  actionToCode(action) {
    switch (action.type) {
      case 'goto':
        return `  await page.goto('${action.url}');`;
      case 'click':
        return `  await page.click('${action.selector}');`;
      case 'fill':
        return `  await page.fill('${action.selector}', '${action.value}');`;
      case 'submit':
        return `  await page.click('${action.selector} [type="submit"]');`;
      default:
        return `  // ${action.type}: ${JSON.stringify(action)}`;
    }
  }
}

// CLI usage
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('Usage: node record-session.js <url> [options]');
    console.log('');
    console.log('Examples:');
    console.log('  node record-session.js https://example.com');
    console.log('  node record-session.js https://example.com --headless');
    console.log('  node record-session.js https://example.com --browser firefox');
    console.log('');
    console.log('Features:');
    console.log('  - Records actions to JSON file');
    console.log('  - Captures video of the session');
    console.log('  - Generates trace files for debugging');
    console.log('  - Creates Playwright test script automatically');
    console.log('');
    console.log('Press Ctrl+C to stop recording');
    process.exit(args[0] === '--help' || args[0] === '-h' ? 0 : 1);
  }

  const url = args[0];

  const recorder = new SessionRecorder({
    browserType: 'chromium',
    headless: false,
    recordVideo: true,
    recordTrace: true
  });

  let isRecording = true;

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    if (isRecording) {
      isRecording = false;
      await recorder.stop();
      process.exit(0);
    }
  });

  try {
    const page = await recorder.start(url);

    // Keep recording until interrupted
    while (isRecording) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error('❌ Recording failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = SessionRecorder;
