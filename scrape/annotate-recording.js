#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Annotate Playwright recordings for LLM conversion to scrapers
 */
class RecordingAnnotator {
  constructor() {
    this.annotations = {
      clicks: [],
      navigations: [],
      inputs: [],
      waits: []
    };
  }

  annotateFile(inputFile, outputFile, options = {}) {
    console.log(`📝 Annotating ${inputFile} for LLM conversion...`);

    const content = fs.readFileSync(inputFile, 'utf8');
    const lines = content.split('\n');

    const annotatedLines = [];
    const metadata = this.extractMetadata(content, options);

    // Add header with LLM instructions
    annotatedLines.push(...this.generateHeader(metadata));
    annotatedLines.push('');

    // Process each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const annotation = this.annotateLine(line, i);

      if (annotation.before) {
        annotatedLines.push(...annotation.before);
      }

      annotatedLines.push(line);

      if (annotation.after) {
        annotatedLines.push(...annotation.after);
      }
    }

    // Add footer with conversion instructions
    annotatedLines.push('');
    annotatedLines.push(...this.generateFooter(metadata));

    const annotatedContent = annotatedLines.join('\n');
    fs.writeFileSync(outputFile, annotatedContent);

    console.log(`✅ Annotated file saved to: ${outputFile}`);
    console.log(`🎯 Ready for LLM conversion to scraper`);

    return {
      metadata,
      annotations: this.annotations,
      outputFile
    };
  }

  extractMetadata(content, options) {
    const metadata = {
      url: this.extractUrl(content),
      actions: this.countActions(content),
      intent: options.intent || 'UNKNOWN - Please specify scraping intent',
      dataTargets: options.dataTargets || ['UNKNOWN - Specify what data to extract'],
      outputFormat: options.outputFormat || 'JSON'
    };

    return metadata;
  }

  extractUrl(content) {
    const urlMatch = content.match(/page\.goto\(['"`]([^'"`]+)['"`]\)/);
    return urlMatch ? urlMatch[1] : 'UNKNOWN_URL';
  }

  countActions(content) {
    return {
      clicks: (content.match(/\.click\(/g) || []).length,
      fills: (content.match(/\.fill\(/g) || []).length,
      navigations: (content.match(/\.goto\(/g) || []).length,
      waits: (content.match(/\.wait/g) || []).length
    };
  }

  annotateLine(line, lineNumber) {
    const annotation = { before: [], after: [] };

    // Annotate different types of actions
    if (line.includes('.click(')) {
      annotation.before.push(`  // LLM_CONVERT: This click suggests user interest in this element`);
      annotation.before.push(`  // REPLACEMENT: Extract data instead of clicking`);
      this.annotations.clicks.push({ line: lineNumber, content: line.trim() });
    }

    if (line.includes('.fill(')) {
      annotation.before.push(`  // LLM_CONVERT: This input suggests search/filter functionality`);
      annotation.before.push(`  // ENHANCEMENT: Add dynamic input handling for scraping variations`);
      this.annotations.inputs.push({ line: lineNumber, content: line.trim() });
    }

    if (line.includes('.goto(')) {
      annotation.before.push(`  // LLM_CONVERT: Navigation point - keep but add error handling`);
      this.annotations.navigations.push({ line: lineNumber, content: line.trim() });
    }

    if (line.includes('await page.locator') || line.includes('await page.getByText')) {
      annotation.after.push(`  // EXTRACT_HINT: This selector targets specific content - convert to data extraction`);
    }

    return annotation;
  }

  generateHeader(metadata) {
    return [
      `/**`,
      ` * AUTO-GENERATED LLM CONVERSION TEMPLATE`,
      ` * `,
      ` * SOURCE: Playwright recording`,
      ` * TARGET: ${metadata.url}`,
      ` * INTENT: ${metadata.intent}`,
      ` * `,
      ` * SCRAPING OBJECTIVES:`,
      ...metadata.dataTargets.map(target => ` * - ${target}`),
      ` * `,
      ` * CONVERSION TASKS FOR LLM:`,
      ` * 1. Replace interaction actions with data extraction`,
      ` * 2. Add systematic pagination/navigation`,
      ` * 3. Structure data output (${metadata.outputFormat})`,
      ` * 4. Add error handling and retries`,
      ` * 5. Optimize for production (headless, rate limiting)`,
      ` * `,
      ` * ACTION SUMMARY:`,
      ` * - Clicks: ${metadata.actions.clicks} (convert to extractions)`,
      ` * - Fills: ${metadata.actions.fills} (convert to parameterized inputs)`,
      ` * - Navigations: ${metadata.actions.navigations} (keep with error handling)`,
      ` * - Waits: ${metadata.actions.waits} (enhance with smart waiting)`,
      ` */`
    ];
  }

  generateFooter(metadata) {
    return [
      ``,
      `/**`,
      ` * LLM CONVERSION CHECKLIST:`,
      ` * `,
      ` * [ ] Replace all .click() with data extraction using $$eval or evaluate`,
      ` * [ ] Add pagination logic (check for next/previous buttons)`,
      ` * [ ] Implement data structure for ${metadata.outputFormat} output`,
      ` * [ ] Add try-catch blocks for network and element errors`,
      ` * [ ] Change headless: false to headless: true`,
      ` * [ ] Add rate limiting (await page.waitForTimeout(1000))`,
      ` * [ ] Implement data deduplication`,
      ` * [ ] Add progress logging`,
      ` * [ ] Include timestamp and metadata in output`,
      ` * [ ] Test with edge cases (empty pages, network failures)`,
      ` * `,
      ` * EXAMPLE DATA EXTRACTION PATTERN:`,
      ` * const data = await page.evaluate(() => {`,
      ` *   return Array.from(document.querySelectorAll('.item')).map(item => ({`,
      ` *     title: item.querySelector('.title')?.textContent?.trim(),`,
      ` *     link: item.querySelector('a')?.href,`,
      ` *     description: item.querySelector('.desc')?.textContent?.trim()`,
      ` *   }));`,
      ` * });`,
      ` */`
    ];
  }
}

// CLI usage
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: node annotate-recording.js <input-file> [output-file] [options]');
    console.log('');
    console.log('Examples:');
    console.log('  node annotate-recording.js recorded-test.spec.js');
    console.log('  node annotate-recording.js my-recording.js annotated-scraper.js');
    console.log('');
    console.log('Options (as JSON string):');
    console.log('  --options \'{"intent": "Extract product data", "dataTargets": ["prices", "titles"]}\'');
    process.exit(1);
  }

  const inputFile = args[0];
  const outputFile = args[1] || inputFile.replace('.js', '-annotated.js');

  let options = {};
  const optionsIndex = args.indexOf('--options');
  if (optionsIndex !== -1 && args[optionsIndex + 1]) {
    try {
      options = JSON.parse(args[optionsIndex + 1]);
    } catch (e) {
      console.error('Invalid JSON options:', e.message);
      process.exit(1);
    }
  }

  if (!fs.existsSync(inputFile)) {
    console.error('Input file not found:', inputFile);
    process.exit(1);
  }

  const annotator = new RecordingAnnotator();
  const result = annotator.annotateFile(inputFile, outputFile, options);

  console.log('');
  console.log('📊 Annotation Summary:');
  console.log(`   Clicks found: ${result.annotations.clicks.length}`);
  console.log(`   Inputs found: ${result.annotations.inputs.length}`);
  console.log(`   Navigations found: ${result.annotations.navigations.length}`);
  console.log('');
  console.log('🤖 Ready for LLM conversion!');
  console.log('   Pass the annotated file to an LLM with instructions to convert to a scraper.');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = RecordingAnnotator;
