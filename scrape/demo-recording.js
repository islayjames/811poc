#!/usr/bin/env node

const { chromium } = require('@playwright/test');

async function interactiveDemo() {
  console.log('🎬 Starting interactive demo...');
  console.log('This will open a browser where you can interact with the page');
  console.log('Press Ctrl+C in this terminal to stop when done');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 500 // Slow down actions to see what's happening
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();

  // Navigate to the target site
  await page.goto('https://quotes.toscrape.com/');

  console.log('✅ Browser opened! You can now:');
  console.log('   - Click on quotes');
  console.log('   - Navigate to different pages');
  console.log('   - Search for content');
  console.log('   - Try any interactions you want to record');
  console.log('');
  console.log('🔍 Open your browser dev tools to inspect elements');
  console.log('💡 This is what your recording session will look like');

  // Keep the browser open until user interrupts
  let running = true;
  process.on('SIGINT', async () => {
    console.log('\\n🛑 Closing browser...');
    running = false;
    await browser.close();
    console.log('✅ Demo completed!');
    process.exit(0);
  });

  // Keep script alive
  while (running) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

if (require.main === module) {
  interactiveDemo().catch(console.error);
}
