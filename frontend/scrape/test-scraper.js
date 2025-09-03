#!/usr/bin/env node

const { runTexas811Scraper } = require('./texas811-production-scraper');

/**
 * Test script to validate the scraper functionality
 * Run with: node test-scraper.js
 */

async function testScraper() {
  console.log('🧪 Starting scraper test...');

  try {
    // Run the scraper with debug mode (non-headless)
    process.env.DEBUG = 'true';

    const results = await runTexas811Scraper();

    console.log('✅ Test completed successfully!');
    console.log(`📊 Results: ${results.tickets.length} tickets extracted`);

    if (results.tickets.length > 0) {
      console.log('📄 Sample ticket data:');
      console.log(JSON.stringify(results.tickets[0], null, 2));
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  testScraper();
}
