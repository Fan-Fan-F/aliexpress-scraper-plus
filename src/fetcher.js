/**
 * HTTP fetching with retry, exponential backoff, configurable timeout and UA.
 */

import { NetworkError, TimeoutError } from './errors.js';

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/**
 * Fetch a URL with retry + exponential backoff.
 *
 * @param {string} url
 * @param {object} opts
 * @param {number} opts.maxRetries   - max retry attempts (default 3)
 * @param {number} opts.timeoutMs    - per-request timeout in ms (default 30000)
 * @param {string} opts.userAgent    - User-Agent header
 * @param {string} opts.productId    - for error context
 * @returns {Promise<string>}        - response body text
 */
export async function fetchWithRetry(url, opts = {}) {
  const {
    maxRetries = 3,
    timeoutMs = 30000,
    userAgent = DEFAULT_USER_AGENT,
    productId = 'unknown',
  } = opts;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 1s, 2s, 4s ... plus jitter up to 500ms
      const baseDelay = Math.pow(2, attempt - 1) * 1000;
      const jitter = Math.floor(Math.random() * 500);
      await sleep(baseDelay + jitter);
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': userAgent,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new NetworkError(`HTTP ${response.status} for ${url}`, {
          productId,
          statusCode: response.status,
          url,
        });
      }

      return await response.text();
    } catch (err) {
      if (err.name === 'AbortError') {
        lastError = new TimeoutError(productId, timeoutMs);
      } else if (err instanceof NetworkError) {
        lastError = err;
      } else {
        lastError = new NetworkError(err.message || 'Fetch failed', {
          productId,
          url,
        });
      }
    }
  }

  throw lastError;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
