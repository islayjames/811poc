#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Simple wrapper around Playwright's codegen feature
 */
function startCodegen(url, options = {}) {
  const outputFile = options.output || 'recorded-test.spec.js';
  const browser = options.browser || 'chromium';

  console.log('🎬 Starting Playwright code generation...');
  console.log(`📍 Target URL: ${url}`);
  console.log(`🎯 Output file: ${outputFile}`);
  console.log(`🌐 Browser: ${browser}`);
  console.log('');
  console.log('Instructions:');
  console.log('1. A browser window will open');
  console.log('2. Interact with the webpage as you normally would');
  console.log('3. Your actions will be recorded as Playwright code');
  console.log('4. Close the browser when done');
  console.log('');

  const args = [
    'playwright',
    'codegen',
    '--target', 'javascript',
    '--browser', browser,
    '--output', outputFile,
    url
  ];

  const codegen = spawn('npx', args, {
    stdio: 'inherit',
    cwd: process.cwd()
  });

  codegen.on('close', (code) => {
    if (code === 0) {
      console.log('✅ Recording completed!');
      console.log(`📄 Generated test file: ${outputFile}`);

      // Show the generated content
      if (fs.existsSync(outputFile)) {
        console.log('\n📝 Generated code preview:');
        console.log('─'.repeat(50));
        const content = fs.readFileSync(outputFile, 'utf8');
        console.log(content);
        console.log('─'.repeat(50));
      }
    } else {
      console.error('❌ Recording failed with exit code:', code);
    }
  });

  codegen.on('error', (err) => {
    console.error('❌ Failed to start recording:', err);
  });

  return codegen;
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: node codegen-record.js <url> [options]');
    console.log('');
    console.log('Examples:');
    console.log('  node codegen-record.js https://example.com');
    console.log('  node codegen-record.js https://example.com --output my-test.spec.js');
    console.log('  node codegen-record.js https://example.com --browser firefox');
    process.exit(1);
  }

  const url = args[0];
  const options = {};

  for (let i = 1; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    options[key] = value;
  }

  startCodegen(url, options);
}

module.exports = { startCodegen };
