import { BaseParser } from './BaseParser';
import { ParseResult, Product } from './types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Parser for MONTECARLO (portal.imm.com.co)
 * Handles HTML responses from their shop search system
 */
export class MontecarloParser extends BaseParser {
  readonly originCode = 'MONTECARLO';
  readonly originName = 'Montecarlo';

  canParse(content: string | object): boolean {
    if (typeof content !== 'string') return false;

    // Check for MONTECARLO-specific markers
    return (
      content.includes('portal.imm.com.co') ||
      content.includes('imm.com.co') ||
      content.includes('oe_search_box') ||
      content.includes('search-query') ||
      content.includes('MONTECARLO')
    );
  }

  async parse(html: string, searchTerm: string): Promise<ParseResult> {
    // Save HTML to file for debugging
    try {
      const debugDir = path.join(process.cwd(), 'debug-html');
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      // Sanitize searchTerm for filename (replace invalid characters)
      const sanitizedSearchTerm = searchTerm.replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, '-');
      const filename = path.join(debugDir, `montecarlo-${sanitizedSearchTerm}-${timestamp}.html`);
      fs.writeFileSync(filename, html, 'utf-8');
      console.log(`📄 [MONTECARLO] Saved HTML to: ${filename}`);
      console.log(`📄 [MONTECARLO] HTML length: ${html.length} characters`);
    } catch (error: any) {
      console.warn(`⚠️ [MONTECARLO] Failed to save HTML debug file: ${error.message}`);
    }

    const $ = this.loadCheerio(html);
    const products: Product[] = [];

    console.log(`🔍 [MONTECARLO] Parsing HTML for search term: "${searchTerm}"`);
    console.log(`🔍 [MONTECARLO] HTML length: ${html.length} characters`);

    // Check if we got a login page (session expired)
    // More specific check: look for actual login form elements, not just text
    const hasLoginForm = html.includes('form.oe_login_form') || 
                        html.includes('oe_login_form') ||
                        html.includes('input[name="login"]') ||
                        html.includes('input[type="password"][name="password"]') ||
                        (html.includes('Iniciar sesión') && html.includes('oe_login_form')) ||
                        ($('form.oe_login_form').length > 0) ||
                        ($('input[name="login"][type="text"]').length > 0 && $('input[type="password"][name="password"]').length > 0);
    
    // Also check if we're on the login URL
    const isLoginPage = html.includes('/web/login') && hasLoginForm;
    
    if (isLoginPage) {
      console.warn('⚠️ [MONTECARLO] Login page detected - session may have expired');
      return {
        originCode: this.originCode,
        originName: this.originName,
        searchTerm,
        products: [],
        metadata: {
          totalFound: 0,
          error: 'Session expired - login required',
        },
      };
    }

    // Check for "no results" messages
    const pageText = $.text().toLowerCase();
    const noResultsIndicators = [
      'no se encontraron resultados',
      'no se encontraron productos',
      'sin resultados',
      'no hay resultados',
      'no results found',
      'no se encontró',
      'no hay coincidencias',
      'no products found',
      'ningún resultado',
    ];

    const hasNoResults = noResultsIndicators.some(indicator => pageText.includes(indicator));
    if (hasNoResults) {
      console.log('ℹ️ [MONTECARLO] Page indicates no results found');
      return {
        originCode: this.originCode,
        originName: this.originName,
        searchTerm,
        products: [],
        metadata: {
          totalFound: 0,
        },
      };
    }

    // Look for product elements
    // Montecarlo uses Odoo shop structure with .oe_product class
    const productSelectors = [
      '.oe_product', // Primary selector for Montecarlo products
      'section#o_wsale_products_grid .oe_product',
      '.o_wsale_product_grid_wrapper',
      '[class*="oe_product"]',
      '.product-item',
      '.product-card',
      '.product',
    ];

    let productElements: any = null;
    for (const selector of productSelectors) {
      productElements = $(selector);
      if (productElements.length > 0) {
        console.log(`🔍 [MONTECARLO] Found ${productElements.length} elements with selector: "${selector}"`);
        break;
      }
    }

    // If no product elements found, try to find any divs containing the search term
    if (!productElements || productElements.length === 0) {
      console.log('⚠️ [MONTECARLO] No product elements found with standard selectors, trying alternative...');
      
      // Try to find elements containing product-like information
      const allDivs = $('div');
      const productDivs: any[] = [];
      
      allDivs.each((_index: number, element: any) => {
        const $el = $(element);
        const text = $el.text();
        
        // Look for divs that contain product-like information
        // (has prices, product codes, or product names)
        if (
          text.includes(searchTerm.toUpperCase()) ||
          text.includes('$') ||
          text.includes('COP') ||
          text.match(/[A-Z]{1,3}\d{3,}/) // Product codes
        ) {
          productDivs.push($el);
        }
      });
      
      if (productDivs.length > 0) {
        console.log(`🔍 [MONTECARLO] Found ${productDivs.length} product-like divs`);
        productElements = productDivs;
      }
    }

    // Try table rows if no product divs found
    if (!productElements || productElements.length === 0) {
      const tableRows = $('table tbody tr, tr[data-product-id]');
      if (tableRows.length > 0) {
        console.log(`🔍 [MONTECARLO] Found ${tableRows.length} table rows`);
        productElements = tableRows;
      }
    }

    if (!productElements || productElements.length === 0) {
      console.warn(`⚠️ [MONTECARLO] No product elements found in HTML. Content length: ${html.length}, preview: ${html.substring(0, 500)}`);
      return {
        originCode: this.originCode,
        originName: this.originName,
        searchTerm,
        products: [],
        metadata: {
          totalFound: 0,
        },
      };
    }

    // Parse each product element
    productElements.each((_index: number, element: any) => {
      const product = this.extractProduct($, $(element), searchTerm);
      if (product) {
        products.push(product);
        console.log(`✅ [MONTECARLO] Product extracted: ${product.reference} - Price: ${product.price}`);
      }
    });

    console.log(`✅ [MONTECARLO] Parsed ${products.length} products`);

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
   * Extract product data from a product element
   */
  private extractProduct($: any, $product: any, searchTerm: string): Product | null {
    try {
      const productText = $product.text();
      
      // Skip if this doesn't look like a product
      if (!productText || productText.length < 10) {
        return null;
      }

      // Extract reference/code from product URL slug
      // Montecarlo URLs format: /shop/{reference}-{description-slug}-{id}
      // Example: /shop/87583926-ml-motor-de-arranque-12v-4-2kw-new-holland-7630-8030-tm-tc57-74266
      let reference = '';
      
      // First, try to get reference from product link URL
      const productLink = $product.find('a[href*="/shop/"]').first();
      if (productLink.length > 0) {
        const href = productLink.attr('href') || '';
        // Extract reference from URL: /shop/{reference}-...
        const urlMatch = href.match(/\/shop\/([^/-]+(?:-[^/-]+)?)/);
        if (urlMatch && urlMatch[1]) {
          // Get the first part before the description (usually the reference)
          const urlParts = urlMatch[1].split('-');
          if (urlParts.length > 0) {
            // Reference is usually the first part or first two parts
            // Check if it matches the search term pattern
            const potentialRef = urlParts[0] + (urlParts[1] && urlParts[1].length <= 3 ? '-' + urlParts[1] : '');
            if (potentialRef.toUpperCase().includes(searchTerm.toUpperCase()) || 
                searchTerm.toUpperCase().includes(potentialRef.toUpperCase())) {
              reference = potentialRef.toUpperCase();
            } else {
              // Try just the first part
              reference = urlParts[0].toUpperCase();
            }
          }
        }
      }

      // If no reference from URL, try to find in product text
      if (!reference) {
        const refMatch = productText.match(/\b([A-Z0-9]{4,}(?:-[A-Z0-9]{1,3})?)\b/);
        if (refMatch) {
          reference = refMatch[1];
        } else {
          // Try to find reference in headings or links
          const heading = $product.find('.o_wsale_products_item_title a, h4, h5, h6, strong, a').first().text().trim();
          if (heading) {
            const headingRefMatch = heading.match(/\b([A-Z0-9]{4,}(?:-[A-Z0-9]{1,3})?)\b/);
            if (headingRefMatch) {
              reference = headingRefMatch[1];
            } else {
              // Use search term as reference if found in product
              if (productText.toUpperCase().includes(searchTerm.toUpperCase())) {
                reference = searchTerm.toUpperCase();
              }
            }
          }
        }
      }

      if (!reference) {
        // Try to extract from data attributes
        const productId = $product.attr('data-product-id') || 
                         $product.find('[data-product-id]').attr('data-product-id') ||
                         $product.find('[data-product-template-id]').attr('data-product-template-id');
        if (productId) {
          reference = productId.toString();
        } else {
          // Last resort: use search term
          reference = searchTerm.toUpperCase();
        }
      }

      // Extract description (from product title link)
      let description = '';
      const titleLink = $product.find('.o_wsale_products_item_title a').first();
      if (titleLink.length > 0) {
        description = titleLink.text().trim();
        // Remove reference from description if it appears
        description = description.replace(new RegExp(reference.replace(/-/g, '[-]?'), 'gi'), '').trim();
        description = description.replace(/^[-–—]\s*/, '').trim();
      }
      
      // Fallback to other headings
      if (!description) {
        const heading = $product.find('h4, h5, h6, strong, a').first().text().trim();
        if (heading) {
          description = heading.replace(new RegExp(reference.replace(/-/g, '[-]?'), 'gi'), '').trim();
          description = description.replace(/^[-–—]\s*/, '').trim();
        }
      }
      
      if (!description) {
        // Try to get description from text content
        const lines = productText.split('\n').map((line: string) => line.trim()).filter((line: string) => line.length > 0);
        if (lines.length > 0) {
          description = lines[0].replace(new RegExp(reference.replace(/-/g, '[-]?'), 'gi'), '').trim();
        }
      }

      // Extract brand (look for "Marca:" or brand names)
      let brand = '';
      const brandMatch = productText.match(/Marca:\s*([A-Z][A-Z\s]+)/i);
      if (brandMatch) {
        brand = brandMatch[1].trim();
      } else {
        // Look for common brands in text
        const brands = ['BALDWIN', 'CATERPILLAR', 'CAT', 'DAF', 'KENWORTH', 'PACCAR', 'MONTECARLO'];
        for (const b of brands) {
          if (productText.includes(b)) {
            brand = b;
            break;
          }
        }
      }

      // Extract price from Montecarlo structure
      // Format: "$&nbsp;<span class="oe_currency_value">1.251.000</span>"
      let price = 0;
      
      // Try to get price from the product_price div structure
      const priceDiv = $product.find('.product_price');
      if (priceDiv.length > 0) {
        // Get the sale price (price_reduce) - it's in the h6 span
        const priceSpan = priceDiv.find('span.h6.mb-0 span.oe_currency_value').first();
        if (priceSpan.length > 0) {
          const priceText = priceSpan.text().trim().replace(/[.,]/g, '');
          const priceNum = parseInt(priceText, 10);
          if (priceNum > 0) {
            price = priceNum;
          }
        }
        
        // If not found, try the itemprop="price" hidden span
        if (price === 0) {
          const hiddenPrice = priceDiv.find('span[itemprop="price"]').first();
          if (hiddenPrice.length > 0) {
            const priceText = hiddenPrice.text().trim().replace(/[.,]/g, '');
            const priceNum = parseFloat(priceText);
            if (priceNum > 0) {
              price = Math.round(priceNum);
            }
          }
        }
      }
      
      // Fallback: try to extract from text patterns
      if (price === 0) {
        const pricePatterns = [
          /\$\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/, // $ 60571 or $ 60,571
          /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*COP/, // 60571.0 COP
          /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*\$/, // 60571 $
          /Precio[:\s]+(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/i, // Precio: 60571
        ];

        for (const pattern of pricePatterns) {
          const matches = productText.match(pattern);
          if (matches && matches[1]) {
            const priceText = matches[1].replace(/[.,]/g, '');
            const priceNum = parseInt(priceText, 10);
            if (priceNum > 0) {
              price = priceNum;
              break;
            }
          }
        }
      }

      // Extract stock/quantity
      let stock = 0;
      const stockPatterns = [
        /Stock:\s*(\d+)/i,
        /Cantidad:\s*(\d+)/i,
        /Disponible:\s*(\d+)/i,
        /Inventario:\s*(\d+)/i,
      ];

      for (const pattern of stockPatterns) {
        const match = productText.match(pattern);
        if (match && match[1]) {
          stock = parseInt(match[1], 10);
          break;
        }
      }

      // Extract use/type (e.g., "Aire", "Aceite")
      let use = '';
      const useMatch = productText.match(/Uso:\s*([^\n]+)/i);
      if (useMatch) {
        use = useMatch[1].trim();
      }

      // Normalize reference
      reference = this.normalizeReference(reference);

      // Build full description
      let fullDescription = description;
      if (brand) {
        fullDescription = `${description} - ${brand}`.trim();
      }
      if (use) {
        fullDescription = `${fullDescription} (${use})`.trim();
      }

      // Extract product URL
      let productUrl = '';
      // Montecarlo uses links like: /shop/{reference}-{description-slug}-{id}
      const linkEl = $product.find('a[href*="/shop/"]').first();
      if (linkEl.length > 0) {
        productUrl = linkEl.attr('href') || '';
        if (productUrl && !productUrl.startsWith('http')) {
          productUrl = `https://portal.imm.com.co${productUrl}`; // Prepend base URL if relative
        }
      }

      // Extract image URL
      let imageUrl = '';
      const imgEl = $product.find('img').first();
      if (imgEl.length > 0) {
        imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || '';
        if (imageUrl && !imageUrl.startsWith('http')) {
          imageUrl = `https://portal.imm.com.co${imageUrl}`; // Prepend base URL if relative
        }
      }

      // Determine hasStock
      const hasStock = stock > 0;

      return {
        origin: this.originCode,
        reference,
        description: fullDescription || description || reference,
        price,
        stock,
        hasStock,
        imageUrl: imageUrl || undefined,
        link: productUrl || undefined,
        brand: brand || undefined,
        rawData: {
          use: use || undefined,
        },
      };
    } catch (error: any) {
      console.warn(`⚠️ [MONTECARLO] Error extracting product:`, error.message);
      return null;
    }
  }

  /**
   * Normalize reference code
   * Override base implementation if needed, otherwise use protected method from BaseParser
   */
  protected normalizeReference(ref: string): string {
    return ref.trim().toUpperCase().replace(/\s+/g, '');
  }
}

