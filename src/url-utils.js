/**
 * Extract a numeric product ID from a URL or raw ID string.
 */
export function extractProductId(input) {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();

  // Pure numeric ID
  if (/^\d{5,20}$/.test(trimmed)) {
    return trimmed;
  }

  // URL patterns: /item/<id>.html  or  /item/<id>  or  /i/<id>.html
  const urlPatterns = [
    /\/item\/(\d{5,20})\.html/i,
    /\/item\/(\d{5,20})/i,
    /\/i\/(\d{5,20})\.html/i,
    /\/(\d{5,20})\.html/i,
    /productId=(\d{5,20})/i,
  ];

  for (const pattern of urlPatterns) {
    const match = trimmed.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Build a product page URL from a product ID.
 */
export function buildProductUrl(productId) {
  return `https://www.aliexpress.com/item/${productId}.html`;
}
