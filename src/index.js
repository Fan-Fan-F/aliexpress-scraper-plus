/**
 * aliexpress-scraper-plus — main module
 *
 * Exports:
 *   scrapeProduct(idOrUrl, options)    — scrape a single product
 *   scrapeProducts(inputs, options)    — batch scrape multiple products
 *   Error classes for structured error handling
 */

import { fetchWithRetry } from './fetcher.js';
import { parseProductPage } from './parser.js';
import { extractProductId, buildProductUrl } from './url-utils.js';
import {
  ScraperError,
  NetworkError,
  ParseError,
  ProductNotFoundError,
  TimeoutError,
} from './errors.js';

/**
 * Default options.
 */
const DEFAULTS = {
  maxRetries: 3,
  timeoutMs: 30000,
  userAgent: undefined, // uses fetcher's built-in default
  concurrency: 3,
};

/**
 * Scrape a single AliExpress product by ID or URL.
 *
 * @param {string} idOrUrl  - Product ID (e.g. "1005007429636284") or full URL
 * @param {object} [options]
 * @param {number} [options.maxRetries=3]
 * @param {number} [options.timeoutMs=30000]
 * @param {string} [options.userAgent]
 * @returns {Promise<object>} - Structured product data
 */
export async function scrapeProduct(idOrUrl, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const productId = extractProductId(String(idOrUrl));

  if (!productId) {
    throw new ParseError(`Invalid product ID or URL: ${idOrUrl}`, {
      productId: String(idOrUrl),
      field: 'input',
    });
  }

  const url = buildProductUrl(productId);
  const html = await fetchWithRetry(url, {
    maxRetries: opts.maxRetries,
    timeoutMs: opts.timeoutMs,
    userAgent: opts.userAgent,
    productId,
  });

  return parseProductPage(html, productId);
}

/**
 * Batch scrape multiple products.
 * Returns an array of result objects: { status: 'ok'|'error', productId, data?, error? }
 *
 * @param {string[]} inputs   - Array of product IDs or URLs
 * @param {object}  [options]
 * @param {number}  [options.concurrency=3]  - Max concurrent requests
 * @returns {Promise<Array<{status: string, productId: string, data?: object, error?: object}>>}
 */
export async function scrapeProducts(inputs, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const concurrency = opts.concurrency || 3;
  const results = [];
  const queue = [...inputs];

  async function worker() {
    while (queue.length > 0) {
      const input = queue.shift();
      const productId = extractProductId(String(input)) || String(input);
      try {
        const data = await scrapeProduct(input, opts);
        results.push({ status: 'ok', productId, data });
      } catch (err) {
        const errorPayload =
          err instanceof ScraperError
            ? err.toJSON()
            : { error: true, name: err.name, code: 'UNKNOWN', message: err.message };
        results.push({ status: 'error', productId, error: errorPayload });
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, inputs.length) }, () => worker());
  await Promise.all(workers);

  return results;
}

// Re-export error classes and utilities for library consumers
export {
  ScraperError,
  NetworkError,
  ParseError,
  ProductNotFoundError,
  TimeoutError,
};
export { extractProductId } from './url-utils.js';
