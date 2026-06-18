import { BaseParser } from './BaseParser';
import { ParseResult, Product } from './types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Parser for DONSSON (donsson.com)
 * Handles HTML responses from their shop search system
 */
export class DonssonParser extends BaseParser {
  readonly originCode = 'DONSSON';
  readonly originName = 'Donsson';

  canParse(content: string | object): boolean {
    if (typeof content !== 'string') return false;

    // Check for DONSSON-specific markers
    return (
      content.includes('donsson.com') ||
      content.includes('DONSSON') ||
      content.includes('select2-input') ||
      content.includes('s2id_autogen1_search') ||
      content.includes('FILTRO') ||
      content.includes('BALDWIN')
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
      const filename = path.join(debugDir, `donsson-${searchTerm}-${timestamp}.html`);
      fs.writeFileSync(filename, html, 'utf-8');
      console.log(`📄 [DONSSON] Saved HTML to: ${filename}`);
      console.log(`📄 [DONSSON] HTML length: ${html.length} characters`);
      console.log(`📄 [DONSSON] HTML preview (first 500 chars): ${html.substring(0, 500)}`);
      
      // Log file size for reference
      const stats = fs.statSync(filename);
      console.log(`📄 [DONSSON] File size: ${(stats.size / 1024).toFixed(2)} KB`);
    } catch (error: any) {
      console.warn(`⚠️ [DONSSON] Failed to save HTML debug file: ${error.message}`);
      console.warn(`⚠️ [DONSSON] Error stack: ${error.stack}`);
    }

    const $ = this.loadCheerio(html);
    const products: Product[] = [];

    console.log(`🔍 [DONSSON] Parsing HTML for search term: "${searchTerm}"`);
    console.log(`🔍 [DONSSON] HTML length: ${html.length} characters`);

    // Check if we got a login page (session expired)
    // Be more specific - check for actual login form elements, not just the word "login" in navigation
    const hasLoginForm = html.includes('class="oe_login_form"') || 
                         html.includes('action="/web/login"') ||
                         (html.includes('id="login"') && html.includes('id="password"') && html.includes('type="password"'));
    
    // Also check if we're on the actual login URL
    const isLoginUrl = html.includes('<form class="oe_login_form"');
    
    if (hasLoginForm && isLoginUrl) {
      console.warn('⚠️ [DONSSON] Login page detected - session may have expired');
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
    ];

    const hasNoResults = noResultsIndicators.some(indicator => pageText.includes(indicator));
    if (hasNoResults) {
      console.log('ℹ️ [DONSSON] Page indicates no results found');
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

    // Look for product cards/items
    // Based on the website structure, products appear to be in cards with sale badges
    // DONSSON uses .oe_product.oe_list.oe_product_cart for product cards
    const productSelectors = [
      '.oe_product',
      '.product-item',
      '.product-card',
      '.product',
      '[class*="product"]',
      '[class*="item"]',
      'div:has(> h4, > h5, > h6)',
      'div:has(strong)',
    ];

    let productElements: any = null;
    for (const selector of productSelectors) {
      productElements = $(selector);
      if (productElements.length > 0) {
        console.log(`🔍 [DONSSON] Found ${productElements.length} elements with selector: "${selector}"`);
        break;
      }
    }

    // If no product elements found, try to find any divs containing the search term
    if (!productElements || productElements.length === 0) {
      console.log('⚠️ [DONSSON] No product elements found with standard selectors, trying alternative...');
      
      // Try to find elements containing product-like information
      const allDivs = $('div');
      const productDivs: any[] = [];
      
      allDivs.each((_index: number, element: any) => {
        const $el = $(element);
        const text = $el.text();
        
        // Look for divs that contain product-like information
        // (has brand names, prices, or product codes)
        if (
          text.includes('FILTRO') ||
          text.includes('BALDWIN') ||
          text.includes('$') ||
          text.includes('COP') ||
          text.match(/[A-Z]{1,3}\d{3,}/) // Product codes like GX2518
        ) {
          productDivs.push($el);
        }
      });
      
      if (productDivs.length > 0) {
        console.log(`🔍 [DONSSON] Found ${productDivs.length} product-like divs`);
        productElements = productDivs;
      }
    }

    if (!productElements || productElements.length === 0) {
      console.warn(`⚠️ [DONSSON] No product elements found in HTML. Content length: ${html.length}, preview: ${html.substring(0, 500)}`);
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
        console.log(`✅ [DONSSON] Product extracted: ${product.reference} - Price: ${product.price}`);
      }
    });

    console.log(`✅ [DONSSON] Parsed ${products.length} products`);

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

      // Extract link from product card
      // DONSSON uses a[itemprop="name"] or a[itemprop="url"] for product links
      let productLink = '';
      const linkElement = $product.find('a[itemprop="name"], a[itemprop="url"]').first();
      if (linkElement.length > 0) {
        const href = linkElement.attr('href');
        if (href) {
          // Make absolute URL if relative
          productLink = href.startsWith('http') ? href : `https://www.donsson.com${href}`;
        }
      }

      // Extract reference/code (usually in the title or first line)
      // Look for patterns like "GX2518", "GS782", etc.
      let reference = '';
      const refMatch = productText.match(/\b([A-Z]{1,3}\d{3,})\b/);
      if (refMatch) {
        reference = refMatch[1];
      } else {
        // Try to find reference in headings or link text
        const titleText = linkElement.length > 0 ? linkElement.text().trim() : '';
        const heading = titleText || $product.find('h4, h5, h6, strong').first().text().trim();
        if (heading) {
          const headingRefMatch = heading.match(/\b([A-Z]{1,3}\d{3,})\b/);
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

      if (!reference) {
        return null; // Skip if no reference found
      }

      // Extract description (usually in heading or link text)
      let description = '';
      const titleText = linkElement.length > 0 ? linkElement.text().trim() : '';
      const heading = titleText || $product.find('h4, h5, h6, strong').first().text().trim();
      if (heading) {
        // Get full title and remove reference to get description
        description = heading.replace(new RegExp(reference, 'gi'), '').trim();
        // Clean up description
        description = description.replace(/^[-–—]\s*/, '').trim();
        // If description is empty, use the full title without reference
        if (!description && heading) {
          description = heading.trim();
        }
      }
      
      if (!description) {
        // Try to get description from text content
        const lines = productText.split('\n').map((line: string) => line.trim()).filter((line: string) => line.length > 0);
        if (lines.length > 0) {
          description = lines[0].replace(new RegExp(reference, 'gi'), '').trim();
        }
      }

      // Extract brand (look for "Marca: BALDWIN" or similar)
      let brand = '';
      const brandMatch = productText.match(/Marca:\s*([A-Z][A-Z\s]+)/i);
      if (brandMatch) {
        brand = brandMatch[1].trim();
      } else {
        // Look for common brands in text
        const brands = ['BALDWIN', 'CATERPILLAR', 'CAT', 'DAF', 'KENWORTH', 'PACCAR'];
        for (const b of brands) {
          if (productText.includes(b)) {
            brand = b;
            break;
          }
        }
      }

      // Extract price
      // Format: "~~$ 101031~~ $ 60571" or "$ 60571" or "60571.0 COP"
      // DONSSON shows: <del>$ 101,031</del> $ 60,571 (original price struck through, sale price in red)
      let price = 0;
      
      // First, try to get all prices to find the sale price (last one)
      const allPrices = productText.match(/\$\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/g);
      if (allPrices && allPrices.length > 0) {
        // Get the last price (sale price) - this is the current price
        const lastPriceMatch = allPrices[allPrices.length - 1].match(/\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?/);
        if (lastPriceMatch) {
          const priceText = lastPriceMatch[0].replace(/[.,]/g, '');
          const priceNum = parseInt(priceText, 10);
          if (priceNum > 0) {
            price = priceNum;
          }
        }
      }
      
      // If no price found yet, try other patterns
      if (price === 0) {
        const pricePatterns = [
          /\$\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/, // $ 60571 or $ 60,571
          /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*COP/, // 60571.0 COP
          /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*\$/, // 60571 $
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
      // Format: "6 60571.0 COP" (quantity price currency) or just a number
      let stock = 0;
      const stockPatterns = [
        /^(\d+)\s+\d+\.\d+\s*COP/, // "6 60571.0 COP"
        /Stock:\s*(\d+)/i,
        /Cantidad:\s*(\d+)/i,
        /Disponible:\s*(\d+)/i,
      ];

      for (const pattern of stockPatterns) {
        const match = productText.match(pattern);
        if (match && match[1]) {
          stock = parseInt(match[1], 10);
          break;
        }
      }

      // Extract use/type (e.g., "Aire", "Aceite", "Sep. Agua /Comb")
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

      return {
        origin: this.originCode,
        reference,
        description: fullDescription || description || reference,
        price,
        stock,
        hasStock: stock > 0,
        location: '', // DONSSON doesn't seem to show location in product cards
        brand: brand || undefined,
        link: productLink || undefined,
        rawData: {
          use: use || undefined,
        },
      };
    } catch (error: any) {
      console.warn(`⚠️ [DONSSON] Error extracting product:`, error.message);
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

