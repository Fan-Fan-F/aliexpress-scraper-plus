/**
 * Custom error types for structured error handling.
 * Each error includes a machine-readable code and contextual fields.
 */

export class ScraperError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'ScraperError';
    this.code = code;
    this.details = details;
  }

  toJSON() {
    return {
      error: true,
      name: this.name,
      code: this.code,
      message: this.message,
      ...this.details,
    };
  }
}

export class NetworkError extends ScraperError {
  constructor(message, { productId, statusCode, url } = {}) {
    super(message, 'NETWORK_ERROR', { productId, statusCode, url });
    this.name = 'NetworkError';
  }
}

export class ParseError extends ScraperError {
  constructor(message, { productId, field } = {}) {
    super(message, 'PARSE_ERROR', { productId, field });
    this.name = 'ParseError';
  }
}

export class ProductNotFoundError extends ScraperError {
  constructor(productId) {
    super(`Product not found: ${productId}`, 'PRODUCT_NOT_FOUND', { productId });
    this.name = 'ProductNotFoundError';
  }
}

export class TimeoutError extends ScraperError {
  constructor(productId, timeoutMs) {
    super(`Request timed out after ${timeoutMs}ms for product: ${productId}`, 'TIMEOUT', {
      productId,
      timeoutMs,
    });
    this.name = 'TimeoutError';
  }
}
