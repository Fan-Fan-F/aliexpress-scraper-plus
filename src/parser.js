/**
 * HTML parser — extracts product data from AliExpress product page HTML.
 * Uses cheerio for DOM traversal.
 *
 * AliExpress embeds structured product data in script tags as JSON.
 * This parser looks for that embedded data and falls back to meta tags.
 */

import * as cheerio from 'cheerio';
import { ParseError, ProductNotFoundError } from './errors.js';

/**
 * Parse AliExpress product page HTML and return structured product data.
 *
 * @param {string} html       - raw HTML string
 * @param {string} productId  - for error context
 * @returns {object}           - standardized product object
 */
export function parseProductPage(html, productId) {
  if (!html || typeof html !== 'string') {
    throw new ParseError('Empty or invalid HTML content', { productId });
  }

  const $ = cheerio.load(html);

  // AliExpress embeds product data in window.runParams or similar JSON blobs inside <script> tags
  const pageData = extractEmbeddedJson($, productId);

  if (!pageData) {
    // Fallback: try meta tags for minimal info
    const metaTitle = $('meta[property="og:title"]').attr('content');
    if (!metaTitle) {
      throw new ProductNotFoundError(productId);
    }
    return buildFromMeta($, productId);
  }

  return normalizeProductData(pageData, productId);
}

/**
 * Search all <script> tags for embedded product JSON data.
 */
function extractEmbeddedJson($, productId) {
  let found = null;

  $('script').each((_i, el) => {
    const text = $(el).html() || '';

    // Pattern 1: window.runParams = { data: {...} }
    const runParamsMatch = text.match(/window\.runParams\s*=\s*\{/);
    if (runParamsMatch) {
      const dataMatch = text.match(/"data"\s*:\s*(\{[\s\S]*?\})\s*[,;}\n]/);
      if (dataMatch) {
        try {
          found = JSON.parse(dataMatch[1]);
          return false; // break
        } catch { /* ignore parse failure, try next */ }
      }

      // Try extracting the whole runParams object
      const fullMatch = text.match(/window\.runParams\s*=\s*(\{[\s\S]*?\});/);
      if (fullMatch) {
        try {
          const parsed = JSON.parse(fullMatch[1]);
          found = parsed.data || parsed;
          return false;
        } catch { /* continue */ }
      }
    }

    // Pattern 2: data JSON object with actionModule, titleModule, etc.
    if (text.includes('"actionModule"') && text.includes('"titleModule"')) {
      // Find the largest JSON object in the script
      const jsonCandidates = text.match(/\{[\s\S]{500,}\}/g);
      if (jsonCandidates) {
        for (const candidate of jsonCandidates) {
          try {
            const parsed = JSON.parse(candidate);
            if (parsed.titleModule || parsed.actionModule) {
              found = parsed;
              return false;
            }
          } catch { /* continue */ }
        }
      }
    }

    // Pattern 3: __NEXT_DATA__ or similar hydration payloads
    if (text.includes('__NEXT_DATA__') || text.includes('__initialData__')) {
      const jsonMatch = text.match(/=\s*(\{[\s\S]*?\});?\s*<\/script>/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          // Dig into possible nested structures
          const productInfo =
            parsed?.props?.pageProps?.productInfo ||
            parsed?.data?.productInfo ||
            parsed?.data;
          if (productInfo) {
            found = productInfo;
            return false;
          }
        } catch { /* continue */ }
      }
    }
  });

  return found;
}

/**
 * Build minimal product data from meta tags when JSON extraction fails.
 */
function buildFromMeta($, productId) {
  return {
    productId,
    title: $('meta[property="og:title"]').attr('content') || '',
    description: $('meta[property="og:description"]').attr('content') || '',
    images: extractMetaImages($),
    categoryId: null,
    quantity: null,
    orders: null,
    storeInfo: null,
    ratings: null,
    reviews: [],
    variants: null,
    specs: [],
    currencyInfo: null,
    originalPrice: null,
    salePrice: null,
    shipping: [],
  };
}

/**
 * Extract images from meta tags.
 */
function extractMetaImages($) {
  const images = [];
  $('meta[property="og:image"]').each((_i, el) => {
    const url = $(el).attr('content');
    if (url) images.push(url);
  });
  return images;
}

/**
 * Normalize the raw embedded JSON into a standardized output shape.
 */
function normalizeProductData(raw, productId) {
  const titleMod = raw.titleModule || {};
  const actionMod = raw.actionModule || {};
  const storeMod = raw.storeModule || {};
  const specMod = raw.specsModule || raw.specsModule || {};
  const quantityMod = raw.quantityModule || {};
  const descMod = raw.descriptionModule || {};
  const reviewMod = raw.feedbackModule || {};
  const skuMod = raw.skuModule || {};
  const shippingMod = raw.shippingModule || {};
  const priceMod = raw.priceModule || raw.pricingModule || {};
  const crossLinkMod = raw.crossLinkModule || {};
  const commonMod = raw.commonModule || {};

  const result = {
    productId: String(titleMod.productId || commonMod.productId || productId),
    title: titleMod.subject || titleMod.title || '',
    categoryId: String(actionMod.categoryId || crossLinkMod.categoryId || ''),
    description: descMod.descriptionUrl || descMod.description || '',
    quantity: normalizeQuantity(quantityMod),
    orders: String(titleMod.tradeCount || titleMod.orderCount || '0'),
    images: extractImages(titleMod, raw),
    storeInfo: normalizeStore(storeMod),
    ratings: normalizeRatings(reviewMod, titleMod),
    reviews: normalizeReviews(reviewMod),
    variants: normalizeVariants(skuMod),
    specs: normalizeSpecs(specMod),
    currencyInfo: normalizeCurrency(priceMod, skuMod),
    originalPrice: normalizePrice(priceMod, 'originalPrice', skuMod),
    salePrice: normalizePrice(priceMod, 'salePrice', skuMod),
    shipping: normalizeShipping(shippingMod),
  };

  return result;
}

function normalizeQuantity(mod) {
  if (!mod || (!mod.totalAvailQuantity && !mod.totalQuantity)) return null;
  return {
    total: mod.totalQuantity || mod.totalAvailQuantity || 0,
    available: mod.totalAvailQuantity || 0,
  };
}

function extractImages(titleMod, raw) {
  if (titleMod.imagePath) {
    return Array.isArray(titleMod.imagePath) ? titleMod.imagePath : [titleMod.imagePath];
  }
  if (titleMod.imagePathList) {
    return titleMod.imagePathList;
  }
  if (raw.imageModule?.imagePathList) {
    return raw.imageModule.imagePathList;
  }
  return [];
}

function normalizeStore(mod) {
  if (!mod || !mod.storeName) return null;
  return {
    name: mod.storeName || '',
    logo: mod.storeLogo || '',
    companyId: mod.companyId || null,
    storeNumber: mod.storeNum || mod.storeId || null,
    isTopRated: Boolean(mod.topRatedSeller),
    hasPayPalAccount: Boolean(mod.payPalAccount),
    ratingCount: mod.positiveNum || 0,
    rating: String(mod.positiveRate || '0'),
  };
}

function normalizeRatings(feedbackMod, titleMod) {
  const avg =
    feedbackMod.averageStar || titleMod.averageStar || feedbackMod.evarageStar || '0';
  const total =
    feedbackMod.totalValidNum || feedbackMod.totalCount || titleMod.feedbackCount || 0;

  return {
    totalStar: 5,
    averageStar: String(avg),
    totalStartCount: Number(total),
    fiveStarCount: feedbackMod.fiveStarNum || 0,
    fourStarCount: feedbackMod.fourStarNum || 0,
    threeStarCount: feedbackMod.threeStarNum || 0,
    twoStarCount: feedbackMod.twoStarNum || 0,
    oneStarCount: feedbackMod.oneStarNum || 0,
  };
}

function normalizeReviews(feedbackMod) {
  if (!feedbackMod.reviews && !feedbackMod.feedbackList) return [];
  const list = feedbackMod.reviews || feedbackMod.feedbackList || [];
  return list.map((r) => ({
    anonymous: Boolean(r.anonymous),
    name: r.buyerName || r.name || '',
    displayName: r.displayName || r.buyerName || '',
    gender: r.gender || '',
    country: r.buyerCountry || r.country || '',
    rating: Number(r.buyerEval || r.rating || 0),
    info: r.buyerTranslationSku || r.skuInfo || r.info || '',
    date: r.evalDate || r.date || '',
    content: r.buyerFeedback || r.content || '',
    photos: (r.images || r.photos || []).map((p) => (typeof p === 'string' ? p : p.url || '')),
    thumbnails: (r.thumbnails || []).map((t) => (typeof t === 'string' ? t : t.url || '')),
  }));
}

function normalizeVariants(skuMod) {
  if (!skuMod || (!skuMod.productSKUPropertyList && !skuMod.skuPropertyList)) return null;

  const propList = skuMod.productSKUPropertyList || skuMod.skuPropertyList || [];
  const options = propList.map((prop) => ({
    id: prop.skuPropertyId || 0,
    name: prop.skuPropertyName || '',
    values: (prop.skuPropertyValues || []).map((val) => ({
      id: val.propertyValueId || val.propertyValueIdLong || 0,
      name: val.skuPropertyValueShowOrder !== undefined
        ? val.propertyValueName || ''
        : val.propertyValueName || '',
      displayName: val.propertyValueDisplayName || val.propertyValueName || '',
      image: val.skuPropertyImagePath || val.propertyValueImage || '',
    })),
  }));

  const priceList = skuMod.skuPriceList || [];
  const prices = priceList.map((sku) => ({
    skuId: sku.skuId || 0,
    optionValueIds: sku.skuPropIds || sku.skuAttr || '',
    availableQuantity: sku.skuVal?.availQuantity || sku.availQuantity || 0,
    originalPrice: normalizeSinglePrice(sku.skuVal?.actSkuCalPrice || sku.skuVal?.skuCalPrice, sku),
    salePrice: normalizeSinglePrice(sku.skuVal?.skuActivityAmount || sku.skuVal?.skuAmount, sku),
  }));

  return { options, prices };
}

function normalizeSinglePrice(value, context) {
  if (!value && !context?.price) return null;
  const numVal = parseFloat(value) || 0;
  const currency = context?.currencyCode || context?.skuVal?.currency || '';
  return {
    currency,
    amount: numVal,
    formatted: currency ? `${currency} ${numVal.toFixed(2)}` : String(numVal),
  };
}

function normalizeSpecs(specMod) {
  if (!specMod) return [];
  const attrList = specMod.props || specMod.attrList || [];
  return attrList.map((attr) => ({
    attrName: attr.attrName || attr.name || '',
    attrValue: attr.attrValue || attr.value || '',
  }));
}

function normalizeCurrency(priceMod, skuMod) {
  const code =
    priceMod.currencyCode ||
    skuMod?.currencyCode ||
    priceMod.currency ||
    '';
  return code ? { currencyCode: code } : null;
}

function normalizePrice(priceMod, key, skuMod) {
  const priceObj = priceMod[key];
  if (priceObj && typeof priceObj === 'object' && priceObj.minAmount !== undefined) {
    const currency = priceObj.currency || priceMod.currencyCode || '';
    return {
      min: { currency, amount: priceObj.minAmount, formatted: priceObj.formattedMinAmount || '' },
      max: { currency, amount: priceObj.maxAmount, formatted: priceObj.formattedMaxAmount || '' },
    };
  }

  // Try extracting from sku price list as fallback
  if (skuMod?.skuPriceList?.length) {
    const amounts = skuMod.skuPriceList
      .map((s) => {
        const raw = key === 'originalPrice'
          ? s.skuVal?.actSkuCalPrice || s.skuVal?.skuCalPrice
          : s.skuVal?.skuActivityAmount || s.skuVal?.skuAmount;
        return parseFloat(raw) || 0;
      })
      .filter((v) => v > 0);
    if (amounts.length) {
      const currency = skuMod.currencyCode || '';
      const min = Math.min(...amounts);
      const max = Math.max(...amounts);
      return {
        min: { currency, amount: min, formatted: `${currency} ${min.toFixed(2)}` },
        max: { currency, amount: max, formatted: `${currency} ${max.toFixed(2)}` },
      };
    }
  }

  return null;
}

function normalizeShipping(shippingMod) {
  if (!shippingMod) return [];
  const list =
    shippingMod.generalFreightInfo?.originalLayoutResultList ||
    shippingMod.freightResult ||
    [];
  return list.map((item) => ({
    deliveryProviderName: item.bizData?.deliveryProviderName || item.company || '',
    deliveryInfo: {
      min: item.bizData?.deliveryDayMin || item.deliveryDayMin || 0,
      max: item.bizData?.deliveryDayMax || item.deliveryDayMax || 0,
    },
    shippingInfo: {
      from: item.bizData?.shipFromCode || item.fromArea || '',
      to: item.bizData?.shipToCode || item.toArea || '',
      fees: parseFloat(item.bizData?.displayAmount || item.freightAmount || 0),
      unreachable: Boolean(item.bizData?.unReachable || item.unReachable),
    },
  }));
}
