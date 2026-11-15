/**
 * Tests for aliexpress-scraper-plus
 *
 * Uses Node.js built-in test runner (node --test).
 * All tests use local HTML fixtures — no network required.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parseProductPage } from '../src/parser.js';
import { extractProductId } from '../src/url-utils.js';
import {
  NetworkError,
  ParseError,
  ProductNotFoundError,
  TimeoutError,
  ScraperError,
} from '../src/errors.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(join(__dirname, 'fixtures', name), 'utf-8');

// ─── URL / ID extraction ──────────────────────────────────────────────

describe('extractProductId', () => {
  it('extracts numeric ID from plain string', () => {
    assert.equal(extractProductId('1005007429636284'), '1005007429636284');
  });

  it('extracts ID from full AliExpress URL', () => {
    assert.equal(
      extractProductId('https://www.aliexpress.com/item/1005007429636284.html'),
      '1005007429636284'
    );
  });

  it('extracts ID from short /i/ URL', () => {
    assert.equal(
      extractProductId('https://aliexpress.com/i/1005007429636284.html'),
      '1005007429636284'
    );
  });

  it('extracts ID from URL with query parameters', () => {
    assert.equal(
      extractProductId('https://www.aliexpress.com/item/1005007429636284.html?spm=abc&pdp=true'),
      '1005007429636284'
    );
  });

  it('returns null for empty input', () => {
    assert.equal(extractProductId(''), null);
    assert.equal(extractProductId(null), null);
    assert.equal(extractProductId(undefined), null);
  });

  it('returns null for invalid input', () => {
    assert.equal(extractProductId('hello-world'), null);
    assert.equal(extractProductId('123'), null); // too short
  });
});

// ─── Parser: full product page ────────────────────────────────────────

describe('parseProductPage — full fixture', () => {
  const html = fixture('product-page.html');
  const result = parseProductPage(html, '1005007429636284');

  it('extracts product title', () => {
    assert.equal(result.title, 'Wireless Keyboard and Mouse Combo RGB Backlit Rechargeable');
  });

  it('extracts product ID', () => {
    assert.equal(result.productId, '1005007429636284');
  });

  it('extracts category ID', () => {
    assert.equal(result.categoryId, '70802');
  });

  it('extracts images as array', () => {
    assert.ok(Array.isArray(result.images));
    assert.equal(result.images.length, 2);
    assert.ok(result.images[0].includes('alicdn.com'));
  });

  it('extracts quantity info', () => {
    assert.deepEqual(result.quantity, { total: 500, available: 285 });
  });

  it('extracts order count', () => {
    assert.equal(result.orders, '1250');
  });

  it('extracts store info', () => {
    assert.equal(result.storeInfo.name, 'JOMAA Computer Office Accessories Store');
    assert.equal(result.storeInfo.companyId, 2674539165);
    assert.equal(result.storeInfo.storeNumber, 1102703188);
    assert.equal(result.storeInfo.rating, '96.5');
  });

  it('extracts ratings', () => {
    assert.equal(result.ratings.averageStar, '4.7');
    assert.equal(result.ratings.totalStartCount, 360);
    assert.equal(result.ratings.fiveStarCount, 280);
  });

  it('extracts reviews', () => {
    assert.ok(Array.isArray(result.reviews));
    assert.equal(result.reviews.length, 2);
    assert.equal(result.reviews[0].name, 'g***i');
    assert.equal(result.reviews[0].country, 'IL');
    assert.equal(result.reviews[0].rating, 4);
    assert.equal(result.reviews[1].anonymous, true);
  });

  it('extracts variant options', () => {
    assert.ok(result.variants);
    assert.equal(result.variants.options.length, 2);
    assert.equal(result.variants.options[0].name, 'Color');
    assert.equal(result.variants.options[0].values.length, 2);
  });

  it('extracts variant prices', () => {
    assert.equal(result.variants.prices.length, 2);
    const firstSku = result.variants.prices[0];
    assert.equal(firstSku.skuId, 12000040723791666);
    assert.ok(firstSku.salePrice);
  });

  it('extracts specs', () => {
    assert.ok(Array.isArray(result.specs));
    assert.equal(result.specs.length, 4);
    assert.equal(result.specs[0].attrName, 'Brand Name');
    assert.equal(result.specs[0].attrValue, 'JOMAA');
  });

  it('extracts shipping info', () => {
    assert.ok(Array.isArray(result.shipping));
    assert.equal(result.shipping.length, 2);
    assert.equal(result.shipping[0].deliveryProviderName, 'Cainiao Standard');
    assert.equal(result.shipping[0].shippingInfo.from, 'CN');
  });

  it('extracts currency info', () => {
    assert.deepEqual(result.currencyInfo, { currencyCode: 'USD' });
  });

  it('extracts sale price from SKU list', () => {
    assert.ok(result.salePrice);
    assert.ok(result.salePrice.min.amount > 0);
    assert.ok(result.salePrice.max.amount >= result.salePrice.min.amount);
  });
});

// ─── Parser: meta-only fallback ───────────────────────────────────────

describe('parseProductPage — meta-only fallback', () => {
  const html = fixture('meta-only-page.html');
  const result = parseProductPage(html, '9999999');

  it('falls back to meta title', () => {
    assert.equal(result.title, 'Simple Test Product');
  });

  it('extracts meta images', () => {
    assert.equal(result.images.length, 2);
  });

  it('returns null for missing structured fields', () => {
    assert.equal(result.storeInfo, null);
    assert.equal(result.variants, null);
  });
});

// ─── Parser: not-found page ──────────────────────────────────────────

describe('parseProductPage — not found', () => {
  const html = fixture('not-found-page.html');

  it('throws ProductNotFoundError', () => {
    assert.throws(() => parseProductPage(html, '000'), (err) => {
      assert.ok(err instanceof ProductNotFoundError);
      assert.equal(err.code, 'PRODUCT_NOT_FOUND');
      return true;
    });
  });
});

// ─── Error classes ───────────────────────────────────────────────────

describe('Error classes', () => {
  it('NetworkError serializes to JSON', () => {
    const err = new NetworkError('Connection refused', { productId: '123', statusCode: 503 });
    const json = err.toJSON();
    assert.equal(json.error, true);
    assert.equal(json.code, 'NETWORK_ERROR');
    assert.equal(json.productId, '123');
    assert.equal(json.statusCode, 503);
  });

  it('ParseError has correct code', () => {
    const err = new ParseError('Bad HTML', { productId: '456', field: 'title' });
    assert.equal(err.code, 'PARSE_ERROR');
    assert.equal(err.details.field, 'title');
  });

  it('TimeoutError includes timeout value', () => {
    const err = new TimeoutError('789', 30000);
    assert.equal(err.code, 'TIMEOUT');
    assert.equal(err.details.timeoutMs, 30000);
  });

  it('all error classes extend ScraperError', () => {
    assert.ok(new NetworkError('x') instanceof ScraperError);
    assert.ok(new ParseError('x') instanceof ScraperError);
    assert.ok(new ProductNotFoundError('x') instanceof ScraperError);
    assert.ok(new TimeoutError('x', 1) instanceof ScraperError);
  });
});
