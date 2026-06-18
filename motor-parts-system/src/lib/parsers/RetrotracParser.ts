import { BaseParser } from './BaseParser';
import { ParseResult, Product } from './types';
import { extractRetrotracData } from '../utils/openai-extractor';
import * as cheerio from 'cheerio';

/**
 * Parser for Retrotrac (tiendab2b.retrotrac.com)
 * Handles both JSON responses from Retrotrac API and HTML from automation
 */
export class RetrotracParser extends BaseParser {
  readonly originCode = 'RETROTRAC';
  readonly originName = 'Retrotrac';

  canParse(content: string | object): boolean {
    if (typeof content === 'object' && content !== null) {
      const hasItems = Array.isArray((content as any).items);
      const hasCantidadTotal = typeof (content as any).cantidadTotal !== 'undefined';

      // If it has items array, it's likely Retrotrac
      if (hasItems) {
        return true;
      }

      // If it has cantidadTotal, also likely Retrotrac
      if (hasCantidadTotal) {
        return true;
      }
    }

    if (typeof content === 'string') {
      const trimmed = content.trim();

      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          return (
            Array.isArray(parsed.items) ||
            typeof parsed.cantidadTotal !== 'undefined' ||
            (parsed.data && Array.isArray(parsed.data.items))
          );
        } catch {
          // If JSON parsing fails, check for markers
        }
      }

      // Check for Retrotrac-specific markers (both API and HTML)
      const hasRetrotracDomain = content.includes('retrotrac.com');
      const hasRetrotracFields =
        content.includes('cantidadTotal') ||
        content.includes('"items"') ||
        content.includes('items') ||
        content.includes('itemPrice') ||
        content.includes('shortDescription');

      // Check for HTML-specific markers (from automation)
      const hasRetrotracHtml =
        content.includes('box-product__info') ||
        content.includes('CANT.DISPONIBLE');

      // If it has the domain or specific fields, it's likely Retrotrac
      if (hasRetrotracDomain || hasRetrotracFields || hasRetrotracHtml) {
        return true;
      }
    }

    return false;
  }

  async parse(content: string | object, searchTerm: string): Promise<ParseResult> {
    console.log(`🔍 [RETROTRAC] Parsing content for search term: "${searchTerm}"`);
    console.log(`🔍 [RETROTRAC] Content type: ${typeof content}`);

    // Check if content is HTML (from automation)
    if (typeof content === 'string' && content.includes('box-product__info')) {
      console.log('🔍 [RETROTRAC] Detected HTML content from automation, using HTML parser');
      return this.parseHtml(content, searchTerm);
    }

    const products: Product[] = [];
    let data: any;

    // Parse content
    const originalContent = typeof content === 'string' ? content : JSON.stringify(content);

    if (typeof content === 'string') {
      try {
        data = JSON.parse(content);
      } catch (error: any) {
        console.error('❌ [RETROTRAC] Failed to parse JSON:', error.message);

        // Try OpenAI extraction as fallback
        console.log('🤖 [RETROTRAC] Attempting OpenAI extraction as fallback for invalid JSON');
        try {
          const openaiResult = await extractRetrotracData(content, searchTerm);

          if (openaiResult.error) {
            throw new Error(openaiResult.error);
          }

          // Convert OpenAI results to our Product format
          const products: Product[] = openaiResult.products.map((item) => {
            // Remove "RET" prefix if reference starts with "RET"
            let reference = item.reference;
            if (reference && reference.toUpperCase().startsWith('RET')) {
              reference = reference.substring(3);
            }
            return this.createProduct({
              reference,
              description: item.description,
              price: item.price,
              stock: item.stock || 0,
              hasStock: item.hasStock,
              origin: this.originCode,
            });
          });

          console.log(`✅ [RETROTRAC] OpenAI extracted ${products.length} products as fallback`);

          return {
            originCode: this.originCode,
            originName: this.originName,
            searchTerm,
            products,
            metadata: {
              totalFound: products.length,
              extractedBy: 'openai',
              fallbackReason: `Invalid JSON: ${error.message}`,
            },
          };
        } catch (openaiError: any) {
          console.error('❌ [RETROTRAC] OpenAI extraction also failed:', openaiError.message);
          return {
            originCode: this.originCode,
            originName: this.originName,
            searchTerm,
            products: [],
            metadata: {
              error: `Invalid JSON response: ${error.message}. OpenAI extraction also failed: ${openaiError.message}`,
            },
          };
        }
      }
    } else {
      data = content;
    }

    // Validate structure - be more flexible
    console.log('🔍 [RETROTRAC] Data structure check:');
    console.log('  - Has data:', !!data);
    console.log('  - Data keys:', data ? Object.keys(data).join(', ') : 'none');
    console.log('  - Has items:', Array.isArray(data?.items));
    console.log('  - Items count:', Array.isArray(data?.items) ? data.items.length : 0);
    console.log('  - Has data.items:', !!data?.data?.items);

    // Check for items in various locations
    let items: any[] = [];
    if (Array.isArray(data.items)) {
      items = data.items;
      console.log('✅ [RETROTRAC] Found items array at data.items');
    } else if (Array.isArray(data.data?.items)) {
      items = data.data.items;
      console.log('✅ [RETROTRAC] Found items array at data.data.items');
    } else if (Array.isArray(data)) {
      // Sometimes the response is directly an array
      items = data;
      console.log('✅ [RETROTRAC] Response is directly an array');
    } else {
      console.error('❌ [RETROTRAC] Invalid response structure - no items array found');
      console.error('❌ [RETROTRAC] Data structure:', JSON.stringify(data, null, 2).substring(0, 1000));

      // Try OpenAI extraction as fallback when structure is invalid
      console.log('🤖 [RETROTRAC] Attempting OpenAI extraction as fallback for invalid structure');
      try {
        const openaiResult = await extractRetrotracData(originalContent, searchTerm);

        if (openaiResult.error) {
          throw new Error(openaiResult.error);
        }

        // Convert OpenAI results to our Product format
        const products: Product[] = openaiResult.products.map((item) =>
          this.createProduct({
            reference: item.reference,
            description: item.description,
            price: item.price,
            stock: item.stock || 0,
            hasStock: item.hasStock,
            origin: this.originCode,
          })
        );

        console.log(`✅ [RETROTRAC] OpenAI extracted ${products.length} products as fallback`);

        return {
          originCode: this.originCode,
          originName: this.originName,
          searchTerm,
          products,
          metadata: {
            totalFound: products.length,
            extractedBy: 'openai',
            fallbackReason: 'Invalid response structure - missing items array',
          },
        };
      } catch (openaiError: any) {
        console.error('❌ [RETROTRAC] OpenAI extraction also failed:', openaiError.message);
        return {
          originCode: this.originCode,
          originName: this.originName,
          searchTerm,
          products: [],
          metadata: {
            error: 'Invalid response structure - missing items array. OpenAI extraction also failed: ' + openaiError.message,
            rawResponse: data,
          },
        };
      }
    }

    console.log(`🔍 [RETROTRAC] Found ${items.length} items in response`);

    if (items.length === 0) {
      console.warn('⚠️ [RETROTRAC] No items found in response, but structure is valid');
      console.warn('⚠️ [RETROTRAC] Data keys:', Object.keys(data || {}));
      console.warn('⚠️ [RETROTRAC] cantidadTotal:', data?.cantidadTotal);
      console.warn('⚠️ [RETROTRAC] totalPage:', data?.totalPage);
    }

    const normalizedSearchTerm = this.normalizeReference(searchTerm);
    console.log(`🔍 [RETROTRAC] Normalized search term: "${normalizedSearchTerm}"`);

    // Process each item
    items.forEach((item: any, index: number) => {
      try {
        // Extract reference - prioritize shortDescription as it usually contains the exact search term
        // Then fallback to reference field, then search term
        let reference = '';

        // Priority 1: Use shortDescription if it exists (it's usually the exact reference code)
        if (item.shortDescription && item.shortDescription.trim()) {
          const shortDesc = item.shortDescription.trim();
          // Check if it's a code-like pattern (alphanumeric, 3+ chars)
          const codeMatch = shortDesc.match(/^([A-Z0-9]{3,})/);
          if (codeMatch) {
            reference = codeMatch[1];
          } else {
            // Use the full shortDescription if it looks like a reference
            reference = this.normalizeReference(shortDesc);
          }
        }

        // Priority 2: Use reference field (may have prefix like CTP, DON, etc.)
        if (!reference && item.reference) {
          reference = item.reference;
        }

        // Priority 3: Try to extract from name if it starts with a code
        if (!reference && item.name) {
          const nameMatch = item.name.trim().match(/^([A-Z0-9]{3,})/);
          if (nameMatch) {
            reference = nameMatch[1];
          }
        }

        // Priority 4: Use search term as fallback
        if (!reference) {
          reference = normalizedSearchTerm;
        }

        // Normalize the reference
        reference = this.normalizeReference(reference);

        // Remove "RET" prefix if reference starts with "RET"
        if (reference.toUpperCase().startsWith('RET')) {
          reference = reference.substring(3);
        }

        // Log which source was used for reference
        if (item.shortDescription && this.normalizeReference(item.shortDescription) === reference) {
          console.log(`🔍 [RETROTRAC] Item ${index + 1} - Using shortDescription as reference: "${reference}"`);
        } else if (item.reference && this.normalizeReference(item.reference) === reference) {
          console.log(`🔍 [RETROTRAC] Item ${index + 1} - Using reference field: "${reference}" (original: "${item.reference}")`);
        }

        // Check if this item matches the search term
        // If the API returned it, it likely matches, but we can do a quick check
        const itemMatches =
          this.matchesSearchTerm(reference, searchTerm) ||
          (item.shortDescription && this.matchesSearchTerm(this.normalizeReference(item.shortDescription), searchTerm)) ||
          (item.name && this.matchesSearchTerm(this.normalizeReference(item.name), searchTerm));

        if (!itemMatches) {
          // Still include the item, but log it
          console.log(`⚠️ [RETROTRAC] Item ${index + 1} reference "${reference}" may not match search term "${searchTerm}", but including it anyway`);
        }

        // Extract description
        const description = item.name || item.shortDescription || '';

        // Extract price - use itemPrice (without tax) in COP, fallback to currentPrice
        let price = 0;
        if (item.itemPrice) {
          // itemPrice is a string like "147725.0000", parse it
          price = parseFloat(item.itemPrice.toString()) || 0;
        } else if (item.currentPrice) {
          price = parseFloat(item.currentPrice.toString()) || 0;
        } else if (item.lastPrice) {
          price = parseFloat(item.lastPrice.toString()) || 0;
        }

        // Log price extraction
        console.log(`🔍 [RETROTRAC] Item ${index + 1} - Price extraction:`, {
          itemPrice: item.itemPrice,
          currentPrice: item.currentPrice,
          lastPrice: item.lastPrice,
          priceTax: item.priceTax,
          finalPrice: price,
        });

        // Extract stock - use available field (real stock), never use cantidad (it's a huge default value)
        let stock = 0;
        if (typeof item.available === 'number') {
          stock = item.available;
        } else if (typeof item.available === 'string') {
          // Sometimes available might be a string
          stock = parseInt(item.available, 10) || 0;
        }

        // Never use cantidad - it's always a huge default value (100000000000) in RETROTRAC
        // Only use available which is the real stock

        const hasStock = stock > 0;

        // Log stock extraction
        console.log(`🔍 [RETROTRAC] Item ${index + 1} - Stock extraction:`, {
          available: item.available,
          cantidad: item.cantidad,
          finalStock: stock,
          hasStock,
        });

        // Extract image URL
        let imageUrl: string | undefined = undefined;
        if (item.principalImage) {
          if (item.imagesDetail && item.imagesDetail.length > 0) {
            const imageDetail = item.imagesDetail[0];
            if (imageDetail.path && imageDetail.image) {
              imageUrl = `${imageDetail.path}${imageDetail.image}`;
            }
          }
          if (!imageUrl && item.principalImage.startsWith('http')) {
            imageUrl = item.principalImage;
          }
        }

        // Extract link - construct from slug or producto_slug
        const link = item.slug || item.producto_slug
          ? `https://admin.retrotrac.com/frontend/web/index.php/${item.slug || item.producto_slug}`
          : undefined;

        // Extract brand if available
        const brand = item.marca_disponible || undefined;

        console.log(`✅ [RETROTRAC] Product ${index + 1}: ${reference} - ${description.substring(0, 50)} - Price: ${price} - Stock: ${stock}`);

        products.push({
          reference, // Already normalized above
          description: description || undefined,
          price: price > 0 ? price : undefined,
          stock,
          hasStock,
          imageUrl,
          link,
          brand,
          origin: this.originCode,
          rawData: {
            id: item.id,
            reference: item.reference,
            shortDescription: item.shortDescription,
            itemPrice: item.itemPrice,
            priceTax: item.priceTax,
            available: item.available,
            cantidad: item.cantidad,
          },
        });
      } catch (error: any) {
        console.error(`❌ [RETROTRAC] Error processing item ${index + 1}:`, error.message);
      }
    });

    console.log(`✅ [RETROTRAC] Parsed ${products.length} products`);

    return {
      originCode: this.originCode,
      originName: this.originName,
      searchTerm,
      products,
      metadata: {
        totalFound: products.length,
        rawResponse: {
          cantidadTotal: data.cantidadTotal,
          totalPage: data.totalPage,
        },
      },
    };
  }

  /**
   * Parse HTML content from automation (tiendab2b.retrotrac.com)
   * Structure:
   * - .box-product__info contains product information
   * - .box-product__name has the reference (Ref: CTP9X1439)
   * - CANT.DISPONIBLE: shows stock
   * - .box-product__reference has description
   * - .box-product__price-normal has price
   */
  private parseHtml(html: string, searchTerm: string): ParseResult {
    console.log('🔍 [RETROTRAC] Parsing HTML content from automation');
    const $ = cheerio.load(html);
    const products: Product[] = [];

    // Find all product boxes
    const productBoxes = $('.box-product__info');
    console.log(`🔍 [RETROTRAC] Found ${productBoxes.length} product boxes`);

    if (productBoxes.length === 0) {
      console.warn('⚠️ [RETROTRAC] No product boxes found in HTML');
      return this.emptyResult(searchTerm);
    }

    // Process each product box
    productBoxes.each((index, boxElement) => {
      try {
        const $box = $(boxElement);
        console.log(`🔍 [RETROTRAC] Processing product box ${index + 1}/${productBoxes.length}`);

        // Extract reference from .box-product__name (e.g., "Ref: CTP9X1439")
        const $nameLink = $box.find('.box-product__name a');
        const nameText = $nameLink.text().trim();
        let reference = '';

        // Extract reference from "Ref: CTP9X1439" format
        const refMatch = nameText.match(/Ref:\s*([A-Z0-9]+)/i);
        if (refMatch) {
          reference = this.normalizeReference(refMatch[1]);
          // Remove "RET" prefix if reference starts with "RET"
          if (reference.toUpperCase().startsWith('RET')) {
            reference = reference.substring(3);
          }
        }

        if (!reference) {
          console.log(`🔍 [RETROTRAC] Box ${index + 1} - No reference found, skipping`);
          return;
        }

        console.log(`🔍 [RETROTRAC] Box ${index + 1} - Reference: ${reference}`);

        // Extract stock from "CANT.DISPONIBLE: 3" format
        let stock = 0;
        const $stockDiv = $box.find('.box-product__name.w700.color-base');
        const stockText = $stockDiv.text().trim();
        const stockMatch = stockText.match(/CANT\.DISPONIBLE:\s*(\d+)/);
        if (stockMatch) {
          stock = parseInt(stockMatch[1], 10);
        }

        console.log(`🔍 [RETROTRAC] Box ${index + 1} - Stock: ${stock}`);

        // Extract description from .box-product__reference
        const description = $box.find('.box-product__reference.small').text().trim();
        console.log(`🔍 [RETROTRAC] Box ${index + 1} - Description: ${description}`);

        // Extract price WITHOUT IVA from .box-product__price-normal
        let price = 0;

        // Find the parent box-product element (go up from box-product__info)
        const $productBox = $box.closest('.box-product');
        const $priceDiv = $productBox.find('.box-product__price .box-product__price-normal');

        // Find the visible price span (aria-hidden="false")
        // The visible price is already the price WITHOUT IVA
        const $allPriceSpans = $priceDiv.find('span.h6, span.ng-binding');

        let visiblePriceText = '';

        $allPriceSpans.each((_, spanElement) => {
          const $span = $(spanElement);
          const ariaHidden = $span.attr('aria-hidden');

          // Check if this span is visible (aria-hidden="false")
          if (ariaHidden === 'false' && $span.text().trim()) {
            visiblePriceText = $span.text().trim();
            console.log(`🔍 [RETROTRAC] Box ${index + 1} - Found visible price: ${visiblePriceText}`);
          }
        });

        if (visiblePriceText) {
          // Extract numeric value from "$  152,074" format
          const priceMatch = visiblePriceText.match(/\$\s*([\d,.]+)/);

          if (priceMatch) {
            // The visible price is the price WITHOUT IVA - use it directly
            price = parseFloat(priceMatch[1].replace(/,/g, ''));
            console.log(`🔍 [RETROTRAC] Box ${index + 1} - Price WITHOUT IVA: ${price}`);
          }
        } else {
          console.warn(`⚠️ [RETROTRAC] Box ${index + 1} - No visible price found`);
        }

        const hasStock = stock > 0;

        console.log(`✅ [RETROTRAC] Product ${index + 1}: ${reference} - ${description.substring(0, 50)} - Price: ${price} - Stock: ${stock}`);

        products.push(
          this.createProduct({
            reference,
            description: description || undefined,
            price: price > 0 ? price : undefined,
            stock,
            hasStock,
            origin: this.originCode,
          })
        );
      } catch (error: any) {
        console.error(`❌ [RETROTRAC] Error processing box ${index + 1}:`, error.message);
      }
    });

    console.log(`✅ [RETROTRAC] Parsed ${products.length} products from HTML`);

    return {
      originCode: this.originCode,
      originName: this.originName,
      searchTerm,
      products,
      metadata: {
        totalFound: products.length,
        extractedBy: 'html-parser',
      },
    };
  }

  /**
   * Check if reference matches search term
   * Handles cases where reference might contain the search term or vice versa
   * Also handles prefixes like CTP, CAT, DON, etc.
   */
  private matchesSearchTerm(reference: string, searchTerm: string): boolean {
    if (!reference || !searchTerm) return false;

    const normalizedRef = this.normalizeReference(reference);
    const normalizedSearch = this.normalizeReference(searchTerm);

    // Exact match
    if (normalizedRef === normalizedSearch) {
      return true;
    }

    // Reference contains search term or vice versa (e.g., "CTP9X1439" contains "9X1439")
    if (normalizedRef.includes(normalizedSearch) || normalizedSearch.includes(normalizedRef)) {
      return true;
    }

    // Check for partial matches by removing common prefixes
    // Remove prefixes like CAT, DON, CTP, P, K, etc. (case insensitive)
    const refWithoutPrefix = normalizedRef.replace(/^(CAT|DON|CTP|P|K|CT|DN)[A-Z0-9]*/i, '');
    if (refWithoutPrefix && refWithoutPrefix.length > 0) {
      // Check if the reference without prefix matches the search term
      if (refWithoutPrefix === normalizedSearch ||
        refWithoutPrefix.includes(normalizedSearch) ||
        normalizedSearch.includes(refWithoutPrefix)) {
        return true;
      }
    }

    // Also check if search term without prefix matches reference
    const searchWithoutPrefix = normalizedSearch.replace(/^(CAT|DON|CTP|P|K|CT|DN)[A-Z0-9]*/i, '');
    if (searchWithoutPrefix && searchWithoutPrefix.length > 0 && searchWithoutPrefix !== normalizedSearch) {
      if (normalizedRef === searchWithoutPrefix ||
        normalizedRef.includes(searchWithoutPrefix) ||
        searchWithoutPrefix.includes(normalizedRef)) {
        return true;
      }
    }

    return false;
  }
}

