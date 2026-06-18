import { BaseParser } from './BaseParser';
import { ParseResult, Product } from './types';

/**
 * Parser for Partequipos (tienda.partequipos.com)
 * Handles HTML responses from Magento-based store
 * 
 * TODO: Update selectors based on actual HTML structure
 */
export class PartequiposParser extends BaseParser {
  readonly originCode = 'PARTEQUIPOS';
  readonly originName = 'Partequipos';

  canParse(content: string | object): boolean {
    if (typeof content !== 'string') return false;

    // Check for Partequipos-specific markers
    const hasPartequiposDomain = content.includes('tienda.partequipos.com') || content.includes('partequipos.com');
    const hasMagentoMarkers =
      content.includes('porto-icon') ||
      content.includes('product-item-info') ||
      content.includes('products-list') ||
      content.includes('product-item') ||
      content.includes('magento') ||
      content.includes('mage-');

    // If it has the domain or Magento markers, it's likely Partequipos
    if (hasPartequiposDomain || hasMagentoMarkers) {
      return true;
    }

    // If content is HTML and has product-related structure, might be Partequipos
    if (content.length > 100 && (content.includes('<html') || content.includes('<!DOCTYPE'))) {
      // Check for common Magento/Partequipos patterns
      if (content.includes('catalogsearch') || content.includes('search result')) {
        return true;
      }
    }

    return false;
  }

  async parse(html: string, searchTerm: string): Promise<ParseResult> {
    const $ = this.loadCheerio(html);
    const products: Product[] = [];

    console.log(`🔍 [PARTEQUIPOS] Parsing HTML for search term: "${searchTerm}"`);
    console.log(`🔍 [PARTEQUIPOS] HTML length: ${html.length} characters`);

    // Check if page indicates no results - be more specific to avoid false positives
    const noResultsIndicators = [
      'no se encontraron productos',
      'no se encontraron resultados',
      'sin resultados',
      'we couldn\'t find any products',
      'no products found',
      'no hay productos',
      'no hay resultados',
    ];

    // Check for specific "no results" messages in common locations
    const noResultsMessages = $('.message.notice.empty, .message.info.empty, .catalogsearch-no-result, .no-results, .empty');
    const hasNoResultsMessage = noResultsMessages.length > 0;

    const pageText = $.text().toLowerCase();
    const hasNoResultsText = noResultsIndicators.some(indicator => {
      // Make sure the indicator appears in a meaningful context, not just anywhere
      const index = pageText.indexOf(indicator.toLowerCase());
      if (index === -1) return false;
      // Check surrounding text to ensure it's a real "no results" message
      const context = pageText.substring(Math.max(0, index - 20), Math.min(pageText.length, index + indicator.length + 20));
      return context.includes('resultado') || context.includes('producto') || context.includes('search');
    });

    // Only return no results if we have both a visual indicator AND text confirmation
    // Don't return early - let the parser try to find products first
    if (hasNoResultsMessage && hasNoResultsText) {
      console.log('ℹ️ [PARTEQUIPOS] Page indicates no results found (both message and text)');
      // Still continue to try parsing - sometimes products are found even with these messages
    } else if (hasNoResultsMessage || hasNoResultsText) {
      console.log('⚠️ [PARTEQUIPOS] Possible no results indicator, but continuing to parse');
    }

    // Try to extract products from JavaScript/JSON-LD embedded in page
    // Magento sometimes embeds product data in script tags
    const scriptTags = $('script[type="application/ld+json"], script[type="application/json"]');
    if (scriptTags.length > 0) {
      console.log(`🔍 [PARTEQUIPOS] Found ${scriptTags.length} JSON-LD/JSON script tags`);
      scriptTags.each((_, script) => {
        try {
          const scriptContent = $(script).html();
          if (scriptContent) {
            const jsonData = JSON.parse(scriptContent);
            // Look for product data in various structures
            if (Array.isArray(jsonData)) {
              jsonData.forEach((item: any) => {
                if (item['@type'] === 'Product' || item.sku || item.name) {
                  const product = this.extractFromJsonLd(item, searchTerm);
                  if (product) {
                    products.push(product);
                  }
                }
              });
            } else if (jsonData['@type'] === 'ItemList' && jsonData.itemListElement) {
              jsonData.itemListElement.forEach((item: any) => {
                if (item.item && item.item['@type'] === 'Product') {
                  const product = this.extractFromJsonLd(item.item, searchTerm);
                  if (product) {
                    products.push(product);
                  }
                }
              });
            }
          }
        } catch (e) {
          // Not valid JSON, skip
        }
      });
    }

    // Find all product items - Magento structure
    // The HTML has: <ol class="products list items product-items __ "> with <li class="item product product-item">
    // Try multiple selectors to be more flexible

    // Collect all possible product items
    let productItems = $('li.item.product.product-item');

    // Try alternative selectors if first one fails
    if (productItems.length === 0) {
      productItems = $('li.product-item');
    }
    if (productItems.length === 0) {
      productItems = $('ol.products.list.items li.product-item');
    }
    if (productItems.length === 0) {
      productItems = $('.products.list.items.product-items li.product-item');
    }
    if (productItems.length === 0) {
      productItems = $('.products-grid .product-item, .products-list .product-item');
    }
    if (productItems.length === 0) {
      productItems = $('[data-container="product-grid"] li.product-item, [data-container="product-grid"] .product-item');
    }

    // If still nothing, try finding by product-item-info and getting parent li
    if (productItems.length === 0) {
      const foundItems: any[] = [];
      $('.product-item-info, .product-item-details').each((_, elem) => {
        const $parentLi = $(elem).closest('li.item.product.product-item, li.product-item, li.item');
        if ($parentLi.length > 0) {
          // Check if already added
          const alreadyAdded = foundItems.some(item => item === $parentLi[0]);
          if (!alreadyAdded) {
            foundItems.push($parentLi[0]);
          }
        } else {
          // If no li parent, try to find product wrapper
          const $wrapper = $(elem).closest('[data-container="product-grid"], .product-items, .products-grid');
          if ($wrapper.length > 0) {
            foundItems.push(elem);
          }
        }
      });
      if (foundItems.length > 0) {
        productItems = $(foundItems);
      }
    }

    console.log(`🔍 [PARTEQUIPOS] Found ${productItems.length} product items after trying selectors`);

    // Debug: Log first few product items HTML if found
    if (productItems.length > 0) {
      const firstItem = productItems.first();
      const itemHtml = $.html(firstItem);
      console.log(`🔍 [PARTEQUIPOS] First product item HTML (first 500 chars): ${itemHtml.substring(0, 500)}`);
    }

    if (productItems.length === 0 && products.length === 0) {
      console.warn('⚠️ [PARTEQUIPOS] No products found, trying all possible selectors...');
      // Try all possible selectors
      const allSelectors = [
        'li.product-item',
        '.product-item-info',
        '.product-item-details',
        '[data-container="product-grid"]',
        '[data-role="priceBox"]',
        '.item.product',
        '.product-items li',
        '.products-grid .product-item',
        '[data-product-id]'
      ];

      for (const selector of allSelectors) {
        const items = $(selector);
        console.log(`🔍 [PARTEQUIPOS] Selector "${selector}" found ${items.length} items`);
        if (items.length > 0) {
          items.each((_, element) => {
            const $item = $(element).closest('li.product-item').length > 0
              ? $(element).closest('li.product-item')
              : $(element).closest('[data-container="product-grid"]')?.parent() || $(element);
            const product = this.extractProduct($, $item, searchTerm);
            if (product) {
              const exists = products.some(p => p.reference === product.reference);
              if (!exists) {
                products.push(product);
              }
            }
          });
        }
      }

      if (products.length === 0) {
        // Log more HTML for debugging
        const bodyHtml = $('body').html() || '';
        const searchResultsHtml = $('.search.results, .catalogsearch-result-index, .toolbar-products').html() || '';
        console.error('❌ [PARTEQUIPOS] No products extracted.');
        console.error('❌ [PARTEQUIPOS] Body HTML length:', bodyHtml.length);
        console.error('❌ [PARTEQUIPOS] Search results HTML length:', searchResultsHtml.length);
        console.error('❌ [PARTEQUIPOS] HTML preview (first 3000 chars):', html.substring(0, 3000));
      }

      return {
        originCode: this.originCode,
        originName: this.originName,
        searchTerm,
        products,
        metadata: {
          totalFound: products.length,
        },
      };
    }

    productItems.each((index, element) => {
      const $item = $(element);

      // Debug: Log what we're trying to extract
      const itemClasses = $item.attr('class') || '';
      console.log(`🔍 [PARTEQUIPOS] Processing item ${index + 1}, classes: "${itemClasses}"`);

      const product = this.extractProduct($, $item, searchTerm);
      if (product) {
        products.push(product);
        console.log(`✅ [PARTEQUIPOS] Product ${index + 1}: ${product.reference} - ${product.description?.substring(0, 50)}`);
      } else {
        console.warn(`⚠️ [PARTEQUIPOS] Item ${index + 1} did not produce a valid product`);
      }
    });

    console.log(`✅ [PARTEQUIPOS] Parsed ${products.length} products`);

    return {
      originCode: this.originCode,
      originName: this.originName,
      searchTerm,
      products,
      metadata: {
        totalFound: products.length,
      },
    };
  }

  /**
   * Extract product data from a product item element
   * Based on actual Magento HTML structure from tienda.partequipos.com
   */
  private extractProduct($: any, $item: any, searchTerm: string): Product | null {
    console.log(`🔍 [PARTEQUIPOS] Extracting product from item...`);

    // Extract product name/description - try multiple selectors
    // HTML structure: <strong class="product name product-item-name"><a class="product-item-link">FILTRO COMBUSTIBLE MOTOR 1R0750</a></strong>
    let productName = $item.find('strong.product.name.product-item-name .product-item-link').first().text().trim();
    if (!productName) {
      productName = $item.find('.product-item-name .product-item-link').first().text().trim();
    }
    if (!productName) {
      productName = $item.find('.product.name .product-item-link').first().text().trim();
    }
    if (!productName) {
      productName = $item.find('.product-item-name a, .product-name a, strong.product-item-name').first().text().trim();
    }
    if (!productName) {
      // Last resort: find any link with href containing /catalog/product/view
      productName = $item.find('a[href*="/catalog/product/view"]').first().text().trim();
    }

    console.log(`🔍 [PARTEQUIPOS] Product name extracted: "${productName}"`);

    // Extract reference from:
    // 1. Product name (e.g., "FILTRO COMBUSTIBLE MOTOR 1R0750" -> "1R0750") - PRIORITY
    // 2. Data attribute (data-sku) - only if it looks like a reference (contains letters)
    // 3. Search term as fallback
    let reference = '';

    // Get SKU from data attribute (for rawData, but may not use as reference)
    const sku = $item.find('button[data-sku], [data-sku]').first().attr('data-sku') || '';
    console.log(`🔍 [PARTEQUIPOS] SKU from data attribute: "${sku}"`);

    // PRIORITY 1: Extract from product name first (most reliable)
    if (productName) {
      const extractedFromName = this.extractReference(productName);
      // If extracted reference matches or contains the search term, use it
      if (extractedFromName && (extractedFromName.toUpperCase() === searchTerm.toUpperCase() ||
        extractedFromName.toUpperCase().includes(searchTerm.toUpperCase()) ||
        searchTerm.toUpperCase().includes(extractedFromName.toUpperCase()))) {
        reference = extractedFromName;
        console.log(`🔍 [PARTEQUIPOS] Reference from product name: "${reference}"`);
      } else if (extractedFromName && extractedFromName.length >= 4) {
        // If extracted reference looks valid (at least 4 chars), use it
        reference = extractedFromName;
        console.log(`🔍 [PARTEQUIPOS] Reference from product name: "${reference}"`);
      }
    }

    // PRIORITY 2: Try to get SKU from data attribute (only if it looks like a reference)
    if (!reference && sku) {
      // SKU might be like "1R0750-ASTL", extract base reference
      const skuBase = sku.split('-')[0].trim().toUpperCase();
      // Only use SKU if it contains letters (not just numbers like product IDs)
      if (/[A-Za-z]/.test(skuBase)) {
        reference = skuBase;
        console.log(`🔍 [PARTEQUIPOS] Reference from SKU: "${reference}"`);
      } else {
        console.log(`🔍 [PARTEQUIPOS] SKU "${sku}" appears to be a product ID (numeric only), skipping`);
      }
    }

    // PRIORITY 3: Fallback to search term
    if (!reference) {
      reference = this.normalizeReference(searchTerm);
      console.log(`🔍 [PARTEQUIPOS] Reference from search term (fallback): "${reference}"`);
    }

    if (!reference) {
      console.warn('⚠️ [PARTEQUIPOS] Could not extract reference from product item');
      console.warn('⚠️ [PARTEQUIPOS] Product name:', productName);
      console.warn('⚠️ [PARTEQUIPOS] SKU:', sku);
      return null;
    }

    // Extract description
    const description = productName || $item.find('.product-item-description, .short-description').first().text().trim();

    // Extract price - ALWAYS use price WITHOUT IVA
    // Method 1: Find price near "PRECIO SIN IVA" text (highest priority)
    // HTML structure: <span id="product-price-22186" data-price-amount="28240" data-price-type="finalPrice">
    // The price without IVA is typically the lower price and is marked with "PRECIO SIN IVA"
    let price = 0;
    let priceAmount: string | undefined = undefined;

    // First, try to find price by data-product-id, prioritizing finalPrice (which is WITHOUT IVA)
    // The price without IVA is in #product-price-{id} with data-price-type="finalPrice"
    // The price with IVA is in #old-price-{id} with data-price-type="oldPrice"
    const productId = $item.find('[data-product-id]').first().attr('data-product-id');
    if (productId) {
      // ALWAYS prioritize finalPrice (price without IVA) over oldPrice (price with IVA)
      // Use filter to explicitly exclude old-price elements
      const finalPriceElems = $item.find(`[id^="product-price-${productId}"][data-price-type="finalPrice"][data-price-amount]`).filter((_index: number, el: any) => {
        const id = $(el).attr('id') || '';
        // Must be product-price (NOT old-price) and finalPrice type
        return id === `product-price-${productId}` || (id.startsWith('product-price-') && !id.includes('old-price'));
      });

      if (finalPriceElems.length > 0) {
        const finalPriceElem = $(finalPriceElems[0]);
        priceAmount = finalPriceElem.attr('data-price-amount');
        if (priceAmount) {
          price = parseFloat(priceAmount) || 0;
          const elemId = finalPriceElem.attr('id') || '';
          console.log(`🔍 [PARTEQUIPOS] Price from finalPrice (id: ${elemId}, product-id ${productId}, WITHOUT IVA): ${price}`);

          // Double-check: if we got old-price, that's an error
          if (elemId.includes('old-price')) {
            console.error(`❌ [PARTEQUIPOS] ERROR: Found old-price element when looking for finalPrice! Trying alternative...`);
            price = 0; // Reset to try alternative
          }
        }
      }

      // If we didn't find it or got old-price, try alternative selector
      if (!price || price === 0) {
        const altPriceElems = $item.find(`span#product-price-${productId}[data-price-type="finalPrice"][data-price-amount]`).filter((_index: number, el: any) => {
          const id = $(el).attr('id') || '';
          return !id.includes('old-price');
        });

        if (altPriceElems.length > 0) {
          const altPriceElem = $(altPriceElems[0]);
          priceAmount = altPriceElem.attr('data-price-amount');
          if (priceAmount) {
            price = parseFloat(priceAmount) || 0;
            console.log(`🔍 [PARTEQUIPOS] Price from alternative selector (WITHOUT IVA): ${price}`);
          }
        }
      }

      // If still not found, try finding by excluding old-price explicitly
      if (!price || price === 0) {
        const priceElems = $item.find(`[data-price-amount]`).filter((_index: number, el: any) => {
          const id = $(el).attr('id') || '';
          const priceType = $(el).attr('data-price-type') || '';
          // Must be product-price (not old-price) and finalPrice type
          return id.includes(`product-price-${productId}`) &&
            !id.includes('old-price') &&
            priceType === 'finalPrice';
        });

        if (priceElems.length > 0) {
          priceAmount = $(priceElems[0]).attr('data-price-amount');
          if (priceAmount) {
            price = parseFloat(priceAmount) || 0;
            console.log(`🔍 [PARTEQUIPOS] Price from filtered selector (WITHOUT IVA): ${price}`);
          }
        }
      }
    }

    // Method 2: Fallback to any price with product-id if finalPrice not found
    // BUT exclude old-price elements explicitly
    if (!price || price === 0 && productId) {
      const priceElems = $item.find(`#product-price-${productId}[data-price-amount]`).filter((_index: number, el: any) => {
        const id = $(el).attr('id') || '';
        // Exclude old-price elements
        return !id.includes('old-price');
      });

      if (priceElems.length > 0) {
        // Get the first element that is NOT old-price
        const priceElem = $(priceElems[0]);
        priceAmount = priceElem.attr('data-price-amount');
        if (priceAmount) {
          price = parseFloat(priceAmount) || 0;
          console.log(`🔍 [PARTEQUIPOS] Price from data-price-amount (product-id ${productId}, excluding old-price): ${price}`);
        }
      }
    }

    // Method 3: Try any element with data-price-type="finalPrice" (usually without IVA)
    if (!price || price === 0) {
      const finalPriceAttr = $item.find('[data-price-type="finalPrice"][data-price-amount]').first().attr('data-price-amount');
      if (finalPriceAttr) {
        priceAmount = finalPriceAttr;
        price = parseFloat(finalPriceAttr) || 0;
        console.log(`🔍 [PARTEQUIPOS] Price from finalPrice (any element): ${price}`);
      }
    }

    // Method 4: If multiple prices exist, use the lowest one (price without IVA is typically lower)
    if (!price || price === 0) {
      const allPrices: number[] = [];
      $item.find('[data-price-amount]').each((_index: number, el: any) => {
        const priceVal = parseFloat($(el).attr('data-price-amount') || '0');
        if (priceVal > 0) {
          allPrices.push(priceVal);
        }
      });

      if (allPrices.length > 0) {
        // Use the minimum price (price without IVA is usually the lower one)
        const minPrice = Math.min(...allPrices);
        priceAmount = minPrice.toString();
        price = minPrice;
        console.log(`🔍 [PARTEQUIPOS] Price from minimum of ${allPrices.length} prices found: ${price}`);
      }
    }

    // Method 5: Fallback to any price element (last resort)
    // BUT exclude old-price elements explicitly
    if (!price || price === 0) {
      const priceElems = $item.find('[data-price-amount]').filter((_index: number, el: any) => {
        const id = $(el).attr('id') || '';
        // Exclude old-price elements
        return !id.includes('old-price');
      });

      if (priceElems.length > 0) {
        priceAmount = $(priceElems[0]).attr('data-price-amount');
        if (priceAmount) {
          price = parseFloat(priceAmount) || 0;
          console.log(`🔍 [PARTEQUIPOS] Price from any data-price-amount (fallback, excluding old-price): ${price}`);
        }
      }
    }

    // Method 6: Extract from price text if data attribute not available
    let priceText: string | undefined = undefined;
    if (!price || price === 0) {
      priceText = $item.find('.price-wrapper .price, .price-box .price, [data-price-type="finalPrice"] .price, span.price').first().text().trim();
      console.log(`🔍 [PARTEQUIPOS] Price text: "${priceText}"`);
      if (priceText) {
        // Remove currency symbol and spaces, then parse
        let cleaned = priceText.replace(/[$\s]/g, '');
        // Colombian format: dots are thousands separators
        cleaned = cleaned.replace(/\./g, '');
        price = parseFloat(cleaned) || 0;
        console.log(`🔍 [PARTEQUIPOS] Parsed price from text: ${price}`);
      }
    }

    // Extract stock availability
    const stockElement = $item.find('.stock.available');
    const hasStock = stockElement.length > 0;

    let stock = 0;
    if (hasStock) {
      const stockText = $item.find('.stock.available span').first().text().trim();
      console.log(`🔍 [PARTEQUIPOS] Stock text: "${stockText}"`);
      // If it says "Disponible" but no quantity, assume available (unknown quantity)
      if (stockText.toLowerCase().includes('disponible')) {
        stock = 1; // Available but quantity unknown
      } else {
        stock = this.extractNumber(stockText);
      }
    }
    console.log(`🔍 [PARTEQUIPOS] Stock: ${stock}, hasStock: ${hasStock}`);

    // Extract product link - try multiple selectors
    let linkAttr = $item.find('.product-item-link').attr('href') || '';
    if (!linkAttr) {
      linkAttr = $item.find('.product.name a').attr('href') || '';
    }
    if (!linkAttr) {
      linkAttr = $item.find('a[href*="/catalog/product/view"]').attr('href') || '';
    }
    const fullLink = linkAttr.startsWith('http')
      ? linkAttr
      : linkAttr
        ? `https://tienda.partequipos.com${linkAttr.startsWith('/') ? linkAttr : '/' + linkAttr}`
        : undefined;

    // Extract image
    let imageUrl = $item.find('.product-image-photo.default_image').attr('src') || '';
    if (!imageUrl) {
      imageUrl = $item.find('.product-image-photo').attr('src') || '';
    }
    if (!imageUrl) {
      imageUrl = $item.find('img[alt*="' + reference + '"], img[src*="catalog/product"]').attr('src') || '';
    }

    // Extract brand if available (look for "STAL" or similar in the HTML)
    const brand = $item.find('.star-container__title, .product-brand, [class*="brand"]').first().text().trim();

    console.log(`✅ [PARTEQUIPOS] Product extracted: reference="${reference}", price=${price}, stock=${stock}, hasStock=${hasStock}`);

    return this.createProduct({
      reference,
      description,
      price: price > 0 ? price : undefined,
      stock,
      hasStock,
      imageUrl: imageUrl || undefined,
      link: fullLink,
      brand: brand || undefined,
      origin: this.originCode,
      rawData: {
        productName,
        priceAmount,
        priceText,
        price: price || 0,
        sku,
      },
    });
  }

  /**
   * Extract reference/part number from product name text
   * Examples:
   * - "FILTRO COMBUSTIBLE MOTOR 1R0750" -> "1R0750"
   * - "DIENTE BALDE (GENERAL) 1U3202" -> "1U3202"
   * - "TR RODILLO PC300LC-8M0 SP" -> "PC300LC-8M0" (if contains dash)
   */
  private extractReference(text: string): string {
    if (!text) return '';

    // First, try to find codes at the end (most common pattern)
    // Match patterns like: "1R0750", "1U3202", "ABC123", etc.
    // Look for alphanumeric codes at the end of the string
    const endMatch = text.match(/\b([A-Z0-9]{4,})(?:\s*$)/);
    if (endMatch) {
      return endMatch[1];
    }

    // Try to find codes with dashes (e.g., "PC300LC-8M0")
    const dashMatch = text.match(/\b([A-Z0-9]+-[A-Z0-9]+)\b/);
    if (dashMatch) {
      return dashMatch[1];
    }

    // Try to find any alphanumeric codes (4+ characters)
    const anyMatch = text.match(/\b([A-Z0-9]{4,})\b/);
    if (anyMatch) {
      return anyMatch[1];
    }

    // Fallback: return cleaned text
    return text.trim();
  }

  /**
   * Extract product from JSON-LD structured data
   */
  private extractFromJsonLd(item: any, searchTerm: string): Product | null {
    try {
      const sku = item.sku || item.gtin || item.productID || '';
      const name = item.name || item.title || '';
      const description = item.description || name;
      const priceStr = item.offers?.price || item.price || '0';
      const price = typeof priceStr === 'string' ? parseFloat(priceStr.replace(/[^\d.]/g, '')) : parseFloat(priceStr);
      const availability = item.offers?.availability || item.availability || '';
      const hasStock = availability && !availability.includes('OutOfStock') && !availability.includes('Discontinued');
      const imageUrl = item.image || item.imageUrl || '';
      const url = item.url || item.identifier || '';

      // Extract reference from SKU or name
      let reference = this.normalizeReference(sku || '');
      if (!reference && name) {
        reference = this.extractReference(name);
      }
      if (!reference) {
        reference = this.normalizeReference(searchTerm);
      }

      if (!reference) {
        return null;
      }

      return {
        reference,
        description: description || name,
        price: price || 0,
        stock: hasStock ? 1 : 0,
        hasStock,
        imageUrl: typeof imageUrl === 'string' ? imageUrl : (Array.isArray(imageUrl) ? imageUrl[0] : ''),
        link: typeof url === 'string' ? url : '',
        origin: this.originCode,
        rawData: item,
      };
    } catch (error) {
      console.warn(`⚠️ [PARTEQUIPOS] Error extracting from JSON-LD:`, error);
      return null;
    }
  }
}

