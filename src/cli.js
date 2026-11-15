#!/usr/bin/env node

/**
 * aliexpress-scraper-plus CLI
 *
 * Usage:
 *   aliexpress-scraper-plus <id-or-url> [<id-or-url>...]
 *   aliexpress-scraper-plus --help
 *
 * Options:
 *   --retries <n>       Max retries (default: 3)
 *   --timeout <ms>      Request timeout in ms (default: 30000)
 *   --user-agent <ua>   Custom User-Agent header
 *   --concurrency <n>   Max concurrent requests for batch (default: 3)
 *   --pretty            Pretty-print JSON output
 *   --help              Show this help message
 */

import { scrapeProduct, scrapeProducts } from './index.js';

async function main() {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    printUsage();
    process.exit(argv.includes('--help') || argv.includes('-h') ? 0 : 1);
  }

  const opts = {};
  const inputs = [];
  let prettyPrint = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--retries':
        opts.maxRetries = parseInt(argv[++i], 10);
        break;
      case '--timeout':
        opts.timeoutMs = parseInt(argv[++i], 10);
        break;
      case '--user-agent':
        opts.userAgent = argv[++i];
        break;
      case '--concurrency':
        opts.concurrency = parseInt(argv[++i], 10);
        break;
      case '--pretty':
        prettyPrint = true;
        break;
      default:
        if (!arg.startsWith('--')) {
          inputs.push(arg);
        } else {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
    }
  }

  if (inputs.length === 0) {
    console.error('Error: At least one product ID or URL is required.');
    process.exit(1);
  }

  try {
    let output;
    if (inputs.length === 1) {
      output = await scrapeProduct(inputs[0], opts);
    } else {
      output = await scrapeProducts(inputs, opts);
    }

    const indent = prettyPrint ? 2 : undefined;
    console.log(JSON.stringify(output, null, indent));
  } catch (err) {
    // Structured error output, never a raw stack trace
    const errorObj = err.toJSON
      ? err.toJSON()
      : { error: true, code: 'UNKNOWN', message: err.message };
    console.error(JSON.stringify(errorObj, null, 2));
    process.exit(1);
  }
}

function printUsage() {
  console.log(`
aliexpress-scraper-plus — AliExpress product scraper

Usage:
  aliexpress-scraper-plus <id-or-url> [<id-or-url>...]

Options:
  --retries <n>       Max retries (default: 3)
  --timeout <ms>      Request timeout in ms (default: 30000)
  --user-agent <ua>   Custom User-Agent header
  --concurrency <n>   Max concurrent requests for batch (default: 3)
  --pretty            Pretty-print JSON output
  --help              Show this help message

Examples:
  aliexpress-scraper-plus 1005007429636284
  aliexpress-scraper-plus https://www.aliexpress.com/item/1005007429636284.html --pretty
  aliexpress-scraper-plus 1005001 1005002 1005003 --concurrency 2
  `.trim());
}

main();
